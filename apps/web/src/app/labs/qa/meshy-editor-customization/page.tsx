"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BuilderInspectorPanel } from "../../../../components/editor/BuilderInspectorPanel";
import { ProjectEditorHeader } from "../../../../components/editor/ProjectEditorHeader";
import { SceneViewport } from "../../../../components/editor/SceneViewport";
import { useEditorSaveSession } from "../../../../components/editor/useEditorSaveSession";
import {
  DEFAULT_CATALOG,
  buildProjectAssetSummary,
  findCatalogItem,
  formatAssetIdLabel,
  getCatalogGenerationBadge,
  toCatalogProductSnapshot,
  type LibraryCatalogItem
} from "../../../../lib/builder/catalog";
import {
  buildPlacedAssetZoneSummary,
  buildReplacementCatalogCandidates,
  inferReplacementRoomZone
} from "../../../../lib/builder/replacement-candidates";
import { buildSeededSceneAssets } from "../../../../lib/builder/seeded-assets";
import {
  buildBuilderScene,
  normalizeBuilderSceneInput
} from "../../../../lib/builder/templates";
import { deriveBlankRoomShell } from "../../../../lib/domain/room-shell";
import { normalizeSceneAnchorType } from "../../../../lib/scene/anchor-types";
import { constrainPlacementToAnchor, inferAnchorTypeForCatalogItem } from "../../../../lib/scene/anchors";
import { computeLightingBoundsMm } from "../../../../lib/scene/lighting-layout";
import { useEditorStore } from "../../../../lib/stores/useEditorStore";
import { useSceneStore, type SceneAsset } from "../../../../lib/stores/useSceneStore";
import type { SaveProjectPayload } from "../../../../lib/api/project";

const QA_PROJECT_ID = "qa-meshy-editor-customization";
const SOURCE_DECOR_CATALOG_ITEM_ID = "p2s_decor_mug_espresso";
const MESHY_DECOR_CATALOG_ITEM_ID = "p2s_meshy_pastel_mascot_stack";
const QA_CLUSTER_IDS = ["workstation", "display"] as const;

declare global {
  interface Window {
    __DESKTERIORONLINE_FORCE_REAL_GLB_TOP_VIEW_QA__?: boolean;
    __DESKTERIORONLINE_MESHY_EDITOR_CUSTOMIZATION_QA__?: {
      ready: boolean;
      sourceCatalogItemId: string;
      targetCatalogItemId: string;
      sourceSceneAssetId: string | null;
      selectedSceneAssetId: string | null;
      selectedCatalogItemId: string | null;
      replacementCandidateIds: string[];
      hasMeshyReplacementCandidate: boolean;
      replacementApplied: boolean;
      generatedProvider: string | null;
      generatedReviewStatus: string | null;
      saveCaptureCount: number;
      lastSaveAssetCatalogItemId: string | null;
      lastSaveAssetId: string | null;
      savedAssetIdStable: boolean;
      savedProductSourceKind: string | null;
      savedProductSourceUrl: string | null;
    };
  }
}

function createMeshyCustomizationFixture() {
  const builderInput = normalizeBuilderSceneInput({
    templateId: "rect-studio",
    width: 6.4,
    depth: 4.8
  });
  const baseScene = buildBuilderScene(builderInput);
  const scene = {
    ...baseScene,
    walls: baseScene.walls.map((wall) => ({
      ...wall,
      height: 1.08
    }))
  };
  const roomShell = deriveBlankRoomShell({
    scale: scene.scale,
    scaleInfo: scene.scaleInfo,
    walls: scene.walls,
    openings: scene.openings,
    floors: scene.floors
  });
  const seededAssets = buildSeededSceneAssets(DEFAULT_CATALOG, roomShell, "full", "workspace-flex", {
    enabledWorkspaceFlexClusterIds: QA_CLUSTER_IDS
  });
  const assets = seededAssets.filter((asset) => asset.catalogItemId !== MESHY_DECOR_CATALOG_ITEM_ID);
  const sourceAsset =
    assets.find((asset) => asset.catalogItemId === SOURCE_DECOR_CATALOG_ITEM_ID) ??
    assets.find((asset) => findCatalogItem(DEFAULT_CATALOG, asset)?.categoryId === "decor") ??
    null;

  return {
    scene,
    roomShell,
    assets,
    sourceAsset
  };
}

