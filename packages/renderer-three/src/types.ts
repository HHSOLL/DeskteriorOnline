export type RenderReason =
  | "demand"
  | "camera"
  | "drag-preview"
  | "hover"
  | "asset-load"
  | "focus-placement"
  | "animation";

export type RendererMode = "idle" | "demand" | "continuous" | "throttled-demand";

export type AssetHandle = {
  assetId: string;
  runtimeAssetId: string;
};

export type ObjectHandle = {
  objectId: string;
  assetHandle: AssetHandle;
  visible: boolean;
  matrix: Float32Array | null;
  version: number;
  batchKey: string | null;
  sceneGeneration: number;
  transformRevision: number;
};

export interface RendererBackend {
  readonly kind: "webgl" | "webgpu" | "null";
  invalidate(reason: RenderReason): void;
  render(reason: RenderReason): void;
}

export interface RendererAdapter {
  init(target: HTMLCanvasElement | null): Promise<void>;
  loadRuntimeAsset(runtimeAssetId: string, assetId: string): Promise<AssetHandle>;
  createInstance(assetHandle: AssetHandle, objectId: string): ObjectHandle;
  updateTransform(objectId: string, matrix: Float32Array): void;
  updateMaterial(objectId: string, materialId: string): void;
  setVisibility(objectId: string, visible: boolean): void;
  renderFrame(reason: RenderReason): void;
  disposeObject(objectId: string): void;
}
