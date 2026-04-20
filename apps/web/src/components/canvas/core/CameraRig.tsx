"use client";

import { OrbitControls, OrthographicCamera, PerspectiveCamera, PointerLockControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { CapsuleCollider, type RapierRigidBody, RigidBody } from "@react-three/rapier";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import {
  resolvePreferredTopViewZoom,
  resolveTopViewInteractionPolicy
} from "../../../lib/editor/top-view-policy";
import type { SceneInteractionMode } from "../../../lib/scene/render-quality";
import { useEditorStore } from "../../../lib/stores/useEditorStore";
import { useCameraSelector, useShellSelector } from "../../../lib/stores/scene-slices";
import { useMobileControlsStore } from "../../../lib/stores/useMobileControlsStore";
import { resolveSharedViewerPresentationPolish } from "../../../lib/viewer/presentation";

type MoveState = {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
};

const WALK_SPEED = 3.5;
const BODY_Y = 1;
const EYE_HEIGHT = 0.6;
const ZOOM_EVENT_NAME = "plan2space:zoom";
const TOP_ROTATE_EVENT_NAME = "plan2space:top-rotate";

function clampValue(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function computeBounds(walls: { start: [number, number]; end: [number, number] }[], scale: number) {
  if (walls.length === 0) {
    return { minX: -2, maxX: 2, minZ: -2, maxZ: 2 };
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

function WalkRig({
  initialPosition,
  initialTarget,
  isTouch,
  farClip,
  fov
}: {
  initialPosition: [number, number, number];
  initialTarget: [number, number, number];
  isTouch: boolean;
  farClip: number;
  fov: number;
}) {
  const bodyRef = useRef<RapierRigidBody | null>(null);
  const pointerLockRef = useRef<any>(null);
  const moveState = useRef<MoveState>({ forward: false, backward: false, left: false, right: false });
  const { camera } = useThree();
  const resetLookDelta = useMobileControlsStore((state) => state.resetLookDelta);
  const yawRef = useRef(0);
  const pitchRef = useRef(0);

  useEffect(() => {
    const eyePosition = new THREE.Vector3(initialPosition[0], initialPosition[1] + EYE_HEIGHT, initialPosition[2]);
    const lookTarget = new THREE.Vector3(initialTarget[0], initialTarget[1], initialTarget[2]);
    const direction = lookTarget.sub(eyePosition).normalize();
    if (direction.lengthSq() <= 0) return;
    yawRef.current = Math.atan2(direction.x, direction.z);
    pitchRef.current = Math.asin(THREE.MathUtils.clamp(direction.y, -0.98, 0.98));
    camera.rotation.set(pitchRef.current, yawRef.current, 0, "YXZ");
  }, [camera, initialPosition, initialTarget]);

  useEffect(() => {
    if (isTouch) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === "KeyW") moveState.current.forward = true;
      if (event.code === "KeyS") moveState.current.backward = true;
      if (event.code === "KeyA") moveState.current.left = true;
      if (event.code === "KeyD") moveState.current.right = true;
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === "KeyW") moveState.current.forward = false;
      if (event.code === "KeyS") moveState.current.backward = false;
      if (event.code === "KeyA") moveState.current.left = false;
      if (event.code === "KeyD") moveState.current.right = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [isTouch]);

  useFrame(() => {
    if (!pointerLockRef.current?.isLocked && !isTouch) return;
    const body = bodyRef.current;
    if (!body) return;
    if (isTouch) {
      const { lookDelta } = useMobileControlsStore.getState();
      if (lookDelta.x !== 0 || lookDelta.y !== 0) {
        yawRef.current -= lookDelta.x * 0.002;
        pitchRef.current -= lookDelta.y * 0.002;
        pitchRef.current = Math.max(-1.2, Math.min(1.2, pitchRef.current));
        camera.rotation.set(pitchRef.current, yawRef.current, 0, "YXZ");
        resetLookDelta();
      }
    }
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    direction.y = 0;
    if (direction.lengthSq() === 0) return;
    direction.normalize();
    const right = new THREE.Vector3().crossVectors(direction, new THREE.Vector3(0, 1, 0)).normalize();

    const movement = new THREE.Vector3();
    if (isTouch) {
      const { move } = useMobileControlsStore.getState();
      const forward = -move.y;
      const strafe = move.x;
      if (Math.abs(forward) > 0.01) movement.add(direction.clone().multiplyScalar(forward));
      if (Math.abs(strafe) > 0.01) movement.add(right.clone().multiplyScalar(strafe));
    } else {
      if (moveState.current.forward) movement.add(direction);
      if (moveState.current.backward) movement.sub(direction);
      if (moveState.current.left) movement.sub(right);
      if (moveState.current.right) movement.add(right);
    }

    const current = body.linvel();
    if (movement.lengthSq() > 0) {
      movement.normalize();
      body.setLinvel({ x: movement.x * WALK_SPEED, y: current.y, z: movement.z * WALK_SPEED }, true);
    } else {
      body.setLinvel({ x: 0, y: current.y, z: 0 }, true);
    }
  });

  return (
    <RigidBody
      ref={bodyRef}
      position={initialPosition}
      colliders={false}
      enabledRotations={[false, false, false]}
      linearDamping={0.85}
    >
      <CapsuleCollider args={[0.35, 0.6]} />
      <group position={[0, EYE_HEIGHT, 0]}>
        <PerspectiveCamera makeDefault fov={fov} near={0.08} far={farClip} />
        {!isTouch ? <PointerLockControls ref={pointerLockRef} /> : null}
      </group>
    </RigidBody>
  );
}

export default function CameraRig({ interactionMode = "editor" }: { interactionMode?: SceneInteractionMode }) {
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  const viewMode = useEditorStore((state) => state.viewMode);
  const topMode = useEditorStore((state) => state.topMode);
  const isTransforming = useEditorStore((state) => state.isTransforming);
  const walls = useShellSelector((slice) => slice.walls);
  const openings = useShellSelector((slice) => slice.openings);
  const scale = useShellSelector((slice) => slice.scale);
  const cameraAnchors = useShellSelector((slice) => slice.cameraAnchors);
  const entranceId = useCameraSelector((slice) => slice.entranceId);
  const [isTouch, setIsTouch] = useState(false);

  const orthoRef = useRef<THREE.OrthographicCamera | null>(null);
  const controlsRef = useRef<any>(null);
  const topRotationRef = useRef(0);
  const topViewPolicy = useMemo(
    () => resolveTopViewInteractionPolicy(topMode),
    [topMode]
  );
  const viewerPresentationPolish = useMemo(
    () =>
      resolveSharedViewerPresentationPolish(
        interactionMode === "viewer-showcase" ? "showcase" : "shared"
      ),
    [interactionMode]
  );
  const bounds = useMemo(() => computeBounds(walls, scale), [walls, scale]);
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerZ = (bounds.minZ + bounds.maxZ) / 2;
  const radius = Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ, 1);
  const topHeight = Math.max(6, radius);
  const zoom = Math.max(58, 210 / radius);
  const presentationZoom = zoom * viewerPresentationPolish.topZoomMultiplier;
  const builderDistance = Math.max(4.8, radius * 1.45);
  const builderHeight = Math.max(3.1, radius * 0.92);
  const builderTargetY = Math.max(1.15, radius * 0.12);
  const walkFarClip = Math.max(42, radius * 10);
  const walkFov = viewerPresentationPolish.walkFov;

  const initialPosition = useMemo((): [number, number, number] => {
    const preferredAnchor =
      cameraAnchors.find((anchor) => anchor.kind === "entrance") ??
      cameraAnchors.find((anchor) => anchor.kind === "overview") ??
      cameraAnchors.find((anchor) => anchor.kind === "room_center");
    if (preferredAnchor) {
      const baseX = preferredAnchor.planPosition[0] * scale;
      const baseZ = preferredAnchor.planPosition[1] * scale;
      if (preferredAnchor.kind === "entrance" && preferredAnchor.targetPlanPosition) {
        const targetX = preferredAnchor.targetPlanPosition[0] * scale;
        const targetZ = preferredAnchor.targetPlanPosition[1] * scale;
        const dx = targetX - baseX;
        const dz = targetZ - baseZ;
        const length = Math.hypot(dx, dz);
        if (length > 0.001) {
          const inwardOffset = Math.min(Math.max(0.8, radius * 0.16), Math.max(0.8, length * 0.6));
          return [
            baseX + (dx / length) * inwardOffset,
            Math.max(BODY_Y, preferredAnchor.height),
            baseZ + (dz / length) * inwardOffset
          ];
        }
      }
      return [
        baseX,
        Math.max(BODY_Y, preferredAnchor.height),
        baseZ
      ];
    }

    const entrance =
      (entranceId ? openings.find((o) => o.id === entranceId) : null) ??
      openings.find((o) => o.type === "door");
    if (entrance) {
      const wall = walls.find((w) => w.id === entrance.wallId);
      if (wall) {
        const dx = wall.end[0] - wall.start[0];
        const dz = wall.end[1] - wall.start[1];
        const length = Math.sqrt(dx * dx + dz * dz);
        const ratio = length > 0 ? entrance.offset / length : 0;
        return [
          (wall.start[0] + dx * ratio) * scale,
          BODY_Y,
          (wall.start[1] + dz * ratio) * scale
        ];
      }
    }
    return [
      centerX + radius * viewerPresentationPolish.walkFallbackOffset.x,
      BODY_Y,
      centerZ + radius * viewerPresentationPolish.walkFallbackOffset.z
    ];
  }, [
    cameraAnchors,
    centerX,
    centerZ,
    entranceId,
    openings,
    radius,
    scale,
    viewerPresentationPolish.walkFallbackOffset.x,
    viewerPresentationPolish.walkFallbackOffset.z,
    walls
  ]);

  const initialTarget = useMemo((): [number, number, number] => {
    const preferredAnchor =
      cameraAnchors.find((anchor) => anchor.kind === "entrance") ??
      cameraAnchors.find((anchor) => anchor.kind === "overview") ??
      cameraAnchors.find((anchor) => anchor.kind === "room_center");

    if (preferredAnchor?.targetPlanPosition) {
      return [
        preferredAnchor.targetPlanPosition[0] * scale,
        Math.max(1.2, preferredAnchor.height * 0.72),
        preferredAnchor.targetPlanPosition[1] * scale
      ];
    }

    return [centerX, Math.max(1.2, builderTargetY + viewerPresentationPolish.walkTargetLift), centerZ];
  }, [builderTargetY, cameraAnchors, centerX, centerZ, scale, viewerPresentationPolish.walkTargetLift]);

  useEffect(() => {
    const supportsTouch = typeof window !== "undefined" &&
      (window.matchMedia?.("(pointer: coarse)")?.matches || navigator.maxTouchPoints > 0);
    setIsTouch(Boolean(supportsTouch));
  }, []);

  const applyTopCamera = useMemo(
    () => (nextZoom?: number) => {
      if (!orthoRef.current) return;
      const camera = orthoRef.current;
      camera.position.set(centerX, topHeight, centerZ);
      camera.up.set(Math.sin(topRotationRef.current), 0, -Math.cos(topRotationRef.current));
      camera.zoom = clampValue(
        nextZoom ?? resolvePreferredTopViewZoom(topMode, presentationZoom, camera.zoom),
        topViewPolicy.zoomBounds.min,
        topViewPolicy.zoomBounds.max
      );
      camera.lookAt(centerX, 0, centerZ);
      camera.updateProjectionMatrix();
      invalidate();
    },
    [
      centerX,
      centerZ,
      invalidate,
      topHeight,
      topMode,
      topViewPolicy.zoomBounds.max,
      topViewPolicy.zoomBounds.min,
      presentationZoom
    ]
  );

  useEffect(() => {
    if (viewMode === "top") {
      applyTopCamera(resolvePreferredTopViewZoom(topMode, presentationZoom, orthoRef.current?.zoom));
    }
  }, [applyTopCamera, presentationZoom, topMode, viewMode]);

  useEffect(() => {
    if (viewMode !== "top") return;

    const element = gl.domElement;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (!orthoRef.current) return;
      const factor = event.deltaY < 0 ? 1.1 : 1 / 1.1;
      applyTopCamera(orthoRef.current.zoom * factor);
    };

    element.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      element.removeEventListener("wheel", handleWheel);
    };
  }, [applyTopCamera, gl.domElement, viewMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleZoomEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{ direction?: "in" | "out" }>;
      const direction = customEvent.detail?.direction;
      if (direction !== "in" && direction !== "out") return;

      if (viewMode === "top" && orthoRef.current) {
        const factor = direction === "in" ? 1.15 : 1 / 1.15;
        applyTopCamera(orthoRef.current.zoom * factor);
        return;
      }

      if (viewMode === "builder-preview" && controlsRef.current) {
        if (direction === "in") {
          controlsRef.current.dollyIn?.(1.15);
        } else {
          controlsRef.current.dollyOut?.(1.15);
        }
        controlsRef.current.update?.();
        invalidate();
      }
    };

    window.addEventListener(ZOOM_EVENT_NAME, handleZoomEvent as EventListener);
    return () => {
      window.removeEventListener(ZOOM_EVENT_NAME, handleZoomEvent as EventListener);
    };
  }, [applyTopCamera, invalidate, viewMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleTopRotateEvent = (event: Event) => {
      if (viewMode !== "top") return;
      const customEvent = event as CustomEvent<{ direction?: "left" | "right" }>;
      const direction = customEvent.detail?.direction;
      if (direction !== "left" && direction !== "right") return;

      topRotationRef.current +=
        direction === "left" ? topViewPolicy.rotateStep : -topViewPolicy.rotateStep;
      applyTopCamera();
    };

    window.addEventListener(TOP_ROTATE_EVENT_NAME, handleTopRotateEvent as EventListener);
    return () => {
      window.removeEventListener(TOP_ROTATE_EVENT_NAME, handleTopRotateEvent as EventListener);
    };
  }, [applyTopCamera, topViewPolicy.rotateStep, viewMode]);

  if (viewMode === "walk") {
    return (
      <WalkRig
        initialPosition={initialPosition}
        initialTarget={initialTarget}
        isTouch={isTouch}
        farClip={walkFarClip}
        fov={walkFov}
      />
    );
  }

  if (viewMode === "builder-preview") {
    return (
      <>
        <PerspectiveCamera
          makeDefault
          fov={38}
          near={0.1}
          far={2000}
          position={[centerX + builderDistance * 1.18, builderHeight + 1.45, centerZ + builderDistance * 1.18]}
        />
        <OrbitControls
          ref={controlsRef}
          target={[centerX, builderTargetY, centerZ]}
          enabled={!isTransforming}
          enableRotate
          enablePan={false}
          enableZoom
          enableDamping
          dampingFactor={0.09}
          rotateSpeed={0.8}
          zoomSpeed={0.95}
          minPolarAngle={Math.PI * 0.2}
          maxPolarAngle={Math.PI * 0.54}
          minDistance={Math.max(3.2, radius * 0.85)}
          maxDistance={Math.max(16, radius * 3.2)}
        />
      </>
    );
  }

  return (
    <>
      <OrthographicCamera ref={orthoRef} makeDefault zoom={zoom} near={0.1} far={2000} />
    </>
  );
}