function buildProjectedReplacementAsset({
  targetAsset,
  item,
  sceneAssets,
  walls,
  ceilings,
  scale
}: {
  targetAsset: SceneAsset;
  item: LibraryCatalogItem;
  sceneAssets: SceneAsset[];
  walls: ReturnType<typeof useSceneStore.getState>["walls"];
  ceilings: ReturnType<typeof useSceneStore.getState>["ceilings"];
  scale: number;
}) {
  const productSnapshot = toCatalogProductSnapshot(item);
  const supportProfile = item.supportProfile ?? null;
  const anchorType = normalizeSceneAnchorType(targetAsset.anchorType ?? inferAnchorTypeForCatalogItem(item));
  const anchoredPlacement = constrainPlacementToAnchor(
    {
      position: targetAsset.position,
      rotation: targetAsset.rotation,
      anchorType,
      supportAssetId: targetAsset.supportAssetId
    },
    {
      walls,
      ceilings,
      scale,
      sceneAssets,
      activeAssetId: targetAsset.id,
      activeAsset: {
        id: targetAsset.id,
        assetId: item.assetId,
        catalogItemId: item.id,
        product: productSnapshot,
        supportProfile,
        scale: targetAsset.scale
      }
    }
  );

  return {
    ...targetAsset,
    assetId: item.assetId,
    catalogItemId: item.id,
    product: productSnapshot,
    supportProfile,
    anchorType: anchoredPlacement.anchorType,
    supportAssetId: anchoredPlacement.supportAssetId,
    position: anchoredPlacement.position,
    rotation: anchoredPlacement.rotation
  } satisfies SceneAsset;
}

