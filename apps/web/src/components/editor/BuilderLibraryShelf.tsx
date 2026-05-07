"use client";

import { ChevronDown, LayoutGrid, Search, Sparkles } from "lucide-react";
import type {
  LibraryCatalogCategory,
  LibraryCatalogCategoryId,
  LibraryCatalogItem
} from "../../lib/builder/catalog";
import { getCatalogPreviewClasses } from "../../lib/builder/catalog";

type BuilderLibraryShelfProps = {
  mode?: "library" | "inventory";
  items: LibraryCatalogItem[];
  featuredItems: LibraryCatalogItem[];
  spotlightItem: LibraryCatalogItem | null;
  categories: LibraryCatalogCategory[];
  query: string;
  activeCategory: LibraryCatalogCategoryId;
  catalogCount: number;
  assetCount: number;
  hasActiveFilters: boolean;
  placedItemKeys: ReadonlySet<string>;
  showStarterSet?: boolean;
  onQueryChange: (value: string) => void;
  onCategoryChange: (value: LibraryCatalogCategoryId) => void;
  onAddStarterSet: () => void;
  onAddItem: (item: LibraryCatalogItem) => void;
};

function getSurfaceSupportLabel(item: LibraryCatalogItem) {
  const surfaceCount = item.supportProfile?.surfaces.length ?? 0;
  if (surfaceCount <= 0) return "바닥";
  if (surfaceCount === 1) return "표면";
  return `면 ${surfaceCount}`;
}

function formatDimensionsLabel(item: LibraryCatalogItem) {
  const dimensions = item.dimensionsMm;
  if (!dimensions) return null;
  return `${dimensions.width}x${dimensions.depth}x${dimensions.height} mm`;
}

type CatalogPreviewClasses = ReturnType<typeof getCatalogPreviewClasses>;

function CatalogFallbackPreview({
  item,
  preview
}: {
  item: LibraryCatalogItem;
  preview: CatalogPreviewClasses;
}) {
  const variant = item.categoryId === "seating" ? "seating" : item.categoryId === "tables" ? "table" : "object";

  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="absolute inset-x-4 bottom-4 h-3 rounded-full bg-black/10 blur-md" />
      <div className="relative h-[64%] w-[72%]">
        {variant === "seating" ? (
          <>
            <div
              className={`absolute bottom-11 left-1/2 h-12 w-[64%] -translate-x-1/2 rounded-t-[22px] border ${preview.chip} shadow-sm`}
            />
            <div
              className={`absolute bottom-5 left-1/2 h-8 w-[88%] -translate-x-1/2 rounded-[18px] border ${preview.chip} shadow-sm`}
            />
            <div className="absolute bottom-2 left-[28%] h-6 w-1.5 rounded-full bg-black/15" />
            <div className="absolute bottom-2 right-[28%] h-6 w-1.5 rounded-full bg-black/15" />
          </>
        ) : variant === "table" ? (
          <>
            <div
              className={`absolute bottom-12 left-1/2 h-8 w-[92%] -translate-x-1/2 rounded-[999px] border ${preview.chip} shadow-sm`}
            />
            <div className="absolute bottom-5 left-1/2 h-10 w-3 -translate-x-1/2 rounded-full bg-black/15" />
            <div
              className={`absolute bottom-3 left-1/2 h-3 w-[58%] -translate-x-1/2 rounded-[999px] border ${preview.chip}`}
            />
          </>
        ) : (
          <>
            <div
              className={`absolute bottom-2 left-1/2 h-9 w-full -translate-x-1/2 rounded-[18px] border ${preview.chip} shadow-sm`}
            />
            <div
              className={`absolute bottom-9 left-1/2 h-14 w-[58%] -translate-x-1/2 rounded-[18px] border ${preview.chip} shadow-sm`}
            />
          </>
        )}
      </div>
    </div>
  );
}

