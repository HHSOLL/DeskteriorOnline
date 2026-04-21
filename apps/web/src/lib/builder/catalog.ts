import {
  inferAssetSupportProfile,
  normalizeAssetSupportProfile,
  type AssetSupportProfile
} from "../scene/support-profiles";

export type LibraryCatalogCategoryId =
  | "all"
  | "seating"
  | "tables"
  | "storage"
  | "bedroom"
  | "lighting"
  | "decor"
  | "plants"
  | "utility";

export type ProductDimensionsMm = {
  width: number;
  depth: number;
  height: number;
};

export type ProductPhysicalMetadata = {
  dimensionsMm: ProductDimensionsMm | null;
  finishColor: string | null;
  finishMaterial: string | null;
  detailNotes: string | null;
  scaleLocked: boolean;
};

export type ProductSourceMetadata = {
  kind: "deskterioronline_blender" | "open_source";
  name: string;
  path: string | null;
  url: string | null;
};

export type ProductLicenseMetadata = {
  spdx: string;
  label: string;
  requiresAttribution: boolean;
};

export type ProductPivotMetadata = {
  x: "left" | "center" | "right";
  y: "floor" | "center" | "top";
  z: "front" | "center" | "back";
};

export type ProductCollisionProxyMetadata = {
  kind: "box";
  derivesFrom: "dimensionsMm";
};

export type ProductTextureSetMetadata = {
  workflow: "pbr_metallic_roughness";
  authored: "procedural" | "image_based";
  ktx2Ready: boolean;
};

export type ProductLodProfileMetadata = {
  strategy: "single_mesh" | "manual_lod";
  levelCount: number;
  maxDrawCalls: number;
  maxTriangleCount: number;
};

export type ProductContractMetadata = {
  source: ProductSourceMetadata | null;
  license: ProductLicenseMetadata | null;
  pivot: ProductPivotMetadata | null;
  collisionProxy: ProductCollisionProxyMetadata | null;
  textureSet: ProductTextureSetMetadata | null;
  lodProfile: ProductLodProfileMetadata | null;
};

export type LibraryCatalogItem = {
  id: string;
  label: string;
  category: string;
  categoryId: Exclude<LibraryCatalogCategoryId, "all">;
  collection: string;
  tone: "sand" | "olive" | "slate" | "ember";
  assetId: string;
  scale: [number, number, number];
  description: string;
  thumbnail: string | null;
  price: string | null;
  options: string | null;
  externalUrl: string | null;
  brand: string | null;
  supportProfile?: AssetSupportProfile | null;
} & ProductPhysicalMetadata &
  ProductContractMetadata;

export type CatalogProductSnapshot = {
  id: string;
  name: string;
  category: string;
  brand: string | null;
  price: string | null;
  options: string | null;
  externalUrl: string | null;
  thumbnail: string | null;
} & ProductPhysicalMetadata &
  ProductContractMetadata;

export type ProjectAssetSummaryItem = {
  catalogItemId: string | null;
  assetId: string;
  label: string;
  category: string;
  collection: string;
  tone: LibraryCatalogItem["tone"];
  count: number;
};

export type ProjectAssetSummaryCollection = {
  label: string;
  count: number;
};

export type ProjectAssetSummary = {
  totalAssets: number;
  highlightedItems: ProjectAssetSummaryItem[];
  collections: ProjectAssetSummaryCollection[];
  uncataloguedCount: number;
  primaryTone: LibraryCatalogItem["tone"];
  primaryCollection: string | null;
};

export type LibraryCatalogCategory = {
  id: LibraryCatalogCategoryId;
  label: string;
  description: string;
  count: number;
};

const DEFAULT_SCALE: [number, number, number] = [1, 1, 1];

const CATEGORY_META: Record<
  Exclude<LibraryCatalogCategoryId, "all">,
  { label: string; description: string; collection: string; tone: LibraryCatalogItem["tone"] }
