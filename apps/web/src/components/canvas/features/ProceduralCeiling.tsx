"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useLoader, useThree } from "@react-three/fiber";
import { RuntimeTextureLoader } from "../../../lib/loaders/RuntimeTextureLoader";
import { configureRuntimeAssetLoaders } from "../../../lib/loaders/AssetLoader";
import { useEditorStore } from "../../../lib/stores/useEditorStore";
import { useShellSelector } from "../../../lib/stores/scene-slices";
import type { Wall } from "../../../lib/stores/useSceneStore";
import { buildExteriorPolygon, buildFallbackShape } from "../../../lib/geometry/floor-shape";
import { getWallRenderPlacement } from "../../../lib/geometry/wall-placement";
import {
  CEILING_TEXTURE_PRESETS,
  resolveRuntimeTextureSet,
  type RoomShellTexturePreset
} from "../../../lib/textures/room-shell-textures";

const DEFAULT_HEIGHT = 2.8;
const CEILING_TRIM_HEIGHT = 0.075;
const CEILING_TRIM_DEPTH = 0.032;
const CEILING_CAP_LENGTH = 0.105;
const TRIM_OVERLAP = 0.006;

type CeilingGeometryEntry = {
  id: string;
  geometry: THREE.ShapeGeometry;
};

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

function computeBounds(walls: { start: [number, number]; end: [number, number] }[], scale: number) {
  if (walls.length === 0) {
    return { minX: -2.5, maxX: 2.5, minZ: -2.5, maxZ: 2.5 };
  }

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;

  walls.forEach((wall) => {
    [wall.start, wall.end].forEach(([x, z]) => {
      const scaledX = x * scale;
      const scaledZ = z * scale;
      minX = Math.min(minX, scaledX);
      maxX = Math.max(maxX, scaledX);
      minZ = Math.min(minZ, scaledZ);
      maxZ = Math.max(maxZ, scaledZ);
    });
  });

  return { minX, maxX, minZ, maxZ };
}

