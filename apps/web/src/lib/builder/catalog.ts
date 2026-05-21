import {
  inferAssetSupportProfile,
  normalizeAssetSupportProfile,
  type AssetSupportProfile
} from "../scene/support-profiles";
import { SO_ONG_VIDEO_CATALOG_VARIANTS } from "./so-ong-video-reference";

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
  qualityScore?: number | null;
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

export type CatalogGenerationBadge = {
  label: string;
  reviewLabel: string;
  providerLabel: string;
  tone: "ready" | "review";
};

const DEFAULT_SCALE: [number, number, number] = [1, 1, 1];

function normalizeCatalogPreviewSource(value: string | null | undefined) {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

export function hasSpecificCatalogThumbnail(
  item: Pick<LibraryCatalogItem, "assetId" | "id">,
  thumbnail: string | null | undefined
) {
  const filename = thumbnail?.split("/").pop()?.split(".")[0] ?? "";
  const thumbnailKey = normalizeCatalogPreviewSource(filename);
  if (!thumbnailKey) return false;

  const assetSource = normalizeCatalogPreviewSource(`${item.assetId} ${item.id}`);
  return assetSource.includes(thumbnailKey);
}

function getCatalogGenerationText(
  item: Pick<
    LibraryCatalogItem,
    "brand" | "detailNotes" | "license" | "qualityScore" | "source" | "textureSet"
  >
) {
  return [
    item.brand,
    item.detailNotes,
    item.source?.name,
    item.source?.path,
    item.source?.url,
    item.license?.spdx,
    item.license?.label,
    item.textureSet?.authored,
    typeof item.qualityScore === "number" ? "qualityScore" : null
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();
}

export function isGeneratedCatalogItem(
  item: Pick<
    LibraryCatalogItem,
    "brand" | "detailNotes" | "license" | "qualityScore" | "source" | "textureSet"
  >
) {
  const text = getCatalogGenerationText(item);
  return (
    text.includes("meshy") ||
    text.includes("text-to-3d") ||
    text.includes("image-to-3d") ||
    text.includes("generated") ||
    (item.textureSet?.authored === "image_based" && typeof item.qualityScore === "number")
  );
}

export function getCatalogGenerationBadge(
  item: Pick<
    LibraryCatalogItem,
    "brand" | "detailNotes" | "license" | "qualityScore" | "source" | "textureSet"
  >
): CatalogGenerationBadge | null {
  if (!isGeneratedCatalogItem(item)) return null;

  const text = getCatalogGenerationText(item);
  const providerLabel = text.includes("meshy") ? "Meshy" : text.includes("tripo") ? "TripoSR" : "AI";
  const qualityScore = typeof item.qualityScore === "number" ? item.qualityScore : null;
  const ready = qualityScore !== null && qualityScore >= 0.82;

  return {
    label: providerLabel === "AI" ? "AI 생성" : providerLabel,
    reviewLabel: ready ? `QA ${Math.round(qualityScore * 100)}` : "검수 필요",
    providerLabel,
    tone: ready ? "ready" : "review"
  };
}

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

const P2S_INTERNAL_LICENSE = {
  spdx: "LicenseRef-DeskteriorOnline-Internal",
  label: "DeskteriorOnline Internal Catalog",
  requiresAttribution: false
} as const;

const P2S_PRODUCT_CONTRACT = {
  source: {
    kind: "deskterioronline_blender",
    name: "DeskteriorOnline Catalog Variant",
    path: "apps/web/public/assets/catalog/runtime-packages.json",
    url: null
  },
  license: P2S_INTERNAL_LICENSE,
  pivot: {
    x: "center",
    y: "floor",
    z: "center"
  },
  collisionProxy: {
    kind: "box",
    derivesFrom: "dimensionsMm"
  },
  textureSet: {
    workflow: "pbr_metallic_roughness",
    authored: "procedural",
    ktx2Ready: false
  },
  lodProfile: {
    strategy: "single_mesh",
    levelCount: 1,
    maxDrawCalls: 16,
    maxTriangleCount: 8000
  }
} as const;

const P2S_ASSET_IDS = {
  desk: "/assets/models/p2s_desk_oak/p2s_desk_oak.glb",
  keyboard: "/assets/models/p2s_low_profile_keyboard/p2s_low_profile_keyboard.glb",
  mouse: "/assets/models/p2s_wireless_mouse/p2s_wireless_mouse.glb",
  speaker: "/assets/models/p2s_compact_speaker/p2s_compact_speaker.glb",
  lamp: "/assets/models/p2s_desk_lamp_glow/p2s_desk_lamp_glow.glb",
  tray: "/assets/models/p2s_desk_tray_oak/p2s_desk_tray_oak.glb",
  cableTray: "/assets/models/p2s_under_desk_tray_mount/p2s_under_desk_tray_mount.glb",
  stand: "/assets/models/p2s_monitor_stand/p2s_monitor_stand.glb",
  mug: "/assets/models/p2s_ceramic_mug/p2s_ceramic_mug.glb",
  books: "/assets/models/p2s_book_stack_warm/p2s_book_stack_warm.glb",
  plant: "/assets/models/p2s_desk_planter_pilea/p2s_desk_planter_pilea.glb"
} as const;

const P2S_THUMBNAILS = {
  desk: "/assets/catalog/thumbnails/p2s_desk_oak.webp",
  keyboard: "/assets/catalog/thumbnails/p2s_low_profile_keyboard.webp",
  mouse: "/assets/catalog/thumbnails/p2s_wireless_mouse.webp",
  speaker: "/assets/catalog/thumbnails/p2s_compact_speaker.webp",
  lamp: "/assets/catalog/thumbnails/p2s_desk_lamp_glow.webp",
  tray: "/assets/catalog/thumbnails/p2s_desk_tray_oak.webp",
  cableTray: "/assets/catalog/thumbnails/p2s_under_desk_tray_mount.webp",
  stand: "/assets/catalog/thumbnails/p2s_monitor_stand.webp",
  mug: "/assets/catalog/thumbnails/p2s_ceramic_mug.webp",
  books: "/assets/catalog/thumbnails/p2s_book_stack_warm.webp",
  plant: "/assets/catalog/thumbnails/p2s_desk_planter_pilea.webp"
} as const;

const COMMERCIAL_CATALOG_VARIANTS = [
  {
    id: "p2s_desk_walnut_160",
    label: "P2S 월넛 데스크 1600",
    category: "Tables",
    assetId: P2S_ASSET_IDS.desk,
    thumbnail: P2S_THUMBNAILS.desk,
    scale: [1, 1, 1],
    description: "1600mm급 홈오피스 데스크입니다. edge clamp와 underside tray 배치를 지원합니다.",
    brand: "DeskteriorOnline Studio",
    price: "₩229,000",
    options: "1600x700x740 mm · desk_edge · desk_underside",
    dimensionsMm: { width: 1600, depth: 700, height: 740 },
    finishColor: "Dark walnut",
    finishMaterial: "Walnut veneer over engineered wood",
    detailNotes: "Real-scale desk variant for wide monitor, keyboard, mouse, and mounted accessory placement.",
    scaleLocked: true,
    ...P2S_PRODUCT_CONTRACT
  },
  {
    id: "p2s_desk_white_compact_120",
    label: "P2S 화이트 컴팩트 데스크 1200",
    category: "Tables",
    assetId: P2S_ASSET_IDS.desk,
    thumbnail: P2S_THUMBNAILS.desk,
    scale: [1, 1, 1],
    description: "작은 방용 1200mm 데스크입니다. 상판과 가장자리 부착 배치를 지원합니다.",
    brand: "DeskteriorOnline Studio",
    price: "₩159,000",
    options: "1200x600x735 mm · desktop_top",
    dimensionsMm: { width: 1200, depth: 600, height: 735 },
    finishColor: "Warm white",
    finishMaterial: "Matte laminate over engineered wood",
    detailNotes: "Compact real-scale desk for small rooms and L-shaped room test scenes.",
    scaleLocked: true,
    ...P2S_PRODUCT_CONTRACT
  },
  {
    id: "p2s_desk_black_sitstand_150",
    label: "P2S 블랙 싯스탠드 데스크 1500",
    category: "Tables",
    assetId: P2S_ASSET_IDS.desk,
    thumbnail: P2S_THUMBNAILS.desk,
    scale: [1, 1, 1],
    description: "전동 데스크 범위 치수를 반영한 1500mm 작업대입니다.",
    brand: "DeskteriorOnline Studio",
    price: "₩429,000",
    options: "1500x750x720 mm · clamp/tray ready",
    dimensionsMm: { width: 1500, depth: 750, height: 720 },
    finishColor: "Matte black",
    finishMaterial: "Powder coated metal frame with laminate top",
    detailNotes: "Sit-stand style envelope for mounted monitor arm and under-desk cable route validation.",
    scaleLocked: true,
    ...P2S_PRODUCT_CONTRACT
  },
  {
    id: "p2s_desk_oak_lshape_return",
    label: "P2S 오크 리턴 데스크",
    category: "Tables",
    assetId: P2S_ASSET_IDS.desk,
    thumbnail: P2S_THUMBNAILS.desk,
    scale: [1, 1, 1],
    description: "코너형 작업 공간에 맞는 깊은 상판 데스크 variant입니다.",
    brand: "DeskteriorOnline Studio",
    price: "₩289,000",
    options: "1800x800x740 mm · wide surface",
    dimensionsMm: { width: 1800, depth: 800, height: 740 },
    finishColor: "Natural oak",
    finishMaterial: "Oak veneer with black metal support",
    detailNotes: "Large surface variant for multiple monitors, speaker pair, desk mat, and decor composition.",
    scaleLocked: true,
    ...P2S_PRODUCT_CONTRACT
  },
  {
    id: "p2s_desk_bamboo_minimal_140",
    label: "P2S 밤부 미니멀 데스크 1400",
    category: "Tables",
    assetId: P2S_ASSET_IDS.desk,
    thumbnail: P2S_THUMBNAILS.desk,
    scale: [1, 1, 1],
    description: "1400mm 폭의 밝은 대나무 톤 데스크입니다. 상판, edge clamp, underside accessory 배치를 지원합니다.",
    brand: "DeskteriorOnline Studio",
    price: "₩199,000",
    options: "1400x650x740 mm · desktop_top · desk_edge · desk_underside",
    dimensionsMm: { width: 1400, depth: 650, height: 740 },
    finishColor: "Natural bamboo",
    finishMaterial: "Bamboo veneer over engineered wood with satin finish",
    detailNotes: "Mid-size real-scale desk variant for common bedroom and home-office deskterior layouts.",
    scaleLocked: true,
    ...P2S_PRODUCT_CONTRACT
  },
  {
    id: "p2s_task_chair_mesh_black",
    label: "P2S 메쉬 태스크 체어",
    category: "Seating",
    assetId: "/assets/models/SchoolChair_01/SchoolChair_01_1k.gltf",
    thumbnail: P2S_THUMBNAILS.desk,
    scale: [1, 1, 1],
    description: "홈오피스 책상 앞 배치를 위한 표준 작업 의자입니다.",
    brand: "Generic Workspace",
    price: "₩139,000",
    options: "650x650x960 mm",
    dimensionsMm: { width: 650, depth: 650, height: 960 },
    finishColor: "Black mesh",
    finishMaterial: "Mesh back, fabric seat, nylon base",
    detailNotes: "Real-scale task chair envelope; floor placement only.",
    scaleLocked: true,
    ...P2S_PRODUCT_CONTRACT
  },
  {
    id: "p2s_task_chair_fabric_grey",
    label: "P2S 패브릭 태스크 체어",
    category: "Seating",
    assetId: "/assets/models/dining_chair_02/dining_chair_02_1k.gltf",
    thumbnail: P2S_THUMBNAILS.desk,
    scale: [1, 1, 1],
    description: "차분한 회색 패브릭 작업 의자입니다.",
    brand: "Generic Workspace",
    price: "₩119,000",
    options: "610x610x880 mm",
    dimensionsMm: { width: 610, depth: 610, height: 880 },
    finishColor: "Warm grey",
    finishMaterial: "Woven fabric and steel legs",
    detailNotes: "Floor-placed chair sized against real desk seat clearances.",
    scaleLocked: true,
    ...P2S_PRODUCT_CONTRACT
  },
  {
    id: "p2s_stool_guest_round",
    label: "P2S 라운드 게스트 스툴",
    category: "Seating",
    assetId: "/assets/models/bar_chair_round_01/bar_chair_round_01_1k.gltf",
    thumbnail: P2S_THUMBNAILS.desk,
    scale: [1, 1, 1],
    description: "작은 방 보조 좌석으로 쓰는 원형 스툴입니다.",
    brand: "Generic Workspace",
    price: "₩49,000",
    options: "420x420x460 mm",
    dimensionsMm: { width: 420, depth: 420, height: 460 },
    finishColor: "Oak / black",
    finishMaterial: "Wood seat with powder-coated steel",
    detailNotes: "Compact floor prop for desk-side styling.",
    scaleLocked: true,
    ...P2S_PRODUCT_CONTRACT
  },
  {
    id: "sofa-03",
    label: "모듈러 라운지 소파",
    category: "Seating",
    assetId: "/assets/models/sofa_03_2k.gltf/sofa_03_2k.gltf",
    thumbnail: P2S_THUMBNAILS.desk,
    scale: [1, 1, 1],
    description: "작은 방 라운지 존을 만드는 낮은 패브릭 소파입니다.",
    brand: "DeskteriorOnline Studio",
    price: "₩389,000",
    options: "1900x860x780 mm",
    dimensionsMm: { width: 1900, depth: 860, height: 780 },
    finishColor: "Deep charcoal",
    finishMaterial: "Textured fabric over foam cushion",
    detailNotes: "Reference-room starter sofa; floor placement only.",
    scaleLocked: true,
    ...P2S_PRODUCT_CONTRACT
  },
  {
    id: "modern_coffee_table_01",
    label: "모던 우드 커피 테이블",
    category: "Tables",
    assetId: "/assets/models/modern_coffee_table_01/modern_coffee_table_01_1k.gltf",
    thumbnail: P2S_THUMBNAILS.desk,
    scale: [1, 1, 1],
    description: "라운지 중앙에 배치하는 낮은 원목 커피 테이블입니다.",
    brand: "DeskteriorOnline Studio",
    price: "₩129,000",
    options: "920x540x380 mm · tabletop",
    dimensionsMm: { width: 920, depth: 540, height: 380 },
    finishColor: "Warm walnut / matte white",
    finishMaterial: "Wood veneer and painted base",
    detailNotes: "Low table with usable top surface for small decor props.",
    scaleLocked: true,
    ...P2S_PRODUCT_CONTRACT
  },
  {
    id: "modern_wooden_cabinet",
    label: "낮은 미디어 콘솔",
    category: "Storage",
    assetId: "/assets/models/modern_wooden_cabinet/modern_wooden_cabinet_1k.gltf",
    thumbnail: P2S_THUMBNAILS.stand,
    scale: [1, 1, 1],
    description: "TV와 게임 콘솔을 받치는 낮은 수납장입니다.",
    brand: "DeskteriorOnline Studio",
    price: "₩219,000",
    options: "1600x420x520 mm · furniture_surface",
    dimensionsMm: { width: 1600, depth: 420, height: 520 },
    finishColor: "Walnut / off-white",
    finishMaterial: "Wood veneer cabinet with painted drawer fronts",
    detailNotes: "Media-zone support surface for TV, console, and decor placement.",
    scaleLocked: true,
    ...P2S_PRODUCT_CONTRACT
  },
  {
    id: "Television_01",
    label: "슬림 월 미디어 디스플레이",
    category: "Electronics",
    assetId: "/assets/models/Television_01/Television_01_1k.gltf",
    thumbnail: P2S_THUMBNAILS.stand,
    scale: [1, 1, 1],
    description: "미디어 콘솔 위에 올리는 큰 화면 디스플레이입니다.",
    brand: "DeskteriorOnline Studio",
    price: "₩699,000",
    options: "1320x80x760 mm",
    dimensionsMm: { width: 1320, depth: 80, height: 760 },
    finishColor: "Black glass",
    finishMaterial: "Gloss display panel with matte plastic rear shell",
    detailNotes: "Large screen prop used by the workspace-flex media cluster.",
    scaleLocked: true,
    ...P2S_PRODUCT_CONTRACT
  },
  {
    id: "gaming_console",
    label: "컴팩트 게임 콘솔",
    category: "Electronics",
    assetId: "/assets/models/gaming_console/gaming_console_1k.gltf",
    thumbnail: P2S_THUMBNAILS.stand,
    scale: [1, 1, 1],
    description: "미디어 콘솔 위에 놓는 소형 게임 콘솔입니다.",
    brand: "DeskteriorOnline Studio",
    price: "₩399,000",
    options: "300x260x75 mm",
    dimensionsMm: { width: 300, depth: 260, height: 75 },
    finishColor: "Matte black",
    finishMaterial: "Plastic shell with subtle emissive accent",
    detailNotes: "Small media-cluster device; furniture surface placement only.",
    scaleLocked: true,
    ...P2S_PRODUCT_CONTRACT
  },
  {
    id: "side_table_01",
    label: "라운드 사이드 테이블",
    category: "Tables",
    assetId: "/assets/models/side_table_01/side_table_01_1k.gltf",
    thumbnail: P2S_THUMBNAILS.stand,
    scale: [1, 1, 1],
    description: "라운지 옆 조명과 컵을 받치는 작은 원형 테이블입니다.",
    brand: "DeskteriorOnline Studio",
    price: "₩79,000",
    options: "430x430x500 mm · tabletop",
    dimensionsMm: { width: 430, depth: 430, height: 500 },
    finishColor: "Warm oak",
    finishMaterial: "Wood top with compact pedestal base",
    detailNotes: "Side-table support surface for lamp and small decor.",
    scaleLocked: true,
    ...P2S_PRODUCT_CONTRACT
  },
  {
    id: "anthurium_botany_01",
    label: "아늑한 대형 화분",
    category: "Plants",
    assetId: "/assets/models/anthurium_botany_01/anthurium_botany_01_1k.gltf",
    thumbnail: P2S_THUMBNAILS.plant,
    scale: [1, 1, 1],
    description: "창가와 선반 근처에 생기를 더하는 큰 잎 식물입니다.",
    brand: "DeskteriorOnline Studio",
    price: "₩89,000",
    options: "620x620x940 mm",
    dimensionsMm: { width: 620, depth: 620, height: 940 },
    finishColor: "Deep green",
    finishMaterial: "Leaf geometry with ceramic planter",
    detailNotes: "Large plant prop for creator-room silhouette and shadow breakup.",
    scaleLocked: true,
    ...P2S_PRODUCT_CONTRACT
  },
  {
    id: "book_encyclopedia_set_01",
    label: "엔사이클로피디아 북 세트",
    category: "Decor",
    assetId: "/assets/models/book_encyclopedia_set_01/book_encyclopedia_set_01_1k.gltf",
    thumbnail: P2S_THUMBNAILS.books,
    scale: [1, 1, 1],
    description: "선반을 채우는 컬러 북 세트입니다.",
    brand: "DeskteriorOnline Studio",
    price: "₩39,000",
    options: "320x220x300 mm",
    dimensionsMm: { width: 320, depth: 220, height: 300 },
    finishColor: "Mixed muted colors",
    finishMaterial: "Paper covers with subtle roughness",
    detailNotes: "Shelf-surface decor used to increase reference-room density.",
    scaleLocked: true,
    ...P2S_PRODUCT_CONTRACT
  },
  ...([
    ["p2s_monitor_24_ips_black", "P2S 24형 IPS 모니터", "540x180x410 mm", { width: 540, depth: 180, height: 410 }],
    ["p2s_monitor_27_4k_silver", "P2S 27형 4K 모니터", "615x205x455 mm", { width: 615, depth: 205, height: 455 }],
    ["p2s_monitor_32_creator", "P2S 32형 크리에이터 모니터", "715x230x520 mm", { width: 715, depth: 230, height: 520 }],
    ["p2s_monitor_34_ultrawide", "P2S 34형 울트라와이드 모니터", "815x240x470 mm", { width: 815, depth: 240, height: 470 }],
    ["p2s_monitor_27_vertical", "P2S 세로형 27형 모니터", "370x205x615 mm", { width: 370, depth: 205, height: 615 }]
  ] as const).map(([id, label, options, dimensionsMm]) => ({
    id,
    label,
    category: "Electronics",
    assetId: "/assets/models/Television_01/Television_01_1k.gltf",
    thumbnail: P2S_THUMBNAILS.stand,
    scale: [1, 1, 1],
    description: "VESA 100x100 호환 모니터입니다. 모니터암 타깃 배치 검증에 사용할 수 있습니다.",
    brand: "Generic Display",
    price: "₩229,000",
    options: `${options} · VESA 100x100`,
    dimensionsMm,
    finishColor: "Satin black",
    finishMaterial: "Plastic display shell with metal stand",
    detailNotes: "Real-scale display variant with inferred VESA attachment metadata for monitor-arm placement.",
    scaleLocked: true,
    ...P2S_PRODUCT_CONTRACT
  })),
  ...([
    ["p2s_monitor_arm_single_clamp", "P2S 싱글 모니터암 클램프", "120x110x520 mm", { width: 120, depth: 110, height: 520 }],
    ["p2s_monitor_arm_dual_crossbar", "P2S 듀얼 모니터암", "740x140x540 mm", { width: 740, depth: 140, height: 540 }],
    ["p2s_monitor_arm_heavy_duty", "P2S 헤비듀티 모니터암", "150x130x600 mm", { width: 150, depth: 130, height: 600 }]
  ] as const).map(([id, label, options, dimensionsMm]) => ({
    id,
    label,
    category: "Electronics",
    assetId: "/assets/models/desk_lamp_arm_01/desk_lamp_arm_01_1k.gltf",
    thumbnail: P2S_THUMBNAILS.lamp,
    scale: [1, 1, 1],
    description: "책상 가장자리에 클램프로 고정하는 VESA 모니터암입니다.",
    brand: "Generic Mount",
    price: "₩89,000",
    options: `${options} · edge_clamp · VESA`,
    dimensionsMm,
    finishColor: "Matte black",
    finishMaterial: "Powder-coated aluminum arm with steel clamp",
    detailNotes: "Mounted accessory with inferred edge clamp and VESA target metadata.",
    scaleLocked: true,
    ...P2S_PRODUCT_CONTRACT
  })),
  ...([
    ["p2s_keyboard_75_white", "P2S 75% 화이트 키보드", { width: 330, depth: 135, height: 32 }, "Warm white"],
    ["p2s_keyboard_tkl_graphite", "P2S TKL 그래파이트 키보드", { width: 360, depth: 140, height: 34 }, "Graphite"],
    ["p2s_keyboard_65_wood", "P2S 65% 우드 키보드", { width: 315, depth: 120, height: 30 }, "Walnut"],
    ["p2s_keyboard_full_silver", "P2S 풀사이즈 실버 키보드", { width: 440, depth: 135, height: 28 }, "Silver"],
    ["p2s_keyboard_split_ergo_black", "P2S 스플릿 에르고 키보드", { width: 390, depth: 175, height: 38 }, "Black"]
  ] as const).map(([id, label, dimensionsMm, finishColor]) => ({
    id,
    label,
    category: "Electronics",
    assetId: P2S_ASSET_IDS.keyboard,
    thumbnail: P2S_THUMBNAILS.keyboard,
    scale: [1, 1, 1],
    description: "desktop_top 정밀 배치용 실측 키보드 variant입니다.",
    brand: "Generic Keyboard",
    price: "₩89,000",
    options: `${dimensionsMm.width}x${dimensionsMm.depth}x${dimensionsMm.height} mm`,
    dimensionsMm,
    finishColor,
    finishMaterial: "Matte keycaps over low-profile chassis",
    detailNotes: "Surface-placeable keyboard with scale-locked real dimensions.",
    scaleLocked: true,
    ...P2S_PRODUCT_CONTRACT
  })),
  ...([
    ["p2s_mouse_vertical_black", "P2S 버티컬 마우스", { width: 78, depth: 120, height: 72 }, "Black"],
    ["p2s_mouse_travel_white", "P2S 트래블 마우스", { width: 62, depth: 100, height: 34 }, "White"],
    ["p2s_mouse_ergo_grey", "P2S 에르고 마우스", { width: 76, depth: 122, height: 46 }, "Grey"],
    ["p2s_mouse_gaming_graphite", "P2S 게이밍 마우스", { width: 72, depth: 126, height: 42 }, "Graphite"],
    ["p2s_mouse_trackball_silver", "P2S 트랙볼 마우스", { width: 95, depth: 130, height: 50 }, "Silver"]
  ] as const).map(([id, label, dimensionsMm, finishColor]) => ({
    id,
    label,
    category: "Electronics",
    assetId: P2S_ASSET_IDS.mouse,
    thumbnail: P2S_THUMBNAILS.mouse,
    scale: [1, 1, 1],
    description: "desktop_top 정밀 배치용 실측 마우스 variant입니다.",
    brand: "Generic Mouse",
    price: "₩49,000",
    options: `${dimensionsMm.width}x${dimensionsMm.depth}x${dimensionsMm.height} mm`,
    dimensionsMm,
    finishColor,
    finishMaterial: "Soft-touch plastic and rubber feet",
    detailNotes: "Surface-placeable mouse with scale-locked real dimensions.",
    scaleLocked: true,
    ...P2S_PRODUCT_CONTRACT
  })),
  {
    id: "p2s_speaker_pair_white",
    label: "P2S 화이트 스피커 페어",
    category: "Electronics",
    assetId: P2S_ASSET_IDS.speaker,
    thumbnail: P2S_THUMBNAILS.speaker,
    scale: [1, 1, 1],
    description: "데스크 좌우 배치를 위한 compact speaker variant입니다.",
    brand: "Generic Audio",
    price: "₩129,000",
    options: "110x150x240 mm",
    dimensionsMm: { width: 110, depth: 150, height: 240 },
    finishColor: "Matte white",
    finishMaterial: "Painted cabinet with fabric grille",
    detailNotes: "Surface-placeable speaker sized for monitor-side composition.",
    scaleLocked: true,
    ...P2S_PRODUCT_CONTRACT
  },
  {
    id: "p2s_speaker_soundbar_slim",
    label: "P2S 슬림 사운드바",
    category: "Electronics",
    assetId: "/assets/models/boombox/boombox_1k.gltf",
    thumbnail: P2S_THUMBNAILS.speaker,
    scale: [1, 1, 1],
    description: "모니터 아래에 두는 슬림 사운드바입니다.",
    brand: "Generic Audio",
    price: "₩99,000",
    options: "500x86x62 mm",
    dimensionsMm: { width: 500, depth: 86, height: 62 },
    finishColor: "Black",
    finishMaterial: "Aluminum grille and plastic shell",
    detailNotes: "Surface-placeable audio bar for monitor stand setups.",
    scaleLocked: true,
    ...P2S_PRODUCT_CONTRACT
  },
  {
    id: "p2s_speaker_studio_black",
    label: "P2S 블랙 스튜디오 스피커 페어",
    category: "Electronics",
    assetId: P2S_ASSET_IDS.speaker,
    thumbnail: P2S_THUMBNAILS.speaker,
    scale: [1, 1, 1],
    description: "모니터 양쪽에 두는 조금 큰 nearfield speaker variant입니다.",
    brand: "Generic Audio",
    price: "₩189,000",
    options: "135x170x285 mm",
    dimensionsMm: { width: 135, depth: 170, height: 285 },
    finishColor: "Matte black",
    finishMaterial: "Painted MDF cabinet with fabric grille",
    detailNotes: "Surface-placeable speaker variant for wider desk and monitor-arm compositions.",
    scaleLocked: true,
    ...P2S_PRODUCT_CONTRACT
  },
  {
    id: "p2s_monitor_light_bar_black",
    label: "P2S 모니터 라이트바",
    category: "Lighting",
    assetId: P2S_ASSET_IDS.lamp,
    thumbnail: P2S_THUMBNAILS.lamp,
    scale: [1, 1, 1],
    description: "모니터 상단에 걸쳐 쓰는 라이트바 범위 치수 variant입니다.",
    brand: "Generic Lighting",
    price: "₩69,000",
    options: "450x35x35 mm · light-emitter",
    dimensionsMm: { width: 450, depth: 35, height: 35 },
    finishColor: "Black",
    finishMaterial: "Anodized aluminum with diffuser",
    detailNotes: "Light bar catalog item for desk ambience testing.",
    scaleLocked: true,
    ...P2S_PRODUCT_CONTRACT
  },
  {
    id: "p2s_led_task_lamp_slim",
    label: "P2S 슬림 LED 태스크 램프",
    category: "Lighting",
    assetId: "/assets/models/desk_lamp_arm_01/desk_lamp_arm_01_1k.gltf",
    thumbnail: P2S_THUMBNAILS.lamp,
    scale: [1, 1, 1],
    description: "얇은 암을 가진 LED 작업등입니다.",
    brand: "Generic Lighting",
    price: "₩79,000",
    options: "180x160x520 mm · light-emitter",
    dimensionsMm: { width: 180, depth: 160, height: 520 },
    finishColor: "Black",
    finishMaterial: "Powder-coated metal with LED diffuser",
    detailNotes: "Desk lamp variant with real envelope for surface placement.",
    scaleLocked: true,
    ...P2S_PRODUCT_CONTRACT
  },
  {
    id: "p2s_desk_lamp_dome_warm",
    label: "P2S 돔 쉐이드 데스크 램프",
    category: "Lighting",
    assetId: P2S_ASSET_IDS.lamp,
    thumbnail: P2S_THUMBNAILS.lamp,
    scale: [1, 1, 1],
    description: "따뜻한 책상 분위기를 만드는 돔형 데스크 램프 variant입니다.",
    brand: "Generic Lighting",
    price: "₩59,000",
    options: "210x210x380 mm · light-emitter",
    dimensionsMm: { width: 210, depth: 210, height: 380 },
    finishColor: "Warm brass",
    finishMaterial: "Painted metal shade with warm diffuser",
    detailNotes: "Desk lamp variant that changes room mood in shared viewer and walk placement scenes.",
    scaleLocked: true,
    ...P2S_PRODUCT_CONTRACT
  },
  ...([
    ["p2s_desk_mat_felt_grey", "P2S 펠트 데스크 매트 그레이", { width: 900, depth: 400, height: 4 }, "Felt grey"],
    ["p2s_desk_mat_leather_camel", "P2S 레더 데스크 매트 카멜", { width: 800, depth: 350, height: 3 }, "Camel"],
    ["p2s_desk_mat_cork_natural", "P2S 코르크 데스크 매트", { width: 700, depth: 330, height: 5 }, "Natural cork"],
    ["p2s_desk_mat_black_xl", "P2S 블랙 XL 데스크 매트", { width: 1000, depth: 450, height: 4 }, "Black"],
    ["p2s_desk_mat_wool_blue", "P2S 울 데스크 매트 블루", { width: 850, depth: 380, height: 4 }, "Muted blue"]
  ] as const).map(([id, label, dimensionsMm, finishColor]) => ({
    id,
    label,
    category: "Decor",
    assetId: P2S_ASSET_IDS.tray,
    thumbnail: P2S_THUMBNAILS.tray,
    scale: [1, 1, 1],
    description: "키보드와 마우스를 함께 올리는 얇은 desktop_top 매트입니다.",
    brand: "Generic Desk Mat",
    price: "₩29,000",
    options: `${dimensionsMm.width}x${dimensionsMm.depth}x${dimensionsMm.height} mm`,
    dimensionsMm,
    finishColor,
    finishMaterial: "Soft desk mat surface",
    detailNotes: "Scale-locked desk mat variant for composition and clearance testing.",
    scaleLocked: true,
    ...P2S_PRODUCT_CONTRACT
  })),
  ...([
    ["p2s_cable_tray_mesh_600", "P2S 메쉬 케이블 트레이 600", { width: 600, depth: 180, height: 90 }],
    ["p2s_cable_tray_felt_500", "P2S 펠트 케이블 해먹", { width: 500, depth: 160, height: 70 }],
    ["p2s_cable_tray_bamboo_700", "P2S 밤부 케이블 트레이 700", { width: 700, depth: 190, height: 85 }]
  ] as const).map(([id, label, dimensionsMm]) => ({
    id,
    label,
    category: "Storage",
    assetId: P2S_ASSET_IDS.cableTray,
    thumbnail: P2S_THUMBNAILS.cableTray,
    scale: [1, 1, 1],
    description: "desk_underside에 나사로 설치하는 케이블 트레이 variant입니다.",
    brand: "Generic Cable Management",
    price: "₩39,000",
    options: `${dimensionsMm.width}x${dimensionsMm.depth}x${dimensionsMm.height} mm · underside_screw`,
    dimensionsMm,
    finishColor: "Black",
    finishMaterial: "Steel or reinforced felt",
    detailNotes: "Mounted cable tray with inferred underside_screw metadata.",
    scaleLocked: true,
    ...P2S_PRODUCT_CONTRACT
  })),
  ...([
    ["p2s_cable_clip_edge_single", "P2S 엣지 케이블 클립 싱글", { width: 28, depth: 24, height: 18 }],
    ["p2s_cable_clip_edge_double", "P2S 엣지 케이블 클립 더블", { width: 44, depth: 24, height: 18 }],
    ["p2s_cable_clip_adhesive_3slot", "P2S 3슬롯 케이블 클립", { width: 62, depth: 22, height: 16 }],
    ["p2s_cable_clip_magnetic", "P2S 마그네틱 케이블 클립", { width: 34, depth: 20, height: 14 }],
    ["p2s_cable_clip_underdesk_loop", "P2S 언더데스크 케이블 루프", { width: 60, depth: 36, height: 22 }]
  ] as const).map(([id, label, dimensionsMm]) => ({
    id,
    label,
    category: "Storage",
    assetId: P2S_ASSET_IDS.cableTray,
    thumbnail: P2S_THUMBNAILS.cableTray,
    scale: [1, 1, 1],
    description: "desk_edge 또는 desk_underside에 부착하는 소형 케이블 정리 accessory입니다.",
    brand: "Generic Cable Management",
    price: "₩9,000",
    options: `${dimensionsMm.width}x${dimensionsMm.depth}x${dimensionsMm.height} mm · edge/underside attachment`,
    dimensionsMm,
    finishColor: "Black",
    finishMaterial: "Flexible silicone or ABS plastic",
    detailNotes: "Mounted cable clip with inferred clamp/screw metadata for focus placement.",
    scaleLocked: true,
    ...P2S_PRODUCT_CONTRACT
  })),
  ...([
    ["p2s_wall_shelf_oak_800", "P2S 오크 벽선반 800", "/assets/models/Shelf_01/Shelf_01_1k.gltf", { width: 800, depth: 240, height: 60 }],
    ["p2s_pegboard_grid_white", "P2S 화이트 페그보드", "/assets/models/wooden_display_shelves_01/wooden_display_shelves_01_1k.gltf", { width: 760, depth: 42, height: 560 }],
    ["p2s_steel_shelf_compact", "P2S 컴팩트 스틸 선반", "/assets/models/steel_frame_shelves_01/steel_frame_shelves_01_1k.gltf", { width: 900, depth: 350, height: 1200 }]
  ] as const).map(([id, label, assetId, dimensionsMm]) => ({
    id,
    label,
    category: "Storage",
    assetId,
    thumbnail: P2S_THUMBNAILS.stand,
    scale: [1, 1, 1],
    description: "데스크 주변 수납과 소품 배치를 위한 선반/페그보드입니다.",
    brand: "Generic Storage",
    price: "₩59,000",
    options: `${dimensionsMm.width}x${dimensionsMm.depth}x${dimensionsMm.height} mm`,
    dimensionsMm,
    finishColor: "Neutral",
    finishMaterial: "Wood or powder-coated steel",
    detailNotes: "Storage surface with inferred shelf/furniture support surface metadata.",
    scaleLocked: true,
    ...P2S_PRODUCT_CONTRACT
  })),
  ...([
    ["p2s_decor_mug_espresso", "P2S 에스프레소 머그", P2S_ASSET_IDS.mug, P2S_THUMBNAILS.mug, { width: 92, depth: 72, height: 72 }],
    ["p2s_decor_mug_tall", "P2S 톨 세라믹 머그", P2S_ASSET_IDS.mug, P2S_THUMBNAILS.mug, { width: 110, depth: 84, height: 120 }],
    ["p2s_decor_books_minimal", "P2S 미니멀 북 스택", P2S_ASSET_IDS.books, P2S_THUMBNAILS.books, { width: 180, depth: 240, height: 58 }],
    ["p2s_decor_books_large", "P2S 라지 북 스택", P2S_ASSET_IDS.books, P2S_THUMBNAILS.books, { width: 220, depth: 300, height: 96 }],
    ["p2s_decor_planter_white", "P2S 화이트 플랜터", P2S_ASSET_IDS.plant, P2S_THUMBNAILS.plant, { width: 120, depth: 120, height: 150 }],
    ["p2s_decor_planter_mini", "P2S 미니 플랜터", P2S_ASSET_IDS.plant, P2S_THUMBNAILS.plant, { width: 80, depth: 80, height: 105 }],
    ["p2s_decor_pen_cup", "P2S 펜 컵", P2S_ASSET_IDS.mug, P2S_THUMBNAILS.mug, { width: 82, depth: 82, height: 105 }],
    ["p2s_decor_catchall_tray", "P2S 캐치올 트레이", P2S_ASSET_IDS.tray, P2S_THUMBNAILS.tray, { width: 210, depth: 140, height: 24 }],
    ["p2s_decor_note_stack", "P2S 노트 스택", P2S_ASSET_IDS.books, P2S_THUMBNAILS.books, { width: 148, depth: 210, height: 36 }],
    ["p2s_decor_small_frame", "P2S 소형 액자", P2S_ASSET_IDS.books, P2S_THUMBNAILS.books, { width: 160, depth: 24, height: 210 }],
    ["p2s_decor_clock_round", "P2S 라운드 데스크 시계", "/assets/models/alarm_clock_01/alarm_clock_01_1k.gltf", P2S_THUMBNAILS.mug, { width: 110, depth: 55, height: 110 }],
    ["p2s_decor_camera_vintage", "P2S 빈티지 카메라", "/assets/models/Camera_01/Camera_01_1k.gltf", P2S_THUMBNAILS.tray, { width: 145, depth: 80, height: 95 }],
    ["p2s_decor_candle_pair", "P2S 캔들 페어", "/assets/models/brass_candleholders/brass_candleholders_1k.gltf", P2S_THUMBNAILS.mug, { width: 120, depth: 60, height: 160 }],
    ["p2s_decor_gamepad", "P2S 게임패드", "/assets/models/gamepad/gamepad_1k.gltf", P2S_THUMBNAILS.mouse, { width: 155, depth: 105, height: 55 }],
    ["p2s_decor_headphone_stand", "P2S 헤드폰 스탠드", P2S_ASSET_IDS.stand, P2S_THUMBNAILS.stand, { width: 160, depth: 160, height: 260 }],
    ["p2s_decor_acoustic_panel", "P2S 미니 어쿠스틱 패널", P2S_ASSET_IDS.books, P2S_THUMBNAILS.books, { width: 300, depth: 32, height: 300 }],
    ["p2s_decor_phone_stand", "P2S 알루미늄 폰 스탠드", P2S_ASSET_IDS.stand, P2S_THUMBNAILS.stand, { width: 86, depth: 96, height: 132 }],
    ["p2s_decor_glass_vase", "P2S 글라스 미니 베이스", P2S_ASSET_IDS.plant, P2S_THUMBNAILS.plant, { width: 92, depth: 92, height: 180 }],
    ["p2s_decor_block_calendar", "P2S 블록 캘린더", P2S_ASSET_IDS.books, P2S_THUMBNAILS.books, { width: 150, depth: 58, height: 92 }],
    ["p2s_decor_minimal_figure", "P2S 미니멀 피규어", P2S_ASSET_IDS.mug, P2S_THUMBNAILS.mug, { width: 74, depth: 60, height: 150 }]
  ] as const).map(([id, label, assetId, thumbnail, dimensionsMm]) => ({
    id,
    label,
    category: "Decor",
    assetId,
    thumbnail,
    scale: [1, 1, 1],
    description: "데스크와 선반 위를 꾸미는 실측 소품 variant입니다.",
    brand: "Generic Decor",
    price: "₩19,000",
    options: `${dimensionsMm.width}x${dimensionsMm.depth}x${dimensionsMm.height} mm`,
    dimensionsMm,
    finishColor: "Neutral accent",
    finishMaterial: "Mixed decorative material",
    detailNotes: "Scale-locked decor prop for deskterior styling and shared viewer product details.",
    scaleLocked: true,
    ...P2S_PRODUCT_CONTRACT
  }))
] as const;

const MESHY_ROOM_DECOR_CATALOG_VARIANTS = [
  {
    id: "p2s_meshy_pastel_mascot_stack",
    label: "Meshy 파스텔 마스코트 스택",
    category: "Decor",
    assetId: "/assets/models/p2s_meshy_pastel_mascot_stack/p2s_meshy_pastel_mascot_stack.glb",
    thumbnail: "/assets/catalog/thumbnails/p2s_meshy_pastel_mascot_stack.webp",
    scale: [1, 1, 1],
    description:
      "Meshy text-to-3D로 만든 데스크/디스플레이용 collectible decor prototype입니다. Cozy room starter의 소품 밀도를 보강합니다.",
    brand: "DeskteriorOnline / Meshy",
    price: null,
    options: "180x120x150 mm · text-to-3D prototype · shelf/desktop decor",
    externalUrl: "https://docs.meshy.ai/en/api/text-to-3d",
    qualityScore: 0.76,
    dimensionsMm: { width: 180, depth: 120, height: 150 },
    finishColor: "Pastel multicolor",
    finishMaterial: "PBR glossy vinyl plastic",
    detailNotes:
      "Generated on 2026-05-16 with Meshy text-to-3D preview/refine. Prototype-only until human visual QA and license/release review are complete.",
    scaleLocked: true,
    source: {
      kind: "deskterioronline_blender",
      name: "DeskteriorOnline Meshy text-to-3D decor prototype",
      path: "assets/references/meshy-room-decor/meshy-room-decor-report.json",
      url: "https://docs.meshy.ai/en/api/text-to-3d"
    },
    license: {
      spdx: "LicenseRef-Meshy-Text-To-3D-Prototype",
      label: "Meshy-generated prototype for DeskteriorOnline visual QA",
      requiresAttribution: false
    },
    pivot: {
      x: "center",
      y: "floor",
      z: "center"
    },
    collisionProxy: {
      kind: "box",
      derivesFrom: "dimensionsMm"
    },
    textureSet: {
      workflow: "pbr_metallic_roughness",
      authored: "image_based",
      ktx2Ready: false
    },
    lodProfile: {
      strategy: "single_mesh",
      levelCount: 1,
      maxDrawCalls: 8,
      maxTriangleCount: 100000
    }
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

function normalizeCatalogImagePath(value: unknown) {
  const normalized = normalizeCatalogText(value);
  if (!normalized) return null;
  if (
    normalized.startsWith("http://") ||
    normalized.startsWith("https://") ||
    normalized.startsWith("/")
  ) {
    return normalized;
  }
  return null;
}

function normalizeCatalogImageUrl(record: Record<string, unknown>) {
  return (
    normalizeCatalogImagePath(record.thumbnail) ??
    normalizeCatalogImagePath(record.thumbnailUrl) ??
    normalizeCatalogImagePath(record.image) ??
    normalizeCatalogImagePath(record.imageUrl) ??
    normalizeCatalogImagePath(record.previewImageUrl)
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
    qualityScore:
      typeof record.qualityScore === "number" && Number.isFinite(record.qualityScore) ? record.qualityScore : null,
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

export const DEFAULT_CATALOG: LibraryCatalogItem[] = [
  ...DEFAULT_CATALOG_SOURCE,
  ...COMMERCIAL_CATALOG_VARIANTS,
  ...MESHY_ROOM_DECOR_CATALOG_VARIANTS,
  ...SO_ONG_VIDEO_CATALOG_VARIANTS
]
  .map((item) => normalizeCatalogItem(item))
  .filter((item): item is LibraryCatalogItem => item !== null);

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
  const source = Array.isArray(input) ? input : DEFAULT_CATALOG_SOURCE;
  const normalized = [...source, ...COMMERCIAL_CATALOG_VARIANTS]
    .map((item) => normalizeCatalogItem(item))
    .filter((item): item is LibraryCatalogItem => item !== null);
  const byId = new Map<string, LibraryCatalogItem>();
  normalized.forEach((item) => {
    byId.set(item.id, item);
  });

  return byId.size > 0 ? Array.from(byId.values()) : DEFAULT_CATALOG;
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
