import type { Engine } from "@deskterioronline/engine-core";
import {
  type PlacementRecord,
  type SurfacePlacementRecord,
  serializeWorldTransform
} from "@deskterioronline/scene-schema";
import type { CollisionReport, ConstraintReport, PlacementCandidate } from "./types";
import { CollisionValidator } from "./CollisionValidator";
import { ConstraintSolver } from "./ConstraintSolver";
import { SurfaceResolver } from "./SurfaceResolver";

export type PlacementTransactionState = {
  activeCandidate: PlacementCandidate | null;
  constraintReport: ConstraintReport | null;
  collisionReport: CollisionReport | null;
};

export class PlacementTransaction {
  private readonly surfaceResolver: SurfaceResolver;
  private readonly constraintSolver = new ConstraintSolver();
  private readonly collisionValidator = new CollisionValidator();
  private activeCandidate: PlacementCandidate | null = null;
  private constraintReport: ConstraintReport | null = null;
  private collisionReport: CollisionReport | null = null;

  constructor(private readonly engine: Engine, private readonly objectId: string) {
    this.surfaceResolver = new SurfaceResolver(engine);
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

    this.activeCandidate = {
      ...this.activeCandidate,
      localPose
    };

    this.constraintReport = this.constraintSolver.evaluate(this.activeCandidate);
    this.collisionReport = this.collisionValidator.validate(this.activeCandidate);
    return this.getState();
  }

  commit() {
    if (!this.activeCandidate) {
      throw new Error("Placement transaction has not started.");
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
    this.constraintReport = null;
    this.collisionReport = null;
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
}
