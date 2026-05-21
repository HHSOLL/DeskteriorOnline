"use client";

import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { Geometry, Base, Subtraction } from "@react-three/csg";
import { RuntimeTextureLoader } from "../../../lib/loaders/RuntimeTextureLoader";
import { configureRuntimeAssetLoaders } from "../../../lib/loaders/AssetLoader";
import { useEditorStore } from "../../../lib/stores/useEditorStore";
import { useShellSelector } from "../../../lib/stores/scene-slices";
import type { Wall } from "../../../lib/stores/useSceneStore";
import { getWallRenderPlacement } from "../../../lib/geometry/wall-placement";
import {
  resolveOpeningBottomOffset,
  resolveOpeningRange,
  resolveTrimSegments,
  resolveWallCornerCaps,
  resolveWallInteriorSide
} from "../../../lib/geometry/wall-finish";
import {
  WALL_TEXTURE_PRESETS,
  resolveRuntimeTextureSet,
  type RuntimeTextureSet,
  type RoomShellTexturePreset
} from "../../../lib/textures/room-shell-textures";

const BASEBOARD_HEIGHT = 0.11;
const BASEBOARD_DEPTH = 0.035;
const CROWN_TRIM_HEIGHT = 0.07;
const CROWN_TRIM_DEPTH = 0.032;
const DIORAMA_PANEL_DEPTH = 0.026;
const DIORAMA_PANEL_MARGIN = 0.22;
const DIORAMA_PANEL_MIN_SEGMENT = 0.84;
const TRIM_OVERLAP = 0.006;

type LoadedTextureSet = {
  map: THREE.Texture;
  roughnessMap: THREE.Texture;
  normalMap: THREE.Texture;
  bumpMap: THREE.Texture;
};

function textureSetKey(textureUrls: RuntimeTextureSet | null) {
  return textureUrls
    ? `${textureUrls.map}|${textureUrls.roughnessMap}|${textureUrls.normalMap}|${textureUrls.bumpMap}`
    : "solid";
}

function loadTexture(url: string) {
  return new Promise<THREE.Texture>((resolve, reject) => {
    const loader = new RuntimeTextureLoader();
    loader.load(url, resolve, undefined, reject);
  });
}

