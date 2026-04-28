"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
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
import { useWalkInventoryStore } from "../../../lib/stores/useWalkInventoryStore";

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

function shouldIgnorePointerCommitTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(
    target.closest(
      "button,a,input,textarea,select,[contenteditable='true'],[data-focus-placement-ui='true']"
    )
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

function isFinitePoseValue(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
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
  const setSelectedAssetId = useSelectionSelector((slice) => slice.setSelectedAssetId);
  const assets = useAssetSelector((slice) => slice.assets);
  const removeFurniture = useAssetSelector((slice) => slice.removeFurniture);
  const recordSnapshot = usePublishSelector((slice) => slice.recordSnapshot);
  const pendingRequest = useFocusPlacementStore((state) => state.pendingRequest);
  const activeSession = useFocusPlacementStore((state) => state.activeSession);
  const clearPendingRequest = useFocusPlacementStore((state) => state.clearPendingRequest);
  const startSession = useFocusPlacementStore((state) => state.startSession);
  const updateSession = useFocusPlacementStore((state) => state.updateSession);
  const clearSession = useFocusPlacementStore((state) => state.clearSession);
  const placementDraft = useWalkInventoryStore((state) => state.placementDraft);
  const clearPlacementDraft = useWalkInventoryStore((state) => state.clearPlacementDraft);
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
      if (placementDraft?.objectId === pendingRequest.objectId) {
        removeFurniture(pendingRequest.objectId);
        setSelectedAssetId(null);
        clearPlacementDraft();
        toast.error("배치를 시작하지 못했습니다.", {
          description: "제품 메타데이터나 설치 가능한 표면을 다시 확인해 주세요."
        });
      }
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
    placementDraft,
    readOnly,
    clearPlacementDraft,
    removeFurniture,
    setSelectedAssetId,
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
    if (!activeSession || !engine) {
      return;
    }

    const applyLocalPose = (nextLocalPose: SurfaceLocalPose) => {
      if (!transactionRef.current) {
        return;
      }

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

    const commitActivePlacement = () => {
      if (!transactionRef.current) {
        return;
      }

      try {
        transactionRef.current.commit();
        commitRuntimePlacementToStore({
          objectId: activeSession.objectId,
          engine
        });
        recordSnapshot("집중 배치");
        if (placementDraft?.objectId === activeSession.objectId) {
          clearPlacementDraft();
        }
        transactionRef.current = null;
        clearSession();
        setIsTransforming(false);
      } catch (error) {
        console.error("[FocusPlacementController] failed to commit focus placement", error);
        toast.error("배치할 수 없는 위치입니다.", {
          description: "충돌, 여유 공간, 표면 호환성을 확인한 뒤 다시 배치해 주세요."
        });
      }
    };

    const cancelActivePlacement = () => {
      if (transactionRef.current) {
        transactionRef.current.cancel();
        transactionRef.current = null;
      }
      if (placementDraft?.objectId === activeSession.objectId) {
        removeFurniture(activeSession.objectId);
        setSelectedAssetId(null);
        clearPlacementDraft();
      }
      clearSession();
      setIsTransforming(false);
    };

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
          commitActivePlacement();
          return;
        }
        case "Escape":
          event.preventDefault();
          cancelActivePlacement();
          return;
        default:
          return;
      }

      if (!nextLocalPose) {
        return;
      }

      event.preventDefault();
      applyLocalPose(nextLocalPose);
    };

    const handlePointerCommit = (event: MouseEvent) => {
      if (!transactionRef.current || event.button !== 0 || shouldIgnorePointerCommitTarget(event.target)) {
        return;
      }

      event.preventDefault();
      commitActivePlacement();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("mousedown", handlePointerCommit);
    window.addEventListener("deskterioronline:focus-placement:commit", commitActivePlacement);
    window.addEventListener("deskterioronline:focus-placement:cancel", cancelActivePlacement);
    const handleNumericPoseInput = (event: Event) => {
      const detail = (event as CustomEvent<Partial<SurfaceLocalPose>>).detail;
      if (!detail || typeof detail !== "object") {
        return;
      }

      applyLocalPose({
        ...activeSession.localPose,
        ...(isFinitePoseValue(detail.uMm) ? { uMm: detail.uMm } : {}),
        ...(isFinitePoseValue(detail.vMm) ? { vMm: detail.vMm } : {}),
        ...(isFinitePoseValue(detail.normalOffsetMm) ? { normalOffsetMm: detail.normalOffsetMm } : {}),
        ...(isFinitePoseValue(detail.rotationMilliDeg) ? { rotationMilliDeg: detail.rotationMilliDeg } : {})
      });
    };
    window.addEventListener("deskterioronline:focus-placement:set-local-pose", handleNumericPoseInput);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mousedown", handlePointerCommit);
      window.removeEventListener("deskterioronline:focus-placement:commit", commitActivePlacement);
      window.removeEventListener("deskterioronline:focus-placement:cancel", cancelActivePlacement);
      window.removeEventListener("deskterioronline:focus-placement:set-local-pose", handleNumericPoseInput);
    };
  }, [
    activateCandidate,
    activeSession,
    clearPlacementDraft,
    clearSession,
    engine,
    placementDraft,
    recordSnapshot,
    removeFurniture,
    setIsTransforming,
    setSelectedAssetId,
    updateSession
  ]);

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
