"use client";

import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { CapsuleCollider, type RapierRigidBody, RigidBody } from "@react-three/rapier";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { SceneInteractionMode } from "../../../lib/scene/render-quality";
import { useEditorStore } from "../../../lib/stores/useEditorStore";
import { useInteractionStore } from "../../../lib/stores/useInteractionStore";
import {
  useAssetSelector,
  useCameraSelector,
  useSelectionSelector,
  useShellSelector
} from "../../../lib/stores/scene-slices";
import { useMobileControlsStore } from "../../../lib/stores/useMobileControlsStore";
import { resolveSharedViewerPresentationPolish } from "../../../lib/viewer/presentation";
import {
  WALK_KEYBOARD_RESET_EVENT,
  WALK_VIEWPORT_FOCUS_EVENT,
  type WalkKeyboardResetDetail,
  isEditableWalkKeyboardTarget,
  resolveWalkMovementKey
} from "../../../lib/runtime/walk-keyboard";

type MoveState = {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
};

const WALK_SPEED = 3.5;
const BODY_Y = 1;
const EYE_HEIGHT = 0.6;
const ZOOM_EVENT_NAME = "deskterioronline:zoom";

type WalkKeyboardDebugState = {
  active: boolean;
  pointerLocked: boolean;
  pointerLockBlocked: boolean;
  pointerLockUnavailable: boolean;
  canvasFocusLookActive: boolean;
  canvasFocused: boolean;
  movementBlockedByPanel: boolean;
  moveState: MoveState;
  cameraPosition: [number, number, number];
  bodyPosition: [number, number, number] | null;
  lastMovementAt: number | null;
};

function createEmptyMoveState(): MoveState {
  return {
    forward: false,
    backward: false,
    left: false,
    right: false
  };
}

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

function measureAssetPlanExtent(asset: {
  product?: {
    dimensionsMm?: {
      width?: number;
      depth?: number;
      height?: number;
    };
  } | null;
  scale: [number, number, number];
} | null) {
  if (!asset) return 0;
  const width =
    ((asset.product?.dimensionsMm?.width ?? 0) / 1000) * Math.max(asset.scale[0], 0.001);
  const depth =
    ((asset.product?.dimensionsMm?.depth ?? 0) / 1000) * Math.max(asset.scale[2], 0.001);
  const fallback = Math.max(Math.abs(asset.scale[0]), Math.abs(asset.scale[2]), 0.9);
  return Math.max(width, depth, fallback);
}

function hasDistinctPlanTarget(
  origin: [number, number] | undefined,
  target: [number, number] | undefined
) {
  if (!origin || !target) return false;
  return Math.hypot(target[0] - origin[0], target[1] - origin[1]) > 0.12;
}

