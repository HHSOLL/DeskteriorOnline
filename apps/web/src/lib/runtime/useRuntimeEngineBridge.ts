"use client";

import { useEffect, useMemo, useRef } from "react";
import type { Engine } from "@deskterioronline/engine-core";
import { useAssetStore, useShellStore } from "../stores/scene-slices";
import {
  buildRuntimeAssetsFromStore,
  buildSceneDocumentV2FromStore,
  createEditorRuntimeEngine
} from "./legacy-scene-runtime";

declare global {
  interface Window {
    __DESKTERIORONLINE_RUNTIME_ENGINE__?: Engine;
    __DESKTERIORONLINE_RUNTIME_DOCUMENT_ID__?: string;
  }
}

export function useRuntimeEngineBridge() {
  const {
    scale,
    scaleInfo,
    walls,
    openings,
    floors,
    ceilings,
    rooms,
    cameraAnchors,
    navGraph,
    wallMaterialIndex,
    floorMaterialIndex,
    lighting
  } = useShellStore();
  const { assets } = useAssetStore();
  const engineRef = useRef<Engine | null>(null);

  const runtimeInput = useMemo(
    () => ({
      scale,
      scaleInfo,
      walls,
      openings,
      floors,
      ceilings,
      rooms,
      cameraAnchors,
      navGraph,
      assets,
      wallMaterialIndex,
      floorMaterialIndex,
      lighting
    }),
    [
      assets,
      cameraAnchors,
      ceilings,
      floorMaterialIndex,
      floors,
      lighting,
      navGraph,
      openings,
      rooms,
      scale,
      scaleInfo,
      wallMaterialIndex,
      walls
    ]
  );

  const sceneDocument = useMemo(() => buildSceneDocumentV2FromStore(runtimeInput), [runtimeInput]);
  const runtimeAssets = useMemo(() => buildRuntimeAssetsFromStore(runtimeInput), [runtimeInput]);
  const signature = useMemo(
    () =>
      JSON.stringify({
        room: sceneDocument.room,
        objects: sceneDocument.objects,
        materials: sceneDocument.materials
      }),
    [sceneDocument]
  );

  useEffect(() => {
    if (!engineRef.current) {
      engineRef.current = createEditorRuntimeEngine(runtimeInput);
    } else {
      engineRef.current.replaceDocument(sceneDocument, runtimeAssets);
    }

    window.__DESKTERIORONLINE_RUNTIME_ENGINE__ = engineRef.current ?? undefined;
    window.__DESKTERIORONLINE_RUNTIME_DOCUMENT_ID__ = sceneDocument.id;
  }, [runtimeAssets, runtimeInput, sceneDocument, signature]);

  return {
    engine: engineRef.current,
    sceneDocument,
    runtimeAssets
  };
}
