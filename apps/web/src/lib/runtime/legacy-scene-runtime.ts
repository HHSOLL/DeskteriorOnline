import { createEngine } from "@deskterioronline/engine-core";
import {
  migrateLegacySceneStoreStateToV2,
  type AttachmentPoint,
  type LegacySceneStoreStateLike,
  type RuntimeAsset,
  type SupportSurface,
  type SceneDocumentV2
} from "@deskterioronline/scene-schema";
import type {
  CameraAnchor,
  Ceiling,
  Floor,
  LightingSettings,
  NavGraph,
  Opening,
  RoomZone,
  ScaleInfo,
  SceneAsset,
  Wall
} from "../stores/useSceneStore";
import { resolvePublishedRuntimeAsset } from "./catalog-runtime-packages";

export type SceneStoreRuntimeInput = {
  scale: number;
  scaleInfo: ScaleInfo;
  walls: Wall[];
  openings: Opening[];
  floors: Floor[];
  ceilings: Ceiling[];
  rooms: RoomZone[];
  cameraAnchors: CameraAnchor[];
  navGraph: NavGraph;
  assets: SceneAsset[];
  wallMaterialIndex: number;
  floorMaterialIndex: number;
  ceilingMaterialIndex: number;
  lighting: LightingSettings;
};

function mapRuntimeAssets(assets: SceneAsset[]): RuntimeAsset[] {
  return assets.flatMap((asset) => {
    if (!asset.product?.dimensionsMm) {
      return [];
    }

    const publishedRuntimeAsset = resolvePublishedRuntimeAsset({
      catalogItemId: asset.catalogItemId,
      assetId: asset.assetId
    });
    const runtimeAssetId = asset.catalogItemId ?? asset.assetId;
    const inferredAttachmentPoints = inferCatalogAttachmentPoints(asset);
    const inferredSupportSurfaces = inferCatalogSupportSurfaces(asset);
    const publishedSupportSurfaces = publishedRuntimeAsset?.supportSurfaces ?? [];
    const publishedAttachmentPoints = publishedRuntimeAsset?.attachmentPoints ?? [];
    const authoredSupportSurfaces = inferredSupportSurfaces.length > 0
      ? [...publishedSupportSurfaces, ...inferredSupportSurfaces]
      : publishedSupportSurfaces;
    const authoredAttachmentPoints =
      publishedAttachmentPoints.length > 0
        ? publishedAttachmentPoints
        : inferredAttachmentPoints;

    return [
      {
        ...(publishedRuntimeAsset ?? {}),
        assetId: runtimeAssetId,
        productId: asset.product.id,
        units: "mm",
        dimensionsMm: asset.product.dimensionsMm,
        scaleLocked: true,
        pivot: publishedRuntimeAsset?.pivot ?? asset.product.pivot ?? {
          x: "center",
          y: "floor",
          z: "center"
        },
        sourceProvenance: publishedRuntimeAsset?.sourceProvenance ?? {
          method: asset.product.source?.kind === "open_source" ? "api" : "manual",
          sourceUrl: asset.product.source?.url ?? undefined,
          manufacturer: asset.product.brand ?? undefined,
          license: asset.product.license?.spdx ?? "unknown",
          attributionRequired: asset.product.license?.requiresAttribution ?? false
        },
        runtime: publishedRuntimeAsset?.runtime ?? {
          lods: asset.product.lodProfile
            ? [
                {
                  id: "lod0",
                  level: 0,
                  model: `${asset.assetId}.glb`,
                  triangleCount: asset.product.lodProfile.maxTriangleCount,
                  drawCallBudget: asset.product.lodProfile.maxDrawCalls
                }
              ]
            : [],
          proxy: `${asset.assetId}.proxy.glb`,
          defaultLod: 0,
          triangleBudget: asset.product.lodProfile?.maxTriangleCount ?? 0,
          textureBudgetMb: asset.product.textureSet?.ktx2Ready ? 24 : 48
        },
        colliders: publishedRuntimeAsset?.colliders ?? (asset.product.collisionProxy
          ? [
              {
                id: `${asset.id}:box`,
                kind: "box",
                sizeMm: asset.product.dimensionsMm,
                centerMm: [0, Math.round(asset.product.dimensionsMm.height / 2), 0]
              }
            ]
          : []),
        supportSurfaces:
          authoredSupportSurfaces.length > 0
            ? authoredSupportSurfaces
            : asset.supportProfile?.surfaces?.map((surface) => ({
            id: surface.id,
            type:
              surface.surfaceType ??
              (surface.anchorTypes?.includes("desk_surface")
                ? "desktop_top"
                : surface.anchorTypes?.includes("shelf_surface")
                  ? "shelf_top"
                  : "desktop_top"),
            localFrame:
              surface.localFrame ?? {
                originMm: [
                  Math.round(surface.center[0] * 1000),
                  Math.round(surface.top * 1000),
                  Math.round(surface.center[1] * 1000)
                ],
                tangentU: [1, 0, 0],
                tangentV: [0, 0, 1],
                normal: [0, 1, 0]
              },
            boundsMm: {
              min: [
                Math.round((surface.center[0] - surface.size[0] / 2 + surface.margin[0]) * 1000),
                Math.round((surface.center[1] - surface.size[1] / 2 + surface.margin[1]) * 1000)
              ],
              max: [
                Math.round((surface.center[0] + surface.size[0] / 2 - surface.margin[0]) * 1000),
                Math.round((surface.center[1] + surface.size[1] / 2 - surface.margin[1]) * 1000)
              ]
            },
            ...(typeof surface.thicknessMm === "number" ? { thicknessMm: surface.thicknessMm } : {}),
            allowedAttachments: surface.allowedAttachments ?? ["place_on_surface", "edge_clamp"]
          })) ?? [],
        attachmentPoints: authoredAttachmentPoints,
        materialVariants: publishedRuntimeAsset?.materialVariants ?? [
          {
            id: "default",
            label: asset.product.name
          }
        ],
        qaStatus: publishedRuntimeAsset?.qaStatus ?? {
          status: "passed",
          measuredBoundsMm: asset.product.dimensionsMm,
          dimensionErrorMm: {
            width: 0,
            depth: 0,
            height: 0
          },
          validatorVersion: "runtime-bridge-alpha"
        }
      }
    ];
  });
}

