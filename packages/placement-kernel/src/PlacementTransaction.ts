import { SceneCompiler, type Engine } from "@deskterioronline/engine-core";
import {
  type PlacementRecord,
  type RuntimeAsset,
  type SurfacePlacementRecord,
  isSurfacePlacementRecord,
  serializeWorldTransform
} from "@deskterioronline/scene-schema";
import { AttachmentGraph, type AttachmentGraphSnapshot } from "./AttachmentGraph";
import type { CollisionReport, ConstraintReport, PlacementCandidate, SurfaceHit } from "./types";
import { CollisionValidator } from "./CollisionValidator";
import { ConstraintSolver } from "./ConstraintSolver";
import { SnapCandidateGenerator } from "./SnapCandidateGenerator";
import { SurfaceResolver } from "./SurfaceResolver";

export type PlacementTransactionState = {
  activeCandidate: PlacementCandidate | null;
  constraintReport: ConstraintReport | null;
  collisionReport: CollisionReport | null;
};

export class PlacementTransaction {
  private readonly surfaceResolver: SurfaceResolver;
  private readonly attachmentGraph = new AttachmentGraph();
  private readonly constraintSolver = new ConstraintSolver();
  private readonly snapCandidateGenerator = new SnapCandidateGenerator();
  private readonly collisionValidator: CollisionValidator;
  private surfaceHit: SurfaceHit | null = null;
  private activeCandidate: PlacementCandidate | null = null;
  private constraintReport: ConstraintReport | null = null;
  private collisionReport: CollisionReport | null = null;
  private attachmentSnapshot: AttachmentGraphSnapshot | null = null;

  constructor(private readonly engine: Engine, private readonly objectId: string) {
    this.surfaceResolver = new SurfaceResolver(engine);
    this.collisionValidator = new CollisionValidator(engine);
  }

  begin(input: {
    supportObjectId: string;
    surfaceId: string;
    attachmentType: SurfacePlacementRecord["attachmentType"];
  }) {
    const surfaceHit = this.surfaceResolver.resolve(input.supportObjectId, input.surfaceId);
    if (!surfaceHit) {
      throw new Error(`Surface ${input.surfaceId} on ${input.supportObjectId} was not found.`);
    }
    this.surfaceHit = surfaceHit;
    this.attachmentSnapshot = this.attachmentGraph.build(this.engine.runtimeScene);
    this.engine.beginObjectPreview(this.objectId);

    this.activeCandidate = {
      objectId: this.objectId,
      supportObjectId: input.supportObjectId,
      surfaceId: input.surfaceId,
      attachmentType: input.attachmentType,
      localPose: {
        uMm: 0,
        vMm: 0,
        normalOffsetMm: 0,
        rotationMilliDeg: 0
      }
    };

    return this.getState();
  }

  update(localPose: PlacementCandidate["localPose"]) {
    if (!this.activeCandidate) {
      throw new Error("Placement transaction has not started.");
    }

    const snappedLocalPose = this.snapCandidateGenerator.snapLocalPose(
      localPose,
      this.activeCandidate.attachmentType,
      this.surfaceHit?.surface ?? null
    );

    this.activeCandidate = {
      ...this.activeCandidate,
      localPose: snappedLocalPose
    };

    const runtimeAsset = this.resolveActiveRuntimeAsset();
    this.constraintReport = this.constraintSolver.evaluate(
      this.activeCandidate,
      this.surfaceHit?.surface ?? null,
      runtimeAsset
    );
    this.collisionReport = this.collisionValidator.validate(
      this.activeCandidate,
      this.surfaceHit?.surface ?? null,
      this.attachmentSnapshot ?? undefined
    );
    const previewTransform = this.resolvePreviewTransform();
    if (previewTransform) {
      this.engine.previewObjectTransform(this.objectId, previewTransform);
    }
    return this.getState();
  }

  commit() {
    if (!this.activeCandidate) {
      throw new Error("Placement transaction has not started.");
    }
    if (!this.constraintReport || !this.collisionReport) {
      throw new Error("Placement candidate must be evaluated before commit.");
    }
    if (this.constraintReport && !this.constraintReport.valid) {
      throw new Error("Placement candidate is invalid.");
    }
    if (this.collisionReport?.collided) {
      throw new Error("Placement candidate is colliding.");
    }

    const runtimeObject = this.engine.runtimeScene.objectRegistry.get(this.objectId);
    if (!runtimeObject) {
      throw new Error(`Object ${this.objectId} was not found.`);
    }

    const nextPlacement: PlacementRecord = {
      mode: "surface_local",
      supportObjectId: this.activeCandidate.supportObjectId,
      surfaceId: this.activeCandidate.surfaceId,
      attachmentType: this.activeCandidate.attachmentType,
      localPose: this.activeCandidate.localPose,
      scalePermille: runtimeObject.placement.mode === "world"
        ? runtimeObject.placement.world.scalePermille
        : runtimeObject.placement.scalePermille
    };

    this.engine.setObjectPlacement(
      this.objectId,
      nextPlacement,
      runtimeObject.previewTransform ?? runtimeObject.transform
    );
    return nextPlacement;
  }

  cancel() {
    this.activeCandidate = null;
    this.surfaceHit = null;
    this.constraintReport = null;
    this.collisionReport = null;
    this.attachmentSnapshot = null;
    this.engine.cancelObjectPreview(this.objectId);
  }

  previewWorldTransform() {
    const runtimeObject = this.engine.runtimeScene.objectRegistry.get(this.objectId);
    if (!runtimeObject) {
      return null;
    }

    return serializeWorldTransform(runtimeObject.previewTransform ?? runtimeObject.transform);
  }

  getState(): PlacementTransactionState {
    return {
      activeCandidate: this.activeCandidate,
      constraintReport: this.constraintReport,
      collisionReport: this.collisionReport
    };
  }

  private resolveActiveRuntimeAsset(): RuntimeAsset | null {
    const runtimeObject = this.engine.runtimeScene.objectRegistry.get(this.objectId);
    if (!runtimeObject) {
      return null;
    }

    const runtimeAssetId = runtimeObject.runtimeAssetId ?? runtimeObject.assetId;
    return this.engine.runtimeScene.runtimeAssets.get(runtimeAssetId) ?? null;
  }

  private resolvePreviewTransform() {
    if (!this.activeCandidate) {
      return null;
    }

    const runtimeObject = this.engine.runtimeScene.objectRegistry.get(this.objectId);
    if (!runtimeObject) {
      return null;
    }

    const scalePermille = isSurfacePlacementRecord(runtimeObject.placement)
      ? runtimeObject.placement.scalePermille
      : runtimeObject.placement.world.scalePermille;
    const previewPlacement: PlacementRecord = {
      mode: "surface_local",
      supportObjectId: this.activeCandidate.supportObjectId,
      surfaceId: this.activeCandidate.surfaceId,
      attachmentType: this.activeCandidate.attachmentType,
      localPose: this.activeCandidate.localPose,
      scalePermille
    };

    return SceneCompiler.resolvePlacementTransform(
      runtimeObject.objectDocument,
      previewPlacement,
      this.engine.runtimeScene.objectRegistry,
      this.engine.runtimeScene.runtimeAssets
    );
  }
}
