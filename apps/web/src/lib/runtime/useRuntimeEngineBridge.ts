"use client";

import { useEffect, useMemo, useRef } from "react";
import type { Engine } from "@deskterioronline/engine-core";
import type { RuntimeEngineBridgeState } from "./runtime-engine-context";
import { useAssetStore, useShellStore } from "../stores/scene-slices";
import {
  buildRuntimeAssetsFromStore,
  buildSceneDocumentV2FromStore,
  createEditorRuntimeEngine
} from "./legacy-scene-runtime";
import { useWalkInventoryStore } from "../stores/useWalkInventoryStore";

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
    ceilingMaterialIndex,
    lighting
  } = useShellStore();
  const { assets } = useAssetStore();
  const placementDraft = useWalkInventoryStore((state) => state.placementDraft);
  const engineRef = useRef<Engine | null>(null);
  const runtimeAssetsInput = useMemo(() => {
    if (!placementDraft?.asset || assets.some((asset) => asset.id === placementDraft.objectId)) {
      return assets;
    }
    return [...assets, placementDraft.asset];
  }, [assets, placementDraft]);

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
      assets: runtimeAssetsInput,
      wallMaterialIndex,
      floorMaterialIndex,
      ceilingMaterialIndex,
      lighting
    }),
    [
      cameraAnchors,
      ceilingMaterialIndex,
      ceilings,
      floorMaterialIndex,
      floors,
      lighting,
      navGraph,
      openings,
      rooms,
      runtimeAssetsInput,
      scale,
      scaleInfo,
      wallMaterialIndex,
      walls
    ]
  );

  const sceneDocument = useMemo(() => buildSceneDocumentV2FromStore(runtimeInput), [runtimeInput]);
  const runtimeAssets = useMemo(() => buildRuntimeAssetsFromStore(runtimeInput), [runtimeInput]);
  const roomSignature = useMemo(
    () =>
      JSON.stringify({
        room: sceneDocument.room,
        environment: sceneDocument.environment
      }),
    [sceneDocument]
  );
  const objectSignature = useMemo(
    () =>
      JSON.stringify({
        objects: sceneDocument.objects,
        materials: sceneDocument.materials
      }),
    [sceneDocument]
  );
  const previousRoomSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    if (!engineRef.current) {
      engineRef.current = createEditorRuntimeEngine(runtimeInput);
    } else if (previousRoomSignatureRef.current !== roomSignature) {
      engineRef.current.replaceDocument(sceneDocument, runtimeAssets);
    } else {
      engineRef.current.syncDocument(sceneDocument, runtimeAssets);
    }

    previousRoomSignatureRef.current = roomSignature;
    window.__DESKTERIORONLINE_RUNTIME_ENGINE__ = engineRef.current ?? undefined;
    window.__DESKTERIORONLINE_RUNTIME_DOCUMENT_ID__ = sceneDocument.id;
  }, [objectSignature, roomSignature, runtimeAssets, runtimeInput, sceneDocument]);

  return {
    engineRef,
    sceneDocumentId: sceneDocument.id,
    sceneDocument,
    runtimeAssets
  } satisfies RuntimeEngineBridgeState & {
    sceneDocument: typeof sceneDocument;
    runtimeAssets: typeof runtimeAssets;
  };
}
