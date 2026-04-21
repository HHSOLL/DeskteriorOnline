import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  ProductCollisionProxyMetadata,
  ProductLicenseMetadata,
  ProductLodProfileMetadata,
  ProductPivotMetadata,
  ProductSourceMetadata,
  ProductTextureSetMetadata
} from "../src/lib/builder/catalog";

export type CuratedManifestMetadataField =
  | "brand"
  | "externalUrl"
  | "description"
  | "category"
  | "options";

export type CuratedDeskteriorAsset = {
  key: string;
  manifestId: string;
  sourcePath: string;
  runtimePath: string;
  expectedAssetId: string;
  requiredMetadata: CuratedManifestMetadataField[];
  budget: {
    maxFileSizeBytes: number;
    maxDrawCalls: number;
    maxTriangleCount: number;
  };
  supportProfileExpectation?: {
    surfaces: Array<{
      id: string;
      anchorTypes: Array<"desk_surface" | "shelf_surface" | "furniture_surface">;
      center: [number, number];
      size: [number, number];
      top: number;
      margin?: [number, number];
    }>;
  };
  contractMetadata: {
    source: ProductSourceMetadata;
    license: ProductLicenseMetadata;
    pivot: ProductPivotMetadata;
    collisionProxy: ProductCollisionProxyMetadata;
    textureSet: ProductTextureSetMetadata;
    lodProfile: ProductLodProfileMetadata;
  };
  optionsHint?: string;
};

const scriptFile = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptFile);
const appRoot = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(appRoot, "../..");
const publicRoot = path.join(appRoot, "public");

function runtimeAssetPath(assetKey: string) {
  return path.join(publicRoot, "assets", "models", assetKey, `${assetKey}.glb`);
}

function runtimeAssetId(assetKey: string) {
  return `/assets/models/${assetKey}/${assetKey}.glb`;
}

function sourceBlendPath(assetKey: string) {
  return path.join(repoRoot, "assets", "blender", "deskterior", `${assetKey}.blend`);
}

function sourceBlendRepoPath(assetKey: string) {
  return `assets/blender/deskterior/${assetKey}.blend`;
}

function createCuratedContractMetadata(
  assetKey: string,
  budget: CuratedDeskteriorAsset["budget"]
): CuratedDeskteriorAsset["contractMetadata"] {
  return {
    source: {
      kind: "plan2space_blender",
      name: "Plan2Space Blender Deskterior",
      path: sourceBlendRepoPath(assetKey),
      url: null
    },
    license: {
      spdx: "LicenseRef-Plan2Space-Internal",
      label: "Plan2Space Internal Catalog",
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
      authored: "procedural",
      ktx2Ready: false
    },
    lodProfile: {
      strategy: "single_mesh",
      levelCount: 1,
      maxDrawCalls: budget.maxDrawCalls,
      maxTriangleCount: budget.maxTriangleCount
    }
  };
}

