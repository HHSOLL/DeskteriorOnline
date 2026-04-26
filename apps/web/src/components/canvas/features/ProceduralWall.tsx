"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useLoader, useThree } from "@react-three/fiber";
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
  type RoomShellTexturePreset
} from "../../../lib/textures/room-shell-textures";

const BASEBOARD_HEIGHT = 0.11;
const BASEBOARD_DEPTH = 0.035;
const TRIM_OVERLAP = 0.006;

type LoadedTextureSet = {
  map: THREE.Texture;
  roughnessMap: THREE.Texture;
  normalMap: THREE.Texture;
  bumpMap: THREE.Texture;
};

function hasRenderableTexture(texture: THREE.Texture | undefined) {
  if (!texture) return false;
  const sourceData = (texture.source as { data?: unknown } | undefined)?.data;
  return Boolean((texture as { image?: unknown }).image ?? sourceData);
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

    if (isWhitePreview || !textures || !hasRenderableTextureSet) {
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
  }, [hasRenderableTextureSet, isWhitePreview, textureConfig, textures, wallRender]);

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

function CornerCapColumns({ color }: { color: string }) {
  const walls = useShellSelector((slice) => slice.walls);
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

function DetailedWalls({ wallMaterialIndex, walls }: { wallMaterialIndex: number; walls: Wall[] }) {
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
  const loadedTextures = useLoader(
    RuntimeTextureLoader,
    textureUrls
      ? [textureUrls.map, textureUrls.roughnessMap, textureUrls.normalMap, textureUrls.bumpMap]
      : []
  ) as THREE.Texture[];
  const textures = useMemo(
    () =>
      textureUrls
        ? {
            map: loadedTextures[0]!,
            roughnessMap: loadedTextures[1]!,
            normalMap: loadedTextures[2]!,
            bumpMap: loadedTextures[3]!
          }
        : null,
    [loadedTextures, textureUrls]
  );
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
      <CornerCapColumns color={cornerCapColor} />
    </group>
  );
}

export default function ProceduralWall() {
  const viewMode = useEditorStore((state) => state.viewMode);
  const wallMaterialIndex = useShellSelector((slice) => slice.wallMaterialIndex);
  const walls = useShellSelector((slice) => slice.walls);
  const topWallColor =
    wallMaterialIndex < 0
      ? "#f2efea"
      : WALL_TEXTURE_PRESETS[wallMaterialIndex % WALL_TEXTURE_PRESETS.length]?.topColor ?? "#cfc9c1";

  if (viewMode === "top") {
    return (
      <group>
        <DetailedWalls wallMaterialIndex={wallMaterialIndex} walls={walls} />
        {walls.map((wall) => (
          <TopWallFootprint key={wall.id} wallId={wall.id} color={topWallColor} />
        ))}
      </group>
    );
  }

  return <DetailedWalls wallMaterialIndex={wallMaterialIndex} walls={walls} />;
}