> = {
  seating: {
    label: "Seating",
    description: "Sofas, chairs, stools, and lounge pieces.",
    collection: "Social Layer",
    tone: "sand"
  },
  tables: {
    label: "Tables",
    description: "Coffee, dining, and side tables.",
    collection: "Social Layer",
    tone: "sand"
  },
  storage: {
    label: "Storage",
    description: "Shelves, cabinets, consoles, and drawer units.",
    collection: "Room Core",
    tone: "slate"
  },
  bedroom: {
    label: "Bedroom",
    description: "Beds and sleep-zone furniture.",
    collection: "Room Core",
    tone: "slate"
  },
  lighting: {
    label: "Lighting",
    description: "Pendant lights, chandeliers, and glow accents.",
    collection: "Atmosphere",
    tone: "ember"
  },
  decor: {
    label: "Decor",
    description: "Mirrors, art, vases, and small styling objects.",
    collection: "Atmosphere",
    tone: "ember"
  },
  plants: {
    label: "Plants",
    description: "Greenery and soft natural accents.",
    collection: "Atmosphere",
    tone: "olive"
  },
  utility: {
    label: "Utility",
    description: "Appliances, carts, industrial pieces, and tools.",
    collection: "Utility Rail",
    tone: "slate"
  }
};

const CATEGORY_ORDER: Array<Exclude<LibraryCatalogCategoryId, "all">> = [
  "seating",
  "tables",
  "storage",
  "bedroom",
  "lighting",
  "decor",
  "plants",
  "utility"
];

const CATEGORY_KEYWORDS: Array<{
  id: Exclude<LibraryCatalogCategoryId, "all">;
  keywords: string[];
}> = [
  {
    id: "seating",
    keywords: ["sofa", "chair", "armchair", "ottoman", "bench", "stool", "loveseat", "couch", "seat"]
  },
  {
    id: "tables",
    keywords: ["table", "desk", "dining", "coffee table", "side table"]
  },
  {
    id: "bedroom",
    keywords: ["bed", "nightstand", "bedroom", "wardrobe", "mattress"]
  },
  {
    id: "storage",
    keywords: ["cabinet", "drawer", "shelf", "shelves", "storage", "console", "commode", "bookcase"]
  },
  {
    id: "lighting",
    keywords: ["lamp", "light", "lighting", "lantern", "chandelier", "sconce"]
  },
  {
    id: "plants",
    keywords: ["plant", "grass", "nature", "greenery", "leaf", "tree"]
  },
  {
    id: "utility",
    keywords: ["appliance", "electronics", "tool", "industrial", "cart", "container", "coffee cart"]
  },
  {
    id: "decor",
    keywords: ["decor", "decorative", "mirror", "vase", "wall decoration", "prop", "props", "art"]
  }
];

const CATEGORY_ALIASES: Record<string, Exclude<LibraryCatalogCategoryId, "all">> = {
  seating: "seating",
  table: "tables",
  tables: "tables",
  storage: "storage",
  shelves: "storage",
  containers: "storage",
  bedroom: "bedroom",
  lighting: "lighting",
  decorative: "decor",
  decor: "decor",
  "wall decoration": "decor",
  vases: "decor",
  plants: "plants",
  grass: "plants",
  nature: "plants",
  appliances: "utility",
  electronics: "utility",
  industrial: "utility",
  tools: "utility",
  structures: "utility",
  "collection: namaqualand": "plants"
};