function configureCeilingTextures(
  textures: LoadedTextureSet,
  textureConfig: RoomShellTexturePreset,
  width: number,
  depth: number
) {
  const repeatX = Math.max(1, width / Math.max(0.25, textureConfig.repeatScaleMeters[0]));
  const repeatY = Math.max(1, depth / Math.max(0.25, textureConfig.repeatScaleMeters[1]));

  Object.values(textures).forEach((texture) => {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeatX, repeatY);
    texture.center.set(0.5, 0.5);
    texture.rotation = textureConfig.rotationRadians;
    texture.anisotropy = 4;
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

function resolveInteriorSide(
  wall: Wall,
  placement: ReturnType<typeof getWallRenderPlacement>,
  scale: number
) {
  const rawMidX = ((wall.start[0] + wall.end[0]) / 2) * scale;
  const rawMidZ = ((wall.start[1] + wall.end[1]) / 2) * scale;
  const placedMidX = placement.start[0] + placement.direction[0] * (placement.length / 2);
  const placedMidZ = placement.start[1] + placement.direction[1] * (placement.length / 2);
  const outwardX = placedMidX - rawMidX;
  const outwardZ = placedMidZ - rawMidZ;
  const localPositiveZ = [-Math.sin(placement.angle), Math.cos(placement.angle)] as const;
  const dot = outwardX * localPositiveZ[0] + outwardZ * localPositiveZ[1];

  if (!Number.isFinite(dot) || Math.abs(dot) < 1e-5) {
    return 1;
  }

  return dot > 0 ? -1 : 1;
}

function DetailedCeilingMeshes({
  geometries,
  width,
  depth,
  ceilingMaterialIndex
}: {
  geometries: CeilingGeometryEntry[];
  width: number;
  depth: number;
  ceilingMaterialIndex: number;
}) {
  const isWhitePreview = ceilingMaterialIndex < 0;
  const gl = useThree((state) => state.gl);
  const textureConfig =
    CEILING_TEXTURE_PRESETS[ceilingMaterialIndex % CEILING_TEXTURE_PRESETS.length] ?? CEILING_TEXTURE_PRESETS[0];
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

  useEffect(() => {
    if (!textures || !hasRenderableTextureSet) return;
    configureCeilingTextures(textures, textureConfig, width, depth);
  }, [depth, hasRenderableTextureSet, textureConfig, textures, width]);

  const material = useMemo(() => {
    if (isWhitePreview || !textures || !hasRenderableTextureSet) {
      return new THREE.MeshStandardMaterial({
        color: textureConfig.color ?? textureConfig.topColor,
        roughness: 0.94,
        metalness: 0.01,
        envMapIntensity: 0.26,
        side: THREE.DoubleSide
      });
    }

    return new THREE.MeshStandardMaterial({
      color: textureConfig.color,
      map: textures.map,
      roughnessMap: textures.roughnessMap,
      normalMap: textures.normalMap,
      bumpMap: textures.bumpMap,
      bumpScale: textureConfig.bumpScale,
      roughness: textureConfig.roughness,
      normalScale: new THREE.Vector2(textureConfig.normalScale, textureConfig.normalScale),
      envMapIntensity: textureConfig.envMapIntensity,
      side: THREE.DoubleSide
    });
  }, [hasRenderableTextureSet, isWhitePreview, textureConfig, textures]);

  useEffect(() => {
    return () => {
      material.dispose();
    };
  }, [material]);

  return (
    <>
      {geometries.map((entry) => (
        <mesh key={entry.id} geometry={entry.geometry} castShadow receiveShadow>
          <primitive object={material} attach="material" />
        </mesh>
      ))}
    </>
  );
}

function CeilingTrim({
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
    const interiorSide = resolveInteriorSide(wall, placement, scale);

    return {
      position: [placement.start[0], 0, placement.start[1]] as [number, number, number],
      rotation: [0, -placement.angle, 0] as [number, number, number],
      localZ: interiorSide * (thickness / 2 + CEILING_TRIM_DEPTH / 2 - TRIM_OVERLAP),
      length
    };
  }, [floors, scale, wall]);

  if (!trim) return null;

  return (
    <group name={`ceiling-trim:${wallId}`} position={trim.position} rotation={trim.rotation}>
      <mesh position={[trim.length / 2, -CEILING_TRIM_HEIGHT / 2, trim.localZ]} castShadow receiveShadow>
        <boxGeometry args={[trim.length, CEILING_TRIM_HEIGHT, CEILING_TRIM_DEPTH]} />
        <meshStandardMaterial color={color} roughness={0.76} metalness={0.01} envMapIntensity={0.28} />
      </mesh>
      {[0, trim.length].map((x, index) => (
        <mesh
          key={`${wallId}-ceiling-cap-${index}`}
          position={[x, -CEILING_TRIM_HEIGHT / 2, trim.localZ]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[CEILING_CAP_LENGTH, CEILING_TRIM_HEIGHT, CEILING_CAP_LENGTH]} />
          <meshStandardMaterial color={color} roughness={0.78} metalness={0.01} envMapIntensity={0.26} />
        </mesh>
      ))}
    </group>
  );
}

export default function ProceduralCeiling() {
  const viewMode = useEditorStore((state) => state.viewMode);
  const walls = useShellSelector((slice) => slice.walls);
  const floors = useShellSelector((slice) => slice.floors);
  const ceilings = useShellSelector((slice) => slice.ceilings);
  const scale = useShellSelector((slice) => slice.scale);
  const ceilingMaterialIndex = useShellSelector((slice) => slice.ceilingMaterialIndex);

  const bounds = useMemo(() => computeBounds(walls, scale), [walls, scale]);
  const exterior = useMemo(() => buildExteriorPolygon(walls, scale), [walls, scale]);
  const fallbackShape = useMemo(() => buildFallbackShape(bounds), [bounds]);
  const shape = exterior?.shape ?? fallbackShape;
  const shapeBounds = exterior?.bounds ?? {
    minX: bounds.minX,
    maxX: bounds.maxX,
    minY: bounds.minZ,
    maxY: bounds.maxZ
  };
  const width = Math.max(1, shapeBounds.maxX - shapeBounds.minX);
  const depth = Math.max(1, shapeBounds.maxY - shapeBounds.minY);
  const wallHeight = useMemo(() => {
    if (ceilings.length > 0) {
      return ceilings.reduce((max, ceiling) => Math.max(max, ceiling.height || DEFAULT_HEIGHT), DEFAULT_HEIGHT);
    }
    if (walls.length === 0) return DEFAULT_HEIGHT;
    return walls.reduce((max, wall) => Math.max(max, wall.height || DEFAULT_HEIGHT), DEFAULT_HEIGHT);
  }, [ceilings, walls]);
  const geometries = useMemo(() => {
    if (ceilings.length > 0) {
      return ceilings
        .map((ceiling) => {
          if (!Array.isArray(ceiling.outline) || ceiling.outline.length < 3) return null;
          const floorShape = new THREE.Shape();
          floorShape.moveTo(ceiling.outline[0]![0] * scale, ceiling.outline[0]![1] * scale);
          for (let index = 1; index < ceiling.outline.length; index += 1) {
            floorShape.lineTo(ceiling.outline[index]![0] * scale, ceiling.outline[index]![1] * scale);
          }
          floorShape.closePath();
          const geometry = new THREE.ShapeGeometry(floorShape);
          geometry.rotateX(Math.PI / 2);
          return {
            id: ceiling.id,
            geometry
          };
        })
        .filter((entry): entry is CeilingGeometryEntry => Boolean(entry));
    }

    if (floors.length > 0) {
      return floors
        .map((floor) => {
          if (!Array.isArray(floor.outline) || floor.outline.length < 3) return null;
          const floorShape = new THREE.Shape();
          floorShape.moveTo(floor.outline[0]![0] * scale, floor.outline[0]![1] * scale);
          for (let index = 1; index < floor.outline.length; index += 1) {
            floorShape.lineTo(floor.outline[index]![0] * scale, floor.outline[index]![1] * scale);
          }
          floorShape.closePath();
          const geometry = new THREE.ShapeGeometry(floorShape);
          geometry.rotateX(Math.PI / 2);
          return {
            id: floor.id,
            geometry
          };
        })
        .filter((entry): entry is CeilingGeometryEntry => Boolean(entry));
    }

    const geo = new THREE.ShapeGeometry(shape);
    geo.rotateX(Math.PI / 2);
    return [{ id: "fallback-ceiling", geometry: geo }];
  }, [ceilings, floors, scale, shape]);

  useEffect(() => {
    return () => {
      geometries.forEach((entry) => entry.geometry.dispose());
    };
  }, [geometries]);

  if (viewMode !== "walk") return null;

  return (
    <group position={[0, wallHeight, 0]}>
      <DetailedCeilingMeshes
        geometries={geometries}
        width={width}
        depth={depth}
        ceilingMaterialIndex={ceilingMaterialIndex}
      />
      {walls.map((wall) => (
        <CeilingTrim key={`${wall.id}-ceiling-trim`} wallId={wall.id} color="#e7ded2" />
      ))}
    </group>
  );
}
