import type { Engine } from "@deskterioronline/engine-core";
import type { SupportSurface } from "@deskterioronline/scene-schema";
import type { SurfaceHit } from "./types";

export class SurfaceResolver {
  constructor(private readonly engine: Engine) {}

  getObjectSurfaces(objectId: string): SupportSurface[] {
    const runtimeObject = this.engine.runtimeScene.objectRegistry.get(objectId);
    if (!runtimeObject?.runtimeAssetId) {
      return [];
    }

    return this.engine.runtimeScene.runtimeAssets.get(runtimeObject.runtimeAssetId)?.supportSurfaces ?? [];
  }

  resolve(objectId: string, surfaceId: string): SurfaceHit | null {
    const surface = this.getObjectSurfaces(objectId).find((candidate) => candidate.id === surfaceId);
    if (!surface) {
      return null;
    }

    return {
      objectId,
      surfaceId,
      surface,
      distance: 0
    };
  }
}
