"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { useEditorStore } from "../../../lib/stores/useEditorStore";
import { useInteractionStore } from "../../../lib/stores/useInteractionStore";
import { scheduleInteractionLatency } from "../../../lib/performance/scene-telemetry";

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
  const setHint = useInteractionStore((state) => state.setHint);
  const hoveredRef = useRef<THREE.Object3D | null>(null);
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
    const hint = target?.userData?.interactionLabel as string | undefined;
    setHint(hint ?? null);
    invalidate();
  }, [invalidate, setHint]);

  useEffect(() => {
    if (readOnly) {
      setHint(null);
      setHover(null);
    }
  }, [readOnly, setHint, setHover]);

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
    const interactive = hits.length > 0 ? findInteractiveTarget(hits[0].object) : null;
    if (hoveredRef.current !== interactive) {
      scheduleInteractionLatency("hover", startedAt, {
        viewMode,
        targetId: interactive?.name ?? null
      });
    }
    setHover(interactive);
  });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (viewMode !== "walk" || readOnly) return;
      if (event.key.toLowerCase() !== "e") return;
      const target = hoveredRef.current;
      const callback = target?.userData?.onInteract as undefined | (() => void);
      if (callback) callback();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [readOnly, viewMode]);

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
