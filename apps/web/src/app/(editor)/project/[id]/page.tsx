"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import { Crosshair, LayoutGrid } from "lucide-react";
import { BuilderLibraryShelf } from "../../../../components/editor/BuilderLibraryShelf";
import {
  useEditorStore,
  type EditorTopMode,
  type EditorViewMode
} from "../../../../lib/stores/useEditorStore";
import { useProjectStore } from "../../../../lib/stores/useProjectStore";
import {
  useAssetStore,
  useCameraStore,
  usePublishStore,
  useSelectionStore,
  useShellStore
} from "../../../../lib/stores/scene-slices";
import { motion, AnimatePresence } from "framer-motion";
import { BuilderInspectorPanel } from "../../../../components/editor/BuilderInspectorPanel";
import { BuilderLaunchState } from "../../../../components/editor/BuilderLaunchState";
import { PrecisionMeasurementOverlay } from "../../../../components/editor/PrecisionMeasurementOverlay";
import { ProjectEditorViewport } from "../../../../components/editor/ProjectEditorViewport";
import { ProjectEditorHeader } from "../../../../components/editor/ProjectEditorHeader";
import { ShareModal } from "../../../../components/editor/ShareModal";
import { StudioModeToggle } from "../../../../components/editor/StudioModeToggle";
import { useAssetCatalog } from "../../../../components/editor/useAssetCatalog";
import { useEditorSaveSession } from "../../../../components/editor/useEditorSaveSession";
import "../../../../lib/polyfills/progress-event";
import * as THREE from "three";
import { WebGPURenderer } from "three/webgpu";
import { getScaleGateMessage, parseScaleInfo } from "../../../../lib/ai/scaleInfo";
import { fetchProjectSceneBootstrap } from "../../../../lib/api/project";
import {
  buildProjectAssetSummary,
  findCatalogItem,
  formatAssetIdLabel,
  selectStarterSetItems,
  toCatalogProductSnapshot,
  type LibraryCatalogItem
} from "../../../../lib/builder/catalog";
import { builderFloorFinishes, builderWallFinishes } from "../../../../lib/builder/templates";
import {
  toSceneStorePatch,
  type SceneDocumentBootstrap,
  type SceneDocumentDiagnostics
} from "../../../../lib/domain/scene-document";
import { resolveTopViewInteractionPolicy } from "../../../../lib/editor/top-view-policy";
import { constrainPlacementToAnchor, inferAnchorTypeForCatalogItem } from "../../../../lib/scene/anchors";
import { normalizeSceneAnchorType } from "../../../../lib/scene/anchor-types";
import { getLightingPreset, type LightingPresetId } from "../../../../lib/scene/lighting-presets";
import {
  formatSupportSurfaceLabel,
  resolveSupportSurfaceLock
} from "../../../../lib/scene/support-profiles";

const STARTER_SET_OFFSETS: Array<[number, number]> = [
  [-2.2, -1.2],
  [0, -1.2],
  [2.2, -1.2],
  [-2.2, 0.8],
  [0, 0.8],
  [2.2, 0.8]
];

function computeBounds(walls: { start: [number, number]; end: [number, number] }[], scale: number) {
  if (walls.length === 0) return { minX: -1, maxX: 1, minZ: -1, maxZ: 1 };
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  walls.forEach((wall) => {
    [wall.start, wall.end].forEach(([x, z]) => {
      minX = Math.min(minX, x * scale);
      maxX = Math.max(maxX, x * scale);
      minZ = Math.min(minZ, z * scale);
      maxZ = Math.max(maxZ, z * scale);
    });
  });
  return { minX, maxX, minZ, maxZ };
}

