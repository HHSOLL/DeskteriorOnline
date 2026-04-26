"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import gsap from "gsap";
import { useGLBAsset } from "../../../lib/loaders/AssetLoader";
import { useShellSelector } from "../../../lib/stores/scene-slices";
import { getWallRenderPlacement } from "../../../lib/geometry/wall-placement";
import {
  resolveOpeningBottomOffset,
  resolveWallInteriorSide
} from "../../../lib/geometry/wall-finish";
import { useInteractionRegistry } from "../interaction/InteractionManager";

type DoorSpec = {
  id: string;
  position: [number, number, number];
  angle: number;
  width: number;
  height: number;
  thickness: number;
  wallThickness: number;
  interiorSide: number;
};

type WindowSpec = {
  id: string;
  position: [number, number, number];
  angle: number;
  width: number;
  height: number;
  thickness: number;
  wallThickness: number;
  interiorSide: number;
};

type DoorVariant = "single" | "double" | "french";
type WindowVariant = "single" | "wide";

type DoorAssetConfig = {
  path: string;
  pivotNames: string[];
  openRotations: number[];
};

type WindowAssetConfig = {
  path: string;
};

const DOOR_ASSETS: Record<DoorVariant, DoorAssetConfig> = {
  single: {
    path: "/assets/models/p2s_opening_door_single/p2s_opening_door_single.glb",
    pivotNames: ["DoorLeafPivot"],
    openRotations: [-Math.PI / 2.35]
  },
  double: {
    path: "/assets/models/p2s_opening_door_double/p2s_opening_door_double.glb",
    pivotNames: ["DoorLeafLeftPivot", "DoorLeafRightPivot"],
    openRotations: [-Math.PI / 2.5, Math.PI / 2.5]
  },
  french: {
    path: "/assets/models/p2s_opening_door_french/p2s_opening_door_french.glb",
    pivotNames: ["DoorLeafLeftPivot", "DoorLeafRightPivot"],
    openRotations: [-Math.PI / 2.7, Math.PI / 2.7]
  }
};

const WINDOW_ASSETS: Record<WindowVariant, WindowAssetConfig> = {
  single: {
    path: "/assets/models/p2s_opening_window_single/p2s_opening_window_single.glb"
  },
  wide: {
    path: "/assets/models/p2s_opening_window_wide/p2s_opening_window_wide.glb"
  }
};

const FRAME_DEPTH = 0.038;
const FRAME_OVERLAP = 0.005;
const DOOR_CASING_WIDTH = 0.064;
const WINDOW_CASING_WIDTH = 0.052;
const DOOR_THRESHOLD_HEIGHT = 0.032;
const DOOR_THRESHOLD_DEPTH = 0.12;
const WINDOW_SILL_HEIGHT = 0.045;
const WINDOW_SILL_DEPTH = 0.16;
const WINDOW_SILL_OVERHANG = 0.12;

function resolveDoorVariant(width: number): DoorVariant {
  if (width >= 1.52) return "french";
  if (width >= 1.16) return "double";
  return "single";
}

function resolveWindowVariant(width: number): WindowVariant {
  return width >= 2.08 ? "wide" : "single";
}

function prepareRuntimeAsset(root: THREE.Object3D) {
  let highlightMesh: THREE.Mesh | null = null;

  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.castShadow = true;
    child.receiveShadow = true;

    const material = child.material;
    const materials = Array.isArray(material) ? material : [material];
    materials.forEach((entry) => {
      if (entry instanceof THREE.MeshStandardMaterial && entry.transparent) {
        entry.depthWrite = false;
      }
    });

    if (!highlightMesh && child.name.toLowerCase().includes("doorleaf")) {
      highlightMesh = child;
    }
  });

  return highlightMesh;
}

function normalizeOpeningAsset(root: THREE.Object3D) {
  root.rotation.set(0, 0, 0);
  root.updateWorldMatrix(true, true);

  const bounds = new THREE.Box3().setFromObject(root);
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());

  root.position.x -= bounds.min.x;
  root.position.y -= bounds.min.y;
  root.position.z -= center.z;
  root.updateWorldMatrix(true, true);

  return {
    width: Math.max(size.x, 0.001),
    height: Math.max(size.y, 0.001),
    thickness: Math.max(size.z, 0.001)
  } as const;
}