export const curatedDeskteriorAssets: CuratedDeskteriorAsset[] = [
  {
    key: "p2s_desk_oak",
    manifestId: "p2s_desk_oak_140",
    sourcePath: sourceBlendPath("p2s_desk_oak"),
    runtimePath: runtimeAssetPath("p2s_desk_oak"),
    expectedAssetId: runtimeAssetId("p2s_desk_oak"),
    requiredMetadata: ["brand", "externalUrl", "description", "category", "options"],
    budget: {
      maxFileSizeBytes: 1_000_000,
      maxDrawCalls: 16,
      maxTriangleCount: 2_000
    },
    contractMetadata: createCuratedContractMetadata("p2s_desk_oak", {
      maxFileSizeBytes: 1_000_000,
      maxDrawCalls: 16,
      maxTriangleCount: 2_000
    }),
    supportProfileExpectation: {
      surfaces: [
        {
          id: "desk-top",
          anchorTypes: ["desk_surface", "furniture_surface"],
          center: [0, 0],
          size: [1.33, 0.58],
          top: 0.755,
          margin: [0.08, 0.08]
        }
      ]
    }
  },
  {
    key: "p2s_monitor_stand",
    manifestId: "p2s_monitor_stand_wood",
    sourcePath: sourceBlendPath("p2s_monitor_stand"),
    runtimePath: runtimeAssetPath("p2s_monitor_stand"),
    expectedAssetId: runtimeAssetId("p2s_monitor_stand"),
    requiredMetadata: ["brand", "externalUrl", "description", "category", "options"],
    budget: {
      maxFileSizeBytes: 1_000_000,
      maxDrawCalls: 8,
      maxTriangleCount: 2_000
    },
    contractMetadata: createCuratedContractMetadata("p2s_monitor_stand", {
      maxFileSizeBytes: 1_000_000,
      maxDrawCalls: 8,
      maxTriangleCount: 2_000
    }),
    supportProfileExpectation: {
      surfaces: [
        {
          id: "stand-top",
          anchorTypes: ["desk_surface", "furniture_surface"],
          center: [0, 0],
          size: [0.56, 0.13],
          top: 0.072,
          margin: [0.02, 0.02]
        }
      ]
    }
  },
  {
    key: "p2s_desk_lamp_glow",
    manifestId: "p2s_desk_lamp_glow",
    sourcePath: sourceBlendPath("p2s_desk_lamp_glow"),
    runtimePath: runtimeAssetPath("p2s_desk_lamp_glow"),
    expectedAssetId: runtimeAssetId("p2s_desk_lamp_glow"),
    requiredMetadata: ["brand", "externalUrl", "description", "category", "options"],
    budget: {
      maxFileSizeBytes: 2_000_000,
      maxDrawCalls: 12,
      maxTriangleCount: 6_000
    },
    contractMetadata: createCuratedContractMetadata("p2s_desk_lamp_glow", {
      maxFileSizeBytes: 2_000_000,
      maxDrawCalls: 12,
      maxTriangleCount: 6_000
    }),
    optionsHint: "light-emitter"
  },
  {
    key: "p2s_ceramic_mug",
    manifestId: "p2s_ceramic_mug_sand",
    sourcePath: sourceBlendPath("p2s_ceramic_mug"),
    runtimePath: runtimeAssetPath("p2s_ceramic_mug"),
    expectedAssetId: runtimeAssetId("p2s_ceramic_mug"),
    requiredMetadata: ["brand", "externalUrl", "description", "category", "options"],
    budget: {
      maxFileSizeBytes: 1_000_000,
      maxDrawCalls: 4,
      maxTriangleCount: 4_000
    },
    contractMetadata: createCuratedContractMetadata("p2s_ceramic_mug", {
      maxFileSizeBytes: 1_000_000,
      maxDrawCalls: 4,
      maxTriangleCount: 4_000
    })
  },
  {
    key: "p2s_book_stack_warm",
    manifestId: "p2s_book_stack_warm",
    sourcePath: sourceBlendPath("p2s_book_stack_warm"),
    runtimePath: runtimeAssetPath("p2s_book_stack_warm"),
    expectedAssetId: runtimeAssetId("p2s_book_stack_warm"),
    requiredMetadata: ["brand", "externalUrl", "description", "category", "options"],
    budget: {
      maxFileSizeBytes: 1_000_000,
      maxDrawCalls: 6,
      maxTriangleCount: 2_000
    },
    contractMetadata: createCuratedContractMetadata("p2s_book_stack_warm", {
      maxFileSizeBytes: 1_000_000,
      maxDrawCalls: 6,
      maxTriangleCount: 2_000
    })
  },
  {
    key: "p2s_desk_tray_oak",
    manifestId: "p2s_desk_tray_oak",
    sourcePath: sourceBlendPath("p2s_desk_tray_oak"),
    runtimePath: runtimeAssetPath("p2s_desk_tray_oak"),
    expectedAssetId: runtimeAssetId("p2s_desk_tray_oak"),
    requiredMetadata: ["brand", "externalUrl", "description", "category", "options"],
    budget: {
      maxFileSizeBytes: 1_000_000,
      maxDrawCalls: 8,
      maxTriangleCount: 2_000
    },
    contractMetadata: createCuratedContractMetadata("p2s_desk_tray_oak", {
      maxFileSizeBytes: 1_000_000,
      maxDrawCalls: 8,
      maxTriangleCount: 2_000
    }),
    supportProfileExpectation: {
      surfaces: [
        {
          id: "tray-base",
          anchorTypes: ["desk_surface", "shelf_surface", "furniture_surface"],
          center: [0, 0],
          size: [0.22, 0.14],
          top: 0.012,
          margin: [0.01, 0.01]
        }
      ]
    }
  },
  {
    key: "p2s_compact_speaker",
    manifestId: "p2s_compact_speaker",
    sourcePath: sourceBlendPath("p2s_compact_speaker"),
    runtimePath: runtimeAssetPath("p2s_compact_speaker"),
    expectedAssetId: runtimeAssetId("p2s_compact_speaker"),
    requiredMetadata: ["brand", "externalUrl", "description", "category", "options"],
    budget: {
      maxFileSizeBytes: 1_000_000,
      maxDrawCalls: 8,
      maxTriangleCount: 2_000
    },
    contractMetadata: createCuratedContractMetadata("p2s_compact_speaker", {
      maxFileSizeBytes: 1_000_000,
      maxDrawCalls: 8,
      maxTriangleCount: 2_000
    })
  },
  {
    key: "p2s_desk_planter_pilea",
    manifestId: "p2s_desk_planter_pilea",
    sourcePath: sourceBlendPath("p2s_desk_planter_pilea"),
    runtimePath: runtimeAssetPath("p2s_desk_planter_pilea"),
    expectedAssetId: runtimeAssetId("p2s_desk_planter_pilea"),
    requiredMetadata: ["brand", "externalUrl", "description", "category", "options"],
    budget: {
      maxFileSizeBytes: 2_000_000,
      maxDrawCalls: 10,
      maxTriangleCount: 6_000
    },
    contractMetadata: createCuratedContractMetadata("p2s_desk_planter_pilea", {
      maxFileSizeBytes: 2_000_000,
      maxDrawCalls: 10,
      maxTriangleCount: 6_000
    })
  }
];