function clampWalkCoordinate(value: number, min: number, max: number, margin: number) {
  const lower = min + margin;
  const upper = max - margin;
  if (lower <= upper) {
    return clampValue(value, lower, upper);
  }
  return (min + max) / 2;
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
  const pointerLockedRef = useRef(false);
  const pointerLockUnavailableRef = useRef(false);
  const moveState = useRef<MoveState>(createEmptyMoveState());
  const { camera, gl } = useThree();
  const resetLookDelta = useMobileControlsStore((state) => state.resetLookDelta);
  const setWalkPointerLockStatus = useInteractionStore((state) => state.setWalkPointerLockStatus);
  const panels = useEditorStore((state) => state.panels);
  const blockPointerLock = panels.assets || panels.properties;
  const yawRef = useRef(0);
  const pitchRef = useRef(0);
  const lastMovementAtRef = useRef<number | null>(null);
  const debugStateRef = useRef<WalkKeyboardDebugState | null>(null);

  const publishDebugState = useCallback((state: Partial<WalkKeyboardDebugState>) => {
    if (typeof window === "undefined") return;
    const nextState: WalkKeyboardDebugState = {
      active: true,
      pointerLocked: false,
      pointerLockBlocked: false,
      pointerLockUnavailable: false,
      canvasFocusLookActive: false,
      canvasFocused: false,
      movementBlockedByPanel: false,
      moveState: { forward: false, backward: false, left: false, right: false },
      cameraPosition: [0, 0, 0],
      bodyPosition: null,
      lastMovementAt: null,
      ...debugStateRef.current,
      ...state
    };
    debugStateRef.current = nextState;
    (window as typeof window & {
      __DESKTERIORONLINE_WALK_KEYBOARD_DEBUG__?: WalkKeyboardDebugState;
    }).__DESKTERIORONLINE_WALK_KEYBOARD_DEBUG__ = nextState;
  }, []);

  useEffect(() => {
    if (isTouch) {
      setWalkPointerLockStatus({ locked: false, blocked: false });
    }
  }, [isTouch, setWalkPointerLockStatus]);

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
    const canvas = gl.domElement;
    const ownerDocument = canvas.ownerDocument;
    let pointerLockRequestInFlight = false;
    const previousTabIndex = canvas.getAttribute("tabindex");

    const focusCanvas = () => {
      if (!canvas.isConnected || ownerDocument.visibilityState === "hidden") return;
      canvas.focus({ preventScroll: true });
      publishDebugState({
        canvasFocused: ownerDocument.activeElement === canvas,
        movementBlockedByPanel: blockPointerLock
      });
    };

    const resetMovementState = (state?: {
      canvasFocused?: boolean;
      pointerLocked?: boolean;
      pointerLockBlocked?: boolean;
      focusViewport?: boolean;
    }) => {
      moveState.current = createEmptyMoveState();
      if (state?.focusViewport) {
        focusCanvas();
      }
      publishDebugState({
        pointerLocked: state?.pointerLocked ?? (pointerLockedRef.current || isPointerLocked()),
        pointerLockBlocked: state?.pointerLockBlocked ?? blockPointerLock,
        pointerLockUnavailable: pointerLockUnavailableRef.current,
        canvasFocusLookActive:
          !pointerLockedRef.current && !isPointerLocked() && ownerDocument.activeElement === canvas,
        canvasFocused: state?.canvasFocused ?? ownerDocument.activeElement === canvas,
        movementBlockedByPanel: state?.pointerLockBlocked ?? blockPointerLock,
        moveState: { ...moveState.current }
      });
    };

    const canRequestPointerLock = () =>
      !blockPointerLock &&
      typeof canvas.requestPointerLock === "function" &&
      canvas.isConnected &&
      ownerDocument.contains(canvas) &&
      ownerDocument.visibilityState !== "hidden";

    const isPointerLocked = () => ownerDocument.pointerLockElement === canvas;

    canvas.tabIndex = 0;
    const focusFrame = window.requestAnimationFrame(() => {
      if (!blockPointerLock) {
        focusCanvas();
      }
    });
    setWalkPointerLockStatus({
      locked: isPointerLocked(),
      blocked: blockPointerLock
    });
    resetMovementState();

    if (blockPointerLock && isPointerLocked()) {
      ownerDocument.exitPointerLock();
      pointerLockedRef.current = false;
      setWalkPointerLockStatus({ locked: false, blocked: true });
      resetMovementState({
        pointerLocked: false,
        pointerLockBlocked: true
      });
    }

    const handleCanvasPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      focusCanvas();
      if (pointerLockedRef.current || isPointerLocked()) return;
      if (pointerLockRequestInFlight || !canRequestPointerLock()) return;

      event.preventDefault();
      pointerLockRequestInFlight = true;
      const lockResult = canvas.requestPointerLock();
      pointerLockedRef.current = true;
      pointerLockUnavailableRef.current = false;
      setWalkPointerLockStatus({ locked: true, blocked: false });
      if (lockResult && typeof lockResult.then === "function") {
        lockResult
          .then(() => {
            pointerLockedRef.current = isPointerLocked();
            setWalkPointerLockStatus({
              locked: pointerLockedRef.current,
              blocked: false
            });
            publishDebugState({
              pointerLocked: pointerLockedRef.current,
              pointerLockBlocked: false,
              pointerLockUnavailable: false,
              canvasFocusLookActive: false,
              canvasFocused: ownerDocument.activeElement === canvas
            });
          })
          .catch(() => {
            pointerLockedRef.current = false;
            pointerLockUnavailableRef.current = true;
            setWalkPointerLockStatus({ locked: false, blocked: false });
            resetMovementState({
              pointerLocked: false,
              pointerLockBlocked: false,
              focusViewport: true
            });
          })
          .finally(() => {
            pointerLockRequestInFlight = false;
          });
      } else {
        pointerLockRequestInFlight = false;
      }
    };

    const handlePointerLockChange = () => {
      pointerLockedRef.current = isPointerLocked();
      if (pointerLockedRef.current || blockPointerLock) {
        pointerLockUnavailableRef.current = false;
      }
      setWalkPointerLockStatus({
        locked: pointerLockedRef.current,
        blocked: blockPointerLock
      });
      publishDebugState({
        pointerLocked: pointerLockedRef.current,
        pointerLockBlocked: blockPointerLock,
        pointerLockUnavailable: pointerLockUnavailableRef.current && !pointerLockedRef.current,
        canvasFocusLookActive:
          !pointerLockedRef.current && !blockPointerLock && ownerDocument.activeElement === canvas,
        canvasFocused: ownerDocument.activeElement === canvas
      });
      if (!pointerLockedRef.current) {
        resetMovementState({
          pointerLocked: false,
          pointerLockBlocked: blockPointerLock
        });
      }
    };

    const handlePointerLockError = () => {
      pointerLockRequestInFlight = false;
      pointerLockedRef.current = false;
      pointerLockUnavailableRef.current = true;
      setWalkPointerLockStatus({ locked: false, blocked: false });
      resetMovementState({
        pointerLocked: false,
        pointerLockBlocked: false,
        focusViewport: true
      });
    };

    const handleMouseMove = (event: MouseEvent) => {
      const pointerLocked = pointerLockedRef.current || isPointerLocked();
      const eventPath = typeof event.composedPath === "function" ? event.composedPath() : [];
      const canvasFocusLook =
        !pointerLocked &&
        !blockPointerLock &&
        ownerDocument.activeElement === canvas &&
        (event.target === canvas || eventPath.includes(canvas));
      if (!pointerLocked && !canvasFocusLook) return;
      pointerLockedRef.current = pointerLocked;
      if (canvasFocusLook) {
        pointerLockUnavailableRef.current = false;
        setWalkPointerLockStatus({ locked: false, blocked: false });
      }
      yawRef.current -= event.movementX * 0.002;
      pitchRef.current -= event.movementY * 0.002;
      pitchRef.current = Math.max(-1.2, Math.min(1.2, pitchRef.current));
      camera.rotation.set(pitchRef.current, yawRef.current, 0, "YXZ");
      publishDebugState({
        pointerLocked,
        pointerLockBlocked: false,
        pointerLockUnavailable: pointerLockUnavailableRef.current && !canvasFocusLook,
        canvasFocusLookActive: canvasFocusLook,
        canvasFocused: ownerDocument.activeElement === canvas
      });
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const movementKey = resolveWalkMovementKey(event);
      if (!movementKey || isEditableWalkKeyboardTarget(event.target)) return;

      if (blockPointerLock) {
        resetMovementState({
          pointerLocked: false,
          pointerLockBlocked: true
        });
        return;
      }

      const pointerLocked = pointerLockedRef.current || isPointerLocked();
      const canvasFocused = ownerDocument.activeElement === canvas;
      if (!pointerLocked && !canvasFocused) return;

      event.preventDefault();
      pointerLockedRef.current = pointerLocked;
      moveState.current[movementKey] = true;
      publishDebugState({
        pointerLocked,
        pointerLockBlocked: false,
        canvasFocused,
        movementBlockedByPanel: false,
        moveState: { ...moveState.current }
      });
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      const movementKey = resolveWalkMovementKey(event, { allowModified: true });
      if (!movementKey) return;

      const pointerLocked = pointerLockedRef.current || isPointerLocked();
      const canvasFocused = ownerDocument.activeElement === canvas;
      if (pointerLocked || canvasFocused) {
        event.preventDefault();
      }
      moveState.current[movementKey] = false;
      publishDebugState({
        pointerLocked,
        canvasFocused,
        movementBlockedByPanel: blockPointerLock,
        moveState: { ...moveState.current }
      });
    };

    const handleFocusRequest = () => {
      focusCanvas();
    };

    const handleResetKeyboard = (event: Event) => {
      const detail = (event as CustomEvent<WalkKeyboardResetDetail>).detail;
      resetMovementState({
        focusViewport: detail?.focusViewport ?? false,
        pointerLocked: pointerLockedRef.current || isPointerLocked(),
        pointerLockBlocked: blockPointerLock
      });
    };

    canvas.addEventListener("pointerdown", handleCanvasPointerDown);
    window.addEventListener(WALK_KEYBOARD_RESET_EVENT, handleResetKeyboard);
    window.addEventListener(WALK_VIEWPORT_FOCUS_EVENT, handleFocusRequest);
    ownerDocument.addEventListener("pointerlockchange", handlePointerLockChange);
    ownerDocument.addEventListener("pointerlockerror", handlePointerLockError);
    ownerDocument.addEventListener("mousemove", handleMouseMove);
    ownerDocument.addEventListener("keydown", handleKeyDown);
    ownerDocument.addEventListener("keyup", handleKeyUp);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      canvas.removeEventListener("pointerdown", handleCanvasPointerDown);
      window.removeEventListener(WALK_KEYBOARD_RESET_EVENT, handleResetKeyboard);
      window.removeEventListener(WALK_VIEWPORT_FOCUS_EVENT, handleFocusRequest);
      ownerDocument.removeEventListener("pointerlockchange", handlePointerLockChange);
      ownerDocument.removeEventListener("pointerlockerror", handlePointerLockError);
      ownerDocument.removeEventListener("mousemove", handleMouseMove);
      ownerDocument.removeEventListener("keydown", handleKeyDown);
      ownerDocument.removeEventListener("keyup", handleKeyUp);
      if (isPointerLocked()) {
        ownerDocument.exitPointerLock();
      }
      if (previousTabIndex === null) {
        canvas.removeAttribute("tabindex");
      } else {
        canvas.setAttribute("tabindex", previousTabIndex);
      }
      pointerLockedRef.current = false;
      pointerLockUnavailableRef.current = false;
      moveState.current = createEmptyMoveState();
      setWalkPointerLockStatus({ locked: false, blocked: false });
      if (typeof window !== "undefined") {
        (window as typeof window & {
          __DESKTERIORONLINE_WALK_KEYBOARD_DEBUG__?: WalkKeyboardDebugState;
        }).__DESKTERIORONLINE_WALK_KEYBOARD_DEBUG__ = {
          ...(debugStateRef.current ?? {
            cameraPosition: [camera.position.x, camera.position.y, camera.position.z],
            bodyPosition: null,
            lastMovementAt: null,
            moveState: { forward: false, backward: false, left: false, right: false },
            canvasFocused: false
          }),
          active: false,
          pointerLocked: false,
          pointerLockBlocked: false,
          pointerLockUnavailable: false,
          canvasFocusLookActive: false,
          movementBlockedByPanel: false,
          moveState: { forward: false, backward: false, left: false, right: false }
        };
      }
    };
  }, [blockPointerLock, camera, gl.domElement, isTouch, publishDebugState, setWalkPointerLockStatus]);

  useFrame(() => {
    const isDesktopPointerLocked =
      !isTouch && gl.domElement.ownerDocument.pointerLockElement === gl.domElement;
    if (isDesktopPointerLocked && !pointerLockedRef.current) {
      pointerLockedRef.current = true;
      useInteractionStore.getState().setWalkPointerLockStatus({ locked: true, blocked: false });
    }
    const isDesktopCanvasFocused =
      !isTouch && gl.domElement.ownerDocument.activeElement === gl.domElement;
    if (!pointerLockedRef.current && !isTouch && !isDesktopCanvasFocused) return;
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
      lastMovementAtRef.current = performance.now();
    } else {
      body.setLinvel({ x: 0, y: current.y, z: 0 }, true);
    }
    const bodyTranslation = body.translation();
    publishDebugState({
      pointerLocked: pointerLockedRef.current || isDesktopPointerLocked,
      pointerLockBlocked: !isTouch && blockPointerLock,
      pointerLockUnavailable: !isTouch && pointerLockUnavailableRef.current && !isDesktopPointerLocked,
      canvasFocusLookActive: !isTouch && !isDesktopPointerLocked && isDesktopCanvasFocused,
      canvasFocused: isDesktopCanvasFocused,
      movementBlockedByPanel: !isTouch && blockPointerLock,
      moveState: { ...moveState.current },
      cameraPosition: [camera.position.x, camera.position.y, camera.position.z],
      bodyPosition: [bodyTranslation.x, bodyTranslation.y, bodyTranslation.z],
      lastMovementAt: lastMovementAtRef.current
    });
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
        <PerspectiveCamera makeDefault fov={fov} near={0.03} far={farClip} />
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
  const selectedAssetId = useSelectionSelector((slice) => slice.selectedAssetId);
  const assets = useAssetSelector((slice) => slice.assets);
  const walls = useShellSelector((slice) => slice.walls);
  const openings = useShellSelector((slice) => slice.openings);
  const scale = useShellSelector((slice) => slice.scale);
  const cameraAnchors = useShellSelector((slice) => slice.cameraAnchors);
  const entranceId = useCameraSelector((slice) => slice.entranceId);
  const [isTouch, setIsTouch] = useState(false);

  const controlsRef = useRef<any>(null);
  const viewerPresentationPolish = useMemo(
    () =>
      resolveSharedViewerPresentationPolish(
        interactionMode === "viewer-showcase" ? "showcase" : "shared"
      ),
    [interactionMode]
  );
  const enableTopOrbit = viewMode === "top";
  const bounds = useMemo(() => computeBounds(walls, scale), [walls, scale]);
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerZ = (bounds.minZ + bounds.maxZ) / 2;
  const radius = Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ, 1);
  const selectedAsset = useMemo(
    () => assets.find((asset) => asset.id === selectedAssetId) ?? null,
    [assets, selectedAssetId]
  );
  const precisionFocusAsset = useMemo(() => {
    if (topMode !== "desk-precision") return null;
    if (!selectedAsset) return null;
    if (selectedAsset.supportAssetId) {
      return assets.find((asset) => asset.id === selectedAsset.supportAssetId) ?? selectedAsset;
    }
    return selectedAsset;
  }, [assets, selectedAsset, topMode]);
  const precisionExtent = measureAssetPlanExtent(precisionFocusAsset);
  const topTargetX = precisionFocusAsset?.position[0] ?? centerX;
  const topTargetZ = precisionFocusAsset?.position[2] ?? centerZ;
  const topTargetY =
    topMode === "desk-precision" && precisionFocusAsset
      ? Math.max(0.42, precisionFocusAsset.position[1] + precisionExtent * 0.18)
      : Math.max(1.15, radius * 0.12);
  const builderDistance = Math.max(4.8, radius * 1.45);
  const builderHeight = Math.max(3.1, radius * 0.92);
  const builderTargetY = Math.max(1.15, radius * 0.12);
  const roomTopDistance = Math.max(5.6, radius * (interactionMode === "viewer-showcase" ? 1.34 : 1.42));
  const roomTopHeight = Math.max(4.1, radius * (interactionMode === "viewer-showcase" ? 0.94 : 1.02));
  const precisionTopDistance = precisionFocusAsset
    ? Math.max(2.1, precisionExtent * 2.6)
    : Math.max(4.2, radius * 1.08);
  const precisionTopHeight = precisionFocusAsset
    ? Math.max(1.6, precisionExtent * 1.25)
    : Math.max(3, radius * 0.72);
  const topOrbitDistance = topMode === "desk-precision" ? precisionTopDistance : roomTopDistance;
  const topOrbitHeight = topMode === "desk-precision" ? precisionTopHeight : roomTopHeight;
  const topOrbitFov = topMode === "desk-precision" ? 34 : interactionMode === "viewer-showcase" ? 34 : 38;
  const walkFarClip = Math.max(42, radius * 10);
  const walkFov = viewerPresentationPolish.walkFov;
  const walkMargin = Math.min(Math.max(0.6, radius * 0.14), Math.max(radius / 2 - 0.18, 0.6));

  const initialPosition = useMemo((): [number, number, number] => {
    const preferredAnchor =
      interactionMode === "editor"
        ? cameraAnchors.find((anchor) => anchor.kind === "room_center") ??
          cameraAnchors.find((anchor) => anchor.kind === "overview") ??
          cameraAnchors.find((anchor) => anchor.kind === "entrance")
        : cameraAnchors.find((anchor) => anchor.kind === "entrance") ??
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
          const inwardOffset = Math.min(Math.max(1.18, radius * 0.24), Math.max(1.18, length * 0.82));
          return [
            clampWalkCoordinate(baseX + (dx / length) * inwardOffset, bounds.minX, bounds.maxX, walkMargin),
            Math.max(BODY_Y, preferredAnchor.height),
            clampWalkCoordinate(baseZ + (dz / length) * inwardOffset, bounds.minZ, bounds.maxZ, walkMargin)
          ];
        }
      }
      return [
        clampWalkCoordinate(baseX, bounds.minX, bounds.maxX, walkMargin),
        Math.max(BODY_Y, preferredAnchor.height),
        clampWalkCoordinate(baseZ, bounds.minZ, bounds.maxZ, walkMargin)
      ];
    }

    const entrance =
      interactionMode === "editor"
        ? null
        : (entranceId ? openings.find((o) => o.id === entranceId) : null) ??
          openings.find((o) => o.type === "door");
    if (entrance) {
      const wall = walls.find((w) => w.id === entrance.wallId);
      if (wall) {
        const dx = wall.end[0] - wall.start[0];
        const dz = wall.end[1] - wall.start[1];
        const length = Math.sqrt(dx * dx + dz * dz);
        const ratio = length > 0 ? entrance.offset / length : 0;
        return [
          clampWalkCoordinate((wall.start[0] + dx * ratio) * scale, bounds.minX, bounds.maxX, walkMargin),
          BODY_Y,
          clampWalkCoordinate((wall.start[1] + dz * ratio) * scale, bounds.minZ, bounds.maxZ, walkMargin)
        ];
      }
    }
    return [
      clampWalkCoordinate(
        centerX + radius * viewerPresentationPolish.walkFallbackOffset.x,
        bounds.minX,
        bounds.maxX,
        walkMargin
      ),
      BODY_Y,
      clampWalkCoordinate(
        centerZ + radius * viewerPresentationPolish.walkFallbackOffset.z,
        bounds.minZ,
        bounds.maxZ,
        walkMargin
      )
    ];
  }, [
    bounds.maxX,
    bounds.maxZ,
    bounds.minX,
    bounds.minZ,
    cameraAnchors,
    centerX,
    centerZ,
    entranceId,
    interactionMode,
    openings,
    radius,
    scale,
    viewerPresentationPolish.walkFallbackOffset.x,
    viewerPresentationPolish.walkFallbackOffset.z,
    walkMargin,
    walls
  ]);

  const initialTarget = useMemo((): [number, number, number] => {
    const preferredAnchor =
      interactionMode === "editor"
        ? cameraAnchors.find((anchor) => anchor.kind === "room_center") ??
          cameraAnchors.find((anchor) => anchor.kind === "overview") ??
          cameraAnchors.find((anchor) => anchor.kind === "entrance")
        : cameraAnchors.find((anchor) => anchor.kind === "entrance") ??
          cameraAnchors.find((anchor) => anchor.kind === "overview") ??
          cameraAnchors.find((anchor) => anchor.kind === "room_center");

    if (
      preferredAnchor?.targetPlanPosition &&
      hasDistinctPlanTarget(preferredAnchor.planPosition, preferredAnchor.targetPlanPosition)
    ) {
      return [
        preferredAnchor.targetPlanPosition[0] * scale,
        Math.max(1.2, preferredAnchor.height * 0.72),
        preferredAnchor.targetPlanPosition[1] * scale
      ];
    }

    return [
      clampWalkCoordinate(centerX, bounds.minX, bounds.maxX, walkMargin),
      Math.max(1.2, builderTargetY + viewerPresentationPolish.walkTargetLift),
      clampWalkCoordinate(centerZ - Math.max(0.8, radius * 0.28), bounds.minZ, bounds.maxZ, walkMargin)
    ];
  }, [
    bounds.maxX,
    bounds.maxZ,
    bounds.minX,
    bounds.minZ,
    builderTargetY,
    cameraAnchors,
    centerX,
    centerZ,
    interactionMode,
    radius,
    scale,
    viewerPresentationPolish.walkTargetLift,
    walkMargin
  ]);

  useEffect(() => {
    const supportsTouch = typeof window !== "undefined" &&
      (window.matchMedia?.("(pointer: coarse)")?.matches || navigator.maxTouchPoints > 0);
    setIsTouch(Boolean(supportsTouch));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleZoomEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{ direction?: "in" | "out" }>;
      const direction = customEvent.detail?.direction;
      if (direction !== "in" && direction !== "out") return;

      if (viewMode === "top" && controlsRef.current) {
        if (direction === "in") {
          controlsRef.current.dollyIn?.(1.15);
        } else {
          controlsRef.current.dollyOut?.(1.15);
        }
        controlsRef.current.update?.();
        invalidate();
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
  }, [invalidate, viewMode]);

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
          onChange={() => invalidate()}
          dampingFactor={0.09}
          rotateSpeed={0.8}
          zoomSpeed={0.95}
          minPolarAngle={Math.PI * 0.22}
          maxPolarAngle={Math.PI * 0.44}
          minDistance={Math.max(3.2, radius * 0.85)}
          maxDistance={Math.max(16, radius * 3.2)}
        />
      </>
    );
  }

  if (enableTopOrbit) {
    return (
      <>
        <PerspectiveCamera
          makeDefault
          fov={topOrbitFov}
          near={0.1}
          far={2000}
          position={[topTargetX + topOrbitDistance, topOrbitHeight, topTargetZ + topOrbitDistance]}
        />
        <OrbitControls
          ref={controlsRef}
          target={[topTargetX, topTargetY, topTargetZ]}
          enabled={!isTransforming}
          enableRotate
          enablePan={false}
          enableZoom
          enableDamping
          onChange={() => invalidate()}
          dampingFactor={0.08}
          rotateSpeed={0.74}
          zoomSpeed={0.92}
          minPolarAngle={topMode === "desk-precision" ? Math.PI * 0.16 : Math.PI * 0.2}
          maxPolarAngle={topMode === "desk-precision" ? Math.PI * 0.34 : Math.PI * 0.4}
          minDistance={topMode === "desk-precision" ? Math.max(1.4, precisionExtent * 1.3) : Math.max(3.8, radius * 0.78)}
          maxDistance={topMode === "desk-precision" ? Math.max(9, precisionExtent * 6.2) : Math.max(18, radius * 3.2)}
        />
      </>
    );
  }

  return null;
}