function OpeningFrame({
  id,
  type,
  position,
  angle,
  width,
  height,
  wallThickness,
  interiorSide
}: {
  id: string;
  type: "door" | "window";
  position: [number, number, number];
  angle: number;
  width: number;
  height: number;
  wallThickness: number;
  interiorSide: number;
}) {
  const casingWidth = type === "door" ? DOOR_CASING_WIDTH : WINDOW_CASING_WIDTH;
  const color = type === "door" ? "#eadfd1" : "#eee4d8";
  const localZ = interiorSide * (wallThickness / 2 + FRAME_DEPTH / 2 - FRAME_OVERLAP);
  const thresholdZ = interiorSide * (wallThickness / 2 + DOOR_THRESHOLD_DEPTH / 2 - FRAME_OVERLAP);
  const sillZ = interiorSide * (wallThickness / 2 + WINDOW_SILL_DEPTH / 2 - FRAME_OVERLAP);

  return (
    <group name={`${type}-frame:${id}`} position={position} rotation={[0, angle, 0]}>
      {[0, width].map((x, index) => (
        <mesh key={`${id}-side-${index}`} position={[x, height / 2, localZ]} castShadow receiveShadow>
          <boxGeometry args={[casingWidth, height + casingWidth * 0.6, FRAME_DEPTH]} />
          <meshStandardMaterial color={color} roughness={0.68} metalness={0.01} envMapIntensity={0.34} />
        </mesh>
      ))}
      <mesh position={[width / 2, height + casingWidth / 2, localZ]} castShadow receiveShadow>
        <boxGeometry args={[width + casingWidth * 2, casingWidth, FRAME_DEPTH]} />
        <meshStandardMaterial color={color} roughness={0.68} metalness={0.01} envMapIntensity={0.34} />
      </mesh>
      {type === "door" ? (
        <mesh position={[width / 2, DOOR_THRESHOLD_HEIGHT / 2, thresholdZ]} castShadow receiveShadow>
          <boxGeometry args={[width + casingWidth, DOOR_THRESHOLD_HEIGHT, DOOR_THRESHOLD_DEPTH]} />
          <meshStandardMaterial color="#d6cabd" roughness={0.62} metalness={0.02} envMapIntensity={0.28} />
        </mesh>
      ) : (
        <>
          <mesh position={[width / 2, -casingWidth / 2, localZ]} castShadow receiveShadow>
            <boxGeometry args={[width + casingWidth * 2, casingWidth, FRAME_DEPTH]} />
            <meshStandardMaterial color={color} roughness={0.68} metalness={0.01} envMapIntensity={0.34} />
          </mesh>
          <mesh position={[width / 2, -casingWidth - WINDOW_SILL_HEIGHT / 2, sillZ]} castShadow receiveShadow>
            <boxGeometry
              args={[
                width + WINDOW_SILL_OVERHANG * 2,
                WINDOW_SILL_HEIGHT,
                WINDOW_SILL_DEPTH
              ]}
            />
            <meshStandardMaterial color="#ded2c4" roughness={0.66} metalness={0.01} envMapIntensity={0.3} />
          </mesh>
        </>
      )}
    </group>
  );
}

function DoorAssetModel({ door }: { door: DoorSpec }) {
  const registry = useInteractionRegistry();
  const rootRef = useRef<THREE.Group | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const variant = resolveDoorVariant(door.width);
  const config = DOOR_ASSETS[variant];
  const gltf = useGLBAsset(config.path);

  const runtimeAsset = useMemo(() => {
    const clone = gltf.scene.clone(true);
    const highlightMesh = prepareRuntimeAsset(clone);
    const baseSize = normalizeOpeningAsset(clone);
    return {
      root: clone,
      highlightMesh,
      baseSize
    };
  }, [gltf.scene]);

  const leafPivots = useMemo(
    () =>
      config.pivotNames
        .map((name) => runtimeAsset.root.getObjectByName(name))
        .filter((entry): entry is THREE.Object3D => Boolean(entry)),
    [config.pivotNames, runtimeAsset.root]
  );

  useEffect(() => {
    leafPivots.forEach((pivot, index) => {
      gsap.to(pivot.rotation, {
        y: isOpen ? config.openRotations[index] ?? 0 : 0,
        duration: 0.55,
        ease: "power2.out"
      });
    });
  }, [config.openRotations, isOpen, leafPivots]);

  useEffect(() => {
    const group = rootRef.current;
    if (!group) return;

    group.userData.interactive = true;
    group.userData.interactionLabel = "Door";
    group.userData.onInteract = () => setIsOpen((prev) => !prev);
    if (runtimeAsset.highlightMesh) {
      group.userData.highlightMesh = runtimeAsset.highlightMesh;
    }

    registry?.register(group);
    return () => registry?.unregister(group);
  }, [registry, runtimeAsset.highlightMesh]);

  return (
    <>
      <OpeningFrame
        id={door.id}
        type="door"
        position={door.position}
        angle={door.angle}
        width={door.width}
        height={door.height}
        wallThickness={door.wallThickness}
        interiorSide={door.interiorSide}
      />
      <group
        ref={rootRef}
        name={`door:${door.id}`}
        position={door.position}
        rotation={[0, door.angle, 0]}
        scale={[
          door.width / runtimeAsset.baseSize.width,
          door.height / runtimeAsset.baseSize.height,
          door.thickness / runtimeAsset.baseSize.thickness
        ]}
      >
        <primitive object={runtimeAsset.root} />
      </group>
    </>
  );
}