const DEFAULT_CATALOG_SOURCE = [
  {
    id: "chair",
    label: "Minimalist Chair",
    category: "Seating",
    assetId: "placeholder:chair",
    scale: [0.8, 0.8, 0.8],
    description: "Compact lounge chair for quick staging."
  },
  {
    id: "sofa",
    label: "Velvet Sofa",
    category: "Seating",
    assetId: "/assets/models/sofa_03_2k.gltf/sofa_03_2k.gltf",
    scale: [1, 1, 1],
    description: "Soft low-profile sofa for living zones."
  },
  {
    id: "table",
    label: "Oak Round Table",
    category: "Tables",
    assetId: "/assets/models/round_wooden_table_01_2k.gltf/round_wooden_table_01_2k.gltf",
    scale: [1, 1, 1],
    description: "Round table for dining and meeting layouts."
  }
] as const;

function isSupportedCatalogAssetId(assetId: string) {
  const normalized = assetId.trim();
  return (
    normalized.startsWith("placeholder:") ||
    normalized.startsWith("/") ||
    normalized.startsWith("http://") ||
    normalized.startsWith("https://")
  );
}

function normalizeCatalogText(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeCatalogPrice(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return normalizeCatalogText(value);
}

function normalizeCatalogBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return false;
}

function normalizeCatalogStrictBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return null;
}

function normalizeCatalogDimensionValue(value: unknown) {
  const numeric = typeof value === "string" ? Number(value) : value;
  return typeof numeric === "number" && Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function normalizeCatalogPositiveInteger(value: unknown) {
  const numeric = typeof value === "string" ? Number(value) : value;
  return typeof numeric === "number" && Number.isInteger(numeric) && numeric > 0 ? numeric : null;
}

function normalizeCatalogDimensionsMm(value: unknown): ProductDimensionsMm | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const width = normalizeCatalogDimensionValue(record.width);
  const depth = normalizeCatalogDimensionValue(record.depth);
  const height = normalizeCatalogDimensionValue(record.height);

  if (width === null || depth === null || height === null) {
    return null;
  }

  return {
    width,
    depth,
    height
  };
}

function normalizeCatalogUrl(value: unknown) {
  const normalized = normalizeCatalogText(value);
  if (!normalized) return null;
  if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
    return normalized;
  }
  return null;
}

function normalizeCatalogImageUrl(record: Record<string, unknown>) {
  return (
    normalizeCatalogUrl(record.thumbnail) ??
    normalizeCatalogUrl(record.thumbnailUrl) ??
    normalizeCatalogUrl(record.image) ??
    normalizeCatalogUrl(record.imageUrl) ??
    normalizeCatalogUrl(record.previewImageUrl)
  );
}

function normalizeCatalogSource(value: unknown): ProductSourceMetadata | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const kind =
    record.kind === "deskterioronline_blender" || record.kind === "open_source" ? record.kind : null;
  const name = normalizeCatalogText(record.name);
  const metadataPath = normalizeCatalogText(record.path);
  const url = normalizeCatalogUrl(record.url);

  if (!kind || !name || (!metadataPath && !url)) {
    return null;
  }

  return {
    kind,
    name,
    path: metadataPath,
    url
  };
}

function normalizeCatalogLicense(value: unknown): ProductLicenseMetadata | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const spdx = normalizeCatalogText(record.spdx);
  const label = normalizeCatalogText(record.label);
  const requiresAttribution = normalizeCatalogStrictBoolean(record.requiresAttribution);

  if (!spdx || !label || requiresAttribution === null) {
    return null;
  }

  return {
    spdx,
    label,
    requiresAttribution
  };
}

function normalizeCatalogPivot(value: unknown): ProductPivotMetadata | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const x = record.x === "left" || record.x === "center" || record.x === "right" ? record.x : null;
  const y = record.y === "floor" || record.y === "center" || record.y === "top" ? record.y : null;
  const z = record.z === "front" || record.z === "center" || record.z === "back" ? record.z : null;

  if (!x || !y || !z) {
    return null;
  }

  return { x, y, z };
}

function normalizeCatalogCollisionProxy(value: unknown): ProductCollisionProxyMetadata | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (record.kind !== "box" || record.derivesFrom !== "dimensionsMm") {
    return null;
  }

  return {
    kind: "box",
    derivesFrom: "dimensionsMm"
  };
}

