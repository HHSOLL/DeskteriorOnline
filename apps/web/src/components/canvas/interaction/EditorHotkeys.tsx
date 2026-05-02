"use client";

import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import {
  DESK_PRECISION_HOTKEY_COMMIT_DELAY_MS,
  resolveDeskPrecisionHotkeyPreview
} from "../../../lib/editor/desk-precision-hotkeys";
import { resolveTopViewInteractionPolicy } from "../../../lib/editor/top-view-policy";
import {
  cancelRuntimeAssetPreview,
  commitRuntimeAssetUpdateToStore,
  previewRuntimeAssetTransform
} from "../../../lib/runtime/runtime-asset-bridge";
import { useEditorStore } from "../../../lib/stores/useEditorStore";
import {
  useAssetSelector,
  usePublishSelector,
  useSelectionSelector
} from "../../../lib/stores/scene-slices";
import type { SceneAsset } from "../../../lib/stores/useSceneStore";

type PrecisionPreviewDraft = {
  objectId: string;
  position: SceneAsset["position"];
  rotation: SceneAsset["rotation"];
  label: "Nudge asset" | "Rotate asset";
  timer: ReturnType<typeof setTimeout> | null;
};

export default function EditorHotkeys() {
  const invalidate = useThree((state) => state.invalidate);
  const viewMode = useEditorStore((state) => state.viewMode);
  const topMode = useEditorStore((state) => state.topMode);
  const setTransformMode = useEditorStore((state) => state.setTransformMode);
  const transformSpace = useEditorStore((state) => state.transformSpace);
  const setTransformSpace = useEditorStore((state) => state.setTransformSpace);
  const setIsTransforming = useEditorStore((state) => state.setIsTransforming);
  const readOnly = useEditorStore((state) => state.readOnly);
  const selectedAssetId = useSelectionSelector((slice) => slice.selectedAssetId);
  const assets = useAssetSelector((slice) => slice.assets);
  const recordSnapshot = usePublishSelector((slice) => slice.recordSnapshot);
  const undo = usePublishSelector((slice) => slice.undo);
  const redo = usePublishSelector((slice) => slice.redo);
  const topViewPolicy = resolveTopViewInteractionPolicy(topMode);
  const precisionPreviewRef = useRef<PrecisionPreviewDraft | null>(null);

  useEffect(() => {
    return () => {
      const draft = precisionPreviewRef.current;
      if (draft?.timer) {
        clearTimeout(draft.timer);
      }
      if (draft) {
        cancelRuntimeAssetPreview(draft.objectId);
      }
      precisionPreviewRef.current = null;
      setIsTransforming(false);
    };
  }, [setIsTransforming]);

  useEffect(() => {
    const commitPrecisionPreview = () => {
      const draft = precisionPreviewRef.current;
      if (!draft) return;

      if (draft.timer) {
        clearTimeout(draft.timer);
      }
      precisionPreviewRef.current = null;
      commitRuntimeAssetUpdateToStore({
        objectId: draft.objectId,
        updates: {
          position: draft.position,
          rotation: draft.rotation
        }
      });
      recordSnapshot(draft.label);
      setIsTransforming(false);
      invalidate();
    };

    const schedulePrecisionPreviewCommit = (
      objectId: string,
      updates: {
        position?: SceneAsset["position"];
        rotation?: SceneAsset["rotation"];
      },
      label: PrecisionPreviewDraft["label"],
      asset: SceneAsset
    ) => {
      const previousDraft =
        precisionPreviewRef.current?.objectId === objectId ? precisionPreviewRef.current : null;
      if (previousDraft?.timer) {
        clearTimeout(previousDraft.timer);
      }

      const position = updates.position ?? previousDraft?.position ?? asset.position;
      const rotation = updates.rotation ?? previousDraft?.rotation ?? asset.rotation;
      previewRuntimeAssetTransform(objectId, {
        position,
        rotation,
        scale: asset.scale
      });
      setIsTransforming(true);
      invalidate();

      precisionPreviewRef.current = {
        objectId,
        position,
        rotation,
        label,
        timer: setTimeout(commitPrecisionPreview, DESK_PRECISION_HOTKEY_COMMIT_DELAY_MS)
      };
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (readOnly) return;

      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      const key = event.key.toLowerCase();
      const isModifierPressed = event.metaKey || event.ctrlKey;
      if (isModifierPressed && key === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }

      if (isModifierPressed && key === "y") {
        event.preventDefault();
        redo();
        return;
      }

      if (viewMode !== "top" || !topViewPolicy.allowTransformHotkeys) return;
      const asset = selectedAssetId
        ? assets.find((item) => item.id === selectedAssetId)
        : null;
      const commitSelectedAssetUpdate = (
        updates: {
          position?: [number, number, number];
          rotation?: [number, number, number];
        },
        label: string
      ) => {
        if (!selectedAssetId || !asset) return false;
        commitRuntimeAssetUpdateToStore({
          objectId: selectedAssetId,
          updates
        });
        recordSnapshot(label);
        return true;
      };

      if (topMode === "desk-precision" && selectedAssetId && asset) {
        const previousDraft =
          precisionPreviewRef.current?.objectId === selectedAssetId
            ? precisionPreviewRef.current
            : null;
        const preview = resolveDeskPrecisionHotkeyPreview({
          event,
          asset: {
            position: previousDraft?.position ?? asset.position,
            rotation: previousDraft?.rotation ?? asset.rotation
          },
          policy: topViewPolicy
        });
        if (preview) {
          event.preventDefault();
          schedulePrecisionPreviewCommit(
            selectedAssetId,
            preview.updates,
            preview.label,
            asset
          );
          if (preview.transformMode) {
            setTransformMode(preview.transformMode);
          }
          return;
        }
        if (key === "enter") {
          event.preventDefault();
          commitPrecisionPreview();
          return;
        }
        if (key === "escape" && precisionPreviewRef.current) {
          event.preventDefault();
          const draft = precisionPreviewRef.current;
          if (draft.timer) {
            clearTimeout(draft.timer);
          }
          cancelRuntimeAssetPreview(draft.objectId);
          precisionPreviewRef.current = null;
          setIsTransforming(false);
          invalidate();
          return;
        }
      }

      if (event.key.toLowerCase() === "g") {
        setTransformMode("translate");
        return;
      }
      if (event.key.toLowerCase() === "q") {
        setTransformSpace(transformSpace === "world" ? "local" : "world");
        return;
      }
      if (event.key.toLowerCase() !== "r") return;
      if (!asset) return;
      if (commitSelectedAssetUpdate(
        {
          rotation: [
            asset.rotation[0],
            asset.rotation[1] + topViewPolicy.rotationSnap,
            asset.rotation[2]
          ]
        },
        "Rotate asset"
      )) {
        setTransformMode("rotate");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    assets,
    invalidate,
    readOnly,
    recordSnapshot,
    selectedAssetId,
    setIsTransforming,
    setTransformMode,
    setTransformSpace,
    transformSpace,
    undo,
    redo,
    topMode,
    viewMode,
    topViewPolicy
  ]);

  return null;
}