export default function ProjectEditorPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = params.id as string;

  const viewMode = useEditorStore((state) => state.viewMode);
  const topMode = useEditorStore((state) => state.topMode);
  const setViewMode = useEditorStore((state) => state.setViewMode);
  const setTopMode = useEditorStore((state) => state.setTopMode);
  const applyShellPreset = useEditorStore((state) => state.applyShellPreset);
  const panels = useEditorStore((state) => state.panels);
  const setPanels = useEditorStore((state) => state.setPanels);
  const resetShellState = useEditorStore((state) => state.resetShellState);
  const transformMode = useEditorStore((state) => state.transformMode);
  const transformSpace = useEditorStore((state) => state.transformSpace);
  const setIsTransforming = useEditorStore((state) => state.setIsTransforming);
  const setTransformMode = useEditorStore((state) => state.setTransformMode);
  const setTransformSpace = useEditorStore((state) => state.setTransformSpace);
  const {
    walls,
    openings,
    floors,
    ceilings,
    rooms,
    cameraAnchors,
    navGraph,
    scale,
    scaleInfo,
    wallMaterialIndex,
    floorMaterialIndex,
    lighting,
    setWallMaterialIndex,
    setFloorMaterialIndex,
    setLighting,
    setScene,
    resetScene
  } = useShellStore();
  const { assets, addFurniture, updateFurniture, removeFurniture } = useAssetStore();
  const { selectedAssetId, setSelectedAssetId } = useSelectionStore();
  const { entranceId, setEntranceId } = useCameraStore();
  const { initializeHistory, recordSnapshot } = usePublishStore();
  const { currentProject, loadProject } = useProjectStore();

  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [bootstrapDiagnostics, setBootstrapDiagnostics] = useState<SceneDocumentDiagnostics | null>(null);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isWebGPUReady, setIsWebGPUReady] = useState(false);
  const [projectNameDraft, setProjectNameDraft] = useState("");
  const topViewPolicy = useMemo(
    () => resolveTopViewInteractionPolicy(topMode),
    [topMode]
  );
  const topModeOptions = useMemo(
    () => [
      { id: "room", label: "룸 배치", icon: LayoutGrid },
      { id: "desk-precision", label: "데스크 정밀", icon: Crosshair }
    ],
    []
  );
  const {
    catalog: libraryCatalog,
    categories: libraryCategories,
    query: libraryQuery,
    setQuery: setLibraryQuery,
    activeCategory: libraryCategory,
    setActiveCategory: setLibraryCategory,
    filteredItems: filteredLibraryCatalog,
    featuredItems: featuredLibraryCatalog,
    spotlightItem: librarySpotlightItem,
    hasActiveFilters: libraryHasActiveFilters
  } = useAssetCatalog();

  useEffect(() => {
    const supportsWebGPU = typeof navigator !== "undefined" && Boolean((navigator as any).gpu);
    setIsWebGPUReady(supportsWebGPU);
  }, []);

  useEffect(() => {
    applyShellPreset("editor", { panels: { assets: false, properties: false } });
    return () => {
      resetShellState();
    };
  }, [applyShellPreset, resetShellState]);

  useEffect(() => {
    setProjectNameDraft(currentProject?.name ?? "");
  }, [currentProject?.id, currentProject?.name]);

  const preferWebGPU = searchParams.get("renderer") === "webgpu" && isWebGPUReady;
  const createRenderer = useMemo(() => {
    if (!preferWebGPU) return undefined;
    return (canvas: HTMLCanvasElement) => {
      try {
        const renderer = new WebGPURenderer({ canvas, antialias: true });
        if ("init" in renderer && typeof (renderer as unknown as { init?: () => Promise<void> }).init === "function") {
          throw new Error("현재 환경에서는 WebGPU 비동기 초기화를 지원하지 않습니다.");
        }
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
        return renderer;
      } catch (error) {
        console.warn("[renderer] WebGPU fallback -> WebGL", error);
        setIsWebGPUReady(false);
        const fallback = new THREE.WebGLRenderer({
          canvas,
          antialias: true,
          alpha: false,
          stencil: false,
          depth: true,
          powerPreference: "high-performance",
          preserveDrawingBuffer: false
        });
        fallback.setPixelRatio(window.devicePixelRatio);
        fallback.setSize(canvas.clientWidth, canvas.clientHeight, false);
        return fallback;
      }
    };
  }, [preferWebGPU, setIsWebGPUReady]);

  const applyMappedScene = useCallback(
    (mapped: SceneDocumentBootstrap) => {
      const mappedPatch = toSceneStorePatch(mapped);
      const { entranceId, ...sceneState } = mappedPatch;
      const nextScaleInfo = parseScaleInfo(sceneState.scaleInfo, sceneState.scale);
      setScene({
        ...sceneState,
        scale: nextScaleInfo.value,
        scaleInfo: nextScaleInfo,
      });
      setEntranceId(entranceId);
    },
    [setEntranceId, setScene]
  );

  const bootstrapProjectScene = useCallback(async (): Promise<"version" | "empty"> => {
      const bootstrapResponse = await fetchProjectSceneBootstrap(projectId);
      if (!bootstrapResponse.bootstrap) {
        setBootstrapDiagnostics(null);
        return "empty";
      }

      setBootstrapDiagnostics(bootstrapResponse.bootstrap.diagnostics ?? null);
      applyMappedScene(bootstrapResponse.bootstrap);
      setViewMode("top");
      return "version";
    },
    [applyMappedScene, projectId, setViewMode]
  );

  useEffect(() => {
    if (!bootstrapDiagnostics || bootstrapDiagnostics.integrity.status === "ok") {
      return;
    }

    const firstIssue = bootstrapDiagnostics.integrity.issues[0];
    const issueSummary = firstIssue?.message ?? "sceneDocument integrity requires review.";
    const issueCount = bootstrapDiagnostics.integrity.issues.length;
    const description =
      issueCount > 1 ? `${issueSummary} 외 ${issueCount - 1}건` : issueSummary;

    if (bootstrapDiagnostics.integrity.status === "corrupt") {
      toast.error("저장된 장면 무결성 오류를 감지했습니다.", {
        description
      });
      return;
    }

    toast.warning("저장된 장면 무결성 경고가 있습니다.", {
      description
    });
  }, [bootstrapDiagnostics]);

  useEffect(() => {
    const init = async () => {
      resetScene();
      setBootstrapError(null);
      setBootstrapDiagnostics(null);

      try {
        const project = await loadProject(projectId);
        if (!project) {
          setBootstrapError("작업 공간을 불러오지 못했습니다. 접근 권한을 확인하거나 다시 시도해 주세요.");
          return;
        }

        const source = await bootstrapProjectScene();
        initializeHistory(source === "version" ? "세션 시작" : "빌더 시작");
      } catch (error) {
        console.warn("[project-editor] workspace bootstrap failed:", error);
        setBootstrapError(error instanceof Error ? error.message : "작업 공간을 불러오지 못했습니다.");
      } finally {
        setIsInitialLoad(false);
      }
    };
    void init();
  }, [bootstrapProjectScene, initializeHistory, loadProject, projectId, resetScene]);

  const requestViewMode = (mode: EditorViewMode) => {
    if (!hasSceneGeometry) {
      toast.error("저장된 공간 껍데기가 없습니다. 빌더에서 먼저 생성해 주세요.");
      return;
    }
    const scaleGateMessage = getScaleGateMessage(scale, scaleInfo);
    if (scaleGateMessage) {
      toast.error(scaleGateMessage);
      return;
    }
    setViewMode(mode);
  };

  const triggerZoomControl = useCallback((direction: "in" | "out") => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("deskterioronline:zoom", { detail: { direction } }));
  }, []);

  const sceneCenter = useMemo(() => {
    const bounds = computeBounds(walls, scale);
    return {
      x: (bounds.minX + bounds.maxX) / 2,
      z: (bounds.minZ + bounds.maxZ) / 2
    };
  }, [scale, walls]);
  const anchorContext = useMemo(
    () => ({
      walls,
      ceilings,
      scale,
      sceneAssets: assets
    }),
    [assets, ceilings, scale, walls]
  );
  const placedItemKeys = useMemo(
    () => new Set(assets.map((asset) => asset.catalogItemId ?? asset.assetId)),
    [assets]
  );

  const selectedAsset = useMemo(
    () => assets.find((asset) => asset.id === selectedAssetId) ?? null,
    [assets, selectedAssetId]
  );
  const selectedCatalogItem = useMemo(
    () => (selectedAsset ? findCatalogItem(libraryCatalog, selectedAsset) : null),
    [libraryCatalog, selectedAsset]
  );
  const selectedSupportAsset = useMemo(
    () =>
      selectedAsset?.supportAssetId
        ? assets.find((asset) => asset.id === selectedAsset.supportAssetId) ?? null
        : null,
    [assets, selectedAsset]
  );
  const selectedSupportCatalogItem = useMemo(
    () => (selectedSupportAsset ? findCatalogItem(libraryCatalog, selectedSupportAsset) : null),
    [libraryCatalog, selectedSupportAsset]
  );
  const selectedMeasurementAsset = useMemo(() => {
    if (!selectedAsset) {
      return null;
    }

    return {
      assetId: selectedAsset.assetId,
      position: selectedAsset.position,
      rotation: selectedAsset.rotation,
      scale: selectedAsset.scale,
      product: {
        dimensionsMm: selectedAsset.product?.dimensionsMm ?? selectedCatalogItem?.dimensionsMm ?? null
      }
    };
  }, [selectedAsset, selectedCatalogItem]);
  const selectedSupportSurfaceLock = useMemo(
    () =>
      selectedAsset && selectedSupportAsset && selectedMeasurementAsset
        ? resolveSupportSurfaceLock(
            selectedAsset.anchorType,
            selectedMeasurementAsset,
            selectedSupportAsset
          )
        : null,
    [selectedAsset, selectedMeasurementAsset, selectedSupportAsset]
  );
  const selectedSurfaceLockInfo = useMemo(() => {
    if (!selectedSupportAsset || !selectedSupportSurfaceLock) {
      return null;
    }

    return {
      supportLabel:
        selectedSupportAsset.product?.name ??
        selectedSupportCatalogItem?.label ??
        formatAssetIdLabel(selectedSupportAsset.assetId),
      surfaceLabel: formatSupportSurfaceLabel(selectedSupportSurfaceLock.surface.id),
      sizeMm: selectedSupportSurfaceLock.sizeMm,
      usableSizeMm: selectedSupportSurfaceLock.usableSizeMm,
      marginMm: selectedSupportSurfaceLock.marginMm,
      localOffsetMm: selectedSupportSurfaceLock.localOffsetMm,
      topMm: selectedSupportSurfaceLock.topMm,
      assetHeightMm: selectedSupportSurfaceLock.assetHeightMm,
      bottomOffsetMm: selectedSupportSurfaceLock.bottomOffsetMm,
      topOffsetMm: selectedSupportSurfaceLock.topOffsetMm,
      footprintMm: selectedSupportSurfaceLock.footprintMm,
      projectedFootprintMm: selectedSupportSurfaceLock.projectedFootprintMm,
      relativeYawDeg: selectedSupportSurfaceLock.relativeYawDeg,
      clearanceMm: selectedSupportSurfaceLock.clearanceMm,
      withinUsableBounds: selectedSupportSurfaceLock.withinUsableBounds
    };
  }, [selectedSupportAsset, selectedSupportCatalogItem, selectedSupportSurfaceLock]);

  const createAssetId = useCallback(
    () =>
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `asset-${Math.random().toString(36).slice(2, 10)}`,
    []
  );

  const addCatalogItemToScene = useCallback(
    (item: LibraryCatalogItem) => {
      const id = createAssetId();
      const productSnapshot = toCatalogProductSnapshot(item);
      const supportProfile = item.supportProfile ?? null;
      const inferredAnchorType = inferAnchorTypeForCatalogItem(item);
      const anchoredPlacement = constrainPlacementToAnchor(
        {
          position: [sceneCenter.x, 0, sceneCenter.z],
          rotation: [0, 0, 0],
          anchorType: inferredAnchorType,
          supportAssetId: null
        },
        {
          ...anchorContext,
          activeAsset: {
            id,
            assetId: item.assetId,
            catalogItemId: item.id,
            product: productSnapshot,
            supportProfile,
            scale: item.scale
          }
        }
      );
      addFurniture({
        id,
        assetId: item.assetId,
        catalogItemId: item.id,
        product: productSnapshot,
        anchorType: anchoredPlacement.anchorType,
        supportAssetId: anchoredPlacement.supportAssetId,
        supportProfile,
        position: anchoredPlacement.position,
        rotation: anchoredPlacement.rotation,
        scale: item.scale,
        materialId: null
      });
      setSelectedAssetId(id);
      recordSnapshot(`제품 추가: ${item.label}`);
      toast.success(`${item.label} 제품을 추가했습니다.`);
    },
    [
      addFurniture,
      anchorContext,
      createAssetId,
      recordSnapshot,
      sceneCenter.x,
      sceneCenter.z,
      setSelectedAssetId
    ]
  );

  const addStarterSetToScene = useCallback(() => {
    const selectedItems = selectStarterSetItems(libraryCatalog, STARTER_SET_OFFSETS.length);
    const nextSceneAssets = [...assets];

    selectedItems.slice(0, STARTER_SET_OFFSETS.length).forEach((item, index) => {
      const [offsetX, offsetZ] = STARTER_SET_OFFSETS[index] ?? [0, 0];
      const id = createAssetId();
      const productSnapshot = toCatalogProductSnapshot(item);
      const supportProfile = item.supportProfile ?? null;
      const inferredAnchorType = inferAnchorTypeForCatalogItem(item);
      const anchoredPlacement = constrainPlacementToAnchor(
        {
          position: [sceneCenter.x + offsetX, 0, sceneCenter.z + offsetZ],
          rotation: [0, 0, 0],
          anchorType: inferredAnchorType,
          supportAssetId: null
        },
        {
          ...anchorContext,
          sceneAssets: nextSceneAssets,
          activeAsset: {
            id,
            assetId: item.assetId,
            catalogItemId: item.id,
            product: productSnapshot,
            supportProfile,
            scale: item.scale
          }
        }
      );
      const nextAsset = {
        id,
        assetId: item.assetId,
        catalogItemId: item.id,
        product: productSnapshot,
        anchorType: anchoredPlacement.anchorType,
        supportAssetId: anchoredPlacement.supportAssetId,
        supportProfile,
        position: anchoredPlacement.position,
        rotation: anchoredPlacement.rotation,
        scale: item.scale,
        materialId: null
      };
      addFurniture(nextAsset);
      nextSceneAssets.push(nextAsset);
    });

    setSelectedAssetId(null);
    recordSnapshot("추천 세트 추가");
    toast.success("추천 배치 세트를 추가했습니다.");
  }, [
    addFurniture,
    assets,
    anchorContext,
    createAssetId,
    libraryCatalog,
    recordSnapshot,
    sceneCenter.x,
    sceneCenter.z,
    setSelectedAssetId
  ]);

  const updateAssetFromInspector = useCallback(
    (id: string, updates: Parameters<typeof updateFurniture>[1]) => {
      const targetAsset = assets.find((asset) => asset.id === id);
      if (!targetAsset) return;

      const mergedAnchorType = normalizeSceneAnchorType(updates.anchorType ?? targetAsset.anchorType);
      const anchoredPlacement = constrainPlacementToAnchor(
        {
          position: updates.position ?? targetAsset.position,
          rotation: updates.rotation ?? targetAsset.rotation,
          anchorType: mergedAnchorType,
          supportAssetId:
            updates.supportAssetId !== undefined ? updates.supportAssetId : targetAsset.supportAssetId
        },
        {
          ...anchorContext,
          activeAssetId: targetAsset.id
        }
      );

      updateFurniture(id, {
        ...updates,
        anchorType: anchoredPlacement.anchorType,
        supportAssetId: anchoredPlacement.supportAssetId,
        position: anchoredPlacement.position,
        rotation: anchoredPlacement.rotation
      });
      recordSnapshot("제품 편집");
    },
    [anchorContext, assets, recordSnapshot, updateFurniture]
  );

  const removeAssetFromInspector = useCallback(
    (id: string) => {
      removeFurniture(id);
      recordSnapshot("제품 삭제");
    },
    [recordSnapshot, removeFurniture]
  );

  const applyWallFinish = useCallback(
    (index: number) => {
      setWallMaterialIndex(index);
      recordSnapshot("벽 마감 변경");
    },
    [recordSnapshot, setWallMaterialIndex]
  );

  const applyFloorFinish = useCallback(
    (index: number) => {
      setFloorMaterialIndex(index);
      recordSnapshot("바닥 마감 변경");
    },
    [recordSnapshot, setFloorMaterialIndex]
  );
  const applyLightingSetting = useCallback(
    (updates: Partial<typeof lighting>) => {
      setLighting(updates);
    },
    [setLighting]
  );
  const commitLightingSetting = useCallback(() => {
    recordSnapshot("조명 변경");
  }, [recordSnapshot]);
  const applyLightingPreset = useCallback(
    (presetId: LightingPresetId) => {
      const preset = getLightingPreset(presetId);
      if (!preset) return;
      setLighting(preset.settings);
      recordSnapshot(`조명 프리셋 변경: ${preset.label}`);
    },
    [recordSnapshot, setLighting]
  );

  const hasSceneGeometry = walls.length > 0 || floors.length > 0;
  const canEnter3D = hasSceneGeometry && !getScaleGateMessage(scale, scaleInfo);
  const isSceneVisible = hasSceneGeometry && (viewMode === "top" || viewMode === "walk");
  const showLaunchState = !hasSceneGeometry;
  const isTopEditorVisible = isSceneVisible && viewMode === "top";
  const launchMetrics = [
    { label: "진입", value: "빌더" },
    { label: "제품 목록", value: `${libraryCatalog.length}개` },
    { label: "마감 프리셋", value: `${builderWallFinishes.length + builderFloorFinishes.length}개` },
    bootstrapDiagnostics
      ? {
          label: "무결성",
          value:
            bootstrapDiagnostics.integrity.status === "ok"
              ? "정상"
              : `${bootstrapDiagnostics.integrity.status} ${bootstrapDiagnostics.integrity.issues.length}건`
        }
      : null
  ].filter((entry): entry is { label: string; value: string } => Boolean(entry));
  const launchPreviewItems = featuredLibraryCatalog.slice(0, 3);
  const normalizedProjectName = projectNameDraft.trim();
  const activePanel = panels.assets ? "assets" : panels.properties ? "properties" : null;
  const topModeNotice =
    topMode === "room"
      ? "룸 배치 모드: 제품 본체를 직접 드래그해 큰 위치를 잡습니다. 250mm snap과 월드 기준 정렬만 유지합니다."
      : "데스크 정밀 모드: surface/anchor 기준의 미세 배치를 위해 gizmo를 사용합니다. 25mm / 15도 snap이 적용됩니다.";

  const savePayload = useMemo(
    () => ({
      roomShell: {
        scale,
        scaleInfo,
        walls,
        openings,
        floors,
        ceilings,
        rooms,
        cameraAnchors,
        navGraph,
        entranceId
      },
      assets,
      materials: {
        wallIndex: wallMaterialIndex,
        floorIndex: floorMaterialIndex
      },
      lighting,
      assetSummary: buildProjectAssetSummary(libraryCatalog, assets),
      projectName: normalizedProjectName || currentProject?.name || "새 공간 디자인"
    }),
    [
      assets,
      cameraAnchors,
      ceilings,
      currentProject?.name,
      entranceId,
      floorMaterialIndex,
      floors,
      libraryCatalog,
      lighting,
      navGraph,
      normalizedProjectName,
      openings,
      rooms,
      scale,
      scaleInfo,
      wallMaterialIndex,
      walls
    ]
  );
  const saveSignature = useMemo(() => JSON.stringify(savePayload), [savePayload]);
  const {
    isDirty,
    isSaving,
    saveError,
    lastSavedAt,
    triggerManualSave
  } = useEditorSaveSession({
    projectId,
    payload: savePayload,
    signature: saveSignature,
    ready: !isInitialLoad,
    autosaveDelayMs: 2500
  });
  useEffect(() => {
    if (!isSceneVisible || isTopEditorVisible) return;
    setPanels({ assets: false, properties: false });
    setTransformMode("translate");
    setTransformSpace("world");
    setIsTransforming(false);
  }, [
    isSceneVisible,
    isTopEditorVisible,
    setIsTransforming,
    setPanels,
    setTransformMode,
    setTransformSpace
  ]);

  const closePanels = useCallback(() => {
    setPanels({ assets: false, properties: false });
  }, [setPanels]);
  const activateAssetPanel = () => setPanels({ assets: true, properties: false });
  const activateInspectorPanel = () => setPanels({ assets: false, properties: true });
  const toggleAssetPanel = () => {
    if (panels.assets && !panels.properties) {
      closePanels();
      return;
    }
    activateAssetPanel();
  };
  const toggleInspectorPanel = () => {
    if (panels.properties && !panels.assets) {
      closePanels();
      return;
    }
    activateInspectorPanel();
  };

  useEffect(() => {
    if (!isTopEditorVisible || (!panels.assets && !panels.properties)) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closePanels();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closePanels, isTopEditorVisible, panels.assets, panels.properties]);

  useEffect(() => {
    if (viewMode !== "top") return;
    setIsTransforming(false);
    setTransformMode(topViewPolicy.preferredTransformMode);
    setTransformSpace(topViewPolicy.preferredTransformSpace);
  }, [
    setIsTransforming,
    setTransformMode,
    setTransformSpace,
    topViewPolicy.preferredTransformMode,
    topViewPolicy.preferredTransformSpace,
    viewMode
  ]);

  if (isInitialLoad) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#e7e4de]">
        <div className="text-[#6f665c] text-[10px] font-bold uppercase tracking-[0.5em] animate-pulse">
          작업 공간 동기화 중...
        </div>
      </div>
    );
  }

  if (bootstrapError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#e7e4de] px-4 text-[#1f1b16]">
        <div className="w-full max-w-2xl rounded-[32px] border border-black/10 bg-white/95 p-8 shadow-[0_24px_80px_rgba(0,0,0,0.16)] backdrop-blur">
          <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#8f7a62]">작업 공간 오류</div>
          <h1 className="mt-5 text-4xl font-light">프로젝트를 정상적으로 불러오지 못했습니다.</h1>
          <p className="mt-4 text-sm leading-7 text-[#5b5348]">{bootstrapError}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => router.refresh()}
              className="inline-flex items-center justify-center rounded-full bg-[#1f1b16] px-6 py-3 text-[10px] font-bold uppercase tracking-[0.24em] text-white transition hover:bg-[#2b261f]"
            >
              작업 공간 다시 시도
            </button>
            <button
              type="button"
              onClick={() => router.push("/studio")}
              className="inline-flex items-center justify-center rounded-full border border-black/15 bg-white px-6 py-3 text-[10px] font-bold uppercase tracking-[0.24em] text-[#473f35] transition hover:border-black/25 hover:bg-[#f6f4ef]"
            >
              스튜디오로 돌아가기
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#efefec] text-[#1f1b16]">
      <ProjectEditorHeader
        title={projectNameDraft}
        onTitleChange={setProjectNameDraft}
        onTitleCommit={() => setProjectNameDraft((current) => current.trim())}
        viewMode={viewMode}
        canShowPanels={isTopEditorVisible}
        activePanel={activePanel}
        onBack={() => router.push("/studio")}
        onShowAssets={toggleAssetPanel}
        onShowInspector={toggleInspectorPanel}
        onOpenShare={() => setIsShareOpen(true)}
        onSave={() => {
          void triggerManualSave();
        }}
        isSaving={isSaving}
        isDirty={isDirty}
        saveError={saveError}
        lastSavedAt={lastSavedAt}
      />

      <div className="relative h-screen w-full overflow-hidden px-2 pb-20 pt-12 sm:px-3 sm:pb-16 xl:px-4">
        <AnimatePresence mode="popLayout" initial={false}>
          {showLaunchState ? (
            <BuilderLaunchState
              metrics={launchMetrics}
              previewItems={launchPreviewItems}
              onOpenBuilder={() => router.push("/studio/builder")}
              onBrowseStudio={() => router.push("/studio")}
            />
          ) : null}

          {isSceneVisible && (
            <motion.div
              key="workspace_state"
              initial={{ opacity: 0, scale: 1.1 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="h-full w-full"
            >
              <div className="flex h-full min-h-0 w-full gap-3 xl:gap-3">
                <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden p2s-workspace-viewport">
                  {isTopEditorVisible && (
                    <>
                      <AnimatePresence initial={false}>
                        {activePanel ? (
                          <>
                            <motion.button
                              type="button"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              onClick={closePanels}
                              className="absolute inset-0 z-[26] bg-white/8 backdrop-blur-[1px]"
                              aria-label="패널 닫기"
                            />
                            <motion.div
                              initial={{ x: -28, opacity: 0 }}
                              animate={{ x: 0, opacity: 1 }}
                              exit={{ x: -28, opacity: 0 }}
                              transition={{ duration: 0.22, ease: "easeOut" }}
                              className="absolute inset-y-3 left-3 z-[30] flex w-[min(92vw,400px)] flex-col overflow-hidden rounded-[24px] border border-black/10 bg-white/96 shadow-[0_18px_44px_rgba(17,19,22,0.14)]"
                              onClick={(event) => event.stopPropagation()}
                            >
                              {activePanel === "assets" ? (
                                <BuilderLibraryShelf
                                  items={filteredLibraryCatalog}
                                  featuredItems={featuredLibraryCatalog}
                                  spotlightItem={librarySpotlightItem}
                                  categories={libraryCategories}
                                  query={libraryQuery}
                                  activeCategory={libraryCategory}
                                  catalogCount={libraryCatalog.length}
                                  assetCount={assets.length}
                                  hasActiveFilters={libraryHasActiveFilters}
                                  placedItemKeys={placedItemKeys}
                                  onQueryChange={setLibraryQuery}
                                  onCategoryChange={setLibraryCategory}
                                  onAddStarterSet={addStarterSetToScene}
                                  onAddItem={addCatalogItemToScene}
                                />
                              ) : (
                                <BuilderInspectorPanel
                                  visible
                                  layout="inline"
                                  className="min-h-0"
                                  topMode={topMode}
                                  transformMode={transformMode}
                                  transformSpace={transformSpace}
                                  wallMaterialIndex={wallMaterialIndex}
                                  floorMaterialIndex={floorMaterialIndex}
                                  lighting={lighting}
                                  wallsCount={walls.length}
                                  floorsCount={floors.length}
                                  assetsCount={assets.length}
                                  selectedAsset={selectedAsset}
                                  selectedAssetMeta={selectedCatalogItem}
                                  surfaceLockInfo={selectedSurfaceLockInfo}
                                  onTransformModeChange={setTransformMode}
                                  onTransformSpaceChange={setTransformSpace}
                                  onWallMaterialChange={applyWallFinish}
                                  onFloorMaterialChange={applyFloorFinish}
                                  onLightingChange={applyLightingSetting}
                                  onLightingCommit={commitLightingSetting}
                                  onApplyLightingPreset={applyLightingPreset}
                                  onUpdateAsset={updateAssetFromInspector}
                                  onRemoveAsset={removeAssetFromInspector}
                                  formatAssetLabel={formatAssetIdLabel}
                                />
                              )}
                            </motion.div>
                          </>
                        ) : null}
                      </AnimatePresence>
                    </>
                  )}

                  {viewMode === "top" ? (
                    <div className="pointer-events-none absolute right-4 top-4 z-[24] flex flex-col gap-3">
                      <div className="pointer-events-auto flex flex-col overflow-hidden rounded-full border border-black/10 bg-white/96 p-1 shadow-[0_10px_24px_rgba(19,21,24,0.12)]">
                        <button
                          type="button"
                          onClick={() => triggerZoomControl("in")}
                          className="rounded-full px-3 py-2 text-[16px] font-bold text-[#4d453a] transition hover:bg-[#f2eee7]"
                          aria-label="확대"
                        >
                          +
                        </button>
                        <div className="mx-2 h-px bg-black/10" />
                        <button
                          type="button"
                          onClick={() => triggerZoomControl("out")}
                          className="rounded-full px-3 py-2 text-[16px] font-bold text-[#4d453a] transition hover:bg-[#f2eee7]"
                          aria-label="축소"
                        >
                          -
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <ProjectEditorViewport
                    gl={
                      createRenderer ?? {
                        antialias: true,
                        alpha: false,
                        stencil: false,
                        depth: true,
                        powerPreference: "high-performance",
                        preserveDrawingBuffer: false
                      }
                    }
                    modeBadge={viewMode === "top" ? topViewPolicy.shortLabel : undefined}
                    bottomNotice={viewMode === "top" ? topModeNotice : undefined}
                  />
                  {viewMode === "top" && topMode === "desk-precision" ? (
                    <PrecisionMeasurementOverlay
                      selectedAsset={selectedAsset}
                      selectedAssetMeta={selectedCatalogItem}
                      surfaceLockInfo={selectedSurfaceLockInfo}
                      formatAssetLabel={formatAssetIdLabel}
                    />
                  ) : null}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {isSceneVisible ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex justify-center px-3 sm:bottom-6">
          <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-black/10 bg-white/96 p-1.5 shadow-[0_16px_34px_rgba(16,18,22,0.14)]">
            {viewMode === "top" ? (
              <div className="rounded-full border border-black/10 bg-[#f7f7f4] p-1">
                <StudioModeToggle
                  value={topMode}
                  modes={topModeOptions}
                  onChange={(id) => setTopMode(id as EditorTopMode)}
                  variant="solid"
                  hideLabelsOnMobile
                  className="gap-1"
                />
              </div>
            ) : null}
            <div className="flex items-center gap-1 rounded-full bg-[#f4f4f1] p-1">
              <button
                type="button"
                onClick={() => requestViewMode("top")}
                className={`rounded-full px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] transition sm:px-4 ${
                  viewMode === "top"
                    ? "bg-white text-[#1f1b16] shadow-[0_8px_20px_rgba(16,18,22,0.08)]"
                    : "text-[#4d453a] hover:bg-white"
                }`}
              >
                상단뷰
              </button>
              <button
                type="button"
                onClick={() => requestViewMode("walk")}
                disabled={!canEnter3D}
                className={`rounded-full px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] transition sm:px-4 ${
                  viewMode === "walk"
                    ? "bg-white text-[#1f1b16] shadow-[0_8px_20px_rgba(16,18,22,0.08)]"
                    : "text-[#4d453a] hover:bg-white disabled:cursor-not-allowed disabled:text-[#b0a79c] disabled:hover:bg-transparent"
                }`}
              >
                워크뷰
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ShareModal
        projectId={projectId}
        project={currentProject}
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
      />
    </div>
  );
}
