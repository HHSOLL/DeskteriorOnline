import {
  deserializeWorldPlacementRecord,
  isSurfacePlacementRecord,
  type PlacementRecord,
  type RuntimeAsset,
  type SceneDocumentV2,
  type SceneObjectDocument,
  type SupportSurface
} from "@deskterioronline/scene-schema";
import type { RuntimeObjectRecord, RuntimeScene, RuntimeWorldTransform } from "./types";

function cloneTransform(transform: RuntimeWorldTransform): RuntimeWorldTransform {
  return {
    position: [...transform.position] as RuntimeWorldTransform["position"],
    rotation: [...transform.rotation] as RuntimeWorldTransform["rotation"],
    scale: [...transform.scale] as RuntimeWorldTransform["scale"]
  };
}

function buildDefaultTransform(): RuntimeWorldTransform {
  return {
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1]
  };
}

function resolveSurface(
  objectDocument: SceneObjectDocument,
  runtimeAssets: Map<string, RuntimeAsset>,
  surfaceId: string
): SupportSurface | null {
  const runtimeAssetId =
    objectDocument.runtimeAssetId ?? objectDocument.catalogItemId ?? objectDocument.assetId;
  const runtimeAsset = runtimeAssets.get(runtimeAssetId) ?? runtimeAssets.get(objectDocument.assetId);
  return runtimeAsset?.supportSurfaces.find((surface) => surface.id === surfaceId) ?? null;
}

function resolveSurfaceLocalTransform(
  objectDocument: SceneObjectDocument,
  placement: Extract<PlacementRecord, { mode: "surface_local" }>,
  objectIndex: Map<string, RuntimeObjectRecord>,
  runtimeAssets: Map<string, RuntimeAsset>
): RuntimeWorldTransform {
  const supportObject = objectIndex.get(placement.supportObjectId);
  if (!supportObject) {
    return buildDefaultTransform();
  }

  const supportTransform = supportObject.previewTransform ?? supportObject.transform;
  const supportSurface = resolveSurface(supportObject.objectDocument, runtimeAssets, placement.surfaceId);
  if (!supportSurface) {
    return cloneTransform(supportTransform);
  }

  const frame = supportSurface.localFrame;
  const u = placement.localPose.uMm / 1000;
  const v = placement.localPose.vMm / 1000;
  const normalOffset = placement.localPose.normalOffsetMm / 1000;
  const position = [
    supportTransform.position[0] + frame.originMm[0] / 1000 + frame.tangentU[0] / 1000 * u + frame.tangentV[0] / 1000 * v + frame.normal[0] / 1000 * normalOffset,
    supportTransform.position[1] + frame.originMm[1] / 1000 + frame.tangentU[1] / 1000 * u + frame.tangentV[1] / 1000 * v + frame.normal[1] / 1000 * normalOffset,
    supportTransform.position[2] + frame.originMm[2] / 1000 + frame.tangentU[2] / 1000 * u + frame.tangentV[2] / 1000 * v + frame.normal[2] / 1000 * normalOffset
  ] as RuntimeWorldTransform["position"];

  return {
    position,
    rotation: [
      supportTransform.rotation[0],
      supportTransform.rotation[1] + (placement.localPose.rotationMilliDeg * Math.PI) / 180000,
      supportTransform.rotation[2]
    ],
    scale: [
      placement.scalePermille[0] / 1000,
      placement.scalePermille[1] / 1000,
      placement.scalePermille[2] / 1000
    ]
  };
}

export class SceneCompiler {
  private generation = 0;

  static resolvePlacementTransform(
    objectDocument: SceneObjectDocument,
    placement: PlacementRecord,
    objectIndex: Map<string, RuntimeObjectRecord>,
    runtimeAssets: Map<string, RuntimeAsset>
  ) {
    if (isSurfacePlacementRecord(placement)) {
      return resolveSurfaceLocalTransform(objectDocument, placement, objectIndex, runtimeAssets);
    }

    return deserializeWorldPlacementRecord(placement);
  }

  compile(document: SceneDocumentV2, runtimeAssets: Iterable<RuntimeAsset> = []): RuntimeScene {
    this.generation += 1;
    const runtimeAssetMap = new Map(Array.from(runtimeAssets).map((asset) => [asset.assetId, asset]));
    const objectRegistry = new Map<string, RuntimeObjectRecord>();

    for (const objectDocument of document.objects) {
      const transform = SceneCompiler.resolvePlacementTransform(
        objectDocument,
        objectDocument.placement,
        objectRegistry,
        runtimeAssetMap
      );

      objectRegistry.set(objectDocument.id, {
        id: objectDocument.id,
        assetId: objectDocument.assetId,
        runtimeAssetId:
          objectDocument.runtimeAssetId ?? objectDocument.catalogItemId ?? objectDocument.assetId,
        objectDocument,
        placement: objectDocument.placement,
        transform,
        previewTransform: null,
        transformRevision: 0
      });
    }

    return {
      id: document.id,
      units: "mm",
      generation: this.generation,
      sourceDocument: document,
      room: document.room,
      runtimeAssets: runtimeAssetMap,
      objectRegistry,
      dirtyObjectIds: new Set(),
      selectionState: {
        selectedObjectId: null
      },
      hoverState: {
        hoveredObjectId: null
      }
    };
  }
}
