import type { Engine } from "@deskterioronline/engine-core";
import type { AttachmentType, SupportSurface } from "@deskterioronline/scene-schema";
import type { SurfaceHit } from "./types";

export class SurfaceResolver {
  constructor(private readonly engine: Engine) {}

  private matchesCompatibility(surface: SupportSurface, compatibleWith?: string[] | null) {
    if (!compatibleWith || compatibleWith.length === 0) {
      return true;
    }

    return compatibleWith.includes(surface.id) || compatibleWith.includes(surface.type);
  }

  getObjectSurfaces(objectId: string): SupportSurface[] {
    const runtimeObject = this.engine.runtimeScene.objectRegistry.get(objectId);
    if (!runtimeObject?.runtimeAssetId) {
      return [];
    }

    return this.engine.runtimeScene.runtimeAssets.get(runtimeObject.runtimeAssetId)?.supportSurfaces ?? [];
  }

  listCompatibleSurfaces(
    objectId: string,
    attachmentType: AttachmentType,
    compatibleWith?: string[] | null
  ) {
    return this.getObjectSurfaces(objectId).filter((surface) =>
      surface.allowedAttachments.includes(attachmentType) &&
      this.matchesCompatibility(surface, compatibleWith)
    );
  }

  resolve(objectId: string, surfaceId: string): SurfaceHit | null {
    const supportObject = this.engine.runtimeScene.objectRegistry.get(objectId);
    const surface = this.getObjectSurfaces(objectId).find((candidate) => candidate.id === surfaceId);
    if (!surface) {
      return null;
    }

    const surfaceOriginMeters = supportObject
      ? [
          supportObject.transform.position[0] + surface.localFrame.originMm[0] / 1000,
          supportObject.transform.position[1] + surface.localFrame.originMm[1] / 1000,
          supportObject.transform.position[2] + surface.localFrame.originMm[2] / 1000
        ]
      : [0, 0, 0];
    const dx = surfaceOriginMeters[0] - (supportObject?.transform.position[0] ?? 0);
    const dy = surfaceOriginMeters[1] - (supportObject?.transform.position[1] ?? 0);
    const dz = surfaceOriginMeters[2] - (supportObject?.transform.position[2] ?? 0);

    return {
      objectId,
      surfaceId,
      surface,
      distance: Math.sqrt(dx * dx + dy * dy + dz * dz)
    };
  }

  resolveCompatibleSurface(
    objectId: string,
    attachmentType: AttachmentType,
    preferredSurfaceId?: string | null,
    compatibleWith?: string[] | null,
    candidateHits?: SurfaceHit[] | null
  ): SurfaceHit | null {
    if (preferredSurfaceId) {
      const preferred = this.resolve(objectId, preferredSurfaceId);
      if (
        preferred?.surface.allowedAttachments.includes(attachmentType) &&
        this.matchesCompatibility(preferred.surface, compatibleWith)
      ) {
        return preferred;
      }
    }

    const rankedCandidateHits = (candidateHits ?? [])
      .filter((hit) => hit.objectId === objectId)
      .filter((hit) => hit.surface.allowedAttachments.includes(attachmentType))
      .filter((hit) => this.matchesCompatibility(hit.surface, compatibleWith))
      .sort((left, right) => left.distance - right.distance);
    if (rankedCandidateHits.length > 0) {
      return rankedCandidateHits[0] ?? null;
    }

    const compatibleHits = this.listCompatibleSurfaces(objectId, attachmentType, compatibleWith)
      .map((surface) => this.resolve(objectId, surface.id))
      .filter((hit): hit is SurfaceHit => hit !== null)
      .sort((left, right) => left.distance - right.distance);

    return compatibleHits[0] ?? null;
  }
}
