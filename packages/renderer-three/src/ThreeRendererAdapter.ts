import { AssetInstanceManager } from "./AssetInstanceManager";
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
  readonly scheduler = new RenderScheduler((reason) => this.backend.invalidate(reason));
  readonly instances = new AssetInstanceManager();
  readonly materials = new MaterialRegistry();
  readonly textures = new TextureRegistry();
  readonly transforms = new Map<string, Float32Array>();

  async init(target: HTMLCanvasElement | null) {
    this.canvas = target;
  }

  async loadRuntimeAsset(runtimeAssetId: string, assetId: string): Promise<AssetHandle> {
    return {
      runtimeAssetId,
      assetId
    };
  }

  createInstance(assetHandle: AssetHandle, objectId: string): ObjectHandle {
    return this.instances.create(assetHandle, objectId);
  }

  updateTransform(objectId: string, matrix: Float32Array) {
    this.transforms.set(objectId, matrix);
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
    this.instances.delete(objectId);
    this.transforms.delete(objectId);
  }
}
