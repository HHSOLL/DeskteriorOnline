"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import type { Engine } from "@deskterioronline/engine-core";
import { PlacementKernel, type PlacementTransaction } from "@deskterioronline/placement-kernel";
import type { RuntimeAsset, SurfaceLocalPose } from "@deskterioronline/scene-schema";
import { isSurfacePlacementRecord } from "@deskterioronline/scene-schema";
import {
  resolveFocusPlacementSessionUpdate,
  resolveFocusPlacementStepConfig,
  resolveNextFocusPlacementCandidateIndex,
  resolveFocusPlacementWizardState,
  type FocusPlacementAttachmentType
} from "../../../lib/runtime/focus-placement-session";
import { commitRuntimePlacementToStore } from "../../../lib/runtime/runtime-asset-bridge";
import { useRuntimeEngine } from "../../../lib/runtime/runtime-engine-context";
import { useAssetSelector, usePublishSelector, useSelectionSelector } from "../../../lib/stores/scene-slices";
import { useEditorStore } from "../../../lib/stores/useEditorStore";
import {
  useFocusPlacementStore,
  type FocusPlacementRequest,
  type FocusPlacementSession
} from "../../../lib/stores/useFocusPlacementStore";

function shouldIgnoreKeyboardTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return (
    target.isContentEditable ||
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select"
  );
}

function resolveInitialLocalPose(
  selectedAssetPlacement: unknown,
  supportObjectId: string,
  surfaceId: string,
  fallbackPose?: SurfaceLocalPose | null
): SurfaceLocalPose {
  const placement = selectedAssetPlacement as Parameters<typeof isSurfacePlacementRecord>[0];

  if (
    selectedAssetPlacement &&
    typeof selectedAssetPlacement === "object" &&
    isSurfacePlacementRecord(placement) &&
    placement.supportObjectId === supportObjectId &&
    placement.surfaceId === surfaceId
  ) {
    return placement.localPose;
  }

  return (
    fallbackPose ?? {
      uMm: 0,
      vMm: 0,
      normalOffsetMm: 0,
      rotationMilliDeg: 0
    }
  );
}

function resolveMoveStep(event: KeyboardEvent, baseStep: number) {
  if (event.altKey) {
    return 1;
  }
  if (event.shiftKey) {
    return Math.max(baseStep * 10, 50);
  }
  return baseStep;
}

function resolveRotateStep(event: KeyboardEvent, baseStep: number) {
  if (event.altKey) {
    return 100;
  }
  if (event.shiftKey) {
    return Math.max(baseStep * 5, 5000);
  }
  return baseStep;
}

function resolveCandidateFromRequest(request: FocusPlacementRequest, candidateIndex: number) {
  return (
    request.surfaceCandidates[candidateIndex] ??
    request.surfaceCandidates[request.preferredCandidateIndex] ??
    null
  );
}

function resolveRuntimeAssetForObject(engine: Engine, objectId: string) {
  const runtimeObject = engine.runtimeScene.objectRegistry.get(objectId);
  if (!runtimeObject) {
    return null;
  }

  const runtimeAssetId = runtimeObject.runtimeAssetId ?? runtimeObject.assetId;
  return engine.runtimeScene.runtimeAssets.get(runtimeAssetId) ?? null;
}

function resolveSuggestedLocalPose(
  attachmentType: FocusPlacementAttachmentType,
  supportRuntimeAsset: RuntimeAsset | null
): SurfaceLocalPose | null {
  if (attachmentType !== "vesa_mount" || supportRuntimeAsset?.articulation?.type !== "monitor_arm") {
    return null;
  }

  const defaultReachMm =
    supportRuntimeAsset.articulation.joints.find((joint) => joint.type === "prismatic")?.defaultValue ?? 140;

  return {
    uMm: 0,
    vMm: 0,
    normalOffsetMm: defaultReachMm,
    rotationMilliDeg: 0
  };
}

