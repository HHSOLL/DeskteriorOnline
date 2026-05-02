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

function resolvePrecisionMoveStep(event: KeyboardEvent, defaultStep: number) {
  if (event.altKey) return 0.001;
  if (event.shiftKey) return 0.01;
  return defaultStep;
}

function resolvePrecisionRotateStep(event: KeyboardEvent, defaultStep: number) {
  if (event.altKey) return Math.PI / 1800;
  if (event.shiftKey) return Math.PI / 12;
  return defaultStep;
}

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
        const moveStep = resolvePrecisionMoveStep(event, topViewPolicy.translationSnap);
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          const direction = event.key === "ArrowLeft" ? -1 : 1;
          commitSelectedAssetUpdate(
            {
              position: [
                asset.position[0] + direction * moveStep,
                asset.position[1],
                asset.position[2]
              ]
            },
            "Nudge asset"
          );
          return;
        }
        if (event.key === "ArrowUp" || event.key === "ArrowDown") {
          event.preventDefault();
          const direction = event.key === "ArrowUp" ? -1 : 1;
          commitSelectedAssetUpdate(
            {
              position: [
                asset.position[0],
                asset.position[1],
                asset.position[2] + direction * moveStep
              ]
            },
            "Nudge asset"
          );
          return;
        }
        if (key === "q" || key === "e") {
          event.preventDefault();
          const direction = key === "q" ? -1 : 1;
          commitSelectedAssetUpdate(
            {
              rotation: [
                asset.rotation[0],
                asset.rotation[1] + direction * resolvePrecisionRotateStep(event, topViewPolicy.rotateStep),
                asset.rotation[2]
              ]
            },
            "Rotate asset"
          );
          setTransformMode("rotate");
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
    readOnly,
    recordSnapshot,
    selectedAssetId,
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
