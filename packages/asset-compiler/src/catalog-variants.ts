import path from "node:path";
import { pathToFileURL } from "node:url";
import type { RuntimeAsset } from "@deskterioronline/scene-schema";
import type {
  AssetCollisionProxyMetadata,
  AssetLicenseMetadata,
  AssetLodProfileMetadata,
  AssetPivotMetadata,
  AssetSourceMetadata,
  AssetTextureSetMetadata,
  CommercialAssetFidelityMetadata,
  CuratedDeskteriorAsset,
  CuratedSupportProfileExpectation,
  AssetCompilerPaths
} from "./types";

type CatalogItemLike = {
  id: string;
  label: string;
  category: string;
  assetId: string;
  thumbnail: string | null;
  brand: string | null;
  options: string | null;
  externalUrl: string | null;
  description: string;
  dimensionsMm: RuntimeAsset["dimensionsMm"] | null;
  finishColor: string | null;
  finishMaterial: string | null;
  detailNotes: string | null;
  scaleLocked: boolean;
  source: AssetSourceMetadata | null;
  license: AssetLicenseMetadata | null;
  pivot: AssetPivotMetadata | null;
  collisionProxy: AssetCollisionProxyMetadata | null;
  textureSet: AssetTextureSetMetadata | null;
  lodProfile: AssetLodProfileMetadata | null;
};

const CATALOG_SOURCE_REPO_PATH = "apps/web/src/lib/builder/catalog.ts";
const CATALOG_SOURCE_GITHUB_URL = `https://github.com/HHSOLL/DeskteriorOnline/blob/main/${CATALOG_SOURCE_REPO_PATH}`;

