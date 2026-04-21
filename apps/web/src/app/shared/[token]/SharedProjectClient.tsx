"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Link2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { ProductHotspotDrawer } from "../../../components/viewer/ProductHotspotDrawer";
import { ReadOnlyViewerViewport } from "../../../components/viewer/ReadOnlyViewerViewport";
import { StudioWorkspaceShell } from "../../../components/layout/StudioWorkspaceShell";
import { useAssetCatalog } from "../../../components/editor/useAssetCatalog";
import { AuthPopup } from "../../../components/overlay/AuthPopup";
import { getScaleGateMessage } from "../../../lib/ai/scaleInfo";
import {
  findCatalogItem,
  getCatalogPreviewClasses,
  summarizePlacedCatalogItems,
  type ProjectAssetSummary
} from "../../../lib/builder/catalog";
import { toSceneStorePatch, type SceneDocumentBootstrap } from "../../../lib/domain/scene-document";
import { normalizeSceneAnchorType } from "../../../lib/scene/anchor-types";
import { resolveShareCapabilities, type SharePermission } from "../../../lib/share/permissions";
import { useAuthStore } from "../../../lib/stores/useAuthStore";
import { useEditorStore } from "../../../lib/stores/useEditorStore";
import { useCameraStore, useSelectionStore, useShellStore } from "../../../lib/stores/scene-slices";
import type { ProductHotspot } from "../../../lib/viewer/hotspots";
import type { SharedViewerPresentation } from "../../../lib/viewer/presentation";

type SharedProjectClientProps = {
  shareToken: string;
  projectName: string;
  projectDescription: string | null;
  sceneBootstrap: SceneDocumentBootstrap | null;
  linkPermission: SharePermission;
  expiresAt: string | null;
  pinnedVersionNumber: number | null;
  previewAssetSummary: ProjectAssetSummary | null;
  viewerPresentation: SharedViewerPresentation;
};

function toMetadataRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readMetadataText(record: Record<string, unknown> | null, key: string) {
  if (!record) return null;
  const value = record[key];
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function readMetadataBoolean(record: Record<string, unknown> | null, key: string) {
  if (!record) return null;
  const value = record[key];
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return null;
}

function readMetadataDimensionValue(value: unknown) {
  const numeric = typeof value === "string" ? Number(value) : value;
  return typeof numeric === "number" && Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function readMetadataDimensions(record: Record<string, unknown> | null) {
  if (!record) return null;
  const raw = record.dimensionsMm;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }

  const width = readMetadataDimensionValue((raw as Record<string, unknown>).width);
  const depth = readMetadataDimensionValue((raw as Record<string, unknown>).depth);
  const height = readMetadataDimensionValue((raw as Record<string, unknown>).height);
  if (width === null || depth === null || height === null) {
    return null;
  }

  return { width, depth, height };
}

function readMetadataUrl(record: Record<string, unknown> | null, key: string) {
  const value = readMetadataText(record, key);
  if (!value) return null;
  return value.startsWith("http://") || value.startsWith("https://") ? value : null;
}

function readMetadataImageUrl(record: Record<string, unknown> | null) {
  return (
    readMetadataUrl(record, "thumbnail") ??
    readMetadataUrl(record, "imageUrl") ??
    readMetadataUrl(record, "thumbnailUrl") ??
    readMetadataUrl(record, "previewImageUrl")
  );
}

function readMetadataPrice(record: Record<string, unknown> | null) {
  if (!record) return null;
  const raw = record.price;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return new Intl.NumberFormat("ko-KR", {
      style: "currency",
      currency: "KRW",
      maximumFractionDigits: 0
    }).format(raw);
  }
  if (typeof raw === "string" && raw.trim().length > 0) {
    return raw.trim();
  }
  return null;
}

