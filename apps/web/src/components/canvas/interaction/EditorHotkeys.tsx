"use client";

import { useEffect } from "react";
import { resolveTopViewInteractionPolicy } from "../../../lib/editor/top-view-policy";
import { commitRuntimeAssetUpdateToStore } from "../../../lib/runtime/runtime-asset-bridge";
import { useEditorStore } from "../../../lib/stores/useEditorStore";
import {
  useAssetSelector,
  usePublishSelector,
  useSelectionSelector
} from "../../../lib/stores/scene-slices";

export default function EditorHotkeys() {
  const viewMode = useEditorStore((state) => state.viewMode);
  const topMode = useEditorStore((state) => state.topMode);
  const setTransformMode = useEditorStore((state) => state.setTransformMode);
  const transformSpace = useEditorStore((state) => state.transformSpace);
  const setTransformSpace = useEditorStore((state) => state.setTransformSpace);
  const readOnly = useEditorStore((state) => state.readOnly);
  const selectedAssetId = useSelectionSelector((slice) => slice.selectedAssetId);
  const assets = useAssetSelector((slice) => slice.assets);
  const recordSnapshot = usePublishSelector((slice) => slice.recordSnapshot);
  const undo = usePublishSelector((slice) => slice.undo);
  const redo = usePublishSelector((slice) => slice.redo);
  const topViewPolicy = resolveTopViewInteractionPolicy(topMode);

  useEffect(() => {
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
      if (event.key.toLowerCase() === "g") {
        setTransformMode("translate");
        return;
      }
      if (event.key.toLowerCase() === "q") {
        setTransformSpace(transformSpace === "world" ? "local" : "world");
        return;
      }
      if (event.key.toLowerCase() !== "r") return;
      if (!selectedAssetId) return;
      const asset = assets.find((item) => item.id === selectedAssetId);
      if (!asset) return;
      commitRuntimeAssetUpdateToStore({
        objectId: selectedAssetId,
        updates: {
          rotation: [
            asset.rotation[0],
            asset.rotation[1] + topViewPolicy.rotationSnap,
            asset.rotation[2]
          ]
        }
      });
      recordSnapshot("Rotate asset");
      setTransformMode("rotate");
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    assets,
    readOnly,
    recordSnapshot,
    selectedAssetId,
    setTransformMode,
    setTransformSpace,
    transformSpace,
    undo,
    redo,
    viewMode,
    topViewPolicy
  ]);

  return null;
}