export default function FocusPlacementController() {
  const engine = useRuntimeEngine();
  const viewMode = useEditorStore((state) => state.viewMode);
  const readOnly = useEditorStore((state) => state.readOnly);
  const setIsTransforming = useEditorStore((state) => state.setIsTransforming);
  const selectedAssetId = useSelectionSelector((slice) => slice.selectedAssetId);
  const assets = useAssetSelector((slice) => slice.assets);
  const recordSnapshot = usePublishSelector((slice) => slice.recordSnapshot);
  const pendingRequest = useFocusPlacementStore((state) => state.pendingRequest);
  const activeSession = useFocusPlacementStore((state) => state.activeSession);
  const clearPendingRequest = useFocusPlacementStore((state) => state.clearPendingRequest);
  const startSession = useFocusPlacementStore((state) => state.startSession);
  const updateSession = useFocusPlacementStore((state) => state.updateSession);
  const clearSession = useFocusPlacementStore((state) => state.clearSession);
  const transactionRef = useRef<PlacementTransaction | null>(null);
  const kernel = useMemo(() => (engine ? new PlacementKernel(engine) : null), [engine]);
  const assetsById = useMemo(
    () => new Map(assets.map((asset) => [asset.id, asset])),
    [assets]
  );

  const activateCandidate = useCallback(
    (input: {
      request: FocusPlacementRequest | FocusPlacementSession;
      candidateIndex: number;
      baseLocalPose?: SurfaceLocalPose | null;
      mode: "start" | "switch";
    }) => {
      if (!kernel) {
        throw new Error("Focus placement kernel is unavailable.");
      }

      const selectedAsset = assetsById.get(input.request.objectId);
      if (!selectedAsset) {
        throw new Error(`Selected asset ${input.request.objectId} was not found.`);
      }
      if (!engine) {
        throw new Error("Focus placement engine is unavailable.");
      }

      const candidate = resolveCandidateFromRequest(input.request, input.candidateIndex);
      if (!candidate) {
        throw new Error("Focus placement candidate was not found.");
      }

      const selectedRuntimeAsset = resolveRuntimeAssetForObject(engine, input.request.objectId);
      const supportRuntimeAsset = resolveRuntimeAssetForObject(engine, input.request.supportObjectId);

      transactionRef.current?.cancel();
      const transaction = kernel.begin({
        objectId: input.request.objectId,
        supportObjectId: input.request.supportObjectId,
        surfaceId: candidate.surfaceId,
        attachmentType: candidate.attachmentType
      });
      transactionRef.current = transaction;

      const initialLocalPose =
        input.baseLocalPose ??
        resolveInitialLocalPose(
          selectedAsset.placement,
          input.request.supportObjectId,
          candidate.surfaceId,
          resolveSuggestedLocalPose(candidate.attachmentType, supportRuntimeAsset)
        );
      const nextState = transaction.update(initialLocalPose);
      const sessionState = resolveFocusPlacementSessionUpdate(initialLocalPose, nextState);
      const stepConfig = resolveFocusPlacementStepConfig(
        candidate.attachmentType,
        candidate.surfaceType
      );
      const nextSession = {
        ...input.request,
        ...candidate,
        activeCandidateIndex: input.candidateIndex,
        ...sessionState,
        wizardState: resolveFocusPlacementWizardState({
          attachmentType: candidate.attachmentType,
          localPose: sessionState.localPose,
          selectedRuntimeAsset,
          supportRuntimeAsset,
          surfaceId: candidate.surfaceId,
          constraintReport: sessionState.constraintReport,
          collisionReport: sessionState.collisionReport
        }),
        ...stepConfig
      };

      if (input.mode === "start") {
        startSession(nextSession);
      } else {
        updateSession(nextSession);
      }

      setIsTransforming(true);
    },
    [assetsById, engine, kernel, setIsTransforming, startSession, updateSession]
  );

  useEffect(() => {
    if (!pendingRequest || !kernel || !engine || viewMode !== "walk" || readOnly) {
      return;
    }

    try {
      activateCandidate({
        request: pendingRequest,
        candidateIndex: pendingRequest.preferredCandidateIndex,
        mode: "start"
      });
    } catch (error) {
      console.error("[FocusPlacementController] failed to start focus placement", error);
      clearPendingRequest();
      clearSession();
      setIsTransforming(false);
    }
  }, [
    activateCandidate,
    clearPendingRequest,
    clearSession,
    engine,
    kernel,
    pendingRequest,
    readOnly,
    setIsTransforming,
    viewMode
  ]);

  useEffect(() => {
    if (!activeSession || !engine) {
      return;
    }

    if (viewMode === "walk" && !readOnly && selectedAssetId === activeSession.objectId) {
      return;
    }

    transactionRef.current?.cancel();
    transactionRef.current = null;
    clearSession();
    setIsTransforming(false);
  }, [activeSession, clearSession, engine, readOnly, selectedAssetId, setIsTransforming, viewMode]);

  useEffect(() => {
    if (!activeSession) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!transactionRef.current || shouldIgnoreKeyboardTarget(event.target)) {
        return;
      }

      let nextLocalPose: SurfaceLocalPose | null = null;
      const moveStep = resolveMoveStep(event, activeSession.moveStepMm);
      const rotateStep = resolveRotateStep(event, activeSession.rotateStepMilliDeg);

      switch (event.key) {
        case "ArrowLeft":
          nextLocalPose = {
            ...activeSession.localPose,
            uMm: activeSession.localPose.uMm - moveStep
          };
          break;
        case "ArrowRight":
          nextLocalPose = {
            ...activeSession.localPose,
            uMm: activeSession.localPose.uMm + moveStep
          };
          break;
        case "ArrowUp":
          nextLocalPose = {
            ...activeSession.localPose,
            vMm: activeSession.localPose.vMm - moveStep
          };
          break;
        case "ArrowDown":
          nextLocalPose = {
            ...activeSession.localPose,
            vMm: activeSession.localPose.vMm + moveStep
          };
          break;
        case "PageUp":
          nextLocalPose = {
            ...activeSession.localPose,
            normalOffsetMm: activeSession.localPose.normalOffsetMm + moveStep
          };
          break;
        case "PageDown":
          nextLocalPose = {
            ...activeSession.localPose,
            normalOffsetMm: activeSession.localPose.normalOffsetMm - moveStep
          };
          break;
        case "q":
        case "Q":
          nextLocalPose = {
            ...activeSession.localPose,
            rotationMilliDeg: activeSession.localPose.rotationMilliDeg - rotateStep
          };
          break;
        case "e":
        case "E":
          nextLocalPose = {
            ...activeSession.localPose,
            rotationMilliDeg: activeSession.localPose.rotationMilliDeg + rotateStep
          };
          break;
        case "Tab": {
          event.preventDefault();
          const nextCandidateIndex = resolveNextFocusPlacementCandidateIndex(
            activeSession.surfaceCandidates,
            activeSession.activeCandidateIndex,
            event.shiftKey ? -1 : 1
          );
          if (nextCandidateIndex === -1 || nextCandidateIndex === activeSession.activeCandidateIndex) {
            return;
          }

          try {
            activateCandidate({
              request: activeSession,
              candidateIndex: nextCandidateIndex,
              baseLocalPose: activeSession.localPose,
              mode: "switch"
            });
          } catch (error) {
            console.error("[FocusPlacementController] failed to switch focus placement candidate", error);
          }
          return;
        }
        case "f":
        case "F": {
          event.preventDefault();
          if (activeSession.preferredCandidateIndex === activeSession.activeCandidateIndex) {
            return;
          }

          try {
            activateCandidate({
              request: activeSession,
              candidateIndex: activeSession.preferredCandidateIndex,
              mode: "switch"
            });
          } catch (error) {
            console.error("[FocusPlacementController] failed to refocus placement candidate", error);
          }
          return;
        }
        case "Enter": {
          event.preventDefault();
          try {
            transactionRef.current.commit();
            commitRuntimePlacementToStore({
              objectId: activeSession.objectId,
              engine
            });
            recordSnapshot("집중 배치");
            transactionRef.current = null;
            clearSession();
            setIsTransforming(false);
          } catch (error) {
            console.error("[FocusPlacementController] failed to commit focus placement", error);
          }
          return;
        }
        case "Escape":
          event.preventDefault();
          transactionRef.current.cancel();
          transactionRef.current = null;
          clearSession();
          setIsTransforming(false);
          return;
        default:
          return;
      }

      if (!nextLocalPose) {
        return;
      }

      event.preventDefault();
      const nextState = transactionRef.current.update(nextLocalPose);
      const sessionState = resolveFocusPlacementSessionUpdate(nextLocalPose, nextState);
      updateSession({
        ...sessionState,
        wizardState: resolveFocusPlacementWizardState({
          attachmentType: activeSession.attachmentType,
          localPose: sessionState.localPose,
          selectedRuntimeAsset: resolveRuntimeAssetForObject(engine, activeSession.objectId),
          supportRuntimeAsset: resolveRuntimeAssetForObject(engine, activeSession.supportObjectId),
          surfaceId: activeSession.surfaceId,
          constraintReport: sessionState.constraintReport,
          collisionReport: sessionState.collisionReport
        })
      });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activateCandidate, activeSession, clearSession, engine, recordSnapshot, setIsTransforming, updateSession]);

  useEffect(() => {
    return () => {
      transactionRef.current?.cancel();
      transactionRef.current = null;
      clearSession();
      setIsTransforming(false);
    };
  }, [clearSession, setIsTransforming]);

  return null;
}
