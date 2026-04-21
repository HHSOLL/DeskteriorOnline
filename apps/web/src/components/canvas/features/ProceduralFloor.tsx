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
  const gl = useThree((state) => state.gl);
  const textureConfig =
    FLOOR_TEXTURE_PRESETS[floorMaterialIndex % FLOOR_TEXTURE_PRESETS.length] ?? FLOOR_TEXTURE_PRESETS[0];
  configureRuntimeAssetLoaders(gl);
  const textureUrls = useMemo(() => resolveRuntimeTextureSet(textureConfig), [textureConfig]);
  const [map, roughnessMap, normalMap, bumpMap] = useLoader(RuntimeTextureLoader, [
    textureUrls.map,
    textureUrls.roughnessMap,
    textureUrls.normalMap,
    textureUrls.bumpMap
  ]) as THREE.Texture[];
  const textures = useMemo(
    () => ({
      map,
      roughnessMap,
      normalMap,
      bumpMap
    }),
    [bumpMap, map, normalMap, roughnessMap]
  );

  useEffect(() => {
    Object.values(textures).forEach((texture) => {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(Math.max(1, width / 3.8), Math.max(1, depth / 3.8));
      texture.anisotropy = 8;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
    });

    textures.map.colorSpace = THREE.SRGBColorSpace;
    textures.roughnessMap.colorSpace = THREE.NoColorSpace;
    textures.normalMap.colorSpace = THREE.NoColorSpace;
    textures.bumpMap.colorSpace = THREE.NoColorSpace;
  }, [depth, textures, width]);

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
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
      }),
    [textureConfig.bumpScale, textureConfig.normalScale, textureConfig.roughness, textures]
  );

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