function getAssetHaystack(asset: SceneAsset) {
  return [
    asset.catalogItemId ?? "",
    asset.assetId,
    asset.product?.name ?? "",
    asset.product?.category ?? "",
    asset.product?.detailNotes ?? "",
    asset.product?.finishMaterial ?? ""
  ].join(" ").toLowerCase();
}

function isMonitorArmAsset(asset: SceneAsset) {
  const haystack = getAssetHaystack(asset);
  return haystack.includes("monitor arm") || haystack.includes("monitor_arm") || haystack.includes("모니터암");
}

function isMonitorAsset(asset: SceneAsset) {
  const haystack = getAssetHaystack(asset);
  return (haystack.includes("monitor") || haystack.includes("모니터")) && !isMonitorArmAsset(asset);
}

function isDeskEdgeAttachmentAsset(asset: SceneAsset) {
  const haystack = getAssetHaystack(asset);
  return haystack.includes("edge") || haystack.includes("clamp") || haystack.includes("clip") || haystack.includes("클램프");
}

function isUnderDeskAttachmentAsset(asset: SceneAsset) {
  const haystack = getAssetHaystack(asset);
  return haystack.includes("under desk") || haystack.includes("under-desk") || haystack.includes("underside") || haystack.includes("언더데스크");
}

function inferCatalogAttachmentPoints(asset: SceneAsset): AttachmentPoint[] {
  if (isMonitorAsset(asset)) {
    return [
      {
        id: "monitor-vesa-100",
        type: "vesa_mount",
        localPositionMm: [0, Math.round((asset.product?.dimensionsMm?.height ?? 320) * 0.54), -24],
        localNormal: [0, 0, -1000],
        localTangent: [1000, 0, 0],
        compatibleWith: ["monitor_back", "vesa_plate"],
        constraints: {
          vesaPatternMm: [100, 100],
          minClearanceMm: 40,
          maxLoadKg: 9
        }
      }
    ];
  }

  if (isMonitorArmAsset(asset)) {
    return [
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
        localPositionMm: [0, 260, 420],
        localNormal: [0, 0, 1000],
        localTangent: [1000, 0, 0],
        compatibleWith: ["monitor_back"],
        constraints: {
          vesaPatternMm: [100, 100],
          maxLoadKg: 9
        }
      }
    ];
  }

  if (isUnderDeskAttachmentAsset(asset)) {
    return [
      {
        id: "underside-screw-rail",
        type: "underside_screw",
        localPositionMm: [0, asset.product?.dimensionsMm?.height ?? 80, 0],
        localNormal: [0, 1000, 0],
        localTangent: [1000, 0, 0],
        compatibleWith: ["desk-underside", "desk_underside"],
        constraints: {
          requiredThicknessMm: [18, 55],
          minClearanceMm: 80,
          maxLoadKg: 8
        }
      }
    ];
  }

  if (isDeskEdgeAttachmentAsset(asset)) {
    return [
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
    ];
  }

  return [];
}