function normalizeCatalogTextureSet(value: unknown): ProductTextureSetMetadata | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const workflow = record.workflow === "pbr_metallic_roughness" ? record.workflow : null;
  const authored =
    record.authored === "procedural" || record.authored === "image_based" ? record.authored : null;
  const ktx2Ready = normalizeCatalogStrictBoolean(record.ktx2Ready);

  if (!workflow || !authored || ktx2Ready === null) {
    return null;
  }

  return {
    workflow,
    authored,
    ktx2Ready
  };
}

function normalizeCatalogLodProfile(value: unknown): ProductLodProfileMetadata | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const strategy = record.strategy === "single_mesh" || record.strategy === "manual_lod" ? record.strategy : null;
  const levelCount = normalizeCatalogPositiveInteger(record.levelCount);
  const maxDrawCalls = normalizeCatalogPositiveInteger(record.maxDrawCalls);
  const maxTriangleCount = normalizeCatalogPositiveInteger(record.maxTriangleCount);

  if (!strategy || levelCount === null || maxDrawCalls === null || maxTriangleCount === null) {
    return null;
  }

  return {
    strategy,
    levelCount,
    maxDrawCalls,
    maxTriangleCount
  };
}

function resolveCategoryId(record: Record<string, unknown>) {
  const rawCategory = typeof record.category === "string" ? record.category.trim().toLowerCase() : "";
  const text = [record.id, record.label, record.category, record.description]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();

  for (const entry of CATEGORY_KEYWORDS) {
    if (entry.keywords.some((keyword) => text.includes(keyword))) {
      return entry.id;
    }
  }

  if (rawCategory in CATEGORY_ALIASES) {
    return CATEGORY_ALIASES[rawCategory];
  }

  return "decor";
}

function normalizeCatalogItem(item: unknown): LibraryCatalogItem | null {
  if (!item || typeof item !== "object") return null;
  const record = item as Record<string, unknown>;
  const scale =
    Array.isArray(record.scale) &&
    record.scale.length === 3 &&
    record.scale.every((value) => typeof value === "number")
      ? (record.scale as [number, number, number])
      : DEFAULT_SCALE;

  if (
    typeof record.id !== "string" ||
    typeof record.assetId !== "string" ||
    !isSupportedCatalogAssetId(record.assetId)
  ) {
    return null;
  }

  const categoryId = resolveCategoryId(record);
  const meta = CATEGORY_META[categoryId];
  const dimensionsMm = normalizeCatalogDimensionsMm(record.dimensionsMm);

  return {
    id: record.id,
    label: typeof record.label === "string" ? record.label : record.id,
    category: meta.label,
    categoryId,
    collection: meta.collection,
    tone: meta.tone,
    assetId: record.assetId,
    scale,
    description:
      typeof record.description === "string" && record.description.trim().length > 0
        ? record.description.trim()
        : meta.description,
    thumbnail: normalizeCatalogImageUrl(record),
    price: normalizeCatalogPrice(record.price),
    options: normalizeCatalogText(record.options) ?? normalizeCatalogText(record.variant),
    externalUrl: normalizeCatalogUrl(record.externalUrl) ?? normalizeCatalogUrl(record.productUrl),
    brand: normalizeCatalogText(record.brand) ?? normalizeCatalogText(record.vendor),
    dimensionsMm,
    finishColor: normalizeCatalogText(record.finishColor),
    finishMaterial: normalizeCatalogText(record.finishMaterial),
    detailNotes: normalizeCatalogText(record.detailNotes),
    scaleLocked: normalizeCatalogBoolean(record.scaleLocked),
    source: normalizeCatalogSource(record.source),
    license: normalizeCatalogLicense(record.license),
    pivot: normalizeCatalogPivot(record.pivot),
    collisionProxy: normalizeCatalogCollisionProxy(record.collisionProxy),
    textureSet: normalizeCatalogTextureSet(record.textureSet),
    lodProfile: normalizeCatalogLodProfile(record.lodProfile),
    supportProfile:
      normalizeAssetSupportProfile(record.supportProfile) ??
      inferAssetSupportProfile({
        catalogItemId: typeof record.id === "string" ? record.id : null,
        assetId: record.assetId,
        label: typeof record.label === "string" ? record.label : undefined,
        category: typeof record.category === "string" ? record.category : undefined,
        description: typeof record.description === "string" ? record.description : undefined,
        dimensionsMm
      })
  } satisfies LibraryCatalogItem;
}

