import type { RuntimeScene, RuntimeWorldTransform } from "@deskterioronline/engine-core";
import { AssetInstanceManager } from "./AssetInstanceManager";
import { InstanceBatchManager } from "./InstanceBatchManager";
import { MaterialRegistry } from "./MaterialRegistry";
import { RenderScheduler } from "./RenderScheduler";
import { TextureRegistry } from "./TextureRegistry";
import type {
  AssetHandle,
  ObjectHandle,
  RenderReason,
  RendererAdapter,
  RendererBackend
} from "./types";

class NullBackend implements RendererBackend {
  readonly kind = "null" as const;

  invalidate() {}

  render() {}
}

export class ThreeRendererAdapter implements RendererAdapter {
  private backend: RendererBackend = new NullBackend();
  private canvas: HTMLCanvasElement | null = null;
  private lastSyncedSceneGeneration: number | null = null;
  private lastSyncedObjectCount = 0;
  readonly scheduler = new RenderScheduler((reason) => this.backend.invalidate(reason));
  readonly instances = new AssetInstanceManager();
  readonly batches = new InstanceBatchManager();
  readonly materials = new MaterialRegistry();
  readonly textures = new TextureRegistry();
  readonly transforms = new Map<string, Float32Array>();
  readonly runtimeAssets = new Map<string, AssetHandle>();

  private composeMatrix(transform: RuntimeWorldTransform) {
    const [x, y, z] = transform.rotation;
    const [sx, sy, sz] = transform.scale;
    const [px, py, pz] = transform.position;

    const a = Math.cos(x);
    const b = Math.sin(x);
    const c = Math.cos(y);
    const d = Math.sin(y);
    const e = Math.cos(z);
    const f = Math.sin(z);

    const ae = a * e;
    const af = a * f;
    const be = b * e;
    const bf = b * f;

    return new Float32Array([
      c * e * sx,
      (af + be * d) * sx,
      (bf - ae * d) * sx,
      0,
      -c * f * sy,
      (ae - bf * d) * sy,
      (be + af * d) * sy,
      0,
      d * sz,
      -b * c * sz,
      a * c * sz,
      0,
      px,
      py,
      pz,
      1
    ]);
  }

  private ensureAssetHandle(runtimeAssetId: string, assetId: string) {
    const existing = this.runtimeAssets.get(runtimeAssetId);
    if (existing) {
      return existing;
    }

    const handle = {
      runtimeAssetId,
      assetId
    };
    this.runtimeAssets.set(runtimeAssetId, handle);
    return handle;
  }

  async init(target: HTMLCanvasElement | null) {
    this.canvas = target;
  }

  async loadRuntimeAsset(runtimeAssetId: string, assetId: string): Promise<AssetHandle> {
    return this.ensureAssetHandle(runtimeAssetId, assetId);
  }

  createInstance(assetHandle: AssetHandle, objectId: string): ObjectHandle {
    return this.instances.create(assetHandle, objectId);
  }

  updateTransform(objectId: string, matrix: Float32Array) {
    this.transforms.set(objectId, matrix);
    const handle = this.instances.get(objectId);
    if (handle) {
      handle.matrix = matrix;
      handle.version += 1;
    }
    this.scheduler.request("drag-preview");
  }

  updateMaterial(objectId: string, materialId: string) {
    this.materials.set(objectId, materialId);
    this.scheduler.request("demand");
  }

  setVisibility(objectId: string, visible: boolean) {
    const handle = this.instances.get(objectId);
    if (handle) {
      handle.visible = visible;
    }
    this.scheduler.request("demand");
  }

  renderFrame(reason: RenderReason) {
    this.backend.render(reason);
  }

  disposeObject(objectId: string) {
    this.batches.removeObject(objectId);
    this.instances.delete(objectId);
    this.transforms.delete(objectId);
  }

  getObjectHandle(objectId: string) {
    return this.instances.get(objectId);
  }

  getTransform(objectId: string) {
    return this.transforms.get(objectId) ?? null;
  }

  syncRuntimeScene(scene: RuntimeScene) {
    const dirtyCount = scene.dirtyObjectIds.size;
    if (
      dirtyCount === 0 &&
      this.lastSyncedSceneGeneration === scene.generation &&
      this.lastSyncedObjectCount === scene.objectRegistry.size
    ) {
      return {
        syncedCount: 0,
        batchCount: this.batches.size()
      };
    }

    const batchGroups = new Map<string, string[]>();
    const liveObjectIds = new Set<string>();
    let syncedCount = 0;

    scene.objectRegistry.forEach((runtimeObject) => {
      liveObjectIds.add(runtimeObject.id);
      const runtimeAssetId = runtimeObject.runtimeAssetId ?? runtimeObject.assetId;
      const assetHandle = this.ensureAssetHandle(runtimeAssetId, runtimeObject.assetId);
      const objectHandle =
        this.instances.get(runtimeObject.id) ?? this.createInstance(assetHandle, runtimeObject.id);
      const batchKey = `${runtimeAssetId}:${runtimeObject.objectDocument.materialVariantId ?? "default"}`;
      objectHandle.batchKey = batchKey;

      const members = batchGroups.get(batchKey) ?? [];
      members.push(runtimeObject.id);
      batchGroups.set(batchKey, members);

      const needsSync =
        scene.dirtyObjectIds.has(runtimeObject.id) ||
        !objectHandle.matrix ||
        objectHandle.sceneGeneration !== scene.generation ||
        objectHandle.transformRevision !== runtimeObject.transformRevision;

      if (!needsSync) {
        return;
      }

      const matrix = this.composeMatrix(runtimeObject.previewTransform ?? runtimeObject.transform);
      this.transforms.set(runtimeObject.id, matrix);
      objectHandle.matrix = matrix;
      objectHandle.version += 1;
      objectHandle.sceneGeneration = scene.generation;
      objectHandle.transformRevision = runtimeObject.transformRevision;
      syncedCount += 1;
    });

    this.instances.values().forEach((handle) => {
      if (liveObjectIds.has(handle.objectId)) {
        return;
      }
      this.disposeObject(handle.objectId);
    });
    this.batches.replaceAll(batchGroups);
    this.lastSyncedSceneGeneration = scene.generation;
    this.lastSyncedObjectCount = scene.objectRegistry.size;

    if (dirtyCount > 0) {
      scene.dirtyObjectIds.clear();
      this.scheduler.request("drag-preview");
    } else if (syncedCount > 0 || this.instances.size() !== scene.objectRegistry.size) {
      this.scheduler.request("demand");
    }

    return {
      syncedCount,
      batchCount: batchGroups.size
    };
  }
}
