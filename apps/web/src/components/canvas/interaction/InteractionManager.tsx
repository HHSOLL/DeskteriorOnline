"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { useEditorStore } from "../../../lib/stores/useEditorStore";
import { useFocusPlacementStore } from "../../../lib/stores/useFocusPlacementStore";
import { useInteractionStore, type InteractionHint } from "../../../lib/stores/useInteractionStore";
import { scheduleInteractionLatency } from "../../../lib/performance/scene-telemetry";
import {
  dispatchWalkFocusPlacementAim,
  resolveFocusPlacementAimRequest,
  resolveWalkFocusPlacementAimKey
} from "../../../lib/runtime/walk-focus-aim";
import {
  isEditableWalkKeyboardTarget,
  isWalkInteractShortcut
} from "../../../lib/runtime/walk-keyboard";

type InteractionManagerProps = {
  children: React.ReactNode;
};

type InteractionRegistry = {
  register: (object: THREE.Object3D) => void;
  unregister: (object: THREE.Object3D) => void;
};

const InteractionRegistryContext = createContext<InteractionRegistry | null>(null);

export function useInteractionRegistry() {
  const registry = useContext(InteractionRegistryContext);
  return registry;
}

const INTERACTION_DISTANCE = 2.4;

export default function InteractionManager({ children }: InteractionManagerProps) {
  const viewMode = useEditorStore((state) => state.viewMode);
  const readOnly = useEditorStore((state) => state.readOnly);
  const hasActiveFocusPlacement = useFocusPlacementStore((state) => Boolean(state.activeSession));
  const hasPendingFocusPlacement = useFocusPlacementStore((state) => Boolean(state.pendingRequest));
  const setHint = useInteractionStore((state) => state.setHint);
  const hoveredRef = useRef<THREE.Object3D | null>(null);
  const lastAimKeyRef = useRef<string | null>(null);
  const targetsRef = useRef<THREE.Object3D[]>([]);
  const camera = useThree((state) => state.camera);
  const invalidate = useThree((state) => state.invalidate);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const screenCenter = useMemo(() => new THREE.Vector2(0, 0), []);

  useEffect(() => {
    return () => {
      document.body.style.cursor = "default";
      setHint(null);
    };
  }, [setHint]);

  useEffect(() => {
    if (viewMode !== "walk") {
      setHint(null);
    }
  }, [setHint, viewMode]);

  const resolveHighlightTarget = (target: THREE.Object3D | null) => {
    if (!target) return null;
    if (target.userData?.highlightMesh instanceof THREE.Mesh) return target.userData.highlightMesh as THREE.Mesh;
    if (target instanceof THREE.Mesh) return target;
    return null;
  };

  const setHover = useCallback((target: THREE.Object3D | null) => {
    if (hoveredRef.current === target) return;
    const prevMesh = resolveHighlightTarget(hoveredRef.current);
    if (prevMesh) {
      const material = prevMesh.material;
      const materials = Array.isArray(material) ? material : [material];
      materials.forEach((mat) => {
        if (mat instanceof THREE.MeshStandardMaterial) {
          mat.emissive.set("#000000");
          mat.emissiveIntensity = 0;
        }
      });
    }
    hoveredRef.current = target;
    const nextMesh = resolveHighlightTarget(target);
    if (nextMesh) {
      const material = nextMesh.material;
      const materials = Array.isArray(material) ? material : [material];
      materials.forEach((mat) => {
        if (mat instanceof THREE.MeshStandardMaterial) {
          mat.emissive.set("#8dd6ff");
          mat.emissiveIntensity = 0.25;
        }
      });
    }
    const hint = target?.userData?.interactionHint as InteractionHint | undefined;
    setHint(hint ?? null);
    invalidate();
  }, [invalidate, setHint]);

  useEffect(() => {
    if (readOnly) {
      setHint(null);
      setHover(null);
    }
  }, [readOnly, setHint, setHover]);

  useEffect(() => {
    if (hasActiveFocusPlacement || hasPendingFocusPlacement) {
      lastAimKeyRef.current = null;
    }
  }, [hasActiveFocusPlacement, hasPendingFocusPlacement]);

  const register = useCallback((object: THREE.Object3D) => {
    if (!targetsRef.current.includes(object)) {
      targetsRef.current.push(object);
    }
  }, []);

  const unregister = useCallback((object: THREE.Object3D) => {
    targetsRef.current = targetsRef.current.filter((entry) => entry !== object);
  }, []);

  const findInteractiveTarget = useCallback((object: THREE.Object3D | null) => {
    let current = object;
    while (current) {
      if (current.userData?.interactive) return current;
      current = current.parent;
    }
    return null;
  }, []);

  const dispatchCrosshairAim = useCallback((target: THREE.Object3D | null, hit: THREE.Intersection | null) => {
    if (!target || hasActiveFocusPlacement || hasPendingFocusPlacement) {
      if (!target) {
        lastAimKeyRef.current = null;
      }
      return;
    }

    const request = resolveFocusPlacementAimRequest(target);
    if (!request) {
      lastAimKeyRef.current = null;
      return;
    }

    const aimKey = resolveWalkFocusPlacementAimKey(request);
    if (lastAimKeyRef.current === aimKey) {
      return;
    }

    lastAimKeyRef.current = aimKey;
    const hitDistance = typeof hit?.distance === "number" ? hit.distance : INTERACTION_DISTANCE;
    const rayHitConfidence = Math.max(0.6, Math.min(1, 1 - (hitDistance / INTERACTION_DISTANCE) * 0.4));
    dispatchWalkFocusPlacementAim({
      request,
      rayHitConfidence,
      source: "crosshair",
      targetName: target.name || null
    });
  }, [hasActiveFocusPlacement, hasPendingFocusPlacement]);

  useFrame(() => {
    if (viewMode !== "walk" || readOnly) {
      if (hoveredRef.current) setHover(null);
      return;
    }
    if (targetsRef.current.length === 0) {
      if (hoveredRef.current) setHover(null);
      return;
    }
    const startedAt = performance.now();
    raycaster.setFromCamera(screenCenter, camera);
    raycaster.far = INTERACTION_DISTANCE;
    const hits = raycaster.intersectObjects(targetsRef.current, true);
    const firstHit = hits[0] ?? null;
    const interactive = firstHit ? findInteractiveTarget(firstHit.object) : null;
    if (hoveredRef.current !== interactive) {
      scheduleInteractionLatency("hover", startedAt, {
        viewMode,
        targetId: interactive?.name ?? null
      });
    }
    setHover(interactive);
    dispatchCrosshairAim(interactive, firstHit);
  });

  useEffect(() => {
    const triggerFocusedInteraction = (event?: KeyboardEvent | MouseEvent) => {
      const target = hoveredRef.current;
      const callback = target?.userData?.onInteract as undefined | (() => void);
      if (!callback) return;
      event?.preventDefault();
      callback();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (viewMode !== "walk" || readOnly || hasActiveFocusPlacement || hasPendingFocusPlacement) return;
      if (!isWalkInteractShortcut(event) || isEditableWalkKeyboardTarget(event.target)) return;
      triggerFocusedInteraction(event);
    };

    const handleMouseDown = (event: MouseEvent) => {
      if (viewMode !== "walk" || readOnly || hasActiveFocusPlacement || hasPendingFocusPlacement) return;
      if (event.button !== 0) return;
      triggerFocusedInteraction(event);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("mousedown", handleMouseDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mousedown", handleMouseDown);
    };
  }, [hasActiveFocusPlacement, hasPendingFocusPlacement, readOnly, viewMode]);

  return (
    <InteractionRegistryContext.Provider value={{ register, unregister }}>
      <group
        onPointerMove={(event) => {
          if (viewMode !== "top" || readOnly) return;
          const startedAt = performance.now();
          const target = findInteractiveTarget(event.object);
          document.body.style.cursor = target ? "pointer" : "default";
          if (hoveredRef.current !== target) {
            scheduleInteractionLatency("hover", startedAt, {
              viewMode,
              targetId: target?.name ?? null
            });
          }
          setHover(target);
        }}
        onPointerOut={() => {
          if (viewMode !== "top" || readOnly) return;
          document.body.style.cursor = "default";
          setHover(null);
        }}
      >
        {children}
      </group>
    </InteractionRegistryContext.Provider>
  );
}