export const DEFAULT_CATALOG: LibraryCatalogItem[] = DEFAULT_CATALOG_SOURCE.map((item) =>
  normalizeCatalogItem(item)
).filter((item): item is LibraryCatalogItem => item !== null);

export function toCatalogProductSnapshot(item: LibraryCatalogItem): CatalogProductSnapshot {
  return {
    id: item.id,
    name: item.label,
    category: item.category,
    brand: item.brand,
    price: item.price,
    options: item.options,
    externalUrl: item.externalUrl,
    thumbnail: item.thumbnail,
    dimensionsMm: item.dimensionsMm,
    finishColor: item.finishColor,
    finishMaterial: item.finishMaterial,
    detailNotes: item.detailNotes,
    scaleLocked: item.scaleLocked,
    source: item.source,
    license: item.license,
    pivot: item.pivot,
    collisionProxy: item.collisionProxy,
    textureSet: item.textureSet,
    lodProfile: item.lodProfile
  };
}

export function normalizeCatalog(input: unknown) {
  if (!Array.isArray(input)) {
    return DEFAULT_CATALOG;
  }

  const normalized = input
    .map((item) => normalizeCatalogItem(item))
    .filter((item): item is LibraryCatalogItem => item !== null);

  return normalized.length > 0 ? normalized : DEFAULT_CATALOG;
}

export function getLibraryCategories(items: LibraryCatalogItem[]): LibraryCatalogCategory[] {
  const counts = items.reduce<Record<string, number>>((accumulator, item) => {
    accumulator[item.categoryId] = (accumulator[item.categoryId] ?? 0) + 1;
    return accumulator;
  }, {});

  return [
    {
      id: "all",
      label: "All",
      description: "Everything currently available on the shelf.",
      count: items.length
    },
    ...CATEGORY_ORDER.filter((categoryId) => (counts[categoryId] ?? 0) > 0).map((categoryId) => ({
      id: categoryId,
      label: CATEGORY_META[categoryId].label,
      description: CATEGORY_META[categoryId].description,
      count: counts[categoryId] ?? 0
    }))
  ];
}

