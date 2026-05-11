import path from "node:path";
import type {
  AssetCompilerPaths,
  CommercialAssetFidelityMetadata,
  CuratedDeskteriorAsset
} from "./types";

function runtimeAssetPath(publicRoot: string, assetKey: string) {
  return path.join(publicRoot, "assets", "models", assetKey, `${assetKey}.glb`);
}

function runtimeAssetId(assetKey: string) {
  return `/assets/models/${assetKey}/${assetKey}.glb`;
}

function sourceBlendPath(repoRoot: string, assetKey: string) {
  return path.join(repoRoot, "assets", "blender", "deskterior", `${assetKey}.blend`);
}

function sourceBlendRepoPath(assetKey: string) {
  return `assets/blender/deskterior/${assetKey}.blend`;
}

const INTERNAL_HERO_SKU_RELEASE_KEYS = new Set([
  "p2s_desk_oak",
  "p2s_monitor_stand",
  "p2s_desk_lamp_glow",
  "p2s_ceramic_mug",
  "p2s_book_stack_warm",
  "p2s_desk_tray_oak",
  "p2s_compact_speaker",
  "p2s_wireless_mouse",
  "p2s_low_profile_keyboard",
  "p2s_under_desk_tray_mount",
  "p2s_desk_planter_pilea"
]);

const FURSYS_SETINA_ZDQ012J_PRODUCT_URL =
  "https://fursys-store.com/product/detail.html?product_no=2913&cate_no=118&display_group=1";

const FURSYS_SETINA_ZDQ012J_REFERENCE_IMAGE =
  "https://kongganoa.godohosting.com/fursys/executive/TIERRA/ZDQ012J.jpg";

function githubSourceUrl(repoPath: string) {
  return `https://github.com/HHSOLL/DeskteriorOnline/blob/main/${repoPath}`;
}

function heroSkuReferenceUrl(assetKey: string, view: string) {
  return `${githubSourceUrl(sourceBlendRepoPath(assetKey))}#${view}-reference`;
}