function getSharedViewerSessionKey() {
  if (typeof window === "undefined") {
    return null;
  }

  const storageKey = "deskterioronline:shared-viewer-session";
  const existing = window.sessionStorage.getItem(storageKey);
  if (existing) {
    return existing;
  }

  const generated =
    window.crypto?.randomUUID?.() ?? `p2s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  window.sessionStorage.setItem(storageKey, generated);
  return generated;
}

export function SharedProjectClient({
  shareToken,
  projectName,
  projectDescription,
  sceneBootstrap,
  linkPermission,
  expiresAt,
  pinnedVersionNumber,
  previewAssetSummary,
  viewerPresentation
}: SharedProjectClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, session, logout } = useAuthStore();
  const isAuthenticated = Boolean(session?.user);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const { setScene, resetScene } = useShellStore();
  const { selectedAssetId, setSelectedAssetId } = useSelectionStore();
  const { setEntranceId } = useCameraStore();
  const applyShellPreset = useEditorStore((state) => state.applyShellPreset);
  const resetShellState = useEditorStore((state) => state.resetShellState);
  const setViewMode = useEditorStore((state) => state.setViewMode);
  const viewMode = useEditorStore((state) => state.viewMode);
  const shareCapabilities = useMemo(() => resolveShareCapabilities(linkPermission), [linkPermission]);
  const { catalog } = useAssetCatalog();

  const mappedScene = sceneBootstrap;
  const isVersionMappingFailed = !mappedScene;
  const fallbackScenePayload = useMemo(
    () => ({
      walls: [],
      openings: [],
      floors: [],
      ceilings: [],
      rooms: [],
      cameraAnchors: [],
      navGraph: { nodes: [], edges: [] },
      assets: [],
      scale: 1,
      scaleInfo: {
        value: 1,
        source: "unknown" as const,
        confidence: 0,
        evidence: {
          notes: "저장된 장면 버전이 없습니다."
        }
      },
      wallMaterialIndex: 0,
      floorMaterialIndex: 0,
      lighting: {
        mode: "direct",
        ambientIntensity: 0.35,
        hemisphereIntensity: 0.4,
        directionalIntensity: 1.05,
        environmentBlur: 0.2,
        accentIntensity: 0.82,
        beamOpacity: 0.18
      },
      entranceId: null
    }),
    []
  );
  const scenePayload = useMemo(
    () => (mappedScene ? toSceneStorePatch(mappedScene) : fallbackScenePayload),
    [fallbackScenePayload, mappedScene]
  );

  useEffect(() => {
    setScene({
      walls: scenePayload.walls,
      openings: scenePayload.openings,
      floors: scenePayload.floors,
      ceilings: scenePayload.ceilings,
      rooms: scenePayload.rooms,
      cameraAnchors: scenePayload.cameraAnchors,
      navGraph: scenePayload.navGraph,
      assets: scenePayload.assets,
      scale: scenePayload.scale,
      scaleInfo: scenePayload.scaleInfo,
      wallMaterialIndex: scenePayload.wallMaterialIndex,
      floorMaterialIndex: scenePayload.floorMaterialIndex,
      lighting: scenePayload.lighting
    });
    setSelectedAssetId(null);
    setEntranceId(scenePayload.entranceId);
    applyShellPreset("viewer");
    return () => {
      resetShellState();
      resetScene();
    };
  }, [applyShellPreset, resetScene, resetShellState, scenePayload, setEntranceId, setScene, setSelectedAssetId]);

  const placedAssetSummary = useMemo(
    () => summarizePlacedCatalogItems(catalog, scenePayload.assets, 4),
    [catalog, scenePayload.assets]
  );
  const summaryItemsForRail = previewAssetSummary?.highlightedItems ?? null;
  const summaryCollections = previewAssetSummary?.collections ?? placedAssetSummary.collections;
  const summaryUncataloguedCount = previewAssetSummary?.uncataloguedCount ?? placedAssetSummary.unmatchedCount;
  const canEnterWalk =
    (scenePayload.walls.length > 0 || scenePayload.floors.length > 0) &&
    !getScaleGateMessage(scenePayload.scale, scenePayload.scaleInfo);
  const assetHotspots = useMemo(
    () =>
      scenePayload.assets.map((asset, index) => {
        const catalogItem = findCatalogItem(catalog, asset);
        const sceneNode = mappedScene?.document.nodes.find((node) => node.id === asset.id) ?? null;
        const metadata = toMetadataRecord(sceneNode?.metadata ?? null);
        const productSnapshot = asset.product ?? null;
        return {
          id: asset.id,
          name: catalogItem?.label ?? productSnapshot?.name ?? asset.assetId,
          category: catalogItem?.category ?? productSnapshot?.category ?? "미분류",
          collection: catalogItem?.collection ?? "사용자 배치",
          tone: catalogItem?.tone ?? "slate",
          anchorType: normalizeSceneAnchorType(asset.anchorType),
          index,
          brand:
            productSnapshot?.brand ??
            readMetadataText(metadata, "brand") ??
            readMetadataText(metadata, "vendor") ??
            catalogItem?.brand ??
            null,
          price: productSnapshot?.price ?? readMetadataPrice(metadata) ?? catalogItem?.price ?? null,
          thumbnail: productSnapshot?.thumbnail ?? readMetadataImageUrl(metadata) ?? catalogItem?.thumbnail ?? null,
          options:
            productSnapshot?.options ??
            readMetadataText(metadata, "options") ??
            readMetadataText(metadata, "variant") ??
            catalogItem?.options ??
            null,
          externalUrl:
            productSnapshot?.externalUrl ??
            readMetadataUrl(metadata, "externalUrl") ??
            readMetadataUrl(metadata, "productUrl") ??
            catalogItem?.externalUrl ??
            null,
          dimensionsMm: productSnapshot?.dimensionsMm ?? readMetadataDimensions(metadata) ?? catalogItem?.dimensionsMm ?? null,
          finishColor:
            productSnapshot?.finishColor ??
            readMetadataText(metadata, "finishColor") ??
            catalogItem?.finishColor ??
            null,
          finishMaterial:
            productSnapshot?.finishMaterial ??
            readMetadataText(metadata, "finishMaterial") ??
            readMetadataText(metadata, "material") ??
            catalogItem?.finishMaterial ??
            null,
          detailNotes:
            productSnapshot?.detailNotes ??
            readMetadataText(metadata, "detailNotes") ??
            catalogItem?.detailNotes ??
            null,
          scaleLocked:
            productSnapshot?.scaleLocked ??
            readMetadataBoolean(metadata, "scaleLocked") ??
            catalogItem?.scaleLocked ??
            false,
          material:
            productSnapshot?.finishMaterial ??
            readMetadataText(metadata, "finishMaterial") ??
            readMetadataText(metadata, "material") ??
            catalogItem?.finishMaterial ??
            null
        } satisfies ProductHotspot;
      }),
    [catalog, mappedScene, scenePayload.assets]
  );
  const selectedHotspot = useMemo(
    () => assetHotspots.find((asset) => asset.id === selectedAssetId) ?? null,
    [assetHotspots, selectedAssetId]
  );
  const selectedHotspotLabel = selectedHotspot?.name ?? null;
  const trackedFocusKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (isVersionMappingFailed) {
      return;
    }

    const sessionKey = getSharedViewerSessionKey();
    if (!sessionKey) {
      return;
    }

    void fetch(`/api/v1/public-scenes/${encodeURIComponent(shareToken)}/activity`, {
      method: "POST",
      keepalive: true,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        eventType: "view",
        sessionKey,
        source: viewerPresentation
      })
    }).catch(() => {
      // Shared viewer activity is best-effort and must not block rendering.
    });
  }, [isVersionMappingFailed, shareToken, viewerPresentation]);

  useEffect(() => {
    if (!selectedHotspot?.id) {
      return;
    }

    const sessionKey = getSharedViewerSessionKey();
    if (!sessionKey) {
      return;
    }

    const focusKey = `${shareToken}:${selectedHotspot.id}`;
    if (trackedFocusKeysRef.current.has(focusKey)) {
      return;
    }
    trackedFocusKeysRef.current.add(focusKey);

    void fetch(`/api/v1/public-scenes/${encodeURIComponent(shareToken)}/activity`, {
      method: "POST",
      keepalive: true,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        eventType: "product_focus",
        sessionKey,
        source: viewerPresentation,
        assetId: selectedHotspot.id
      })
    }).catch(() => {
      trackedFocusKeysRef.current.delete(focusKey);
    });
  }, [selectedHotspot?.id, shareToken, viewerPresentation]);

  if (isVersionMappingFailed) {
    return (
      <>
        <div className="min-h-screen bg-[#ece8e1] text-[#1f1b16]">
          <div className="sticky top-0 z-[100] border-b border-black/10 bg-white/95 backdrop-blur-xl">
            <div className="flex min-h-16 items-center justify-between gap-3 px-3 py-3 sm:px-5 xl:px-8">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  onClick={() => router.push("/")}
                  className="inline-flex rounded-full border border-black/10 bg-white px-3 py-2 text-[11px] font-semibold tracking-[-0.03em] text-[#171411] transition hover:border-black/20 hover:bg-[#f4f4f1]"
                >
                  DeskteriorOnline
                </button>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-[#8a8177]">
                    <Link2 className="h-4 w-4" />
                    공유 장면
                  </div>
                  <h1 className="truncate text-sm font-semibold text-[#171411] sm:text-[15px]">{projectName}</h1>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {isAuthenticated ? (
                  <>
                    <button
                      type="button"
                      onClick={() => router.push("/my")}
                      className="hidden max-w-[180px] truncate text-[10px] font-bold uppercase tracking-[0.1em] text-[#999999] transition hover:text-[#171411] xl:block"
                    >
                      {user?.name ?? user?.email ?? "내 공간"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void logout()}
                      className="inline-flex h-10 items-center rounded-full border border-black/10 px-4 text-[10px] font-bold uppercase tracking-[0.14em] text-[#625a51] transition hover:border-black/20 hover:bg-[#f4f4f1]"
                    >
                      로그아웃
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsAuthOpen(true)}
                    className="inline-flex h-10 items-center rounded-full bg-[#171411] px-4 text-[10px] font-bold uppercase tracking-[0.14em] text-white transition hover:bg-black"
                  >
                    로그인
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="px-4 pb-12 pt-10 sm:px-8">
            <div className="mx-auto max-w-4xl rounded-[24px] border border-[#c06e3d]/20 bg-white p-8 shadow-[0_18px_46px_rgba(40,30,21,0.12)]">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#c06e3d]/25 bg-[#fff7f1] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#a75f37]">
                <Link2 className="h-3.5 w-3.5" />
                스냅샷 로드 실패
              </div>
              <h1 className="mt-5 text-3xl font-semibold tracking-tight text-[#1d1712] sm:text-4xl">
                공유 스냅샷을 렌더링할 수 없습니다.
              </h1>
              <p className="mt-4 text-sm leading-7 text-[#61574d]">
                저장된 버전은 존재하지만 현재 viewer 매퍼와 장면 데이터가 호환되지 않습니다.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[14px] border border-black/10 bg-[#faf7f2] p-4 text-sm text-[#5b5146]">
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8a7c70]">프로젝트</div>
                  <div className="mt-2 font-semibold text-[#1f1b16]">{projectName}</div>
                </div>
                <div className="rounded-[14px] border border-black/10 bg-[#faf7f2] p-4 text-sm text-[#5b5146]">
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8a7c70]">고정 버전</div>
                  <div className="mt-2 font-semibold text-[#1f1b16]">
                    {pinnedVersionNumber ? `v${pinnedVersionNumber}` : "알 수 없음"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <AuthPopup isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} nextPath={pathname ?? "/"} />
      </>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-[#efefec] text-[#1f1b16]">
        <div className="sticky top-0 z-[100] border-b border-black/10 bg-white/95 backdrop-blur-xl">
          <div className="flex min-h-16 items-center gap-3 px-3 py-3 sm:px-5 xl:px-8">
            <div className="min-w-0 flex flex-1 items-center gap-3">
              <button
                type="button"
                onClick={() => router.push("/")}
                className="inline-flex rounded-full border border-black/10 bg-white px-3 py-2 text-[11px] font-semibold tracking-[-0.03em] text-[#171411] transition hover:border-black/20 hover:bg-[#f4f4f1]"
              >
                DeskteriorOnline
              </button>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-[#8a8177]">
                  <Link2 className="h-4 w-4" />
                  공유 장면
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-sm font-semibold text-[#171411] sm:text-[15px]">{projectName}</h1>
                  <span className="rounded-full border border-black/10 bg-[#f4f4f1] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#625a51]">
                    {shareCapabilities.accessLabel}
                  </span>
                  <span className="rounded-full border border-black/10 bg-[#f4f4f1] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#625a51]">
                    제품 {scenePayload.assets.length}개
                  </span>
                  {pinnedVersionNumber ? (
                    <span className="rounded-full border border-black/10 bg-[#f4f4f1] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#625a51]">
                      버전 {pinnedVersionNumber}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {isAuthenticated ? (
                <>
                  <button
                    type="button"
                    onClick={() => router.push("/my")}
                    className="hidden max-w-[180px] truncate text-[10px] font-bold uppercase tracking-[0.1em] text-[#999999] transition hover:text-[#171411] xl:block"
                  >
                    {user?.name ?? user?.email ?? "내 공간"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void logout()}
                    className="inline-flex h-10 items-center rounded-full border border-black/10 px-4 text-[10px] font-bold uppercase tracking-[0.14em] text-[#625a51] transition hover:border-black/20 hover:bg-[#f4f4f1]"
                  >
                    로그아웃
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsAuthOpen(true)}
                  className="inline-flex h-10 items-center rounded-full bg-[#171411] px-4 text-[10px] font-bold uppercase tracking-[0.14em] text-white transition hover:bg-black"
                >
                  로그인
                </button>
              )}

              <div className="flex items-center gap-2 rounded-full border border-black/10 bg-[#f4f4f1] p-1">
                <button
                  type="button"
                  onClick={() => setViewMode("top")}
                  className={`rounded-full px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] transition sm:px-4 ${
                    viewMode === "top"
                      ? "bg-white text-[#171411] shadow-[0_8px_20px_rgba(16,18,22,0.08)]"
                      : "text-[#625a51] hover:bg-white"
                  }`}
                >
                  상단뷰
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("walk")}
                  disabled={!canEnterWalk}
                  className={`rounded-full px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] transition sm:px-4 ${
                    viewMode === "walk"
                      ? "bg-white text-[#171411] shadow-[0_8px_20px_rgba(16,18,22,0.08)]"
                      : "text-[#625a51] hover:bg-white disabled:cursor-not-allowed disabled:text-[#b0a79c] disabled:hover:bg-transparent"
                  }`}
                >
                  워크뷰
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="px-2 pb-10 pt-4 sm:px-4 xl:px-6">
          <div className="mb-4 flex flex-wrap items-center gap-2 px-1">
            {projectDescription ? (
              <p className="max-w-3xl text-sm leading-6 text-[#625a51]">{projectDescription}</p>
            ) : null}
            {expiresAt ? (
              <span className="rounded-full border border-black/10 bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#625a51]">
                만료 {new Date(expiresAt).toLocaleDateString()}
              </span>
            ) : null}
            {shareCapabilities.showPreviewNotice ? (
              <span className="rounded-full border border-black/10 bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#625a51]">
                읽기 전용 링크
              </span>
            ) : null}
          </div>

          <StudioWorkspaceShell>
            <ProductHotspotDrawer hotspots={assetHotspots} selectedHotspotId={selectedAssetId} onSelectHotspot={setSelectedAssetId}>
              <div className="rounded-[20px] border border-black/10 bg-white p-4">
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#7e7367]">배치 요약</div>
                {summaryItemsForRail && summaryItemsForRail.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {summaryItemsForRail.map((item) => {
                      const preview = getCatalogPreviewClasses(item.tone);
                      return (
                        <div
                          key={item.catalogItemId ?? item.assetId}
                          className={`rounded-xl border border-black/10 p-3 ${preview.surface}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6f655a]">{item.collection}</div>
                              <div className="mt-1 text-sm font-semibold text-[#1f1b16]">{item.label}</div>
                            </div>
                            <span className={`rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] ${preview.chip}`}>
                              x{item.count}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    {summaryUncataloguedCount > 0 ? (
                      <p className="text-xs leading-6 text-[#6a6055]">
                        목록에 매칭되지 않은 제품 {summaryUncataloguedCount}개는 요약에서 제외되었습니다.
                      </p>
                    ) : null}
                  </div>
                ) : placedAssetSummary.items.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {placedAssetSummary.items.map(({ item, count }) => {
                      const preview = getCatalogPreviewClasses(item.tone);
                      return (
                        <div key={item.assetId} className={`rounded-xl border border-black/10 p-3 ${preview.surface}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6f655a]">{item.collection}</div>
                              <div className="mt-1 text-sm font-semibold text-[#1f1b16]">{item.label}</div>
                            </div>
                            <span className={`rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] ${preview.chip}`}>
                              x{count}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    {placedAssetSummary.unmatchedCount > 0 ? (
                      <p className="text-xs leading-6 text-[#6a6055]">
                        목록에 매칭되지 않은 제품 {placedAssetSummary.unmatchedCount}개는 요약에서 제외되었습니다.
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-3 text-sm leading-6 text-[#61574d]">
                    카탈로그 매칭 제품이 없습니다.
                  </p>
                )}

                {summaryCollections.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-1.5 border-t border-black/10 pt-3">
                    {summaryCollections.slice(0, 4).map((collection) => (
                      <span
                        key={collection.label}
                        className="rounded-full border border-black/10 bg-[#f7f4ee] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[#6f655a]"
                      >
                        {collection.label} {collection.count}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </ProductHotspotDrawer>

            <ReadOnlyViewerViewport
              viewMode={viewMode === "walk" ? "walk" : "top"}
              selectedLabel={selectedHotspotLabel}
              showReadOnlyNotice={shareCapabilities.showPreviewNotice}
              presentation={viewerPresentation}
            />
          </StudioWorkspaceShell>
        </div>
      </div>

      <AuthPopup isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} nextPath={pathname ?? "/"} />
    </>
  );
}