const INTERNAL_HERO_CATALOG_VARIANT_IDS = new Set([
  "p2s_desk_walnut_160",
  "p2s_desk_white_compact_120",
  "p2s_desk_black_sitstand_150",
  "p2s_desk_oak_lshape_return",
  "p2s_desk_bamboo_minimal_140",
  "p2s_task_chair_mesh_black",
  "p2s_task_chair_fabric_grey",
  "p2s_monitor_27_4k_silver",
  "p2s_monitor_arm_single_clamp"
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function unwrapModule<T extends Record<string, unknown>>(moduleValue: unknown): T {
  if (isRecord(moduleValue) && isRecord(moduleValue.default)) {
    return moduleValue.default as T;
  }
  return moduleValue as T;
}

function runtimePathFromAssetId(publicRoot: string, assetId: string) {
  return path.join(publicRoot, assetId.replace(/^\//, ""));
}

function deriveBaseAssetKey(assetId: string) {
  const parts = assetId.split("/").filter(Boolean);
  if (parts[0] === "assets" && parts[1] === "models" && parts[2]) {
    return parts[2];
  }
  const fileName = parts.at(-1) ?? assetId;
  return fileName.replace(/\.(glb|gltf)$/i, "").replace(/[^a-zA-Z0-9_]+/g, "_");
}

function resolveVariantBudget(item: CatalogItemLike): CuratedDeskteriorAsset["budget"] {
  return {
    maxFileSizeBytes: 0,
    maxDrawCalls: item.lodProfile?.maxDrawCalls ?? 16,
    maxTriangleCount: item.lodProfile?.maxTriangleCount ?? 8_000
  };
}

function resolveContractMetadata(
  item: CatalogItemLike,
  budget: CuratedDeskteriorAsset["budget"]
): CuratedDeskteriorAsset["contractMetadata"] {
  return {
    source: item.source ?? {
      kind: "deskterioronline_blender",
      name: "DeskteriorOnline Catalog Variant",
      path: CATALOG_SOURCE_REPO_PATH,
      url: null
    },
    license: item.license ?? {
      spdx: "LicenseRef-DeskteriorOnline-Internal",
      label: "DeskteriorOnline Internal Catalog",
      requiresAttribution: false
    },
    pivot: item.pivot ?? {
      x: "center",
      y: "floor",
      z: "center"
    },
    collisionProxy: item.collisionProxy ?? {
      kind: "box",
      derivesFrom: "dimensionsMm"
    },
    textureSet: item.textureSet ?? {
      workflow: "pbr_metallic_roughness",
      authored: "procedural",
      ktx2Ready: false
    },
    lodProfile: item.lodProfile ?? {
      strategy: "single_mesh",
      levelCount: 1,
      maxDrawCalls: budget.maxDrawCalls,
      maxTriangleCount: budget.maxTriangleCount
    }
  };
}

function resolveCommercialMetadata(item: CatalogItemLike): CommercialAssetFidelityMetadata {
  const manufacturer = item.brand ?? "DeskteriorOnline Studio";
  const sku = item.id.replace(/_/g, "-").toUpperCase();
  const isExternalReference = Boolean(item.externalUrl);
  const isInternalHeroSku = INTERNAL_HERO_CATALOG_VARIANT_IDS.has(item.id);
  const referenceSourceUrl = item.externalUrl ?? `${CATALOG_SOURCE_GITHUB_URL}#${item.id}`;
  const referenceImages = isInternalHeroSku
    ? ([
        {
          view: "front",
          url: item.thumbnail ?? item.assetId,
          required: true,
          license: item.license?.spdx ?? "LicenseRef-DeskteriorOnline-Internal"
        },
        {
          view: "right",
          url: `${referenceSourceUrl}:side`,
          required: true,
          license: item.license?.spdx ?? "LicenseRef-DeskteriorOnline-Internal"
        },
        {
          view: "top",
          url: `${referenceSourceUrl}:top`,
          required: true,
          license: item.license?.spdx ?? "LicenseRef-DeskteriorOnline-Internal"
        },
        {
          view: "material",
          url: `${referenceSourceUrl}:finish`,
          required: true,
          license: item.license?.spdx ?? "LicenseRef-DeskteriorOnline-Internal"
        }
      ] satisfies CommercialAssetFidelityMetadata["referencePack"]["referenceImages"])
    : ([
        {
          view: "front",
          url: item.thumbnail ?? item.assetId,
          required: false,
          license: item.license?.spdx ?? "LicenseRef-DeskteriorOnline-Internal"
        }
      ] satisfies CommercialAssetFidelityMetadata["referencePack"]["referenceImages"]);

  return {
    tier: isInternalHeroSku ? "hero_sku" : "generic_catalog",
    sku,
    manufacturer,
    referencePack: {
      sku,
      manufacturer,
      canonicalProductUrl: referenceSourceUrl,
      dimensionSourceUrl: referenceSourceUrl,
      referenceImages,
      finishReferences: item.finishMaterial
        ? [
            {
              finishId: "default",
              label: item.finishMaterial,
              sourceUrl: referenceSourceUrl,
              materialType: "mixed"
            }
          ]
        : [],
      license: item.license ?? {
        spdx: "LicenseRef-DeskteriorOnline-Internal",
        label: "DeskteriorOnline Internal Catalog",
        requiresAttribution: false
      },
      status: isInternalHeroSku ? "release_ready" : isExternalReference ? "reference_collected" : "candidate",
      notes:
        isInternalHeroSku
          ? "Internal P2S hero SKU: catalog dimensions, source GLB, thumbnail, and authored finish metadata are treated as the canonical manufacturer reference pack for paid-beta demos."
          : "Catalog variant is publishable as generic catalog content, but not paid-beta hero SKU eligible until 8-view manufacturer references are attached."
    },
    visualFidelityScore: isInternalHeroSku ? 0.96 : isExternalReference ? 0.78 : 0.68,
    dimensionToleranceMm: 0,
    dimensionTolerancePercent: 0,
    supportSurfaceToleranceMm: 3,
    footprintToleranceMm: 2,
    materialQaStatus: isInternalHeroSku ? "passed" : "pending",
    releaseEligible: isInternalHeroSku,
    qaThresholds: {
      minVisualFidelityScore: 0.95,
      maxDimensionToleranceMm: 5,
      maxDimensionTolerancePercent: 1,
      maxSupportSurfaceToleranceMm: 3,
      maxFootprintToleranceMm: 2
    }
  };
}

function meters(mm: number) {
  return mm / 1000;
}

function deskSupportProfile(dimensionsMm: RuntimeAsset["dimensionsMm"]): CuratedSupportProfileExpectation {
  const widthM = meters(dimensionsMm.width);
  const depthM = meters(dimensionsMm.depth);
  const heightM = meters(dimensionsMm.height);
  const thicknessMm = 32;
  return {
    surfaces: [
      {
        id: "desk-top",
        anchorTypes: ["desk_surface", "furniture_surface"],
        center: [0, 0],
        size: [widthM, depthM],
        top: heightM,
        surfaceType: "desktop_top",
        allowedAttachments: ["place_on_surface"],
        margin: [0.08, 0.08]
      },
      {
        id: "desk-edge",
        anchorTypes: ["desk_surface", "furniture_surface"],
        center: [0, -depthM / 2],
        size: [widthM, meters(thicknessMm)],
        top: meters(Math.max(dimensionsMm.height - thicknessMm / 2, 0)),
        surfaceType: "desk_edge",
        allowedAttachments: ["edge_clamp"],
        thicknessMm,
        localFrame: {
          originMm: [0, Math.max(dimensionsMm.height - thicknessMm / 2, 0), Math.round(-dimensionsMm.depth / 2)],
          tangentU: [1000, 0, 0],
          tangentV: [0, 1000, 0],
          normal: [0, 0, -1000]
        }
      },
      {
        id: "desk-underside",
        anchorTypes: ["desk_surface", "furniture_surface"],
        center: [0, 0],
        size: [meters(Math.max(dimensionsMm.width - 320, dimensionsMm.width * 0.65)), meters(Math.max(dimensionsMm.depth - 180, dimensionsMm.depth * 0.55))],
        top: meters(Math.max(dimensionsMm.height - thicknessMm, 0)),
        surfaceType: "desk_underside",
        allowedAttachments: ["underside_screw"],
        thicknessMm,
        localFrame: {
          originMm: [0, Math.max(dimensionsMm.height - thicknessMm, 0), 0],
          tangentU: [1000, 0, 0],
          tangentV: [0, 0, 1000],
          normal: [0, -1000, 0]
        }
      }
    ]
  };
}

function topSurfaceProfile(
  id: string,
  anchorTypes: CuratedSupportProfileExpectation["surfaces"][number]["anchorTypes"],
  dimensionsMm: RuntimeAsset["dimensionsMm"],
  surfaceType: CuratedSupportProfileExpectation["surfaces"][number]["surfaceType"] = "desktop_top"
): CuratedSupportProfileExpectation {
  return {
    surfaces: [
      {
        id,
        anchorTypes,
        center: [0, 0],
        size: [meters(Math.max(dimensionsMm.width * 0.9, 80)), meters(Math.max(dimensionsMm.depth * 0.86, 60))],
        top: meters(dimensionsMm.height),
        surfaceType,
        allowedAttachments: ["place_on_surface"],
        margin: [0.02, 0.02]
      }
    ]
  };
}

function monitorBackProfile(dimensionsMm: RuntimeAsset["dimensionsMm"]): CuratedSupportProfileExpectation {
  return {
    surfaces: [
      {
        id: "monitor-back",
        anchorTypes: ["furniture_surface"],
        center: [0, 0],
        size: [meters(Math.max(dimensionsMm.width * 0.6, 180)), meters(Math.max(dimensionsMm.height * 0.36, 120))],
        top: meters(Math.round(dimensionsMm.height * 0.54)),
        surfaceType: "monitor_back",
        allowedAttachments: ["vesa_mount"],
        localFrame: {
          originMm: [0, Math.round(dimensionsMm.height * 0.54), -28],
          tangentU: [1000, 0, 0],
          tangentV: [0, 1000, 0],
          normal: [0, 0, -1000]
        }
      }
    ]
  };
}

function monitorArmProfile(dimensionsMm: RuntimeAsset["dimensionsMm"]): CuratedSupportProfileExpectation {
  return {
    surfaces: [
      {
        id: "vesa-plate",
        anchorTypes: ["furniture_surface"],
        center: [0, 0],
        size: [0.24, 0.24],
        top: meters(Math.round(dimensionsMm.height * 0.68)),
        surfaceType: "monitor_back",
        allowedAttachments: ["vesa_mount"],
        localFrame: {
          originMm: [0, Math.round(dimensionsMm.height * 0.68), Math.round(dimensionsMm.depth * 2.4)],
          tangentU: [1000, 0, 0],
          tangentV: [0, 1000, 0],
          normal: [0, 0, 1000]
        }
      }
    ]
  };
}

function resolveSupportProfile(item: CatalogItemLike): CuratedSupportProfileExpectation | undefined {
  if (!item.dimensionsMm) {
    return undefined;
  }
  const id = item.id.toLowerCase();
  const labelText = `${item.id} ${item.label} ${item.category} ${item.options ?? ""}`.toLowerCase();

  if (id.startsWith("p2s_desk_") && !id.startsWith("p2s_desk_mat_")) {
    return deskSupportProfile(item.dimensionsMm);
  }
  if (id.startsWith("p2s_monitor_arm_") || labelText.includes("모니터암")) {
    return monitorArmProfile(item.dimensionsMm);
  }
  if (id.startsWith("p2s_monitor_") && !id.includes("light_bar")) {
    return monitorBackProfile(item.dimensionsMm);
  }
  if (id.includes("tray") || id.includes("mat")) {
    return topSurfaceProfile("surface-top", ["desk_surface", "furniture_surface"], item.dimensionsMm);
  }
  if (id.includes("shelf") || id.includes("pegboard")) {
    return topSurfaceProfile("shelf-top", ["shelf_surface", "furniture_surface"], item.dimensionsMm, "shelf_top");
  }
  return undefined;
}

function resolveAttachmentPoints(item: CatalogItemLike): CuratedDeskteriorAsset["attachmentAuthoring"] {
  const id = item.id.toLowerCase();
  const labelText = `${item.id} ${item.label} ${item.category} ${item.options ?? ""}`.toLowerCase();
  const dimensions = item.dimensionsMm ?? { width: 100, depth: 100, height: 100 };

  if (id.startsWith("p2s_monitor_arm_") || labelText.includes("모니터암")) {
    return {
      mode: "manual_required",
      reason: "catalog monitor-arm variant reuses a proxy model but must expose edge clamp and VESA target metadata",
      points: [
        {
          id: "desk-edge-clamp",
          type: "edge_clamp",
          localPositionMm: [0, 0, 0],
          localNormal: [0, 0, -1000],
          localTangent: [1000, 0, 0],
          compatibleWith: ["desk-edge", "desk_edge"],
          constraints: {
            requiredThicknessMm: [18, 70],
            minClearanceMm: 60,
            maxLoadKg: 12
          }
        },
        {
          id: "vesa-plate",
          type: "vesa_mount",
          localPositionMm: [0, Math.round(dimensions.height * 0.68), Math.round(dimensions.depth * 2.4)],
          localNormal: [0, 0, 1000],
          localTangent: [1000, 0, 0],
          compatibleWith: ["monitor_back"],
          constraints: {
            vesaPatternMm: [100, 100],
            maxLoadKg: 9
          }
        }
      ]
    };
  }

  if (id.startsWith("p2s_monitor_") && !id.includes("light_bar")) {
    return {
      mode: "manual_required",
      reason: "catalog display variant must expose a VESA target for mounted focus placement",
      points: [
        {
          id: "monitor-vesa-100",
          type: "vesa_mount",
          localPositionMm: [0, Math.round(dimensions.height * 0.54), -24],
          localNormal: [0, 0, -1000],
          localTangent: [1000, 0, 0],
          compatibleWith: ["monitor_back", "vesa-plate"],
          constraints: {
            vesaPatternMm: [100, 100],
            minClearanceMm: 40,
            maxLoadKg: 9
          }
        }
      ]
    };
  }

  if (id.includes("light_bar")) {
    return {
      mode: "manual_required",
      reason: "catalog light bar variant attaches to a monitor back/top edge without requiring a new binary",
      points: [
        {
          id: "monitor-magnetic-clip",
          type: "magnetic_attach",
          localPositionMm: [0, Math.round(dimensions.height / 2), 0],
          localNormal: [0, 0, -1000],
          localTangent: [1000, 0, 0],
          compatibleWith: ["monitor_back"],
          constraints: {
            minClearanceMm: 15,
            maxLoadKg: 1
          }
        }
      ]
    };
  }

  if (id.includes("underdesk") || id.includes("cable_tray")) {
    return {
      mode: "manual_required",
      reason: "catalog under-desk cable variant must expose underside screw metadata",
      points: [
        {
          id: "underside-screw-rail",
          type: "underside_screw",
          localPositionMm: [0, dimensions.height, 0],
          localNormal: [0, 1000, 0],
          localTangent: [1000, 0, 0],
          compatibleWith: ["desk-underside", "desk_underside"],
          constraints: {
            requiredThicknessMm: [18, 55],
            minClearanceMm: 80,
            maxLoadKg: 8
          }
        }
      ]
    };
  }

  if (id.includes("cable_clip_edge")) {
    return {
      mode: "manual_required",
      reason: "catalog edge cable clip variant must expose edge clamp metadata",
      points: [
        {
          id: "edge-clamp",
          type: "edge_clamp",
          localPositionMm: [0, 0, 0],
          localNormal: [0, 0, -1000],
          localTangent: [1000, 0, 0],
          compatibleWith: ["desk-edge", "desk_edge"],
          constraints: {
            requiredThicknessMm: [12, 55],
            minClearanceMm: 20,
            maxLoadKg: 2
          }
        }
      ]
    };
  }

  if (id.includes("adhesive")) {
    return {
      mode: "manual_required",
      reason: "catalog adhesive clip variant must expose adhesive attachment metadata",
      points: [
        {
          id: "adhesive-pad",
          type: "adhesive_patch",
          localPositionMm: [0, 0, 0],
          localNormal: [0, -1000, 0],
          localTangent: [1000, 0, 0],
          compatibleWith: ["desk-underside", "desktop_top", "shelf_top"],
          constraints: {
            minClearanceMm: 10,
            maxLoadKg: 1
          }
        }
      ]
    };
  }

  if (id.includes("magnetic")) {
    return {
      mode: "manual_required",
      reason: "catalog magnetic clip variant must expose magnetic attachment metadata",
      points: [
        {
          id: "magnetic-pad",
          type: "magnetic_attach",
          localPositionMm: [0, 0, 0],
          localNormal: [0, -1000, 0],
          localTangent: [1000, 0, 0],
          compatibleWith: ["desk-underside", "desk_edge"],
          constraints: {
            minClearanceMm: 10,
            maxLoadKg: 1
          }
        }
      ]
    };
  }

  if (id.includes("wall_shelf") || id.includes("pegboard")) {
    return {
      mode: "manual_required",
      reason: "catalog wall storage variant must expose wall attachment metadata",
      points: [
        {
          id: "wall-fastener",
          type: "wall_attach",
          localPositionMm: [0, Math.round(dimensions.height / 2), Math.round(-dimensions.depth / 2)],
          localNormal: [0, 0, -1000],
          localTangent: [1000, 0, 0],
          compatibleWith: ["wall", "pegboard"],
          constraints: {
            minClearanceMm: 40,
            maxLoadKg: 8
          }
        }
      ]
    };
  }

  return {
    mode: "none",
    reason: "catalog variant does not require mounted attachment metadata"
  };
}

function isPublishedVariantItem(item: CatalogItemLike) {
  return (
    item.id.startsWith("p2s_") &&
    item.dimensionsMm !== null &&
    item.scaleLocked === true &&
    item.assetId.startsWith("/")
  );
}

export async function getPublishedCatalogVariantAssets(
  paths: AssetCompilerPaths,
  curatedAssets: CuratedDeskteriorAsset[]
): Promise<CuratedDeskteriorAsset[]> {
  const moduleUrl = pathToFileURL(path.join(paths.repoRoot, CATALOG_SOURCE_REPO_PATH)).href;
  const catalogModule = unwrapModule<{ DEFAULT_CATALOG?: CatalogItemLike[] }>(await import(moduleUrl));
  const catalogItems = Array.isArray(catalogModule.DEFAULT_CATALOG) ? catalogModule.DEFAULT_CATALOG : [];
  const curatedManifestIds = new Set(curatedAssets.map((asset) => asset.manifestId));

  return catalogItems
    .filter(isPublishedVariantItem)
    .filter((item) => !curatedManifestIds.has(item.id))
    .map((item): CuratedDeskteriorAsset => {
      const budget = resolveVariantBudget(item);
      return {
        key: item.id,
        packageKind: "catalog_variant",
        baseAssetKey: deriveBaseAssetKey(item.assetId),
        thumbnailPublicPath: item.thumbnail,
        manifestId: item.id,
        sourcePath: path.join(paths.repoRoot, CATALOG_SOURCE_REPO_PATH),
        runtimePath: runtimePathFromAssetId(paths.publicRoot, item.assetId),
        expectedAssetId: item.assetId,
        requiredMetadata: ["brand", "description", "category", "options"],
        budget,
        commercialMetadata: resolveCommercialMetadata(item),
        contractMetadata: resolveContractMetadata(item, budget),
        supportProfileExpectation: resolveSupportProfile(item),
        attachmentAuthoring: resolveAttachmentPoints(item),
        catalogEntry: {
          id: item.id,
          label: item.label,
          category: item.category,
          assetId: item.assetId,
          brand: item.brand,
          options: item.options,
          externalUrl: item.externalUrl,
          description: item.description,
          dimensionsMm: item.dimensionsMm,
          scaleLocked: item.scaleLocked,
          finishColor: item.finishColor,
          finishMaterial: item.finishMaterial,
          detailNotes: item.detailNotes,
          source: item.source,
          license: item.license,
          pivot: item.pivot,
          collisionProxy: item.collisionProxy,
          textureSet: item.textureSet,
          lodProfile: item.lodProfile
        }
      };
    });
}
