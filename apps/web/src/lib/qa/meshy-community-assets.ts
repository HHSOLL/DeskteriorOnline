export const MESHY_COMMUNITY_QA_ROUTE_BASE = "/api/qa-assets/meshy-community";
export const MESHY_COMMUNITY_SOURCE_ROOT_RELATIVE = "assets/sources/meshy-community/selected-glb";

export type MeshyCommunityMaterialTone = {
  tint?: string;
  tintStrength?: number;
  colorScale?: number;
  roughness?: number;
  metalness?: number;
  emissiveIntensity?: number;
  opacity?: number;
};

export type MeshyCommunityAsset = {
  slug: string;
  label: string;
  file: string;
  category: "chair" | "table" | "rack" | "wall-decor";
  usage: string;
  author: string;
  pageUrl: string;
  publicTaskApi: string;
  license: "CC0-1.0";
  sourceStatus: "qa-source-staged";
  sourceRelativePath: string;
  boundsM: [number, number, number];
  triangleCount: number;
  vertexCount: number;
  byteLength: number;
  sha256: string;
};

export type MeshyCommunityScenePlacement = {
  slug: MeshyCommunityAsset["slug"];
  layer: "wall-accent" | "storage-density" | "lounge-surface" | "lounge-seat";
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  materialTone: MeshyCommunityMaterialTone;
};

export const MESHY_COMMUNITY_ASSETS: MeshyCommunityAsset[] = [
  {
    slug: "chair-rodiondbulatoff",
    label: "Chair",
    file: "chair-rodiondbulatoff.glb",
    category: "chair",
    usage: "accent lounge chair / room seating density",
    author: "rodiondbulatoff",
    pageUrl: "https://www.meshy.ai/3d-models/019676c5-3501-72f7-b7de-88f2e8a0b264",
    publicTaskApi: "https://api.meshy.ai/web/public/tasks/019676c5-3501-72f7-b7de-88f2e8a0b264",
    license: "CC0-1.0",
    sourceStatus: "qa-source-staged",
    sourceRelativePath: `${MESHY_COMMUNITY_SOURCE_ROOT_RELATIVE}/chair-rodiondbulatoff.glb`,
    boundsM: [0.86755, 1.99395, 0.90545],
    triangleCount: 9997,
    vertexCount: 9330,
    byteLength: 1508716,
    sha256: "f729878cbc6e5526a05b5ca38239b594495d49cdcf8e7ca29831f301739c624f"
  },
  {
    slug: "rustic-table",
    label: "Rustic Table",
    file: "rustic-table.glb",
    category: "table",
    usage: "lounge side table / foreground decor surface",
    author: "Warface",
    pageUrl: "https://www.meshy.ai/3d-models/019b215f-1b40-75b2-b039-bfbca510845b",
    publicTaskApi: "https://api.meshy.ai/web/public/tasks/019b215c-907c-76e5-adf6-c115cfd71a1d",
    license: "CC0-1.0",
    sourceStatus: "qa-source-staged",
    sourceRelativePath: `${MESHY_COMMUNITY_SOURCE_ROOT_RELATIVE}/rustic-table.glb`,
    boundsM: [1.83823, 0.85261, 1.91687],
    triangleCount: 9998,
    vertexCount: 9221,
    byteLength: 8017724,
    sha256: "68b26b44176782e3a22c84b346aa1e4faf18227648c480e617d483ac58df4e98"
  },
  {
    slug: "rack-golden-arch",
    label: "Rack Golden Arch",
    file: "rack-golden-arch.glb",
    category: "rack",
    usage: "right-side storage and display density",
    author: "epix.asmr",
    pageUrl: "https://www.meshy.ai/3d-models/019b38d7-2c17-7e67-a949-17a00786dcdc",
    publicTaskApi: "https://api.meshy.ai/web/public/tasks/019b38cf-8c16-70cf-9482-bb7c24237f5c",
    license: "CC0-1.0",
    sourceStatus: "qa-source-staged",
    sourceRelativePath: `${MESHY_COMMUNITY_SOURCE_ROOT_RELATIVE}/rack-golden-arch.glb`,
    boundsM: [1.91645, 1.8001, 0.99228],
    triangleCount: 10000,
    vertexCount: 7717,
    byteLength: 6478816,
    sha256: "db6574d23fd142970b64b6f3afc30a78386aae5302d52589b115feaba7e90654"
  },
  {
    slug: "colorful-brick-wall",
    label: "Colorful Brick Wall",
    file: "colorful-brick-wall.glb",
    category: "wall-decor",
    usage: "rear wall accent material layer",
    author: "crit",
    pageUrl: "https://www.meshy.ai/3d-models/019adb1c-3540-7272-86c5-d4d05a56ffbc",
    publicTaskApi: "https://api.meshy.ai/web/public/tasks/019adb19-b5f2-774d-84dc-d032d1031d5e",
    license: "CC0-1.0",
    sourceStatus: "qa-source-staged",
    sourceRelativePath: `${MESHY_COMMUNITY_SOURCE_ROOT_RELATIVE}/colorful-brick-wall.glb`,
    boundsM: [1.89385, 1.91241, 0.30758],
    triangleCount: 21035,
    vertexCount: 14384,
    byteLength: 2029936,
    sha256: "8db2260d338d7d305632186e06091fdd05cbbb872a99818d461e2cb63c922e23"
  }
];

export const MESHY_COMMUNITY_ASSET_FILES = MESHY_COMMUNITY_ASSETS.map((asset) => asset.file);
export const MESHY_COMMUNITY_ASSET_FILE_SET = new Set(MESHY_COMMUNITY_ASSET_FILES);

export const MESHY_COMMUNITY_SCENE_PLACEMENTS: MeshyCommunityScenePlacement[] = [
  {
    slug: "colorful-brick-wall",
    layer: "wall-accent",
    position: [1.34, 1.02, -1.988],
    rotation: [0, 0.02, 0],
    scale: [0.58, 0.44, 0.075],
    materialTone: { tint: "#ff9bb8", tintStrength: 0.1, colorScale: 0.72, roughness: 0.9, metalness: 0.02, opacity: 0.44 }
  },
  {
    slug: "rack-golden-arch",
    layer: "storage-density",
    position: [2.34, 0.82, -1.55],
    rotation: [0, -0.58, 0],
    scale: [0.38, 0.44, 0.38],
    materialTone: { tint: "#f3d6b3", tintStrength: 0.18, colorScale: 0.78, roughness: 0.68, metalness: 0.12, opacity: 0.84 }
  },
  {
    slug: "rustic-table",
    layer: "lounge-surface",
    position: [1.05, 0.28, 1.44],
    rotation: [0, -0.38, 0],
    scale: [0.34, 0.34, 0.34],
    materialTone: { tint: "#bd7a51", tintStrength: 0.1, colorScale: 0.84, roughness: 0.82, metalness: 0.03, opacity: 0.86 }
  },
  {
    slug: "chair-rodiondbulatoff",
    layer: "lounge-seat",
    position: [1.02, 0.54, 1.24],
    rotation: [0, -0.92, 0],
    scale: [0.48, 0.48, 0.48],
    materialTone: { tint: "#e7dfd8", tintStrength: 0.16, colorScale: 0.9, roughness: 0.78, metalness: 0.04, opacity: 0.88 }
  }
];

export function getMeshyCommunityAssetBySlug(slug: string) {
  return MESHY_COMMUNITY_ASSETS.find((asset) => asset.slug === slug) ?? null;
}

export function getMeshyCommunityRuntimeUrl(file: string) {
  return `${MESHY_COMMUNITY_QA_ROUTE_BASE}/${file}`;
}
