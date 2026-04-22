import type { CollisionReport, PlacementCandidate } from "./types";

export class CollisionValidator {
  validate(_candidate: PlacementCandidate): CollisionReport {
    return {
      collided: false,
      collisions: []
    };
  }
}