export default function MeshyEditorCustomizationQaPage() {
  const [sourceSceneAssetId, setSourceSceneAssetId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [projectNameDraft, setProjectNameDraft] = useState("Meshy replacement QA");
  const [capturedSavePayload, setCapturedSavePayload] = useState<SaveProjectPayload | null>(null);
  const [saveCaptureCount, setSaveCaptureCount] = useState(0);
  const editorState = useEditorStore();
  const sceneState = useSceneStore();
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
    assets,
    wallMaterialIndex,
    floorMaterialIndex,
    ceilingMaterialIndex,
    lighting,
    selectedAssetId,
    entranceId,
    updateFurniture,
    setSelectedAssetId,
    setWallMaterialIndex,
    setFloorMaterialIndex,
    setCeilingMaterialIndex,
    setLighting,
    recordSnapshot
  } = sceneState;

  const selectedAsset = useMemo(
    () => assets.find((asset) => asset.id === selectedAssetId) ?? null,
    [assets, selectedAssetId]
  );
  const selectedAssetMeta = useMemo(
    () => (selectedAsset ? findCatalogItem(DEFAULT_CATALOG, selectedAsset) : null),
    [selectedAsset]
  );
  const replacementItems = useMemo(
    () =>
      buildReplacementCatalogCandidates({
        items: DEFAULT_CATALOG,
        selectedAsset,
        selectedCatalogItem: selectedAssetMeta,
        limit: DEFAULT_CATALOG.length
      }),
    [selectedAsset, selectedAssetMeta]
  );
  const placedZoneSummaries = useMemo(
    () =>
      buildPlacedAssetZoneSummary(
        assets.map((asset) => {
          const item = findCatalogItem(DEFAULT_CATALOG, asset);
          const topReplacement = buildReplacementCatalogCandidates({
            items: DEFAULT_CATALOG,
            selectedAsset: asset,
            selectedCatalogItem: item,
            limit: 1
          })[0];
          return {
            id: asset.id,
            label: item?.label ?? formatAssetIdLabel(asset.assetId),
            zone: inferReplacementRoomZone(item, asset.assetId),
            isSelected: asset.id === selectedAssetId,
            supportDependentCount: assets.filter((candidate) => candidate.supportAssetId === asset.id).length,
            replacementItemId: topReplacement?.item.id ?? null,
            replacementLabel: topReplacement?.item.label ?? null,
            replacementMatchPercent: topReplacement?.matchPercent ?? null,
            replacementPreviewFamily: topReplacement?.previewFamily ?? null,
            replacementPreviewScale: topReplacement?.previewScale ?? null
          };
        })
      ),
    [assets, selectedAssetId]
  );
  const lightingBoundsMm = useMemo(
    () => computeLightingBoundsMm(walls, scale),
    [scale, walls]
  );
  const savePayload = useMemo<SaveProjectPayload>(
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
        floorIndex: floorMaterialIndex,
        ceilingIndex: ceilingMaterialIndex
      },
      lighting,
      assetSummary: buildProjectAssetSummary(DEFAULT_CATALOG, assets),
      projectName: projectNameDraft.trim() || "Meshy replacement QA"
    }),
    [
      assets,
      cameraAnchors,
      ceilingMaterialIndex,
      ceilings,
      entranceId,
      floorMaterialIndex,
      floors,
      lighting,
      navGraph,
      openings,
      projectNameDraft,
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
    projectId: QA_PROJECT_ID,
    payload: savePayload,
    signature: saveSignature,
    ready: isReady,
    autosaveDelayMs: 600_000
  });

  useEffect(() => {
    const fixture = createMeshyCustomizationFixture();
    setSourceSceneAssetId(fixture.sourceAsset?.id ?? null);
    setIsReady(false);
    setCapturedSavePayload(null);
    setSaveCaptureCount(0);
    useEditorStore.getState().applyShellPreset("editor", {
      viewMode: "top",
      topMode: "room",
      selectedId: fixture.sourceAsset?.id ?? null,
      readOnly: false,
      panels: {
        assets: false,
        properties: true
      }
    });
    useSceneStore.getState().setScene({
      scale: fixture.scene.scale,
      scaleInfo: fixture.scene.scaleInfo,
      walls: fixture.scene.walls,
      openings: fixture.scene.openings,
      floors: fixture.scene.floors,
      ceilings: fixture.roomShell.ceilings,
      rooms: fixture.roomShell.rooms,
      cameraAnchors: fixture.roomShell.cameraAnchors,
      navGraph: fixture.roomShell.navGraph,
      assets: fixture.assets,
      wallMaterialIndex: 0,
      floorMaterialIndex: 1,
      ceilingMaterialIndex: 0,
      lighting: {
        mode: "direct",
        ambientIntensity: 0.38,
        hemisphereIntensity: 0.52,
        directionalIntensity: 1.34,
        environmentBlur: 0.14,
        accentIntensity: 0.96,
        beamOpacity: 0.22,
        fixtures: []
      },
      selectedAssetId: fixture.sourceAsset?.id ?? null,
      entranceId: fixture.roomShell.entranceId
    });
    useSceneStore.getState().initializeHistory("Meshy replacement QA");

    if (typeof window === "undefined") {
      setIsReady(true);
      return;
    }

    window.__DESKTERIORONLINE_FORCE_REAL_GLB_TOP_VIEW_QA__ = true;
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method?.toUpperCase() ?? "GET";
      if (method === "POST" && url.includes(`/api/v1/projects/${QA_PROJECT_ID}/versions`)) {
        const payload =
          typeof init?.body === "string" ? (JSON.parse(init.body) as SaveProjectPayload) : null;
        if (!payload) {
          throw new Error("Meshy customization QA save payload was not JSON.");
        }
        setCapturedSavePayload(payload);
        setSaveCaptureCount((count) => count + 1);
        return new Response(
          JSON.stringify({
            version: {
              id: "qa-version-meshy-editor-customization",
              projectId: QA_PROJECT_ID
            }
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json"
            }
          }
        );
      }
      return originalFetch(input, init);
    };

    const readyFrame = window.requestAnimationFrame(() => {
      setIsReady(true);
    });

    return () => {
      window.cancelAnimationFrame(readyFrame);
      window.fetch = originalFetch;
      delete window.__DESKTERIORONLINE_FORCE_REAL_GLB_TOP_VIEW_QA__;
      delete window.__DESKTERIORONLINE_MESHY_EDITOR_CUSTOMIZATION_QA__;
      useSceneStore.getState().resetScene();
      useEditorStore.getState().resetShellState();
    };
    // The fixture and fetch interceptor are installed once for this isolated QA route.
    // Re-running on scene edits would reset the replacement flow before save verification.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const generationBadge = getCatalogGenerationBadge(
      DEFAULT_CATALOG.find((item) => item.id === MESHY_DECOR_CATALOG_ITEM_ID) ?? null
    );
    const selectedSavedAsset =
      capturedSavePayload?.assets.find((asset) => asset.id === sourceSceneAssetId) ?? null;
    window.__DESKTERIORONLINE_MESHY_EDITOR_CUSTOMIZATION_QA__ = {
      ready: isReady,
      sourceCatalogItemId: SOURCE_DECOR_CATALOG_ITEM_ID,
      targetCatalogItemId: MESHY_DECOR_CATALOG_ITEM_ID,
      sourceSceneAssetId,
      selectedSceneAssetId: selectedAsset?.id ?? null,
      selectedCatalogItemId: selectedAsset?.catalogItemId ?? null,
      replacementCandidateIds: replacementItems.map((candidate) => candidate.item.id),
      hasMeshyReplacementCandidate: replacementItems.some(
        (candidate) => candidate.item.id === MESHY_DECOR_CATALOG_ITEM_ID
      ),
      replacementApplied: selectedAsset?.catalogItemId === MESHY_DECOR_CATALOG_ITEM_ID,
      generatedProvider: generationBadge?.providerLabel ?? null,
      generatedReviewStatus: generationBadge?.reviewLabel ?? null,
      saveCaptureCount,
      lastSaveAssetCatalogItemId: selectedSavedAsset?.catalogItemId ?? null,
      lastSaveAssetId: selectedSavedAsset?.id ?? null,
      savedAssetIdStable: Boolean(selectedSavedAsset && selectedSavedAsset.id === sourceSceneAssetId),
      savedProductSourceKind: selectedSavedAsset?.product?.source?.kind ?? null,
      savedProductSourceUrl: selectedSavedAsset?.product?.source?.url ?? null
    };
  }, [
    capturedSavePayload,
    isReady,
    replacementItems,
    saveCaptureCount,
    selectedAsset,
    sourceSceneAssetId
  ]);

  const replaceAsset = useCallback(
    (id: string, item: LibraryCatalogItem) => {
      const targetAsset = assets.find((asset) => asset.id === id);
      if (!targetAsset) return;
      const projectedAsset = buildProjectedReplacementAsset({
        targetAsset,
        item,
        sceneAssets: assets,
        walls,
        ceilings,
        scale
      });
      updateFurniture(id, projectedAsset);
      setSelectedAssetId(id);
      useEditorStore.getState().setSelectedId(id);
      recordSnapshot(`제품 교체: ${item.label}`);
    },
    [assets, ceilings, recordSnapshot, scale, setSelectedAssetId, updateFurniture, walls]
  );

  const selectedMeshyAsset = selectedAsset?.catalogItemId === MESHY_DECOR_CATALOG_ITEM_ID;

  return (
    <main className="min-h-screen bg-[#efefec] text-[#1f1b16]">
      <ProjectEditorHeader
        title={projectNameDraft}
        onTitleChange={setProjectNameDraft}
        onTitleCommit={() => setProjectNameDraft((current) => current.trim())}
        viewMode="top"
        canShowPanels={true}
        activePanel="properties"
        onBack={() => undefined}
        onShowAssets={() => undefined}
        onShowInspector={() => undefined}
        onOpenShare={() => undefined}
        onSave={() => {
          void triggerManualSave();
        }}
        isSaving={isSaving}
        isDirty={isDirty}
        saveError={saveError}
        lastSavedAt={lastSavedAt}
      />

      <section className="grid min-h-screen gap-4 px-4 pb-6 pt-16 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div
          data-testid="meshy-editor-customization-viewport"
          className="min-h-[680px] overflow-hidden rounded-[28px] border border-black/10 bg-[#16120f] shadow-[0_28px_80px_rgba(31,27,22,0.18)]"
        >
          {isReady && sourceSceneAssetId ? (
            <SceneViewport
              camera={{
                position: [5.6, 3.2, 5.8],
                fov: 42,
                near: 0.1,
                far: 100
              }}
              chromeTone="light"
              gl={{
                antialias: true,
                alpha: false,
                stencil: false,
                depth: true,
                powerPreference: "high-performance",
                preserveDrawingBuffer: true
              }}
              hudProfile="none"
              interactionMode="editor"
              modeBadge="Meshy replacement QA"
              showHud={false}
              toneMappingExposure={1.02}
            />
          ) : (
            <div className="grid h-full min-h-[680px] place-items-center text-sm font-semibold text-white/70">
              Preparing editor customization fixture
            </div>
          )}
        </div>

        <aside className="space-y-3">
          <div className="rounded-[20px] border border-black/10 bg-white p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#7a7064]">
              Meshy editor customization QA
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-semibold text-[#6f665a]">
              <span data-testid="meshy-customization-source-id">{sourceSceneAssetId ?? "pending"}</span>
              <span data-testid="meshy-customization-selected-catalog">
                {selectedAsset?.catalogItemId ?? "pending"}
              </span>
              <span data-testid="meshy-customization-candidate-state">
                {replacementItems.some((candidate) => candidate.item.id === MESHY_DECOR_CATALOG_ITEM_ID)
                  ? "candidate-ready"
                  : "candidate-missing"}
              </span>
              <span data-testid="meshy-customization-save-count">{saveCaptureCount}</span>
            </div>
            {selectedMeshyAsset ? (
              <p
                className="mt-3 rounded-[12px] border border-[#b9d7c3] bg-[#eef8f0] px-3 py-2 text-xs font-semibold text-[#34543d]"
                data-testid="meshy-customization-replaced-state"
              >
                Meshy replacement applied to the selected scene asset
              </p>
            ) : null}
          </div>

          <BuilderInspectorPanel
            visible={true}
            layout="inline"
            topMode={editorState.topMode}
            transformMode={editorState.transformMode}
            transformSpace={editorState.transformSpace}
            wallMaterialIndex={wallMaterialIndex}
            floorMaterialIndex={floorMaterialIndex}
            ceilingMaterialIndex={ceilingMaterialIndex}
            lighting={lighting}
            lightingBoundsMm={lightingBoundsMm}
            wallsCount={walls.length}
            floorsCount={floors.length}
            assetsCount={assets.length}
            placedZoneSummaries={placedZoneSummaries}
            catalogItems={DEFAULT_CATALOG}
            selectedAsset={selectedAsset}
            selectedAssetMeta={selectedAssetMeta}
            replacementItems={replacementItems}
            surfaceLockInfo={null}
            onTransformModeChange={useEditorStore.getState().setTransformMode}
            onTransformSpaceChange={useEditorStore.getState().setTransformSpace}
            onWallMaterialChange={setWallMaterialIndex}
            onFloorMaterialChange={setFloorMaterialIndex}
            onCeilingMaterialChange={setCeilingMaterialIndex}
            onLightingChange={setLighting}
            onLightingCommit={() => undefined}
            onApplyLightingPreset={() => undefined}
            onApplyRoomMoodRecipe={() => undefined}
            onApplyRoomStylingBundle={() => undefined}
            onReplaceAsset={replaceAsset}
            onSelectPlacedAsset={(id) => {
              setSelectedAssetId(id);
              useEditorStore.getState().setSelectedId(id);
            }}
            onApplyPlacedZoneReplacements={() => undefined}
            onUpdateAsset={(id, updates) => updateFurniture(id, updates)}
            onRemoveAsset={() => undefined}
            formatAssetLabel={formatAssetIdLabel}
          />
        </aside>
      </section>
    </main>
  );
}