function AssetVisualPreview({
  item,
  preview
}: {
  item: LibraryCatalogItem;
  preview: CatalogPreviewClasses;
}) {
  const thumbnail = item.thumbnail?.trim();

  return (
    <>
      {thumbnail ? (
        <img
          src={thumbnail}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          className="h-full w-full object-contain p-2 transition duration-200 group-hover:scale-[1.03]"
        />
      ) : (
        <CatalogFallbackPreview item={item} preview={preview} />
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-white/15" />
    </>
  );
}

function AssetCard({
  item,
  placed,
  mode,
  onAdd
}: {
  item: LibraryCatalogItem;
  placed: boolean;
  mode: "library" | "inventory";
  onAdd: (item: LibraryCatalogItem) => void;
}) {
  const preview = getCatalogPreviewClasses(item.tone);
  const dimensionsLabel = formatDimensionsLabel(item);
  const supportLabel = getSurfaceSupportLabel(item);
  const secondaryLine = item.price ?? dimensionsLabel ?? item.collection;
  const tertiaryLine =
    secondaryLine === dimensionsLabel ? supportLabel : dimensionsLabel ?? supportLabel;

  return (
    <button
      type="button"
      onClick={() => onAdd(item)}
      className="group text-left"
      aria-label={mode === "inventory" ? `${item.label} 선택` : `${item.label} 추가`}
    >
      <article className="flex flex-col">
        <div
          className={`relative aspect-[4/5] overflow-hidden rounded-[14px] border border-black/8 ${preview.surface} transition duration-200 group-hover:border-black/20`}
        >
          <AssetVisualPreview item={item} preview={preview} />
          {placed ? (
            <span className="absolute right-2 top-2 z-10 inline-flex h-2.5 w-2.5 rounded-full bg-[#171411]" />
          ) : null}
        </div>

        <div className="mt-2 space-y-0.5 px-0.5">
          <p className="line-clamp-2 text-[11px] font-semibold leading-4 text-[#171411]">{item.label}</p>
          <p className="line-clamp-1 text-[10px] leading-4 text-[#61594f]">{item.collection}</p>
          <p className="line-clamp-1 text-[10px] leading-4 text-[#61594f]">{secondaryLine}</p>
          <p className="line-clamp-1 text-[10px] leading-4 text-[#9a9186]">{tertiaryLine}</p>
        </div>
      </article>
    </button>
  );
}

export function BuilderLibraryShelf({
  mode = "library",
  items,
  featuredItems,
  spotlightItem,
  categories,
  query,
  activeCategory,
  catalogCount,
  assetCount,
  hasActiveFilters,
  placedItemKeys,
  showStarterSet = true,
  onQueryChange,
  onCategoryChange,
  onAddStarterSet,
  onAddItem
}: BuilderLibraryShelfProps) {
  const activeCategoryMeta = categories.find((category) => category.id === activeCategory) ?? categories[0] ?? null;
  const isPlaced = (item: LibraryCatalogItem) => placedItemKeys.has(item.id) || placedItemKeys.has(item.assetId);
  const heroSuggestion = hasActiveFilters ? null : spotlightItem ?? featuredItems[0] ?? null;
  const isInventory = mode === "inventory";

  return (
    <div className="flex h-full flex-col bg-white text-[#171411]">
      <div className="border-b border-black/8 px-4 py-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#948b80]" />
          <input
            type="text"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="무엇을 찾으시나요?"
            className="w-full rounded-full border border-transparent bg-[#f4f4f1] py-3 pl-10 pr-4 text-sm text-[#171411] outline-none transition placeholder:text-[#948b80] focus:border-black/10 focus:bg-white"
          />
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#8f867a]">카테고리</div>
            <div className="mt-1 inline-flex items-center gap-1 text-base font-semibold text-[#171411]">
              <span>{activeCategoryMeta?.label ?? "전체"}</span>
              <ChevronDown className="h-4 w-4 text-[#8f867a]" />
            </div>
          </div>
          <div className="text-right text-[10px] leading-4 text-[#8f867a]">
            <div>{catalogCount}개 제품</div>
            <div>{assetCount}개 배치됨</div>
          </div>
        </div>

        <div className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1">
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => onCategoryChange(category.id)}
              className={`shrink-0 rounded-full px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] transition ${
                activeCategory === category.id
                  ? "bg-[#171411] text-white"
                  : "bg-[#f4f4f1] text-[#61594f] hover:bg-[#ecebe7]"
              }`}
            >
              {category.label}
            </button>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="text-[10px] leading-4 text-[#7d756b]">
            {heroSuggestion
              ? `${heroSuggestion.label} 같은 제품을 선택할 수 있습니다.`
              : isInventory
                ? "배치할 제품을 선택하세요."
                : "가구를 골라 바로 배치해보세요."}
          </div>
          {showStarterSet ? (
            <button
              type="button"
              onClick={onAddStarterSet}
              className="inline-flex shrink-0 items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#171411] transition hover:bg-[#f4f4f1]"
            >
              <Sparkles className="h-3.5 w-3.5" />
              빠른 세트
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {items.length > 0 ? (
          <div className="grid grid-cols-2 gap-x-3 gap-y-5 min-[390px]:grid-cols-3">
            {items.map((item) => (
              <AssetCard key={item.id} item={item} placed={isPlaced(item)} mode={mode} onAdd={onAddItem} />
            ))}
          </div>
        ) : (
          <div className="flex h-full min-h-[260px] flex-col items-center justify-center rounded-[20px] border border-dashed border-black/10 bg-[#faf9f7] p-6 text-center">
            <LayoutGrid className="h-5 w-5 text-[#948b80]" />
            <p className="mt-3 text-sm leading-6 text-[#625a51]">
              조건에 맞는 제품이 없습니다. 검색어나 카테고리를 다시 조정해 주세요.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
