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
  WALL_TEXTURE_PRESETS,
  resolveRuntimeTextureSet
} from "../../../lib/textures/room-shell-textures";

function hasRenderableTexture(texture: THREE.Texture | undefined) {
  if (!texture) return false;
  const sourceData = (texture.source as { data?: unknown } | undefined)?.data;
  return Boolean((texture as { image?: unknown }).image ?? sourceData);
}

function WallMesh({
  wallId,
  materialTemplate
}: {
  wallId: string;
  materialTemplate: THREE.Material;
}) {
  const walls = useShellSelector((slice) => slice.walls);
  const openings = useShellSelector((slice) => slice.openings);
  const floors = useShellSelector((slice) => slice.floors);
  const scale = useShellSelector((slice) => slice.scale);
  const wall = useMemo(() => walls.find((item) => item.id === wallId), [wallId, walls]);
  const material = useMemo(() => materialTemplate.clone(), [materialTemplate]);

  const wallOpenings = useMemo(() => openings.filter((opening) => opening.wallId === wallId), [openings, wallId]);

  const { baseGeometry, holeGeometries, position, rotation } = useMemo(() => {
    if (!wall) {
      return {
        baseGeometry: null,
        holeGeometries: [],
        position: [0, 0, 0] as [number, number, number],
        rotation: [0, 0, 0] as [number, number, number]
      };
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

        const bottomOffset =
          typeof opening.verticalOffset === "number"
            ? opening.verticalOffset * scale
            : typeof opening.sillHeight === "number"
              ? opening.sillHeight * scale
              : opening.type === "window"
                ? 0.9 * scale
                : 0;
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
      rotation: [0, -placement.angle, 0] as [number, number, number]
    };
  }, [floors, scale, wall, wallOpenings]);

  useEffect(() => {
    return () => {
      baseGeometry?.dispose();
      holeGeometries.forEach((geometry) => geometry.dispose());
      material.dispose();
    };
  }, [baseGeometry, holeGeometries, material]);

  if (!wall || !baseGeometry) return null;

  return (
    <mesh name={`wall:${wall.id}`} position={position} rotation={rotation} castShadow receiveShadow>
      <Geometry computeVertexNormals>
        <Base geometry={baseGeometry} />
        {holeGeometries.map((geometry, index) => (
          <Subtraction key={`${wall.id}-hole-${index}`} geometry={geometry} />
        ))}
      </Geometry>
      <primitive object={material} attach="material" />
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

function DetailedWalls({ wallMaterialIndex, walls }: { wallMaterialIndex: number; walls: Wall[] }) {
  const isWhitePreview = wallMaterialIndex < 0;
  const gl = useThree((state) => state.gl);
  const textureConfig =
    WALL_TEXTURE_PRESETS[wallMaterialIndex % WALL_TEXTURE_PRESETS.length] ?? WALL_TEXTURE_PRESETS[0];
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
    Object.values(textures).forEach((texture) => {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(1, 1);
      texture.anisotropy = 4;
    });

    textures.map.colorSpace = THREE.SRGBColorSpace;
    textures.roughnessMap.colorSpace = THREE.NoColorSpace;
    textures.normalMap.colorSpace = THREE.NoColorSpace;
    textures.bumpMap.colorSpace = THREE.NoColorSpace;
  }, [hasRenderableTextureSet, textures]);

  const material = useMemo(() => {
    if (isWhitePreview || !textures || !hasRenderableTextureSet) {
      return new THREE.MeshStandardMaterial({
        color: textureConfig.color ?? textureConfig.topColor,
        roughness: 0.86,
        metalness: 0.02,
        envMapIntensity: 0.36,
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
    <group>
      {walls.map((wall) => (
        <WallMesh key={wall.id} wallId={wall.id} materialTemplate={material} />
      ))}
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
