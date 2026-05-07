"use client";

import { Component, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
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
import {
  createProceduralDoorAsset,
  createProceduralWindowAsset,
  DOOR_VISUALS,
  OPENING_TRIM_NODE_NAMES,
  resolveDoorVariant,
  resolveWindowVariant,
  WINDOW_VISUALS,
  type DoorVariant
} from "./opening-visuals";

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

const FRAME_DEPTH = 0.038;
const FRAME_OVERLAP = 0.005;
const DOOR_CASING_WIDTH = 0.064;
const WINDOW_CASING_WIDTH = 0.052;
const DOOR_THRESHOLD_HEIGHT = 0.032;
const DOOR_THRESHOLD_DEPTH = 0.12;
const WINDOW_SILL_HEIGHT = 0.045;
const WINDOW_SILL_DEPTH = 0.16;
const WINDOW_SILL_OVERHANG = 0.12;

class OpeningModelErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

function prepareRuntimeAsset(root: THREE.Object3D) {
  let highlightMesh: THREE.Mesh | null = null;

  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.castShadow = true;
    child.receiveShadow = true;

    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      if (material instanceof THREE.MeshStandardMaterial && material.transparent) {
        material.depthWrite = false;
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

function OpeningTrim({
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
  const casingColor = type === "door" ? "#d4c3ae" : "#cfc0ae";
  const jambColor = type === "door" ? "#99826b" : "#786f64";
  const jambDepth = Math.max(FRAME_DEPTH * 1.8, wallThickness - FRAME_OVERLAP * 2);
  const faceOffset = Math.max(0, wallThickness / 2 - FRAME_DEPTH / 2);
  const frontZ = faceOffset;
  const backZ = -faceOffset;
  const thresholdZ = interiorSide * (wallThickness / 2 + DOOR_THRESHOLD_DEPTH / 2 - FRAME_OVERLAP);
  const sillZ = interiorSide * (wallThickness / 2 + WINDOW_SILL_DEPTH / 2 - FRAME_OVERLAP);
  const nodeNames = type === "door" ? OPENING_TRIM_NODE_NAMES.door : OPENING_TRIM_NODE_NAMES.window;

  return (
    <group name={`${type}-trim:${id}`} position={position} rotation={[0, angle, 0]}>
      {[0, width].map((x, index) => (
        <mesh
          key={`${id}-jamb-side-${index}`}
          name={nodeNames[index]}
          position={[x, height / 2, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[casingWidth * 0.82, height, jambDepth]} />
          <meshStandardMaterial color={jambColor} roughness={0.74} metalness={0.06} envMapIntensity={0.28} />
        </mesh>
      ))}
      <mesh name={nodeNames[2]} position={[width / 2, height - casingWidth / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, casingWidth * 0.82, jambDepth]} />
        <meshStandardMaterial color={jambColor} roughness={0.74} metalness={0.06} envMapIntensity={0.28} />
      </mesh>
      {type === "window" ? (
        <mesh name={nodeNames[3]} position={[width / 2, casingWidth / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[width, casingWidth * 0.82, jambDepth]} />
          <meshStandardMaterial color={jambColor} roughness={0.74} metalness={0.06} envMapIntensity={0.28} />
        </mesh>
      ) : null}
      {[frontZ, backZ].map((z, faceIndex) => {
        const baseIndex = type === "door" ? (faceIndex === 0 ? 3 : 6) : faceIndex === 0 ? 4 : 8;
        return (
          <group key={`${id}-casing-face-${faceIndex}`}>
            {[0, width].map((x, index) => (
              <mesh
                key={`${id}-casing-side-${faceIndex}-${index}`}
                name={nodeNames[baseIndex + index]}
                position={[x, height / 2, z]}
                castShadow
                receiveShadow
              >
                <boxGeometry args={[casingWidth, height + casingWidth * 0.74, FRAME_DEPTH]} />
                <meshStandardMaterial color={casingColor} roughness={0.66} metalness={0.03} envMapIntensity={0.34} />
              </mesh>
            ))}
            <mesh
              name={nodeNames[baseIndex + 2]}
              position={[width / 2, height + casingWidth / 2, z]}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[width + casingWidth * 2, casingWidth, FRAME_DEPTH]} />
              <meshStandardMaterial color={casingColor} roughness={0.66} metalness={0.03} envMapIntensity={0.34} />
            </mesh>
            {type === "window" ? (
              <mesh
                name={nodeNames[baseIndex + 3]}
                position={[width / 2, -casingWidth / 2, z]}
                castShadow
                receiveShadow
              >
                <boxGeometry args={[width + casingWidth * 2, casingWidth, FRAME_DEPTH]} />
                <meshStandardMaterial color={casingColor} roughness={0.66} metalness={0.03} envMapIntensity={0.34} />
              </mesh>
            ) : null}
          </group>
        );
      })}
      {type === "door" ? (
        <mesh name={nodeNames[9]} position={[width / 2, DOOR_THRESHOLD_HEIGHT / 2, thresholdZ]} castShadow receiveShadow>
          <boxGeometry args={[width + casingWidth, DOOR_THRESHOLD_HEIGHT, DOOR_THRESHOLD_DEPTH]} />
          <meshStandardMaterial color="#b79d7d" roughness={0.54} metalness={0.18} envMapIntensity={0.32} />
        </mesh>
      ) : (
        <mesh name={nodeNames[12]} position={[width / 2, -casingWidth - WINDOW_SILL_HEIGHT / 2, sillZ]} castShadow receiveShadow>
          <boxGeometry
            args={[
              width + WINDOW_SILL_OVERHANG * 2,
              WINDOW_SILL_HEIGHT,
              WINDOW_SILL_DEPTH
            ]}
          />
          <meshStandardMaterial color="#d7cab8" roughness={0.62} metalness={0.04} envMapIntensity={0.32} />
        </mesh>
      )}
    </group>
  );
}

function DoorRuntimeModel({
  door,
  variant,
  runtimeRoot
}: {
  door: DoorSpec;
  variant: DoorVariant;
  runtimeRoot: THREE.Object3D;
}) {
  const registry = useInteractionRegistry();
  const rootRef = useRef<THREE.Group | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const config = DOOR_VISUALS[variant];

  const runtimeAsset = useMemo(() => {
    const clone = runtimeRoot.clone(true);
    const highlightMesh = prepareRuntimeAsset(clone);
    const baseSize = normalizeOpeningAsset(clone);
    return {
      root: clone,
      highlightMesh,
      baseSize
    };
  }, [runtimeRoot]);

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
    group.userData.openingVisual = {
      type: "door",
      variant,
      renderer: "InteractiveDoors",
      source: runtimeRoot.name.startsWith("ProceduralDoor:") ? "procedural-fallback" : "glb"
    };
    if (runtimeAsset.highlightMesh) {
      group.userData.highlightMesh = runtimeAsset.highlightMesh;
    }

    registry?.register(group);
    return () => registry?.unregister(group);
  }, [registry, runtimeAsset.highlightMesh, runtimeRoot.name, variant]);

  return (
    <>
      <OpeningTrim
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

function DoorGlbModel({ door }: { door: DoorSpec }) {
  const variant = resolveDoorVariant(door.width);
  const gltf = useGLBAsset(DOOR_VISUALS[variant].assetPath);
  return <DoorRuntimeModel door={door} variant={variant} runtimeRoot={gltf.scene} />;
}

function DoorProceduralFallback({ door }: { door: DoorSpec }) {
  const variant = resolveDoorVariant(door.width);
  const runtimeRoot = useMemo(() => createProceduralDoorAsset(variant), [variant]);
  return <DoorRuntimeModel door={door} variant={variant} runtimeRoot={runtimeRoot} />;
}

function WindowRuntimeModel({
  window,
  runtimeRoot
}: {
  window: WindowSpec;
  runtimeRoot: THREE.Object3D;
}) {
  const variant = resolveWindowVariant(window.width);

  const runtimeAsset = useMemo(() => {
    const clone = runtimeRoot.clone(true);
    prepareRuntimeAsset(clone);
    const baseSize = normalizeOpeningAsset(clone);
    return {
      root: clone,
      baseSize
    };
  }, [runtimeRoot]);

  return (
    <>
      <OpeningTrim
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
        userData={{
          openingVisual: {
            type: "window",
            variant,
            renderer: "InteractiveDoors",
            source: runtimeRoot.name.startsWith("ProceduralWindow:") ? "procedural-fallback" : "glb"
          }
        }}
      >
        <primitive object={runtimeAsset.root} />
      </group>
    </>
  );
}

function WindowGlbModel({ window }: { window: WindowSpec }) {
  const variant = resolveWindowVariant(window.width);
  const gltf = useGLBAsset(WINDOW_VISUALS[variant].assetPath);
  return <WindowRuntimeModel window={window} runtimeRoot={gltf.scene} />;
}

function WindowProceduralFallback({ window }: { window: WindowSpec }) {
  const variant = resolveWindowVariant(window.width);
  const runtimeRoot = useMemo(() => createProceduralWindowAsset(variant), [variant]);
  return <WindowRuntimeModel window={window} runtimeRoot={runtimeRoot} />;
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
        const offset = Math.min(
          Math.max(0, opening.offset * scale + placement.startInset),
          Math.max(0, length - width)
        );
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
        const offset = Math.min(
          Math.max(0, opening.offset * scale + placement.startInset),
          Math.max(0, length - width)
        );
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
        <OpeningModelErrorBoundary key={door.id} fallback={<DoorProceduralFallback door={door} />}>
          <DoorGlbModel door={door} />
        </OpeningModelErrorBoundary>
      ))}
      {windowSpecs.map((window) => (
        <OpeningModelErrorBoundary key={window.id} fallback={<WindowProceduralFallback window={window} />}>
          <WindowGlbModel window={window} />
        </OpeningModelErrorBoundary>
      ))}
    </group>
  );
}