export function formatAssetIdLabel(assetId: string) {
  const last = assetId.split("/").filter(Boolean).pop() ?? assetId;
  return last
    .replace(/\.(glb|gltf)$/i, "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function findCatalogItemByAssetId(items: LibraryCatalogItem[], assetId: string) {
  return items.find((item) => item.assetId === assetId) ?? null;
}

export function findCatalogItem(
  items: LibraryCatalogItem[],
  asset: { assetId: string; catalogItemId?: string | null }
) {
  if (typeof asset.catalogItemId === "string" && asset.catalogItemId.length > 0) {
    const byId = items.find((item) => item.id === asset.catalogItemId);
    if (byId) return byId;
  }
  return findCatalogItemByAssetId(items, asset.assetId);
}

export function filterCatalogItems(
  items: LibraryCatalogItem[],
  {
    query,
    categoryId
  }: {
    query: string;
    categoryId: LibraryCatalogCategoryId;
  }
) {
  const normalizedQuery = query.trim().toLowerCase();
  return items.filter((item) => {
    const matchesCategory = categoryId === "all" || item.categoryId === categoryId;
    const matchesQuery =
      normalizedQuery.length === 0 ||
      [item.label, item.category, item.description, item.id].some((value) =>
        value.toLowerCase().includes(normalizedQuery)
      );
    return matchesCategory && matchesQuery;
  });
}

export function getFeaturedCatalogItems(items: LibraryCatalogItem[], limit = 4) {
  const selected: LibraryCatalogItem[] = [];
  const preferredKeywords = ["desk", "chair", "lamp", "monitor", "shelf", "drawer"];
  const available = items.filter((item) => !item.assetId.startsWith("placeholder:"));

  preferredKeywords.forEach((keyword) => {
    const match = available.find((item) => item.label.toLowerCase().includes(keyword));
    if (match && !selected.some((item) => item.id === match.id)) {
      selected.push(match);
    }
  });

  available.forEach((item) => {
    if (selected.length >= limit) return;
    if (!selected.some((existing) => existing.id === item.id)) {
      selected.push(item);
    }
  });

  return selected.slice(0, limit);
}

export function getCatalogSpotlight(
  filteredItems: LibraryCatalogItem[],
  featuredItems: LibraryCatalogItem[]
) {
  return filteredItems[0] ?? featuredItems[0] ?? null;
}

export function selectStarterSetItems(items: LibraryCatalogItem[], limit: number) {
  return getFeaturedCatalogItems(items, limit);
}

export function getCatalogToneClasses(tone: LibraryCatalogItem["tone"]) {
  switch (tone) {
    case "olive":
      return {
        badge: "border-emerald-400/20 bg-emerald-500/10 text-emerald-100",
        tile: "border-emerald-300/15 bg-[linear-gradient(180deg,rgba(31,73,55,0.34),rgba(255,255,255,0.03))]"
      };
    case "ember":
      return {
        badge: "border-amber-300/20 bg-amber-400/10 text-amber-50",
        tile: "border-amber-300/15 bg-[linear-gradient(180deg,rgba(127,69,24,0.36),rgba(255,255,255,0.03))]"
      };
    case "slate":
      return {
        badge: "border-sky-200/15 bg-slate-400/10 text-slate-100",
        tile: "border-slate-300/15 bg-[linear-gradient(180deg,rgba(58,69,82,0.36),rgba(255,255,255,0.03))]"
      };
    case "sand":
    default:
      return {
        badge: "border-[#dbc8a7]/20 bg-[#dbc8a7]/10 text-[#f6ead8]",
        tile: "border-[#dbc8a7]/20 bg-[linear-gradient(180deg,rgba(124,96,61,0.28),rgba(255,255,255,0.03))]"
      };
  }
}

export function getCatalogPreviewClasses(tone: LibraryCatalogItem["tone"]) {
  switch (tone) {
    case "olive":
      return {
        surface: "bg-[linear-gradient(180deg,#e8efe6_0%,#d7e6cf_100%)] text-[#203126]",
        chip: "border-emerald-900/10 bg-white/60 text-[#365241]"
      };
    case "ember":
      return {
        surface: "bg-[linear-gradient(180deg,#f5ead8_0%,#ead4b9_100%)] text-[#3b281c]",
        chip: "border-amber-950/10 bg-white/60 text-[#7c4c22]"
      };
    case "slate":
      return {
        surface: "bg-[linear-gradient(180deg,#e8edf3_0%,#d7dee7_100%)] text-[#1e2834]",
        chip: "border-slate-900/10 bg-white/60 text-[#46566b]"
      };
    case "sand":
    default:
      return {
        surface: "bg-[linear-gradient(180deg,#f5efe7_0%,#eadfce_100%)] text-[#2d241d]",
        chip: "border-[#7c603d]/10 bg-white/60 text-[#7c603d]"
      };
  }
}

export function summarizePlacedCatalogItems(
  items: LibraryCatalogItem[],
  placedAssets: Array<{ assetId: string; catalogItemId?: string | null }>,
  limit = 4
) {
  const matched = new Map<
    string,
    {
      item: LibraryCatalogItem;
      count: number;
    }
  >();
  const collections = new Map<string, number>();
  let unmatchedCount = 0;

  placedAssets.forEach((asset) => {
    const catalogItem = findCatalogItem(items, asset);
    if (!catalogItem) {
      unmatchedCount += 1;
      return;
    }

    const existing = matched.get(catalogItem.id);
    if (existing) {
      existing.count += 1;
    } else {
      matched.set(catalogItem.id, { item: catalogItem, count: 1 });
    }
    collections.set(catalogItem.collection, (collections.get(catalogItem.collection) ?? 0) + 1);
  });

  return {
    items: Array.from(matched.values())
      .sort((left, right) => right.count - left.count || left.item.label.localeCompare(right.item.label))
      .slice(0, limit),
    collections: Array.from(collections.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label)),
    unmatchedCount
  };
}