function inferCatalogSupportSurfaces(asset: SceneAsset): SupportSurface[] {
  if (isMonitorAsset(asset)) {
    const width = asset.product?.dimensionsMm?.width ?? 610;
    const height = asset.product?.dimensionsMm?.height ?? 360;
    return [
      {
        id: "monitor-back",
        type: "monitor_back",
        localFrame: {
          originMm: [0, Math.round(height * 0.54), -28],
          tangentU: [1000, 0, 0],
          tangentV: [0, 1000, 0],
          normal: [0, 0, -1000]
        },
        boundsMm: {
          min: [Math.round(width * -0.3), Math.round(height * -0.18)],
          max: [Math.round(width * 0.3), Math.round(height * 0.18)]
        },
        allowedAttachments: ["vesa_mount"],
        preferredZones: [
          {
            min: [-70, -70],
            max: [70, 70]
          }
        ]
      }
    ];
  }

  if (isMonitorArmAsset(asset)) {
    const height = asset.product?.dimensionsMm?.height ?? 440;
    return [
      {
        id: "vesa-plate",
        type: "monitor_back",
        localFrame: {
          originMm: [0, Math.round(height * 0.68), 360],
          tangentU: [1000, 0, 0],
          tangentV: [0, 1000, 0],
          normal: [0, 0, 1000]
        },
        boundsMm: {
          min: [-120, -120],
          max: [120, 120]
        },
        allowedAttachments: ["vesa_mount"],
        loadCapacityKg: 9
      }
    ];
  }

  return [];
}

export function buildSceneDocumentV2FromStore(input: SceneStoreRuntimeInput): SceneDocumentV2 {
  const storeLike: LegacySceneStoreStateLike = {
    scale: input.scale,
    scaleInfo: input.scaleInfo,
    walls: input.walls,
    openings: input.openings,
    floors: input.floors,
    ceilings: input.ceilings,
    rooms: input.rooms,
    cameraAnchors: input.cameraAnchors,
    navGraph: input.navGraph,
    assets: input.assets,
    wallMaterialIndex: input.wallMaterialIndex,
    floorMaterialIndex: input.floorMaterialIndex,
    ceilingMaterialIndex: input.ceilingMaterialIndex,
    lighting: input.lighting
  };

  return migrateLegacySceneStoreStateToV2(storeLike, {
    id: "editor-runtime-bridge",
    version: 2
  });
}

export function buildRuntimeAssetsFromStore(input: SceneStoreRuntimeInput) {
  return mapRuntimeAssets(input.assets);
}

export function createEditorRuntimeEngine(input: SceneStoreRuntimeInput) {
  const document = buildSceneDocumentV2FromStore(input);
  const runtimeAssets = buildRuntimeAssetsFromStore(input);
  return createEngine(document, runtimeAssets);
}
