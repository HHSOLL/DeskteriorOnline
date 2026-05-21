"use client";

import { useEffect, useState } from "react";
import { SceneViewport } from "../../../../components/editor/SceneViewport";
import { DEFAULT_CATALOG, getCatalogGenerationBadge } from "../../../../lib/builder/catalog";
import { buildSeededSceneAssets } from "../../../../lib/builder/seeded-assets";
import {
  buildBuilderScene,
  normalizeBuilderSceneInput
} from "../../../../lib/builder/templates";
import { deriveBlankRoomShell } from "../../../../lib/domain/room-shell";
import { useEditorStore } from "../../../../lib/stores/useEditorStore";
import { useSceneStore } from "../../../../lib/stores/useSceneStore";

const MESHY_DECOR_CATALOG_ITEM_ID = "p2s_meshy_pastel_mascot_stack";
const DISPLAY_CLUSTER_IDS = ["display"] as const;

declare global {
  interface Window {
    __DESKTERIORONLINE_FORCE_REAL_GLB_TOP_VIEW_QA__?: boolean;
    __DESKTERIORONLINE_MESHY_EDITOR_SCENE_QA__?: {
      catalogItemId: string;
      sceneAssetId: string | null;
      assetCount: number;
      viewMode: "top";
      clusterIds: readonly string[];
      generatedProvider: string | null;
      reviewStatus: string | null;
    };
  }
}

function createMeshyEditorSceneFixture() {
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
  const assets = buildSeededSceneAssets(DEFAULT_CATALOG, roomShell, "full", "workspace-flex", {
    enabledWorkspaceFlexClusterIds: DISPLAY_CLUSTER_IDS
  });
  const meshyAsset = assets.find((asset) => asset.catalogItemId === MESHY_DECOR_CATALOG_ITEM_ID) ?? null;

  return {
    scene,
    roomShell,
    assets,
    meshyAsset
  };
}

export default function MeshyEditorSceneQaPage() {
  const item = DEFAULT_CATALOG.find((catalogItem) => catalogItem.id === MESHY_DECOR_CATALOG_ITEM_ID);
  const generationBadge = item ? getCatalogGenerationBadge(item) : null;
  const [fixture, setFixture] = useState<ReturnType<typeof createMeshyEditorSceneFixture> | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!item) {
      return;
    }

    let readyFrame = 0;
    const nextFixture = createMeshyEditorSceneFixture();
    setFixture(nextFixture);
    setIsReady(false);
    useEditorStore.getState().applyShellPreset("viewer", {
      viewMode: "top",
      topMode: "room",
      selectedId: nextFixture.meshyAsset?.id ?? null,
      readOnly: true,
      panels: {
        assets: false,
        properties: false
      }
    });
    useSceneStore.getState().setScene({
      scale: nextFixture.scene.scale,
      scaleInfo: nextFixture.scene.scaleInfo,
      walls: nextFixture.scene.walls,
      openings: nextFixture.scene.openings,
      floors: nextFixture.scene.floors,
      ceilings: nextFixture.roomShell.ceilings,
      rooms: nextFixture.roomShell.rooms,
      cameraAnchors: nextFixture.roomShell.cameraAnchors,
      navGraph: nextFixture.roomShell.navGraph,
      assets: nextFixture.assets,
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
      selectedAssetId: nextFixture.meshyAsset?.id ?? null,
      entranceId: nextFixture.roomShell.entranceId
    });

    if (typeof window !== "undefined") {
      window.__DESKTERIORONLINE_FORCE_REAL_GLB_TOP_VIEW_QA__ = true;
      window.__DESKTERIORONLINE_MESHY_EDITOR_SCENE_QA__ = {
        catalogItemId: MESHY_DECOR_CATALOG_ITEM_ID,
        sceneAssetId: nextFixture.meshyAsset?.id ?? null,
        assetCount: nextFixture.assets.length,
        viewMode: "top",
        clusterIds: DISPLAY_CLUSTER_IDS,
        generatedProvider: generationBadge?.providerLabel ?? null,
        reviewStatus: generationBadge?.reviewLabel ?? null
      };
      readyFrame = window.requestAnimationFrame(() => {
        setIsReady(true);
      });
    } else {
      setIsReady(true);
    }

    return () => {
      if (readyFrame) {
        window.cancelAnimationFrame(readyFrame);
      }
      delete window.__DESKTERIORONLINE_FORCE_REAL_GLB_TOP_VIEW_QA__;
      delete window.__DESKTERIORONLINE_MESHY_EDITOR_SCENE_QA__;
      useSceneStore.getState().resetScene();
      useEditorStore.getState().resetShellState();
    };
  }, [generationBadge?.providerLabel, generationBadge?.reviewLabel, item]);

  if (!item) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#11100e] px-6 text-[#f8f2e8]">
        <p data-testid="meshy-editor-scene-missing" className="text-sm font-semibold">
          Meshy editor scene fixture missing
        </p>
      </main>
    );
  }

  const isFixtureReady = isReady && fixture?.meshyAsset;

  return (
    <main className="min-h-screen bg-[#15120f] px-6 py-8 text-[#f8f2e8]">
      <section className="mx-auto grid min-h-[760px] max-w-6xl gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div
          data-testid="meshy-editor-scene-viewport"
          className="h-[720px] overflow-hidden rounded-[28px] border border-white/[0.12] bg-[#0b0a09]"
        >
          {isFixtureReady ? (
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
              interactionMode="viewer-showcase"
              modeBadge="Meshy editor scene QA"
              showHud={false}
              toneMappingExposure={1.02}
            />
          ) : (
            <div className="grid h-full place-items-center text-sm font-semibold text-white/70">
              Preparing Meshy editor scene
            </div>
          )}
        </div>

        <aside className="self-start rounded-[24px] border border-white/10 bg-white/[0.06] p-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#d7b98f]">
            Text-to-3D room asset
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-normal text-[#fff8ee]">{item.label}</h1>
          <dl className="mt-6 grid gap-3 text-sm text-[#d8ccbe]">
            <div>
              <dt className="text-[11px] uppercase tracking-[0.16em] text-[#9f9488]">provider</dt>
              <dd data-testid="meshy-editor-scene-provider" className="mt-1 font-medium text-[#fff8ee]">
                {generationBadge?.providerLabel ?? "AI"}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-[0.16em] text-[#9f9488]">review</dt>
              <dd data-testid="meshy-editor-scene-review" className="mt-1 font-medium text-[#fff8ee]">
                {generationBadge?.reviewLabel ?? "검수 필요"}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-[0.16em] text-[#9f9488]">scene asset</dt>
              <dd data-testid="meshy-editor-scene-asset-id" className="mt-1 break-all font-medium text-[#fff8ee]">
                {fixture?.meshyAsset?.id ?? "pending"}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-[0.16em] text-[#9f9488]">asset count</dt>
              <dd data-testid="meshy-editor-scene-asset-count" className="mt-1 font-medium text-[#fff8ee]">
                {fixture?.assets.length ?? 0}
              </dd>
            </div>
          </dl>
        </aside>
      </section>
    </main>
  );
}