export function buildProjectAssetSummary(
  items: LibraryCatalogItem[],
  placedAssets: Array<{ assetId: string; catalogItemId?: string | null }>
): ProjectAssetSummary {
  const summary = summarizePlacedCatalogItems(items, placedAssets, 3);
  const primary = summary.items[0]?.item ?? null;

  return {
    totalAssets: placedAssets.length,
    highlightedItems: summary.items.map(({ item, count }) => ({
      catalogItemId: item.id,
      assetId: item.assetId,
      label: item.label,
      category: item.category,
      collection: item.collection,
      tone: item.tone,
      count
    })),
    collections: summary.collections,
    uncataloguedCount: summary.unmatchedCount,
    primaryTone: primary?.tone ?? "sand",
    primaryCollection: primary?.collection ?? summary.collections[0]?.label ?? null
  };
}

function isTone(value: unknown): value is LibraryCatalogItem["tone"] {
  return value === "sand" || value === "olive" || value === "slate" || value === "ember";
}

export function getProjectAssetSummary(metadata: unknown): ProjectAssetSummary | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const root = metadata as Record<string, unknown>;
  const raw = root.assetSummary;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const summary = raw as Record<string, unknown>;

  const highlightedItems = Array.isArray(summary.highlightedItems)
    ? summary.highlightedItems
        .map((entry) => {
          if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
          const item = entry as Record<string, unknown>;
          if (
            typeof item.assetId !== "string" ||
            typeof item.label !== "string" ||
            typeof item.category !== "string" ||
            typeof item.collection !== "string" ||
            !isTone(item.tone) ||
            typeof item.count !== "number"
          ) {
            return null;
          }
          return {
            catalogItemId: typeof item.catalogItemId === "string" ? item.catalogItemId : null,
            assetId: item.assetId,
            label: item.label,
            category: item.category,
            collection: item.collection,
            tone: item.tone,
            count: item.count
          } satisfies ProjectAssetSummaryItem;
        })
        .filter((item): item is ProjectAssetSummaryItem => Boolean(item))
    : [];

  const collections = Array.isArray(summary.collections)
    ? summary.collections
        .map((entry) => {
          if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
          const item = entry as Record<string, unknown>;
          if (typeof item.label !== "string" || typeof item.count !== "number") return null;
          return { label: item.label, count: item.count } satisfies ProjectAssetSummaryCollection;
        })
        .filter((item): item is ProjectAssetSummaryCollection => Boolean(item))
    : [];

  return {
    totalAssets: typeof summary.totalAssets === "number" ? summary.totalAssets : 0,
    highlightedItems,
    collections,
    uncataloguedCount: typeof summary.uncataloguedCount === "number" ? summary.uncataloguedCount : 0,
    primaryTone: isTone(summary.primaryTone) ? summary.primaryTone : "sand",
    primaryCollection: typeof summary.primaryCollection === "string" ? summary.primaryCollection : null
  };
}
