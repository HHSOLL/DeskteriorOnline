import type { Engine, RuntimeObjectRecord } from "@deskterioronline/engine-core";
import { isSurfacePlacementRecord, type RuntimeAsset, type SupportSurface } from "@deskterioronline/scene-schema";
import { AttachmentGraph, type AttachmentGraphSnapshot } from "./AttachmentGraph";
import { rectsOverlap, resolveLocalFootprintBounds } from "./footprint";
import type { CollisionReport, PlacementCandidate } from "./types";

function usesSurfaceFootprintCollision(attachmentType: PlacementCandidate["attachmentType"]) {
  return (
    attachmentType === "place_on_surface" ||
    attachmentType === "underside_screw" ||
    attachmentType === "grommet_hole" ||
    attachmentType === "wall_screw" ||
    attachmentType === "wall_attach" ||
    attachmentType === "adhesive_patch" ||
    attachmentType === "magnetic_attach" ||
    attachmentType === "peg_slot"
  );
}

export class CollisionValidator {
  private readonly attachmentGraph = new AttachmentGraph();

  constructor(private readonly engine: Engine) {}

  private resolveRuntimeAsset(runtimeObject: RuntimeObjectRecord) {
    const runtimeAssetId = runtimeObject.runtimeAssetId ?? runtimeObject.assetId;
    return this.engine.runtimeScene.runtimeAssets.get(runtimeAssetId) ?? null;
  }

  private resolveSiblingObjects(
    snapshot: AttachmentGraphSnapshot,
    candidate: PlacementCandidate
  ) {
    return this.attachmentGraph
      .getSiblings(snapshot, candidate.supportObjectId, candidate.objectId)
      .map((objectId) => this.engine.runtimeScene.objectRegistry.get(objectId))
      .filter((runtimeObject): runtimeObject is RuntimeObjectRecord => {
        if (!runtimeObject?.visible) {
          return false;
        }
        return (
          isSurfacePlacementRecord(runtimeObject.placement) &&
          runtimeObject.placement.supportObjectId === candidate.supportObjectId &&
          runtimeObject.placement.surfaceId === candidate.surfaceId
        );
      });
  }

  validate(
    candidate: PlacementCandidate,
    surface?: SupportSurface | null,
    snapshot = this.attachmentGraph.build(this.engine.runtimeScene)
  ): CollisionReport {
    const candidateObject = this.engine.runtimeScene.objectRegistry.get(candidate.objectId);
    const candidateRuntimeAsset = candidateObject ? this.resolveRuntimeAsset(candidateObject) : null;
    if (!candidateObject || !candidateRuntimeAsset || !surface) {
      return {
        collided: false,
        collisions: []
      };
    }

    const candidateBounds = resolveLocalFootprintBounds(
      candidate.localPose,
      candidateRuntimeAsset.dimensionsMm,
      surface.type
    );
    const collisions: CollisionReport["collisions"] = [];

    if (!usesSurfaceFootprintCollision(candidate.attachmentType)) {
      return {
        collided: false,
        collisions
      };
    }

    for (const sibling of this.resolveSiblingObjects(snapshot, candidate)) {
      const siblingRuntimeAsset = this.resolveRuntimeAsset(sibling);
      if (!siblingRuntimeAsset || !isSurfacePlacementRecord(sibling.placement)) {
        continue;
      }
      if (!usesSurfaceFootprintCollision(sibling.placement.attachmentType)) {
        continue;
      }

      const siblingBounds = resolveLocalFootprintBounds(
        sibling.placement.localPose,
        siblingRuntimeAsset.dimensionsMm,
        surface.type
      );

      if (!rectsOverlap(candidateBounds, siblingBounds)) {
        continue;
      }

      collisions.push({
        code: "SAME_SURFACE_OVERLAP",
        objectId: sibling.id,
        reason: `Placement footprint overlaps with ${sibling.id} on the same support surface.`
      });
    }

    return {
      collided: collisions.length > 0,
      collisions
    };
  }
}
