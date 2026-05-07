"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import type { Engine } from "@deskterioronline/engine-core";
import {
  createBlockedReason,
  createFocusPlacementMachine,
  type BlockedReason,
  type FocusPlacementMachine,
  type FocusPlacementMachineState,
  type InteractionResult,
  type RankedInteractionSurfaceCandidate
} from "@deskterioronline/interaction-engine";
import {
  FINE_PRECISION_SNAP_RULE,
  PlacementKernel,
  type PlacementTransaction,
  type SnapRule
} from "@deskterioronline/placement-kernel";
import type { RuntimeAsset, SurfaceLocalPose } from "@deskterioronline/scene-schema";
import { isSurfacePlacementRecord } from "@deskterioronline/scene-schema";
import {
  resolveFocusPlacementEntry,
  resolveFocusPlacementSessionUpdate,
  resolveFocusPlacementStepConfig,
  resolveFocusPlacementWizardState,
  type FocusPlacementAttachmentType,
  type FocusPlacementSurfaceCandidate
} from "../../../lib/runtime/focus-placement-session";
import {
  cancelRuntimeAssetPreview,
  commitRuntimeAssetUpdateToStore,
  commitRuntimePlacementDraftToStore,
  commitRuntimePlacementToStore
} from "../../../lib/runtime/runtime-asset-bridge";
import { useRuntimeEngine } from "../../../lib/runtime/runtime-engine-context";
import {
  focusPlacementRequestToInteractionCandidates,
  WALK_FOCUS_PLACEMENT_AIM_EVENT,
  withFocusPlacementAimMetadata,
  type WalkFocusPlacementAimDetail
} from "../../../lib/runtime/walk-focus-aim";
import { useAssetSelector, usePublishSelector, useSelectionSelector } from "../../../lib/stores/scene-slices";
import { useEditorStore } from "../../../lib/stores/useEditorStore";
import {
  useFocusPlacementStore,
  type FocusPlacementRequest,
  type FocusPlacementSession
} from "../../../lib/stores/useFocusPlacementStore";
import type { SceneAsset } from "../../../lib/stores/useSceneStore";
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

function resolveFocusCandidateTone(candidate: RankedInteractionSurfaceCandidate) {
  if (candidate.visualAffordance.tone === "valid") {
    return "ready" as const;
  }
  if (candidate.visualAffordance.tone === "blocked" || candidate.blockedReasons.length > 0) {
    return "blocked" as const;
  }
  return "info" as const;
}

function toFocusCandidate(candidate: RankedInteractionSurfaceCandidate): FocusPlacementSurfaceCandidate {
  return {
    surfaceId: candidate.surfaceId,
    surfaceLabel: candidate.surfaceLabel ?? candidate.surfaceId,
    surfaceType: candidate.surfaceType,
    attachmentType: candidate.attachmentType as FocusPlacementAttachmentType,
    surfaceBoundsMm: candidate.surfaceBoundsMm ?? { min: [0, 0], max: [0, 0] },
    noPlaceZones: candidate.noPlaceZones ?? [],
    preferredZones: candidate.preferredZones ?? [],
    enabled: candidate.enabled && candidate.blockedReasons.length === 0,
    tone: resolveFocusCandidateTone(candidate),
    reason: candidate.blockedReasons[0]?.message ?? candidate.reason ?? null,
    ranking: candidate.ranking ?? {},
    score: candidate.score,
    rank: candidate.rank,
    blockedReasons: candidate.blockedReasons,
    visualAffordance: candidate.visualAffordance
  };
}

function toFocusCandidates(state: FocusPlacementMachineState): FocusPlacementSurfaceCandidate[] {
  return state.candidates.map(toFocusCandidate);
}

function resolveActiveMachineCandidate(state: FocusPlacementMachineState) {
  return state.candidates[state.activeCandidateIndex] ?? null;
}

function formatBlockedReason(reason: BlockedReason) {
  return `[${reason.code}] ${reason.message}`;
}