function useRetainedTextureSet(textureUrls: RuntimeTextureSet | null) {
  const [textures, setTextures] = useState<LoadedTextureSet | null>(null);
  const key = textureSetKey(textureUrls);

  useEffect(() => {
    if (!textureUrls) {
      setTextures(null);
      return undefined;
    }

    let cancelled = false;
    Promise.all([
      loadTexture(textureUrls.map),
      loadTexture(textureUrls.roughnessMap),
      loadTexture(textureUrls.normalMap),
      loadTexture(textureUrls.bumpMap)
    ])
      .then(([map, roughnessMap, normalMap, bumpMap]) => {
        const nextTextures = { map, roughnessMap, normalMap, bumpMap };
        if (cancelled) {
          Object.values(nextTextures).forEach((texture) => texture.dispose());
          return;
        }
        setTextures(nextTextures);
      })
      .catch(() => {
        if (!cancelled) {
          setTextures((current) => current);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [key, textureUrls]);

  useEffect(() => {
    return () => {
      Object.values(textures ?? {}).forEach((texture) => texture.dispose());
    };
  }, [textures]);

  return textures;
}

function hasRenderableTexture(texture: THREE.Texture | undefined) {
  if (!texture) return false;
  const sourceData = (texture.source as { data?: unknown } | undefined)?.data;
  return Boolean((texture as { image?: unknown }).image ?? sourceData);
}

function resolveBuilderCutawayWalls(walls: Wall[]) {
  if (walls.length <= 2) return walls;

  const points = walls.flatMap((wall) => [wall.start, wall.end]);
  const maxX = Math.max(...points.map(([x]) => x));
  const maxZ = Math.max(...points.map(([, z]) => z));
  const minX = Math.min(...points.map(([x]) => x));
  const minZ = Math.min(...points.map(([, z]) => z));
  const epsilon = Math.max(0.06, Math.max(maxX - minX, maxZ - minZ) * 0.01);
  const cutawayWalls = walls.filter((wall) => {
    const midpointX = (wall.start[0] + wall.end[0]) / 2;
    const midpointZ = (wall.start[1] + wall.end[1]) / 2;
    return midpointX < maxX - epsilon && midpointZ < maxZ - epsilon;
  });

  return cutawayWalls.length >= 2 ? cutawayWalls : walls;
}

function cloneTextureSet(textures: LoadedTextureSet): LoadedTextureSet {
  return {
    map: textures.map.clone(),
    roughnessMap: textures.roughnessMap.clone(),
    normalMap: textures.normalMap.clone(),
    bumpMap: textures.bumpMap.clone()
  };
}

function configureSurfaceTextures(
  textures: LoadedTextureSet,
  textureConfig: RoomShellTexturePreset,
  width: number,
  height: number,
  anisotropy: number
) {
  const repeatX = Math.max(1, width / Math.max(0.25, textureConfig.repeatScaleMeters[0]));
  const repeatY = Math.max(1, height / Math.max(0.25, textureConfig.repeatScaleMeters[1]));

  Object.values(textures).forEach((texture) => {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeatX, repeatY);
    texture.center.set(0.5, 0.5);
    texture.rotation = textureConfig.rotationRadians;
    texture.anisotropy = anisotropy;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
  });

  textures.map.colorSpace = THREE.SRGBColorSpace;
  textures.roughnessMap.colorSpace = THREE.NoColorSpace;
  textures.normalMap.colorSpace = THREE.NoColorSpace;
  textures.bumpMap.colorSpace = THREE.NoColorSpace;
  Object.values(textures).forEach((texture) => {
    texture.needsUpdate = true;
  });
}

function WallMesh({
  wallId,
  textureConfig,
  textures,
  hasRenderableTextureSet,
  isWhitePreview
}: {
  wallId: string;
  textureConfig: RoomShellTexturePreset;
  textures: LoadedTextureSet | null;
  hasRenderableTextureSet: boolean;
  isWhitePreview: boolean;
}) {
  const walls = useShellSelector((slice) => slice.walls);
  const openings = useShellSelector((slice) => slice.openings);
  const floors = useShellSelector((slice) => slice.floors);
  const scale = useShellSelector((slice) => slice.scale);
  const wall = useMemo(() => walls.find((item) => item.id === wallId), [wallId, walls]);

  const wallOpenings = useMemo(() => openings.filter((opening) => opening.wallId === wallId), [openings, wallId]);
  const useCleanPaintMaterial =
    textureConfig.useCategory === "commercial_default" && /clean (paint|plaster)/i.test(textureConfig.category);

  const wallRender = useMemo(() => {
    if (!wall) {
      return null;
    }

    const placement = getWallRenderPlacement(wall, floors, scale);
    const length = Math.max(0.05, placement.length);
    const thickness = Math.max(0.02, wall.thickness * scale);
    const height = (wall.height > 0 ? wall.height : 2.8) * scale;
    const geometry = new THREE.BoxGeometry(length, height, thickness);
    geometry.translate(length / 2, height / 2, 0);
    geometry.computeVertexNormals();

    const holes = wallOpenings
      .map((opening) => {
        const offset = Math.max(0, opening.offset * scale + placement.startInset);
        const width = opening.width * scale;
        const baseHeight = opening.height * scale;
        if (width <= 0.05 || baseHeight <= 0.05) return null;

        const usableWidth = Math.min(width, length - offset);
        if (usableWidth <= 0.05) return null;

        const bottomOffset = resolveOpeningBottomOffset(opening, scale);
        const holeHeight = Math.min(baseHeight, height - bottomOffset);
        if (holeHeight <= 0.05) return null;

        const depth = thickness + 0.12;
        const holeGeometry = new THREE.BoxGeometry(usableWidth, holeHeight, depth);
        holeGeometry.translate(offset + usableWidth / 2, bottomOffset + holeHeight / 2, 0);
        return holeGeometry;
      })
      .filter((entry): entry is THREE.BoxGeometry => Boolean(entry));

    return {
      baseGeometry: geometry,
      holeGeometries: holes,
      position: [placement.start[0], 0, placement.start[1]] as [number, number, number],
      rotation: [0, -placement.angle, 0] as [number, number, number],
      length,
      height
    };
  }, [floors, scale, wall, wallOpenings]);

  const materialBundle = useMemo(() => {
    if (!wallRender) return null;

    if (isWhitePreview || useCleanPaintMaterial || !textures || !hasRenderableTextureSet) {
      return {
        material: new THREE.MeshStandardMaterial({
          color: textureConfig.color ?? textureConfig.topColor,
          roughness: 0.86,
          metalness: 0.02,
          envMapIntensity: 0.36,
          side: THREE.DoubleSide
        }),
        textures: []
      };
    }

    const clonedTextures = cloneTextureSet(textures);
    configureSurfaceTextures(clonedTextures, textureConfig, wallRender.length, wallRender.height, 4);

    return {
      material: new THREE.MeshStandardMaterial({
        color: textureConfig.color,
        map: clonedTextures.map,
        roughnessMap: clonedTextures.roughnessMap,
        normalMap: clonedTextures.normalMap,
        bumpMap: clonedTextures.bumpMap,
        bumpScale: textureConfig.bumpScale,
        roughness: textureConfig.roughness,
        normalScale: new THREE.Vector2(textureConfig.normalScale, textureConfig.normalScale),
        envMapIntensity: textureConfig.envMapIntensity,
        side: THREE.DoubleSide
      }),
      textures: Object.values(clonedTextures)
    };
  }, [hasRenderableTextureSet, isWhitePreview, textureConfig, textures, useCleanPaintMaterial, wallRender]);

  useEffect(() => {
    return () => {
      wallRender?.baseGeometry?.dispose();
      wallRender?.holeGeometries.forEach((geometry) => geometry.dispose());
      materialBundle?.material.dispose();
      materialBundle?.textures.forEach((texture) => texture.dispose());
    };
  }, [materialBundle, wallRender]);

  if (!wall || !wallRender?.baseGeometry || !materialBundle) return null;

  return (
    <mesh name={`wall:${wall.id}`} position={wallRender.position} rotation={wallRender.rotation} castShadow receiveShadow>
      <Geometry computeVertexNormals>
        <Base geometry={wallRender.baseGeometry} />
        {wallRender.holeGeometries.map((geometry, index) => (
          <Subtraction key={`${wall.id}-hole-${index}`} geometry={geometry} />
        ))}
      </Geometry>
      <primitive object={materialBundle.material} attach="material" />
    </mesh>
  );
}

function TopWallFootprint({
  wallId,
  color
}: {
  wallId: string;
  color: string;
}) {
  const walls = useShellSelector((slice) => slice.walls);
  const floors = useShellSelector((slice) => slice.floors);
  const scale = useShellSelector((slice) => slice.scale);
  const wall = useMemo(() => walls.find((item) => item.id === wallId), [wallId, walls]);

  const strip = useMemo(() => {
    if (!wall) {
      return null;
    }
    const placement = getWallRenderPlacement(wall, floors, scale);
    const thickness = Math.max(0.14, wall.thickness * scale);

    return {
      position: [
        placement.start[0] + placement.direction[0] * (placement.length / 2),
        0.018,
        placement.start[1] + placement.direction[1] * (placement.length / 2)
      ] as [number, number, number],
      rotation: [0, -placement.angle, 0] as [number, number, number],
      length: placement.length,
      thickness
    };
  }, [floors, scale, wall]);

  if (!strip) return null;

  return (
    <mesh
      name={`top-wall:${wallId}`}
      position={strip.position}
      rotation={strip.rotation}
      receiveShadow={false}
      castShadow={false}
    >
      <boxGeometry args={[strip.length, 0.036, strip.thickness]} />
      <meshStandardMaterial color={color} roughness={0.94} metalness={0.02} />
    </mesh>
  );
}

function BaseboardTrim({
  wallId,
  color
}: {
  wallId: string;
  color: string;
}) {
  const walls = useShellSelector((slice) => slice.walls);
  const openings = useShellSelector((slice) => slice.openings);
  const floors = useShellSelector((slice) => slice.floors);
  const scale = useShellSelector((slice) => slice.scale);
  const wall = useMemo(() => walls.find((item) => item.id === wallId), [wallId, walls]);
  const wallOpenings = useMemo(() => openings.filter((opening) => opening.wallId === wallId), [openings, wallId]);

  const trim = useMemo(() => {
    if (!wall) return null;

    const placement = getWallRenderPlacement(wall, floors, scale);
    const length = Math.max(0.05, placement.length);
    const thickness = Math.max(0.02, wall.thickness * scale);
    const interiorSide = resolveWallInteriorSide(wall, placement, scale);
    const blockedRanges = wallOpenings
      .map((opening) => {
        const bottomOffset = resolveOpeningBottomOffset(opening, scale);

        if (opening.type !== "door" && bottomOffset > BASEBOARD_HEIGHT + 0.03) {
          return null;
        }

        return resolveOpeningRange(opening, placement, scale);
      })
      .filter((range): range is { start: number; end: number } => Boolean(range));

    return {
      position: [placement.start[0], 0, placement.start[1]] as [number, number, number],
      rotation: [0, -placement.angle, 0] as [number, number, number],
      localZ: interiorSide * (thickness / 2 + BASEBOARD_DEPTH / 2 - TRIM_OVERLAP),
      segments: resolveTrimSegments(length, blockedRanges)
    };
  }, [floors, scale, wall, wallOpenings]);

  if (!trim || trim.segments.length === 0) return null;

  return (
    <group name={`baseboard:${wallId}`} position={trim.position} rotation={trim.rotation}>
      {trim.segments.map((segment, index) => (
        <mesh
          key={`${wallId}-baseboard-${index}`}
          position={[segment.start + segment.length / 2, BASEBOARD_HEIGHT / 2, trim.localZ]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[segment.length, BASEBOARD_HEIGHT, BASEBOARD_DEPTH]} />
          <meshStandardMaterial color={color} roughness={0.72} metalness={0.01} envMapIntensity={0.32} />
        </mesh>
      ))}
    </group>
  );
}

function CrownTrim({
  wallId,
  color
}: {
  wallId: string;
  color: string;
}) {
  const walls = useShellSelector((slice) => slice.walls);
  const floors = useShellSelector((slice) => slice.floors);
  const scale = useShellSelector((slice) => slice.scale);
  const wall = useMemo(() => walls.find((item) => item.id === wallId), [wallId, walls]);

  const trim = useMemo(() => {
    if (!wall) return null;

    const placement = getWallRenderPlacement(wall, floors, scale);
    const length = Math.max(0.05, placement.length);
    const thickness = Math.max(0.02, wall.thickness * scale);
    const height = (wall.height > 0 ? wall.height : 2.8) * scale;
    const interiorSide = resolveWallInteriorSide(wall, placement, scale);

    return {
      position: [placement.start[0], 0, placement.start[1]] as [number, number, number],
      rotation: [0, -placement.angle, 0] as [number, number, number],
      localY: Math.max(BASEBOARD_HEIGHT + CROWN_TRIM_HEIGHT, height - CROWN_TRIM_HEIGHT / 2 - 0.025),
      localZ: interiorSide * (thickness / 2 + CROWN_TRIM_DEPTH / 2 - TRIM_OVERLAP),
      length
    };
  }, [floors, scale, wall]);

  if (!trim) return null;

  return (
    <group name={`crown-trim:${wallId}`} position={trim.position} rotation={trim.rotation}>
      <mesh position={[trim.length / 2, trim.localY, trim.localZ]} castShadow receiveShadow>
        <boxGeometry args={[trim.length, CROWN_TRIM_HEIGHT, CROWN_TRIM_DEPTH]} />
        <meshStandardMaterial color={color} roughness={0.7} metalness={0.02} envMapIntensity={0.34} />
      </mesh>
    </group>
  );
}

function DioramaWallPanels({
  wallId,
  wallIndex
}: {
  wallId: string;
  wallIndex: number;
}) {
  const walls = useShellSelector((slice) => slice.walls);
  const openings = useShellSelector((slice) => slice.openings);
  const floors = useShellSelector((slice) => slice.floors);
  const scale = useShellSelector((slice) => slice.scale);
  const wall = useMemo(() => walls.find((item) => item.id === wallId), [wallId, walls]);
  const wallOpenings = useMemo(() => openings.filter((opening) => opening.wallId === wallId), [openings, wallId]);

  const panelGroup = useMemo(() => {
    if (!wall) return null;

    const placement = getWallRenderPlacement(wall, floors, scale);
    const length = Math.max(0.05, placement.length);
    const thickness = Math.max(0.02, wall.thickness * scale);
    const height = (wall.height > 0 ? wall.height : 2.8) * scale;
    const interiorSide = resolveWallInteriorSide(wall, placement, scale);
    const blockedRanges = wallOpenings
      .map((opening) => resolveOpeningRange(opening, placement, scale))
      .filter((range): range is { start: number; end: number } => Boolean(range));
    const panelSegments = resolveTrimSegments(length, blockedRanges)
      .map((segment) => ({
        start: segment.start + DIORAMA_PANEL_MARGIN,
        length: segment.length - DIORAMA_PANEL_MARGIN * 2
      }))
      .filter((segment) => segment.length >= DIORAMA_PANEL_MIN_SEGMENT)
      .sort((a, b) => b.length - a.length)
      .slice(0, length > 2.4 ? 2 : 1);

    const panelY = Math.min(Math.max(1.12, height * 0.52), Math.max(1.12, height - 0.58));
    const faceOffset = interiorSide * (DIORAMA_PANEL_DEPTH / 2 + 0.006);
    const panels = panelSegments.map((segment, index) => {
      const panelWidth = Math.min(index === 0 ? 0.68 : 0.48, Math.max(0.42, segment.length * 0.42));
      const panelHeight = Math.min(0.48, Math.max(0.3, panelWidth * 0.7));
      const preferredX = segment.start + segment.length * (index === 0 ? 0.44 : 0.64);
      const localX = Math.min(
        segment.start + segment.length - panelWidth / 2,
        Math.max(segment.start + panelWidth / 2, preferredX)
      );

      return {
        id: `${wallId}-panel-${index}`,
        localX,
        panelWidth,
        panelHeight,
        paletteIndex: (wallIndex + index) % 3
      };
    });

    return {
      position: [placement.start[0], 0, placement.start[1]] as [number, number, number],
      rotation: [0, -placement.angle, 0] as [number, number, number],
      localY: panelY,
      localZ: interiorSide * (thickness / 2 + DIORAMA_PANEL_DEPTH / 2 - TRIM_OVERLAP),
      faceOffset,
      panels
    };
  }, [floors, scale, wall, wallId, wallIndex, wallOpenings]);

  if (!panelGroup || panelGroup.panels.length === 0) return null;

  const palettes = [
    { frame: "#7a5a46", matte: "#f1e5d4", art: "#e77453", accent: "#2f4f65" },
    { frame: "#3d4754", matte: "#e8eef1", art: "#6fa6ad", accent: "#d9a451" },
    { frame: "#73545f", matte: "#f0dfdf", art: "#c95f80", accent: "#36406b" }
  ];

  return (
    <group name={`diorama-wall-panels:${wallId}`} position={panelGroup.position} rotation={panelGroup.rotation}>
      {panelGroup.panels.map((panel) => {
        const palette = palettes[panel.paletteIndex] ?? palettes[0];
        return (
          <group
            key={panel.id}
            position={[panel.localX, panelGroup.localY, panelGroup.localZ]}
          >
            <mesh castShadow receiveShadow>
              <boxGeometry args={[panel.panelWidth + 0.07, panel.panelHeight + 0.07, DIORAMA_PANEL_DEPTH]} />
              <meshStandardMaterial color={palette.frame} roughness={0.58} metalness={0.04} envMapIntensity={0.28} />
            </mesh>
            <mesh position={[0, 0, panelGroup.faceOffset * 0.92]} castShadow={false} receiveShadow>
              <boxGeometry args={[panel.panelWidth, panel.panelHeight, 0.008]} />
              <meshStandardMaterial color={palette.matte} roughness={0.86} metalness={0.01} envMapIntensity={0.18} />
            </mesh>
            <mesh position={[panel.panelWidth * 0.08, panel.panelHeight * 0.06, panelGroup.faceOffset * 1.12]} castShadow={false}>
              <boxGeometry args={[panel.panelWidth * 0.66, panel.panelHeight * 0.52, 0.01]} />
              <meshStandardMaterial color={palette.art} roughness={0.68} metalness={0.02} envMapIntensity={0.22} />
            </mesh>
            <mesh position={[-panel.panelWidth * 0.2, -panel.panelHeight * 0.18, panelGroup.faceOffset * 1.18]} castShadow={false}>
              <boxGeometry args={[panel.panelWidth * 0.2, panel.panelHeight * 0.16, 0.012]} />
              <meshStandardMaterial color={palette.accent} roughness={0.62} metalness={0.02} envMapIntensity={0.24} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function CornerCapColumns({ color, walls }: { color: string; walls: Wall[] }) {
  const scale = useShellSelector((slice) => slice.scale);
  const caps = useMemo(() => resolveWallCornerCaps(walls, scale), [scale, walls]);

  if (caps.length === 0) return null;

  return (
    <group name="wall-corner-caps">
      {caps.map((cap) => (
        <mesh
          key={cap.id}
          name={`wall-corner-cap:${cap.id}`}
          position={[cap.position[0], cap.height / 2, cap.position[1]]}
          rotation={[0, Math.PI / 8, 0]}
          castShadow
          receiveShadow
        >
          <cylinderGeometry args={[cap.radius, cap.radius, cap.height, 8]} />
          <meshStandardMaterial color={color} roughness={0.78} metalness={0.01} envMapIntensity={0.3} />
        </mesh>
      ))}
    </group>
  );
}

function DetailedWalls({
  wallMaterialIndex,
  walls,
  showDioramaDetails
}: {
  wallMaterialIndex: number;
  walls: Wall[];
  showDioramaDetails: boolean;
}) {
  const isWhitePreview = wallMaterialIndex < 0;
  const gl = useThree((state) => state.gl);
  const textureConfig =
    WALL_TEXTURE_PRESETS[wallMaterialIndex % WALL_TEXTURE_PRESETS.length] ?? WALL_TEXTURE_PRESETS[0];
  const baseboardColor = isWhitePreview ? "#f2ede4" : "#e8dfd3";
  const cornerCapColor = isWhitePreview ? "#f5f0e9" : "#eadfd2";
  configureRuntimeAssetLoaders(gl);
  const textureUrls = useMemo(
    () => (isWhitePreview ? null : resolveRuntimeTextureSet(textureConfig)),
    [isWhitePreview, textureConfig]
  );
  const textures = useRetainedTextureSet(textureUrls);
  const hasRenderableTextureSet = useMemo(
    () =>
      Boolean(
        textures &&
          hasRenderableTexture(textures.map) &&
          hasRenderableTexture(textures.roughnessMap) &&
          hasRenderableTexture(textures.normalMap) &&
          hasRenderableTexture(textures.bumpMap)
      ),
    [textures]
  );

  return (
    <group>
      {walls.map((wall) => (
        <WallMesh
          key={wall.id}
          wallId={wall.id}
          textureConfig={textureConfig}
          textures={textures}
          hasRenderableTextureSet={hasRenderableTextureSet}
          isWhitePreview={isWhitePreview}
        />
      ))}
      {walls.map((wall) => (
        <BaseboardTrim key={`${wall.id}-baseboard`} wallId={wall.id} color={baseboardColor} />
      ))}
      {showDioramaDetails
        ? walls.map((wall) => (
            <CrownTrim key={`${wall.id}-crown-trim`} wallId={wall.id} color="#eee4d8" />
          ))
        : null}
      {showDioramaDetails
        ? walls.map((wall, index) => (
            <DioramaWallPanels key={`${wall.id}-diorama-panels`} wallId={wall.id} wallIndex={index} />
          ))
        : null}
      <CornerCapColumns color={cornerCapColor} walls={walls} />
    </group>
  );
}

function FallbackWalls({
  wallMaterialIndex,
  walls,
  showDioramaDetails
}: {
  wallMaterialIndex: number;
  walls: Wall[];
  showDioramaDetails: boolean;
}) {
  const isWhitePreview = wallMaterialIndex < 0;
  const textureConfig =
    WALL_TEXTURE_PRESETS[wallMaterialIndex % WALL_TEXTURE_PRESETS.length] ?? WALL_TEXTURE_PRESETS[0];
  const baseboardColor = isWhitePreview ? "#f2ede4" : "#e8dfd3";
  const cornerCapColor = isWhitePreview ? "#f5f0e9" : "#eadfd2";

  return (
    <group>
      {walls.map((wall) => (
        <WallMesh
          key={wall.id}
          wallId={wall.id}
          textureConfig={textureConfig}
          textures={null}
          hasRenderableTextureSet={false}
          isWhitePreview={isWhitePreview}
        />
      ))}
      {walls.map((wall) => (
        <BaseboardTrim key={`${wall.id}-baseboard`} wallId={wall.id} color={baseboardColor} />
      ))}
      {showDioramaDetails
        ? walls.map((wall) => <CrownTrim key={`${wall.id}-crown-trim`} wallId={wall.id} color="#eee4d8" />)
        : null}
      {showDioramaDetails
        ? walls.map((wall, index) => (
            <DioramaWallPanels key={`${wall.id}-diorama-panels`} wallId={wall.id} wallIndex={index} />
          ))
        : null}
      <CornerCapColumns color={cornerCapColor} walls={walls} />
    </group>
  );
}

function ProceduralWallBase({ useTextureFallback }: { useTextureFallback: boolean }) {
  const viewMode = useEditorStore((state) => state.viewMode);
  const wallMaterialIndex = useShellSelector((slice) => slice.wallMaterialIndex);
  const walls = useShellSelector((slice) => slice.walls);
  const visibleWalls = useMemo(
    () => (viewMode === "builder-preview" ? resolveBuilderCutawayWalls(walls) : walls),
    [viewMode, walls]
  );
  const showDioramaDetails = viewMode === "builder-preview";
  const topWallColor =
    wallMaterialIndex < 0
      ? "#f2efea"
      : WALL_TEXTURE_PRESETS[wallMaterialIndex % WALL_TEXTURE_PRESETS.length]?.topColor ?? "#cfc9c1";

  if (viewMode === "top") {
    return (
      <group>
        {useTextureFallback ? (
          <FallbackWalls wallMaterialIndex={wallMaterialIndex} walls={walls} showDioramaDetails={false} />
        ) : (
          <DetailedWalls wallMaterialIndex={wallMaterialIndex} walls={walls} showDioramaDetails={false} />
        )}
        {walls.map((wall) => (
          <TopWallFootprint key={wall.id} wallId={wall.id} color={topWallColor} />
        ))}
      </group>
    );
  }

  return useTextureFallback ? (
    <FallbackWalls
      wallMaterialIndex={wallMaterialIndex}
      walls={visibleWalls}
      showDioramaDetails={showDioramaDetails}
    />
  ) : (
    <DetailedWalls
      wallMaterialIndex={wallMaterialIndex}
      walls={visibleWalls}
      showDioramaDetails={showDioramaDetails}
    />
  );
}

export function ProceduralWallFallback() {
  return <ProceduralWallBase useTextureFallback />;
}

export default function ProceduralWall() {
  return <ProceduralWallBase useTextureFallback={false} />;
}
