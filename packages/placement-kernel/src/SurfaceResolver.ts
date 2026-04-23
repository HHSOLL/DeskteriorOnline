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
}