function WindowAssetModel({ window }: { window: WindowSpec }) {
  const variant = resolveWindowVariant(window.width);
  const config = WINDOW_ASSETS[variant];
  const gltf = useGLBAsset(config.path);

  const runtimeAsset = useMemo(() => {
    const clone = gltf.scene.clone(true);
    prepareRuntimeAsset(clone);
    const baseSize = normalizeOpeningAsset(clone);
    return {
      root: clone,
      baseSize
    };
  }, [gltf.scene]);

  return (
    <>
      <OpeningFrame
        id={window.id}
        type="window"
        position={window.position}
        angle={window.angle}
        width={window.width}
        height={window.height}
        wallThickness={window.wallThickness}
        interiorSide={window.interiorSide}
      />
      <group
        name={`window:${window.id}`}
        position={window.position}
        rotation={[0, window.angle, 0]}
        scale={[
          window.width / runtimeAsset.baseSize.width,
          window.height / runtimeAsset.baseSize.height,
          window.thickness / runtimeAsset.baseSize.thickness
        ]}
      >
        <primitive object={runtimeAsset.root} />
      </group>
    </>
  );
}

export default function InteractiveDoors() {
  const walls = useShellSelector((slice) => slice.walls);
  const openings = useShellSelector((slice) => slice.openings);
  const floors = useShellSelector((slice) => slice.floors);
  const scale = useShellSelector((slice) => slice.scale);

  const doorSpecs = useMemo(() => {
    return openings
      .filter((opening) => opening.type === "door")
      .map((opening) => {
        const wall = walls.find((item) => item.id === opening.wallId);
        if (!wall) return null;

        const placement = getWallRenderPlacement(wall, floors, scale);
        const length = placement.length;
        if (!Number.isFinite(length) || length <= 0) return null;

        const width = Math.max(0.72, opening.width * scale);
        const height = Math.max(1.95, opening.height * scale);
        const wallThickness = Math.max(0.02, wall.thickness * scale);
        const thickness = Math.max(0.06, wallThickness * 0.72);
        const offset = Math.min(Math.max(0, opening.offset * scale + placement.startInset), Math.max(0, length - width));
        const startX = placement.start[0] + placement.direction[0] * offset;
        const startZ = placement.start[1] + placement.direction[1] * offset;
        const bottomOffset = resolveOpeningBottomOffset(opening, scale);

        return {
          id: opening.id,
          position: [startX, bottomOffset, startZ] as [number, number, number],
          angle: -placement.angle,
          width,
          height,
          thickness,
          wallThickness,
          interiorSide: resolveWallInteriorSide(wall, placement, scale)
        } satisfies DoorSpec;
      })
      .filter((entry): entry is DoorSpec => Boolean(entry));
  }, [floors, openings, scale, walls]);

  const windowSpecs = useMemo(() => {
    return openings
      .filter((opening) => opening.type === "window")
      .map((opening) => {
        const wall = walls.find((item) => item.id === opening.wallId);
        if (!wall) return null;

        const placement = getWallRenderPlacement(wall, floors, scale);
        const length = placement.length;
        if (!Number.isFinite(length) || length <= 0) return null;

        const width = Math.max(0.92, opening.width * scale);
        const height = Math.max(0.88, opening.height * scale);
        const wallThickness = Math.max(0.02, wall.thickness * scale);
        const thickness = Math.max(0.08, wallThickness * 0.82);
        const offset = Math.min(Math.max(0, opening.offset * scale + placement.startInset), Math.max(0, length - width));
        const startX = placement.start[0] + placement.direction[0] * offset;
        const startZ = placement.start[1] + placement.direction[1] * offset;
        const sillHeight = resolveOpeningBottomOffset(opening, scale);

        return {
          id: opening.id,
          position: [startX, sillHeight, startZ] as [number, number, number],
          angle: -placement.angle,
          width,
          height,
          thickness,
          wallThickness,
          interiorSide: resolveWallInteriorSide(wall, placement, scale)
        } satisfies WindowSpec;
      })
      .filter((entry): entry is WindowSpec => Boolean(entry));
  }, [floors, openings, scale, walls]);

  if (doorSpecs.length === 0 && windowSpecs.length === 0) return null;

  return (
    <group>
      {doorSpecs.map((door) => (
        <DoorAssetModel key={door.id} door={door} />
      ))}
      {windowSpecs.map((window) => (
        <WindowAssetModel key={window.id} window={window} />
      ))}
    </group>
  );
}