function isFinitePoseValue(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function resolveRuntimeAssetForObject(engine: Engine, objectId: string, assetFallback?: SceneAsset | null) {
  const runtimeObject = engine.runtimeScene.objectRegistry.get(objectId);
  if (runtimeObject) {
    const runtimeAssetId = runtimeObject.runtimeAssetId ?? runtimeObject.assetId;
    return (
      engine.runtimeScene.runtimeAssets.get(runtimeAssetId) ??
      (assetFallback
        ? engine.runtimeScene.runtimeAssets.get(assetFallback.catalogItemId ?? assetFallback.assetId) ?? null
        : null)
    );
  }

  return assetFallback
    ? engine.runtimeScene.runtimeAssets.get(assetFallback.catalogItemId ?? assetFallback.assetId) ?? null
    : null;
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
  const requestFocusPlacement = useFocusPlacementStore((state) => state.requestFocusPlacement);
  const clearPendingRequest = useFocusPlacementStore((state) => state.clearPendingRequest);
  const startSession = useFocusPlacementStore((state) => state.startSession);
  const updateSession = useFocusPlacementStore((state) => state.updateSession);
  const clearSession = useFocusPlacementStore((state) => state.clearSession);
  const placementDraft = useWalkInventoryStore((state) => state.placementDraft);
  const clearPlacementDraft = useWalkInventoryStore((state) => state.clearPlacementDraft);
  const transactionRef = useRef<PlacementTransaction | null>(null);
  const machineRef = useRef<FocusPlacementMachine | null>(null);
  const kernel = useMemo(() => (engine ? new PlacementKernel(engine) : null), [engine]);
  const assetsById = useMemo(
    () => {
      const entries = assets.map((asset) => [asset.id, asset] as const);
      if (placementDraft?.asset && !assets.some((asset) => asset.id === placementDraft.objectId)) {
        entries.push([placementDraft.objectId, placementDraft.asset]);
      }
      return new Map(entries);
    },
    [assets, placementDraft]
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
      const supportAsset = assetsById.get(input.request.supportObjectId);
      if (!supportAsset) {
        throw new Error(`Support asset ${input.request.supportObjectId} was not found.`);
      }
      if (!engine) {
        throw new Error("Focus placement engine is unavailable.");
      }
      const selectedRuntimeAsset = resolveRuntimeAssetForObject(
        engine,
        input.request.objectId,
        selectedAsset
      );
      const supportRuntimeAsset = resolveRuntimeAssetForObject(
        engine,
        input.request.supportObjectId,
        supportAsset
      );
      const requestedCandidate =
        input.request.surfaceCandidates[input.candidateIndex] ??
        input.request.surfaceCandidates[input.request.preferredCandidateIndex] ??
        null;
      const refreshedEntry =
        supportRuntimeAsset && supportRuntimeAsset.supportSurfaces.length > 0
          ? resolveFocusPlacementEntry({
              selectedAsset,
              selectedRuntimeAsset,
              supportAsset,
              supportSurfaces: supportRuntimeAsset.supportSurfaces
            })
          : null;
      const refreshedSurfaceCandidates =
        refreshedEntry && refreshedEntry.candidates.length > 0
          ? refreshedEntry.candidates
          : input.request.surfaceCandidates;
      const refreshedPreferredCandidateIndex =
        refreshedEntry && refreshedEntry.candidates.length > 0
          ? refreshedEntry.preferredCandidateIndex
          : input.request.preferredCandidateIndex;
      const requestedSurfaceId = requestedCandidate?.surfaceId ?? input.request.surfaceId;
      const requestedAttachmentType =
        requestedCandidate?.attachmentType ?? input.request.attachmentType;
      const matchedCandidateIndex = refreshedSurfaceCandidates.findIndex(
        (candidateOption) =>
          candidateOption.surfaceId === requestedSurfaceId &&
          candidateOption.attachmentType === requestedAttachmentType
      );
      const candidateIndex =
        matchedCandidateIndex >= 0
          ? matchedCandidateIndex
          : input.mode === "start"
            ? refreshedPreferredCandidateIndex
            : input.candidateIndex;
      const request = {
        ...input.request,
        surfaceCandidates: refreshedSurfaceCandidates,
        preferredCandidateIndex: refreshedPreferredCandidateIndex
      };

      let machine = machineRef.current;
      if (!machine) {
        machine = createFocusPlacementMachine({ mode: "walk", readOnly });
        machineRef.current = machine;
      }

      if (input.mode === "start") {
        const startResult = machine.dispatch({
          type: "AIM_AT_SURFACE",
          payload: {
            objectId: input.request.objectId,
            supportObjectId: input.request.supportObjectId,
            surfaceId: input.request.surfaceId,
            candidates: focusPlacementRequestToInteractionCandidates(request)
          }
        });
        machine.dispatch({
          type: "START_PLACEMENT",
          objectId: input.request.objectId,
          supportObjectId: input.request.supportObjectId,
          candidates: startResult.state.candidates,
          preferredCandidateIndex: candidateIndex,
          readOnly
        });
      } else {
        machine.dispatch({
          type: "SELECT_CANDIDATE",
          candidateIndex
        });
      }

      const machineState = machine.getState();
      const machineCandidate = resolveActiveMachineCandidate(machineState);
      const candidate = machineCandidate ? toFocusCandidate(machineCandidate) : null;
      if (!candidate) {
        throw new Error("Focus placement candidate was not found.");
      }

      transactionRef.current?.cancel();
      const transaction = kernel.begin({
        objectId: input.request.objectId,
        supportObjectId: machineCandidate?.supportObjectId ?? input.request.supportObjectId,
        surfaceId: candidate.surfaceId,
        attachmentType: candidate.attachmentType
      });
      transactionRef.current = transaction;

      const initialLocalPose =
        input.baseLocalPose ??
        resolveInitialLocalPose(
          selectedAsset.placement,
          request.supportObjectId,
          candidate.surfaceId,
          resolveSuggestedLocalPose(candidate.attachmentType, supportRuntimeAsset)
        );
      const nextState = transaction.update(initialLocalPose);
      const sessionState = resolveFocusPlacementSessionUpdate(initialLocalPose, nextState);
      machine.dispatch({
        type: "APPLY_REPORTS",
        localPose: sessionState.localPose,
        constraintReport: sessionState.constraintReport,
        collisionReport: sessionState.collisionReport
      });
      const syncedMachineState = machine.getState();
      const stepConfig = resolveFocusPlacementStepConfig(
        candidate.attachmentType,
        candidate.surfaceType
      );
      const nextSurfaceCandidates = toFocusCandidates(syncedMachineState);
      const preferredCandidateIndex = Math.max(
        0,
        syncedMachineState.candidates.findIndex(
          (candidateOption) =>
            candidateOption.enabled && candidateOption.blockedReasons.length === 0
        )
      );
      const nextSession = {
        ...request,
        ...candidate,
        supportObjectId: machineCandidate?.supportObjectId ?? input.request.supportObjectId,
        surfaceCandidates: nextSurfaceCandidates,
        preferredCandidateIndex,
        activeCandidateIndex: syncedMachineState.activeCandidateIndex,
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

      if (selectedAssetId !== input.request.objectId) {
        setSelectedAssetId(input.request.objectId);
      }
      setIsTransforming(true);
    },
    [
      assetsById,
      engine,
      kernel,
      readOnly,
      selectedAssetId,
      setIsTransforming,
      setSelectedAssetId,
      startSession,
      updateSession
    ]
  );

  useEffect(() => {
    (window as typeof window & {
      __DESKTERIORONLINE_FOCUS_PLACEMENT_STATE__?: Record<string, unknown>;
    }).__DESKTERIORONLINE_FOCUS_PLACEMENT_STATE__ = {
      viewMode,
      readOnly,
      pendingObjectId: pendingRequest?.objectId ?? null,
      activeObjectId: activeSession?.objectId ?? null,
      draftObjectId: placementDraft?.objectId ?? null,
      hasKernel: Boolean(kernel),
      hasEngine: Boolean(engine)
    };
  }, [activeSession, engine, kernel, pendingRequest, placementDraft, readOnly, viewMode]);

  useEffect(() => {
    if (viewMode !== "walk" || readOnly || activeSession || pendingRequest) {
      return;
    }

    const handleAimAtSurface = (event: Event) => {
      const detail = (event as CustomEvent<WalkFocusPlacementAimDetail>).detail;
      if (!detail?.request || activeSession || pendingRequest) {
        return;
      }

      let machine = machineRef.current;
      if (!machine) {
        machine = createFocusPlacementMachine({ mode: "walk", readOnly });
        machineRef.current = machine;
      }

      const aimedRequest = withFocusPlacementAimMetadata(
        detail.request,
        detail.rayHitConfidence
      );

      machine.dispatch({
        type: "AIM_AT_SURFACE",
        payload: {
          objectId: aimedRequest.objectId,
          supportObjectId: aimedRequest.supportObjectId,
          surfaceId: aimedRequest.surfaceId,
          candidates: focusPlacementRequestToInteractionCandidates(aimedRequest),
          ...(typeof aimedRequest.aimRayHitConfidence === "number"
            ? { rayHitConfidence: aimedRequest.aimRayHitConfidence }
            : {})
        }
      });
      requestFocusPlacement(aimedRequest);
    };

    window.addEventListener(WALK_FOCUS_PLACEMENT_AIM_EVENT, handleAimAtSurface);
    return () => {
      window.removeEventListener(WALK_FOCUS_PLACEMENT_AIM_EVENT, handleAimAtSurface);
    };
  }, [activeSession, pendingRequest, readOnly, requestFocusPlacement, viewMode]);

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
        cancelRuntimeAssetPreview(pendingRequest.objectId, engine);
        if (assets.some((asset) => asset.id === pendingRequest.objectId)) {
          removeFurniture(pendingRequest.objectId);
        }
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
    assets,
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
    if (!placementDraft || activeSession || pendingRequest || viewMode !== "walk" || readOnly) {
      return;
    }

    const cancelDraft = () => {
      cancelRuntimeAssetPreview(placementDraft.objectId, engine);
      if (assets.some((asset) => asset.id === placementDraft.objectId)) {
        removeFurniture(placementDraft.objectId);
      }
      if (selectedAssetId === placementDraft.objectId) {
        setSelectedAssetId(null);
      }
      clearPlacementDraft();
      setIsTransforming(false);
      toast.info("배치 preview를 취소했습니다.");
    };

    const commitWorldDraft = () => {
      if (placementDraft.placementMode !== "world") {
        return false;
      }

      const asset = assetsById.get(placementDraft.objectId);
      const runtimeObject = engine?.runtimeScene.objectRegistry.get(placementDraft.objectId);
      if (!asset || !runtimeObject) {
        toast.error("배치를 확정할 수 없습니다.", {
          description: "제품 메타데이터를 다시 불러온 뒤 시도해 주세요."
        });
        cancelDraft();
        return true;
      }

      const transform = runtimeObject.previewTransform ?? runtimeObject.transform;
      if (assets.some((candidate) => candidate.id === placementDraft.objectId)) {
        commitRuntimeAssetUpdateToStore({
          objectId: placementDraft.objectId,
          updates: {
            position: [...transform.position] as typeof asset.position,
            rotation: [...transform.rotation] as typeof asset.rotation,
            scale: [...transform.scale] as typeof asset.scale
          },
          engine
        });
      } else {
        commitRuntimePlacementDraftToStore({
          asset: placementDraft.asset,
          engine,
          commitPreview: true
        });
      }
      recordSnapshot("워크뷰 제품 배치");
      clearPlacementDraft();
      setIsTransforming(false);
      toast.success(`${placementDraft.label} 배치됨`, {
        description: "commit 후 저장/공유 대상 scene document에 포함됩니다."
      });
      return true;
    };

    const showSurfaceBlockedMessage = () => {
      window.setTimeout(() => {
        const latestDraft = useWalkInventoryStore.getState().placementDraft;
        const latestFocus = useFocusPlacementStore.getState();
        if (
          latestDraft?.objectId !== placementDraft.objectId ||
          latestDraft.placementMode !== "surface" ||
          latestFocus.pendingRequest ||
          latestFocus.activeSession
        ) {
          return;
        }
        toast.error("여기는 배치할 수 없습니다.", {
          description: "바닥, 책상, 벽처럼 호환되는 표면을 화면 중앙에 조준하세요."
        });
      }, 0);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (shouldIgnoreKeyboardTarget(event.target)) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        cancelDraft();
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        if (!commitWorldDraft()) {
          showSurfaceBlockedMessage();
        }
      }
    };

    const handleMouseDown = (event: MouseEvent) => {
      if (event.button !== 0 || shouldIgnorePointerCommitTarget(event.target)) {
        return;
      }
      if (placementDraft.placementMode === "world") {
        event.preventDefault();
        commitWorldDraft();
        return;
      }
      showSurfaceBlockedMessage();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("mousedown", handleMouseDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mousedown", handleMouseDown);
    };
  }, [
    activeSession,
    assets,
    assetsById,
    clearPlacementDraft,
    engine,
    placementDraft,
    pendingRequest,
    readOnly,
    recordSnapshot,
    removeFurniture,
    selectedAssetId,
    setIsTransforming,
    setSelectedAssetId,
    viewMode
  ]);

  useEffect(() => {
    if (!activeSession || !engine) {
      return;
    }

    if (
      viewMode === "walk" &&
      !readOnly &&
      (selectedAssetId === activeSession.objectId || placementDraft?.objectId === activeSession.objectId)
    ) {
      return;
    }

    transactionRef.current?.cancel();
    transactionRef.current = null;
    machineRef.current = null;
    clearSession();
    setIsTransforming(false);
  }, [
    activeSession,
    clearSession,
    engine,
    placementDraft,
    readOnly,
    selectedAssetId,
    setIsTransforming,
    viewMode
  ]);

  useEffect(() => {
    if (!activeSession || !engine) {
      return;
    }

    const syncPreviewFromMachineResult = (result: InteractionResult) => {
      if (!transactionRef.current) {
        return;
      }

      const previewCommand = result.commands.find(
        (command) => command.type === "UPDATE_PREVIEW_POSE"
      );
      if (!previewCommand || previewCommand.type !== "UPDATE_PREVIEW_POSE") {
        return;
      }

      const nextState = transactionRef.current.update(
        previewCommand.snapRule
          ? { localPose: previewCommand.localPose, snapRule: previewCommand.snapRule }
          : previewCommand.localPose
      );
      const sessionState = resolveFocusPlacementSessionUpdate(previewCommand.localPose, nextState);
      const syncedResult = machineRef.current?.dispatch({
        type: "APPLY_REPORTS",
        localPose: sessionState.localPose,
        constraintReport: sessionState.constraintReport,
        collisionReport: sessionState.collisionReport
      });
      const syncedMachineState = syncedResult?.state ?? result.state;
      updateSession({
        activeCandidateIndex: syncedMachineState.activeCandidateIndex,
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

    const dispatchPreviewEvent = (
      event:
        | { type: "NUDGE"; axis: "u" | "v" | "normal"; deltaMm: number; snapRule?: SnapRule }
        | { type: "ROTATE"; deltaMilliDeg: number; snapRule?: SnapRule }
        | { type: "SET_NUMERIC_POSE"; pose: Partial<SurfaceLocalPose>; snapRule?: SnapRule }
    ) => {
      const machine = machineRef.current;
      if (!machine) {
        return;
      }

      syncPreviewFromMachineResult(machine.dispatch(event));
    };

    const commitActivePlacement = () => {
      if (!transactionRef.current) {
        return;
      }

      const commitResult = machineRef.current?.dispatch({ type: "COMMIT" });
      if (commitResult && commitResult.documentPatchCount === 0) {
        const detail =
          commitResult.state.blockedReasons.map(formatBlockedReason).join(", ") ||
          "충돌, 여유 공간, 표면 호환성을 확인한 뒤 다시 배치해 주세요.";
        toast.error("배치할 수 없는 위치입니다.", {
          description: detail
        });
        return;
      }

      try {
        const committedPlacement = transactionRef.current.commit();
        (window as typeof window & {
          __DESKTERIORONLINE_FOCUS_PLACEMENT_LAST_COMMIT__?: Record<string, unknown>;
        }).__DESKTERIORONLINE_FOCUS_PLACEMENT_LAST_COMMIT__ = {
          activeObjectId: activeSession.objectId,
          draftObjectId: placementDraft?.objectId ?? null,
          committedPlacementMode: committedPlacement.mode,
          draftBranch: placementDraft?.objectId === activeSession.objectId && Boolean(placementDraft.asset)
        };
        if (placementDraft?.objectId === activeSession.objectId && placementDraft.asset) {
          commitRuntimePlacementDraftToStore({
            asset: placementDraft.asset,
            engine,
            placement: committedPlacement
          });
        } else {
          commitRuntimePlacementToStore({
            objectId: activeSession.objectId,
            engine
          });
        }
        machineRef.current?.dispatch({ type: "COMMIT_SUCCEEDED" });
        recordSnapshot("집중 배치");
        if (placementDraft?.objectId === activeSession.objectId) {
          clearPlacementDraft();
        }
        transactionRef.current = null;
        machineRef.current = null;
        clearSession();
        setIsTransforming(false);
      } catch (error) {
        console.error("[FocusPlacementController] failed to commit focus placement", error);
        machineRef.current?.dispatch({
          type: "COMMIT_FAILED",
          reasons: [
            createBlockedReason(
              "COLLISION",
              error instanceof Error ? error.message : "Placement commit failed.",
              "constraint"
            )
          ]
        });
        toast.error("배치할 수 없는 위치입니다.", {
          description: "충돌, 여유 공간, 표면 호환성을 확인한 뒤 다시 배치해 주세요."
        });
      }
    };

    const cancelActivePlacement = () => {
      machineRef.current?.dispatch({ type: "CANCEL" });
      if (transactionRef.current) {
        transactionRef.current.cancel();
        transactionRef.current = null;
      }
      if (placementDraft?.objectId === activeSession.objectId) {
        cancelRuntimeAssetPreview(activeSession.objectId, engine);
        if (assets.some((asset) => asset.id === activeSession.objectId)) {
          removeFurniture(activeSession.objectId);
        }
        setSelectedAssetId(null);
        clearPlacementDraft();
      }
      machineRef.current = null;
      clearSession();
      setIsTransforming(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!transactionRef.current || shouldIgnoreKeyboardTarget(event.target)) {
        return;
      }

      const moveStep = resolveMoveStep(event, activeSession.moveStepMm);
      const rotateStep = resolveRotateStep(event, activeSession.rotateStepMilliDeg);
      const snapRule = event.altKey ? FINE_PRECISION_SNAP_RULE : undefined;

      switch (event.key) {
        case "ArrowLeft":
          event.preventDefault();
          dispatchPreviewEvent({ type: "NUDGE", axis: "u", deltaMm: -moveStep, snapRule });
          break;
        case "ArrowRight":
          event.preventDefault();
          dispatchPreviewEvent({ type: "NUDGE", axis: "u", deltaMm: moveStep, snapRule });
          break;
        case "ArrowUp":
          event.preventDefault();
          dispatchPreviewEvent({ type: "NUDGE", axis: "v", deltaMm: -moveStep, snapRule });
          break;
        case "ArrowDown":
          event.preventDefault();
          dispatchPreviewEvent({ type: "NUDGE", axis: "v", deltaMm: moveStep, snapRule });
          break;
        case "PageUp":
          event.preventDefault();
          dispatchPreviewEvent({ type: "NUDGE", axis: "normal", deltaMm: moveStep, snapRule });
          break;
        case "PageDown":
          event.preventDefault();
          dispatchPreviewEvent({ type: "NUDGE", axis: "normal", deltaMm: -moveStep, snapRule });
          break;
        case "q":
        case "Q":
          event.preventDefault();
          dispatchPreviewEvent({ type: "ROTATE", deltaMilliDeg: -rotateStep, snapRule });
          break;
        case "e":
        case "E":
          event.preventDefault();
          dispatchPreviewEvent({ type: "ROTATE", deltaMilliDeg: rotateStep, snapRule });
          break;
        case "Tab": {
          event.preventDefault();
          const switchResult = machineRef.current?.dispatch({
            type: "SWITCH_CANDIDATE",
            direction: event.shiftKey ? -1 : 1
          });
          const nextCandidateIndex = switchResult?.state.activeCandidateIndex ?? -1;
          if (nextCandidateIndex === -1 || nextCandidateIndex === activeSession.activeCandidateIndex) {
            return;
          }

          try {
            activateCandidate({
              request: {
                ...activeSession,
                surfaceCandidates: switchResult ? toFocusCandidates(switchResult.state) : activeSession.surfaceCandidates
              },
              candidateIndex: nextCandidateIndex,
              baseLocalPose: switchResult?.state.localPose ?? activeSession.localPose,
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
            const selectResult = machineRef.current?.dispatch({
              type: "SELECT_CANDIDATE",
              candidateIndex: activeSession.preferredCandidateIndex
            });
            activateCandidate({
              request: {
                ...activeSession,
                surfaceCandidates: selectResult ? toFocusCandidates(selectResult.state) : activeSession.surfaceCandidates
              },
              candidateIndex: selectResult?.state.activeCandidateIndex ?? activeSession.preferredCandidateIndex,
              baseLocalPose: selectResult?.state.localPose ?? activeSession.localPose,
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

      dispatchPreviewEvent({
        type: "SET_NUMERIC_POSE",
        pose: {
          ...(isFinitePoseValue(detail.uMm) ? { uMm: detail.uMm } : {}),
          ...(isFinitePoseValue(detail.vMm) ? { vMm: detail.vMm } : {}),
          ...(isFinitePoseValue(detail.normalOffsetMm) ? { normalOffsetMm: detail.normalOffsetMm } : {}),
          ...(isFinitePoseValue(detail.rotationMilliDeg) ? { rotationMilliDeg: detail.rotationMilliDeg } : {})
        },
        snapRule: FINE_PRECISION_SNAP_RULE
      });
    };
    const handleCandidateSelect = (event: Event) => {
      const detail = (event as CustomEvent<{ candidateIndex?: number }>).detail;
      const candidateIndex = detail?.candidateIndex;
      if (
        typeof candidateIndex !== "number" ||
        !Number.isInteger(candidateIndex) ||
        candidateIndex < 0 ||
        candidateIndex >= activeSession.surfaceCandidates.length ||
        candidateIndex === activeSession.activeCandidateIndex
      ) {
        return;
      }

      try {
        const selectResult = machineRef.current?.dispatch({
          type: "SELECT_CANDIDATE",
          candidateIndex
        });
        activateCandidate({
          request: {
            ...activeSession,
            surfaceCandidates: selectResult ? toFocusCandidates(selectResult.state) : activeSession.surfaceCandidates
          },
          candidateIndex: selectResult?.state.activeCandidateIndex ?? candidateIndex,
          baseLocalPose: selectResult?.state.localPose ?? activeSession.localPose,
          mode: "switch"
        });
      } catch (error) {
        console.error("[FocusPlacementController] failed to select focus placement candidate", error);
      }
    };
    window.addEventListener("deskterioronline:focus-placement:set-local-pose", handleNumericPoseInput);
    window.addEventListener("deskterioronline:focus-placement:select-candidate", handleCandidateSelect);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mousedown", handlePointerCommit);
      window.removeEventListener("deskterioronline:focus-placement:commit", commitActivePlacement);
      window.removeEventListener("deskterioronline:focus-placement:cancel", cancelActivePlacement);
      window.removeEventListener("deskterioronline:focus-placement:set-local-pose", handleNumericPoseInput);
      window.removeEventListener("deskterioronline:focus-placement:select-candidate", handleCandidateSelect);
    };
  }, [
    activateCandidate,
    activeSession,
    assets,
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
      machineRef.current = null;
      clearSession();
      setIsTransforming(false);
    };
  }, [clearSession, setIsTransforming]);

  return null;
}
