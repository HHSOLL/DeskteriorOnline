import path from "node:path";
import type { AssetCompilerPaths, CuratedDeskteriorAsset } from "./types";

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

export function getCuratedDeskteriorAssets(paths: AssetCompilerPaths): CuratedDeskteriorAsset[] {
  return [
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