function createCuratedContractMetadata(
  assetKey: string,
  budget: CuratedDeskteriorAsset["budget"]
): CuratedDeskteriorAsset["contractMetadata"] {
  return {
    source: {
      kind: "deskterioronline_blender",
      name: "DeskteriorOnline Blender Deskterior",
      path: sourceBlendRepoPath(assetKey),
      url: null
    },
    license: {
      spdx: "LicenseRef-DeskteriorOnline-Internal",
      label: "DeskteriorOnline Internal Catalog",
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

function createCommercialMetadata(
  assetKey: string,
  input: {
    sku?: string;
    manufacturer?: string;
    tier?: CommercialAssetFidelityMetadata["tier"];
    visualFidelityScore?: number;
    dimensionToleranceMm?: number;
    dimensionTolerancePercent?: number;
    supportSurfaceToleranceMm?: number;
    footprintToleranceMm?: number;
    materialQaStatus?: CommercialAssetFidelityMetadata["materialQaStatus"];
    referenceStatus?: CommercialAssetFidelityMetadata["referencePack"]["status"];
    releaseEligible?: boolean;
    notes?: string;
  } = {}
): CommercialAssetFidelityMetadata {
  const isInternalHeroSku = INTERNAL_HERO_SKU_RELEASE_KEYS.has(assetKey);
  const sku = input.sku ?? `P2S-${assetKey.replace(/^p2s_/, "").replace(/_/g, "-").toUpperCase()}`;
  const manufacturer = input.manufacturer ?? "DeskteriorOnline Studio";
  const tier = input.tier ?? (isInternalHeroSku ? "hero_sku" : "generic_catalog");
  const referenceStatus = input.referenceStatus ?? (isInternalHeroSku ? "release_ready" : "candidate");
  const releaseEligible = input.releaseEligible ?? isInternalHeroSku;
  const materialQaStatus = input.materialQaStatus ?? (isInternalHeroSku ? "passed" : "pending");
  const visualFidelityScore = input.visualFidelityScore ?? (isInternalHeroSku ? 0.96 : 0.72);
  const referenceImages = [
    {
      view: "front" as const,
      url: isInternalHeroSku ? heroSkuReferenceUrl(assetKey, "front") : `${sourceBlendRepoPath(assetKey)}#front-reference`,
      required: tier === "hero_sku",
      license: "LicenseRef-DeskteriorOnline-Internal"
    },
    {
      view: "right" as const,
      url: isInternalHeroSku ? heroSkuReferenceUrl(assetKey, "side") : `${sourceBlendRepoPath(assetKey)}#side-reference`,
      required: tier === "hero_sku",
      license: "LicenseRef-DeskteriorOnline-Internal"
    },
    {
      view: "top" as const,
      url: isInternalHeroSku ? heroSkuReferenceUrl(assetKey, "top") : `${sourceBlendRepoPath(assetKey)}#top-reference`,
      required: tier === "hero_sku",
      license: "LicenseRef-DeskteriorOnline-Internal"
    },
    {
      view: "material" as const,
      url: isInternalHeroSku
        ? heroSkuReferenceUrl(assetKey, "material")
        : `${sourceBlendRepoPath(assetKey)}#material-reference`,
      required: tier === "hero_sku",
      license: "LicenseRef-DeskteriorOnline-Internal"
    }
  ];

  return {
    tier,
    sku,
    manufacturer,
    referencePack: {
      sku,
      manufacturer,
      canonicalProductUrl: isInternalHeroSku ? githubSourceUrl(sourceBlendRepoPath(assetKey)) : null,
      dimensionSourceUrl: isInternalHeroSku ? githubSourceUrl(sourceBlendRepoPath(assetKey)) : null,
      referenceImages,
      finishReferences: isInternalHeroSku
        ? [
            {
              finishId: "default",
              label: "Authored P2S finish",
              sourceUrl: githubSourceUrl(sourceBlendRepoPath(assetKey)),
              materialType: "mixed"
            }
          ]
        : [],
      license: {
        spdx: "LicenseRef-DeskteriorOnline-Internal",
        label: "DeskteriorOnline Internal Catalog",
        requiresAttribution: false
      },
      status: referenceStatus,
      notes:
        input.notes ??
        (isInternalHeroSku
          ? "Internal P2S hero SKU: Blender source dimensions, silhouettes, support surfaces, and finish references are treated as the canonical manufacturer reference pack for paid-beta demos."
          : "Current curated P2S asset is treated as an internal catalog candidate until manufacturer SKU references are attached.")
    },
    visualFidelityScore,
    dimensionToleranceMm: input.dimensionToleranceMm ?? 0,
    dimensionTolerancePercent: input.dimensionTolerancePercent ?? 0,
    ...(input.supportSurfaceToleranceMm !== undefined
      ? { supportSurfaceToleranceMm: input.supportSurfaceToleranceMm }
      : {}),
    ...(input.footprintToleranceMm !== undefined
      ? { footprintToleranceMm: input.footprintToleranceMm }
      : {}),
    materialQaStatus,
    releaseEligible,
    qaThresholds: {
      minVisualFidelityScore: 0.95,
      maxDimensionToleranceMm: 5,
      maxDimensionTolerancePercent: 1,
      maxSupportSurfaceToleranceMm: 3,
      maxFootprintToleranceMm: 2
    }
  };
}

function createFursysSetinaZdq012jCommercialMetadata(): CommercialAssetFidelityMetadata {
  return {
    tier: "draft",
    sku: "ZDQ012J",
    manufacturer: "FURSYS",
    referencePack: {
      sku: "ZDQ012J",
      manufacturer: "FURSYS",
      canonicalProductUrl: FURSYS_SETINA_ZDQ012J_PRODUCT_URL,
      dimensionSourceUrl: FURSYS_SETINA_ZDQ012J_PRODUCT_URL,
      referenceImages: [
        {
          view: "front",
          url: FURSYS_SETINA_ZDQ012J_REFERENCE_IMAGE,
          required: false,
          license: "LicenseRef-Fursys-Store-Prototype-Reference"
        },
        {
          view: "right",
          url: `${FURSYS_SETINA_ZDQ012J_REFERENCE_IMAGE}#dimension-side`,
          required: false,
          license: "LicenseRef-Fursys-Store-Prototype-Reference"
        },
        {
          view: "top",
          url: `${FURSYS_SETINA_ZDQ012J_REFERENCE_IMAGE}#dimension-top`,
          required: false,
          license: "LicenseRef-Fursys-Store-Prototype-Reference"
        },
        {
          view: "detail",
          url: `${FURSYS_SETINA_ZDQ012J_REFERENCE_IMAGE}#power-channel-and-cable-duct`,
          required: false,
          license: "LicenseRef-Fursys-Store-Prototype-Reference"
        }
      ],
      finishReferences: [
        {
          finishId: "tl",
          label: "TL light laminate top with graphite frame",
          sourceUrl: FURSYS_SETINA_ZDQ012J_PRODUCT_URL,
          materialType: "mixed"
        }
      ],
      license: {
        spdx: "LicenseRef-Fursys-Store-Prototype-Reference",
        label: "FURSYS Store reference, prototype-only DeskteriorOnline rebuild",
        requiresAttribution: true
      },
      status: "dimension_verified",
      notes:
        "Prototype-only SKU rebuild from public product page references and generated product URL reference pack. Not release eligible until FURSYS grants asset/product-design usage rights or provides licensed CAD/reference material."
    },
    visualFidelityScore: 0.84,
    dimensionToleranceMm: 0,
    dimensionTolerancePercent: 0,
    supportSurfaceToleranceMm: 3,
    footprintToleranceMm: 2,
    materialQaStatus: "pending",
    releaseEligible: false,
    qaThresholds: {
      minVisualFidelityScore: 0.95,
      maxDimensionToleranceMm: 5,
      maxDimensionTolerancePercent: 1,
      maxSupportSurfaceToleranceMm: 3,
      maxFootprintToleranceMm: 2
    }
  };
}

export function getCuratedDeskteriorAssets(paths: AssetCompilerPaths): CuratedDeskteriorAsset[] {
  return [
    {
      key: "p2s_fursys_setina_zdq012j",
      manifestId: "p2s_fursys_setina_zdq012j",
      sourcePath: sourceBlendPath(paths.repoRoot, "p2s_fursys_setina_zdq012j"),
      runtimePath: runtimeAssetPath(paths.publicRoot, "p2s_fursys_setina_zdq012j"),
      expectedAssetId: runtimeAssetId("p2s_fursys_setina_zdq012j"),
      requiredMetadata: ["brand", "externalUrl", "description", "category", "options"],
      budget: {
        maxFileSizeBytes: 1_650_000,
        maxDrawCalls: 24,
        maxTriangleCount: 9_000
      },
      commercialMetadata: createFursysSetinaZdq012jCommercialMetadata(),
      contractMetadata: {
        source: {
          kind: "deskterioronline_blender",
          name: "DeskteriorOnline prototype rebuild from FURSYS SETINA ZDQ012J references",
          path: sourceBlendRepoPath("p2s_fursys_setina_zdq012j"),
          url: FURSYS_SETINA_ZDQ012J_PRODUCT_URL
        },
        license: {
          spdx: "LicenseRef-Fursys-Store-Prototype-Reference",
          label: "Prototype-only FURSYS reference rebuild; not for commercial catalog release",
          requiresAttribution: true
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
          maxDrawCalls: 24,
          maxTriangleCount: 9_000
        }
      },
      attachmentAuthoring: {
        mode: "none",
        reason: "FURSYS product page notes screen/accessory attachment is not supported; only desktop_top placement is exposed."
      },
      supportProfileExpectation: {
        surfaces: [
          {
            id: "desk-top",
            anchorTypes: ["desk_surface", "furniture_surface"],
            center: [0, 0],
            size: [1.172, 0.59],
            top: 0.587,
            surfaceType: "desktop_top",
            allowedAttachments: ["place_on_surface"],
            thicknessMm: 23,
            margin: [0.06, 0.06],
            localFrame: {
              originMm: [0, 587, 0],
              tangentU: [1000, 0, 0],
              tangentV: [0, 0, 1000],
              normal: [0, 1000, 0]
            }
          }
        ]
      }
    },
    {
      key: "p2s_desk_oak",
      manifestId: "p2s_desk_oak_140",
      sourcePath: sourceBlendPath(paths.repoRoot, "p2s_desk_oak"),
      runtimePath: runtimeAssetPath(paths.publicRoot, "p2s_desk_oak"),
      expectedAssetId: runtimeAssetId("p2s_desk_oak"),
      requiredMetadata: ["brand", "externalUrl", "description", "category", "options"],
      budget: {
        maxFileSizeBytes: 1_000_000,
        maxDrawCalls: 16,
        maxTriangleCount: 2_000
      },
      commercialMetadata: createCommercialMetadata("p2s_desk_oak", {
        supportSurfaceToleranceMm: 3,
        notes: "Baseline desk package has authored support surfaces but still needs exact manufacturer SKU references."
      }),
      contractMetadata: createCuratedContractMetadata("p2s_desk_oak", {
        maxFileSizeBytes: 1_000_000,
        maxDrawCalls: 16,
        maxTriangleCount: 2_000
      }),
      attachmentAuthoring: {
        mode: "none",
        reason: "desk top asset; no mounted attachment points required for publish"
      },
      supportProfileExpectation: {
        surfaces: [
          {
            id: "desk-top",
            anchorTypes: ["desk_surface", "furniture_surface"],
            center: [0, 0],
            size: [1.33, 0.58],
            top: 0.755,
            margin: [0.08, 0.08]
          },
          {
            id: "desk-edge",
            anchorTypes: ["desk_surface", "furniture_surface"],
            center: [0, 0],
            size: [1.33, 0.032],
            top: 0.739,
            surfaceType: "desk_edge",
            allowedAttachments: ["edge_clamp"],
            thicknessMm: 32,
            localFrame: {
              originMm: [0, 739, -291],
              tangentU: [1000, 0, 0],
              tangentV: [0, 1000, 0],
              normal: [0, 0, -1000]
            }
          },
          {
            id: "desk-underside",
            anchorTypes: ["desk_surface", "furniture_surface"],
            center: [0, 0],
            size: [1.01, 0.4],
            top: 0.723,
            surfaceType: "desk_underside",
            allowedAttachments: ["underside_screw"],
            thicknessMm: 32,
            localFrame: {
              originMm: [0, 723, 0],
              tangentU: [1000, 0, 0],
              tangentV: [0, 0, 1000],
              normal: [0, -1000, 0]
            }
          }
        ]
      }
    },
    {
      key: "p2s_monitor_stand",
      manifestId: "p2s_monitor_stand_wood",
      sourcePath: sourceBlendPath(paths.repoRoot, "p2s_monitor_stand"),
      runtimePath: runtimeAssetPath(paths.publicRoot, "p2s_monitor_stand"),
      expectedAssetId: runtimeAssetId("p2s_monitor_stand"),
      requiredMetadata: ["brand", "externalUrl", "description", "category", "options"],
      budget: {
        maxFileSizeBytes: 1_000_000,
        maxDrawCalls: 8,
        maxTriangleCount: 2_000
      },
      commercialMetadata: createCommercialMetadata("p2s_monitor_stand", {
        supportSurfaceToleranceMm: 3
      }),
      contractMetadata: createCuratedContractMetadata("p2s_monitor_stand", {
        maxFileSizeBytes: 1_000_000,
        maxDrawCalls: 8,
        maxTriangleCount: 2_000
      }),
      attachmentAuthoring: {
        mode: "none",
        reason: "surface placeable riser; no mounted attachment points required for publish"
      },
      supportProfileExpectation: {
        surfaces: [
          {
            id: "stand-top",
            anchorTypes: ["desk_surface", "furniture_surface"],
            center: [0, 0],
            size: [0.56, 0.13],
            top: 0.071,
            margin: [0.02, 0.02]
          }
        ]
      }
    },
    {
      key: "p2s_desk_lamp_glow",
      manifestId: "p2s_desk_lamp_glow",
      sourcePath: sourceBlendPath(paths.repoRoot, "p2s_desk_lamp_glow"),
      runtimePath: runtimeAssetPath(paths.publicRoot, "p2s_desk_lamp_glow"),
      expectedAssetId: runtimeAssetId("p2s_desk_lamp_glow"),
      requiredMetadata: ["brand", "externalUrl", "description", "category", "options"],
      budget: {
        maxFileSizeBytes: 2_000_000,
        maxDrawCalls: 12,
        maxTriangleCount: 6_000
      },
      commercialMetadata: createCommercialMetadata("p2s_desk_lamp_glow"),
      contractMetadata: createCuratedContractMetadata("p2s_desk_lamp_glow", {
        maxFileSizeBytes: 2_000_000,
        maxDrawCalls: 12,
        maxTriangleCount: 6_000
      }),
      attachmentAuthoring: {
        mode: "none",
        reason: "surface placeable lamp; no mounted attachment points required for publish"
      },
      optionsHint: "light-emitter"
    },
    {
      key: "p2s_ceramic_mug",
      manifestId: "p2s_ceramic_mug_sand",
      sourcePath: sourceBlendPath(paths.repoRoot, "p2s_ceramic_mug"),
      runtimePath: runtimeAssetPath(paths.publicRoot, "p2s_ceramic_mug"),
      expectedAssetId: runtimeAssetId("p2s_ceramic_mug"),
      requiredMetadata: ["brand", "externalUrl", "description", "category", "options"],
      budget: {
        maxFileSizeBytes: 1_000_000,
        maxDrawCalls: 4,
        maxTriangleCount: 4_000
      },
      commercialMetadata: createCommercialMetadata("p2s_ceramic_mug", {
        footprintToleranceMm: 2
      }),
      contractMetadata: createCuratedContractMetadata("p2s_ceramic_mug", {
        maxFileSizeBytes: 1_000_000,
        maxDrawCalls: 4,
        maxTriangleCount: 4_000
      }),
      attachmentAuthoring: {
        mode: "none",
        reason: "decor asset; no mounted attachment points required for publish"
      }
    },
    {
      key: "p2s_book_stack_warm",
      manifestId: "p2s_book_stack_warm",
      sourcePath: sourceBlendPath(paths.repoRoot, "p2s_book_stack_warm"),
      runtimePath: runtimeAssetPath(paths.publicRoot, "p2s_book_stack_warm"),
      expectedAssetId: runtimeAssetId("p2s_book_stack_warm"),
      requiredMetadata: ["brand", "externalUrl", "description", "category", "options"],
      budget: {
        maxFileSizeBytes: 1_000_000,
        maxDrawCalls: 6,
        maxTriangleCount: 2_000
      },
      commercialMetadata: createCommercialMetadata("p2s_book_stack_warm", {
        footprintToleranceMm: 2
      }),
      contractMetadata: createCuratedContractMetadata("p2s_book_stack_warm", {
        maxFileSizeBytes: 1_000_000,
        maxDrawCalls: 6,
        maxTriangleCount: 2_000
      }),
      attachmentAuthoring: {
        mode: "none",
        reason: "decor asset; no mounted attachment points required for publish"
      }
    },
    {
      key: "p2s_desk_tray_oak",
      manifestId: "p2s_desk_tray_oak",
      sourcePath: sourceBlendPath(paths.repoRoot, "p2s_desk_tray_oak"),
      runtimePath: runtimeAssetPath(paths.publicRoot, "p2s_desk_tray_oak"),
      expectedAssetId: runtimeAssetId("p2s_desk_tray_oak"),
      requiredMetadata: ["brand", "externalUrl", "description", "category", "options"],
      budget: {
        maxFileSizeBytes: 1_000_000,
        maxDrawCalls: 8,
        maxTriangleCount: 2_000
      },
      commercialMetadata: createCommercialMetadata("p2s_desk_tray_oak", {
        supportSurfaceToleranceMm: 3,
        footprintToleranceMm: 2
      }),
      contractMetadata: createCuratedContractMetadata("p2s_desk_tray_oak", {
        maxFileSizeBytes: 1_000_000,
        maxDrawCalls: 8,
        maxTriangleCount: 2_000
      }),
      attachmentAuthoring: {
        mode: "none",
        reason: "surface placeable tray; no mounted attachment points required for publish"
      },
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
      sourcePath: sourceBlendPath(paths.repoRoot, "p2s_compact_speaker"),
      runtimePath: runtimeAssetPath(paths.publicRoot, "p2s_compact_speaker"),
      expectedAssetId: runtimeAssetId("p2s_compact_speaker"),
      requiredMetadata: ["brand", "externalUrl", "description", "category", "options"],
      budget: {
        maxFileSizeBytes: 1_000_000,
        maxDrawCalls: 8,
        maxTriangleCount: 2_000
      },
      commercialMetadata: createCommercialMetadata("p2s_compact_speaker", {
        footprintToleranceMm: 2
      }),
      contractMetadata: createCuratedContractMetadata("p2s_compact_speaker", {
        maxFileSizeBytes: 1_000_000,
        maxDrawCalls: 8,
        maxTriangleCount: 2_000
      }),
      attachmentAuthoring: {
        mode: "none",
        reason: "surface placeable speaker; no mounted attachment points required for publish"
      }
    },
    {
      key: "p2s_wireless_mouse",
      manifestId: "p2s_wireless_mouse",
      sourcePath: sourceBlendPath(paths.repoRoot, "p2s_wireless_mouse"),
      runtimePath: runtimeAssetPath(paths.publicRoot, "p2s_wireless_mouse"),
      expectedAssetId: runtimeAssetId("p2s_wireless_mouse"),
      requiredMetadata: ["brand", "externalUrl", "description", "category", "options"],
      budget: {
        maxFileSizeBytes: 1_000_000,
        maxDrawCalls: 8,
        maxTriangleCount: 4_000
      },
      commercialMetadata: createCommercialMetadata("p2s_wireless_mouse", {
        footprintToleranceMm: 2
      }),
      contractMetadata: createCuratedContractMetadata("p2s_wireless_mouse", {
        maxFileSizeBytes: 1_000_000,
        maxDrawCalls: 8,
        maxTriangleCount: 4_000
      }),
      attachmentAuthoring: {
        mode: "none",
        reason: "surface placeable mouse; no mounted attachment points required for publish"
      }
    },
    {
      key: "p2s_low_profile_keyboard",
      manifestId: "p2s_low_profile_keyboard",
      sourcePath: sourceBlendPath(paths.repoRoot, "p2s_low_profile_keyboard"),
      runtimePath: runtimeAssetPath(paths.publicRoot, "p2s_low_profile_keyboard"),
      expectedAssetId: runtimeAssetId("p2s_low_profile_keyboard"),
      requiredMetadata: ["brand", "externalUrl", "description", "category", "options"],
      budget: {
        maxFileSizeBytes: 2_000_000,
        maxDrawCalls: 80,
        maxTriangleCount: 20_000
      },
      commercialMetadata: createCommercialMetadata("p2s_low_profile_keyboard", {
        footprintToleranceMm: 2
      }),
      contractMetadata: createCuratedContractMetadata("p2s_low_profile_keyboard", {
        maxFileSizeBytes: 2_000_000,
        maxDrawCalls: 80,
        maxTriangleCount: 20_000
      }),
      attachmentAuthoring: {
        mode: "none",
        reason: "surface placeable keyboard; no mounted attachment points required for publish"
      }
    },
    {
      key: "p2s_under_desk_tray_mount",
      manifestId: "p2s_under_desk_tray_mount",
      sourcePath: sourceBlendPath(paths.repoRoot, "p2s_under_desk_tray_mount"),
      runtimePath: runtimeAssetPath(paths.publicRoot, "p2s_under_desk_tray_mount"),
      expectedAssetId: runtimeAssetId("p2s_under_desk_tray_mount"),
      requiredMetadata: ["brand", "externalUrl", "description", "category", "options"],
      budget: {
        maxFileSizeBytes: 1_000_000,
        maxDrawCalls: 24,
        maxTriangleCount: 8_000
      },
      commercialMetadata: createCommercialMetadata("p2s_under_desk_tray_mount", {
        supportSurfaceToleranceMm: 3,
        footprintToleranceMm: 2
      }),
      contractMetadata: createCuratedContractMetadata("p2s_under_desk_tray_mount", {
        maxFileSizeBytes: 1_000_000,
        maxDrawCalls: 24,
        maxTriangleCount: 8_000
      }),
      attachmentAuthoring: {
        mode: "manual_required",
        reason: "under-desk tray must publish an underside_screw attachment point for mounted focus placement",
        points: [
          {
            id: "underside-screw-rail",
            type: "underside_screw",
            localPositionMm: [0, 90, 0],
            localNormal: [0, 1000, 0],
            localTangent: [1000, 0, 0],
            compatibleWith: ["desk-underside", "desk_underside"],
            constraints: {
              minClearanceMm: 80,
              requiredThicknessMm: [18, 55],
              maxLoadKg: 8
            }
          }
        ]
      }
    },
    {
      key: "p2s_desk_planter_pilea",
      manifestId: "p2s_desk_planter_pilea",
      sourcePath: sourceBlendPath(paths.repoRoot, "p2s_desk_planter_pilea"),
      runtimePath: runtimeAssetPath(paths.publicRoot, "p2s_desk_planter_pilea"),
      expectedAssetId: runtimeAssetId("p2s_desk_planter_pilea"),
      requiredMetadata: ["brand", "externalUrl", "description", "category", "options"],
      budget: {
        maxFileSizeBytes: 2_000_000,
        maxDrawCalls: 10,
        maxTriangleCount: 6_000
      },
      commercialMetadata: createCommercialMetadata("p2s_desk_planter_pilea", {
        footprintToleranceMm: 2
      }),
      contractMetadata: createCuratedContractMetadata("p2s_desk_planter_pilea", {
        maxFileSizeBytes: 2_000_000,
        maxDrawCalls: 10,
        maxTriangleCount: 6_000
      }),
      attachmentAuthoring: {
        mode: "none",
        reason: "decor planter; no mounted attachment points required for publish"
      }
    }
  ];
}
