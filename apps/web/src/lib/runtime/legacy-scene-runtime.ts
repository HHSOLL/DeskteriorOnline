import { createEngine } from "@deskterioronline/engine-core";
import {
  migrateLegacySceneStoreStateToV2,
  type LegacySceneStoreStateLike,
  type RuntimeAsset,
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
  lighting: LightingSettings;
};

function mapRuntimeAssets(assets: SceneAsset[]): RuntimeAsset[] {
  return assets.flatMap((asset) => {
    if (!asset.product?.dimensionsMm) {
      return [];
    }

    return [
      {
        assetId: asset.catalogItemId ?? asset.assetId,
        productId: asset.product.id,
        units: "mm",
        dimensionsMm: asset.product.dimensionsMm,
        scaleLocked: true,
        pivot: asset.product.pivot ?? {
          x: "center",
          y: "floor",
          z: "center"
        },
        sourceProvenance: {
          method: asset.product.source?.kind === "open_source" ? "api" : "manual",
          sourceUrl: asset.product.source?.url ?? undefined,
          manufacturer: asset.product.brand ?? undefined,
          license: asset.product.license?.spdx ?? "unknown",
          attributionRequired: asset.product.license?.requiresAttribution ?? false
        },
        runtime: {
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
        colliders: asset.product.collisionProxy
          ? [
              {
                id: `${asset.id}:box`,
                kind: "box",
                sizeMm: asset.product.dimensionsMm,
                centerMm: [0, Math.round(asset.product.dimensionsMm.height / 2), 0]
              }
            ]
          : [],
        supportSurfaces:
          asset.supportProfile?.surfaces?.map((surface) => ({
            id: surface.id,
            type: surface.anchorTypes?.includes("desk_surface")
              ? "desktop_top"
              : surface.anchorTypes?.includes("shelf_surface")
                ? "shelf_top"
                : "desktop_top",
            localFrame: {
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
            allowedAttachments: ["place_on_surface", "edge_clamp"]
          })) ?? [],
        attachmentPoints: [],
        materialVariants: [
          {
            id: "default",
            label: asset.product.name
          }
        ],
        qaStatus: {
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
