"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useLoader, useThree } from "@react-three/fiber";
import { RuntimeTextureLoader } from "../../../lib/loaders/RuntimeTextureLoader";
import { configureRuntimeAssetLoaders } from "../../../lib/loaders/AssetLoader";
import { useShellSelector } from "../../../lib/stores/scene-slices";
import { buildExteriorPolygon, buildFallbackShape } from "../../../lib/geometry/floor-shape";
import {
  FLOOR_TEXTURE_PRESETS,
  resolveRuntimeTextureSet
} from "../../../lib/textures/room-shell-textures";

type FloorGeometryEntry = {
  id: string;
  geometry: THREE.ShapeGeometry;
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
    const points = [wall.start, wall.end];
    points.forEach(([x, z]) => {
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

function DetailedFloorMeshes({
  geometries,
  width,
  depth,
  floorMaterialIndex
}: {
  geometries: FloorGeometryEntry[];
  width: number;
  depth: number;
  floorMaterialIndex: number;
}) {
  const isWhitePreview = floorMaterialIndex < 0;
  const gl = useThree((state) => state.gl);
  const textureConfig =
    FLOOR_TEXTURE_PRESETS[floorMaterialIndex % FLOOR_TEXTURE_PRESETS.length] ?? FLOOR_TEXTURE_PRESETS[0];
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
    const repeatX = Math.max(1, width / Math.max(0.25, textureConfig.repeatScaleMeters[0]));
    const repeatY = Math.max(1, depth / Math.max(0.25, textureConfig.repeatScaleMeters[1]));
    Object.values(textures).forEach((texture) => {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(repeatX, repeatY);
      texture.center.set(0.5, 0.5);
      texture.rotation = textureConfig.rotationRadians;
      texture.anisotropy = 8;
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
  }, [depth, hasRenderableTextureSet, textureConfig, textures, width]);

  const material = useMemo(() => {
    if (isWhitePreview || !textures || !hasRenderableTextureSet) {
      return new THREE.MeshStandardMaterial({
        color: textureConfig.topColor,
        roughness: 0.88,
        metalness: 0.01,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1
      });
    }

    return new THREE.MeshStandardMaterial({
      map: textures.map,
      roughnessMap: textures.roughnessMap,
      normalMap: textures.normalMap,
      bumpMap: textures.bumpMap,
      bumpScale: textureConfig.bumpScale,
      roughness: textureConfig.roughness,
      normalScale: new THREE.Vector2(textureConfig.normalScale, textureConfig.normalScale),
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1
    });
  }, [
    hasRenderableTextureSet,
    isWhitePreview,
    textureConfig.bumpScale,
    textureConfig.normalScale,
    textureConfig.roughness,
    textureConfig.topColor,
    textures
  ]);

  useEffect(() => {
    return () => {
      material.dispose();
    };
  }, [material]);

  return geometries.map((entry) => (
    <mesh key={entry.id} name={`floor:${entry.id}`} geometry={entry.geometry} receiveShadow>
      <primitive object={material} attach="material" />
    </mesh>
  ));
}

export default function ProceduralFloor() {
  const walls = useShellSelector((slice) => slice.walls);
  const floors = useShellSelector((slice) => slice.floors);
  const scale = useShellSelector((slice) => slice.scale);
  const floorMaterialIndex = useShellSelector((slice) => slice.floorMaterialIndex);

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

  const geometries = useMemo(() => {
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
          if (geometry.attributes.uv) {
            geometry.setAttribute("uv2", geometry.attributes.uv.clone());
          }
          return {
            id: floor.id,
            geometry
          };
        })
        .filter((entry): entry is FloorGeometryEntry => Boolean(entry));
    }

    const geometry = new THREE.ShapeGeometry(shape);
    geometry.rotateX(Math.PI / 2);
    if (geometry.attributes.uv) {
      geometry.setAttribute("uv2", geometry.attributes.uv.clone());
    }
    return [{ id: "fallback-floor", geometry }];
  }, [floors, scale, shape]);

  useEffect(() => {
    return () => {
      geometries.forEach((entry) => entry.geometry.dispose());
    };
  }, [geometries]);

  return (
    <DetailedFloorMeshes
      geometries={geometries}
      width={width}
      depth={depth}
      floorMaterialIndex={floorMaterialIndex}
    />
  );
}
