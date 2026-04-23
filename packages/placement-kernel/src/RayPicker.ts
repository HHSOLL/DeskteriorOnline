import type { AttachmentType } from "@deskterioronline/scene-schema";
import type { SurfaceResolver } from "./SurfaceResolver";
import type { SurfaceHit } from "./types";

export type RayPickerInput = {
  supportObjectId: string;
  attachmentType: AttachmentType;
  preferredSurfaceId?: string;
  compatibleWith?: string[];
  surfaceHits?: SurfaceHit[];
};

export class RayPicker {
  constructor(private readonly surfaceResolver: SurfaceResolver) {}

  pick(input: RayPickerInput): SurfaceHit | null {
    return this.surfaceResolver.resolveCompatibleSurface(
      input.supportObjectId,
      input.attachmentType,
      input.preferredSurfaceId,
      input.compatibleWith,
      input.surfaceHits
    );
  }
}
