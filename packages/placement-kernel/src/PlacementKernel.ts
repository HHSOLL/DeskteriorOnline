import type { Engine } from "@deskterioronline/engine-core";
import { PlacementTransaction } from "./PlacementTransaction";

export class PlacementKernel {
  constructor(private readonly engine: Engine) {}

  begin(input: {
    objectId: string;
    supportObjectId: string;
    surfaceId: string;
    attachmentType: "place_on_surface" | "wall_attach" | "edge_clamp" | "underside_screw";
  }) {
    const transaction = new PlacementTransaction(this.engine, input.objectId);
    transaction.begin(input);
    return transaction;
  }
}
