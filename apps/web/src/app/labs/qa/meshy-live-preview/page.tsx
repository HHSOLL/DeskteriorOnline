"use client";

import { CatalogLiveModelPreview } from "../../../../components/editor/CatalogLiveModelPreview";
import { DEFAULT_CATALOG, getCatalogGenerationBadge } from "../../../../lib/builder/catalog";

const MESHY_DECOR_CATALOG_ITEM_ID = "p2s_meshy_pastel_mascot_stack";

export default function MeshyLivePreviewQaPage() {
  const item = DEFAULT_CATALOG.find((catalogItem) => catalogItem.id === MESHY_DECOR_CATALOG_ITEM_ID);

  if (!item) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#11100e] px-6 text-[#f8f2e8]">
        <p data-testid="meshy-live-preview-missing" className="text-sm font-semibold">
          Meshy catalog item missing
        </p>
      </main>
    );
  }

  const generationBadge = getCatalogGenerationBadge(item);

  return (
    <main className="min-h-screen bg-[#11100e] px-6 py-10 text-[#f8f2e8]">
      <section className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[420px_minmax(0,1fr)]">
        <div
          data-testid="meshy-live-preview-frame"
          className="relative aspect-square overflow-hidden rounded-[24px] border border-white/[0.12] bg-[radial-gradient(circle_at_28%_18%,rgba(255,207,142,0.22),transparent_35%),radial-gradient(circle_at_78%_76%,rgba(130,161,255,0.18),transparent_34%),#181512]"
        >
          <div className="absolute inset-x-8 bottom-16 h-20 rounded-[50%] bg-black/[0.28] blur-2xl" />
          <CatalogLiveModelPreview item={item} testId="meshy-live-preview-canvas" preserveDrawingBufferForQa />
        </div>

        <div className="self-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#d7b98f]">Meshy text-to-3D QA</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal text-[#fff8ee]">{item.label}</h1>
          <dl className="mt-6 grid gap-3 text-sm text-[#d8ccbe] sm:grid-cols-2">
            <div className="rounded-[18px] border border-white/10 bg-white/[0.06] p-4">
              <dt className="text-[11px] uppercase tracking-[0.16em] text-[#9f9488]">source</dt>
              <dd className="mt-2 font-medium text-[#fff8ee]">{generationBadge?.providerLabel ?? "AI"}</dd>
            </div>
            <div className="rounded-[18px] border border-white/10 bg-white/[0.06] p-4">
              <dt className="text-[11px] uppercase tracking-[0.16em] text-[#9f9488]">review</dt>
              <dd className="mt-2 font-medium text-[#fff8ee]">{generationBadge?.reviewLabel ?? "검수 필요"}</dd>
            </div>
            <div className="rounded-[18px] border border-white/10 bg-white/[0.06] p-4 sm:col-span-2">
              <dt className="text-[11px] uppercase tracking-[0.16em] text-[#9f9488]">asset</dt>
              <dd className="mt-2 break-all font-medium text-[#fff8ee]">{item.assetId}</dd>
            </div>
          </dl>
        </div>
      </section>
    </main>
  );
}
