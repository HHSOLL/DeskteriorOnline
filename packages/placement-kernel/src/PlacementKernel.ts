import type { Engine } from "@deskterioronline/engine-core";
import type { AttachmentType } from "@deskterioronline/scene-schema";
import { RayPicker, type RayPickerGeometryCandidate } from "./RayPicker";
import { PlacementTransaction } from "./PlacementTransaction";
import { SurfaceResolver } from "./SurfaceResolver";
import type { SurfaceHit } from "./types";

export class PlacementKernel {
  private readonly surfaceResolver: SurfaceResolver;
  private readonly rayPicker: RayPicker;

  constructor(private readonly engine: Engine) {
    this.surfaceResolver = new SurfaceResolver(engine);
    this.rayPicker = new RayPicker(this.surfaceResolver);
  }

  private resolveCompatibleWith(objectId: string, attachmentType: AttachmentType) {
    const runtimeObject = this.engine.runtimeScene.objectRegistry.get(objectId);
    if (!runtimeObject) {
      return null;
    }

    const runtimeAssetId = runtimeObject.runtimeAssetId ?? runtimeObject.assetId;
    const runtimeAsset = this.engine.runtimeScene.runtimeAssets.get(runtimeAssetId);
    if (!runtimeAsset) {
      return null;
    }

    const compatibleWith = runtimeAsset.attachmentPoints
      .filter((point) => point.type === attachmentType)
      .flatMap((point) => point.compatibleWith);

    return compatibleWith.length > 0 ? compatibleWith : null;
  }

  begin(input: {
    objectId: string;
    supportObjectId: string;
    surfaceId?: string;
    preferredSurfaceId?: string;
    surfaceHits?: SurfaceHit[];
    geometryPick?: {
      ray: {
        origin: [number, number, number];
        direction: [number, number, number];
        near?: number;
        far?: number;
      };
      candidates: RayPickerGeometryCandidate[];
    };
    attachmentType:
      | "place_on_surface"
      | "wall_attach"
      | "edge_clamp"
      | "underside_screw"
      | "vesa_mount"
      | "cable_route";
  }) {
    const compatibleWith = this.resolveCompatibleWith(input.objectId, input.attachmentType);
    const surfaceHit = input.surfaceId
      ? this.surfaceResolver.resolve(input.supportObjectId, input.surfaceId)
      : input.geometryPick
        ? this.rayPicker.pickGeometry({
            supportObjectId: input.supportObjectId,
            attachmentType: input.attachmentType,
            preferredSurfaceId: input.preferredSurfaceId,
            compatibleWith: compatibleWith ?? undefined,
            ray: input.geometryPick.ray,
            candidates: input.geometryPick.candidates
          })
        : this.rayPicker.pick({
          supportObjectId: input.supportObjectId,
          attachmentType: input.attachmentType,
          preferredSurfaceId: input.preferredSurfaceId,
          compatibleWith: compatibleWith ?? undefined,
          surfaceHits: input.surfaceHits
        });
    if (!surfaceHit) {
      throw new Error(
        `No compatible surface was found on ${input.supportObjectId} for ${input.attachmentType}.`
      );
    }

    const transaction = new PlacementTransaction(this.engine, input.objectId);
    transaction.begin({
      supportObjectId: input.supportObjectId,
      surfaceId: surfaceHit.surfaceId,
      attachmentType: input.attachmentType,
      initialLocalPose: surfaceHit.localPose
    });
    return transaction;
  }
}
