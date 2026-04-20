"use client";

import * as THREE from "three";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import {
  configureKtx2LoaderInstance,
  getActiveKtx2Renderer
} from "./AssetLoader";

export class RuntimeTextureLoader extends THREE.Loader<THREE.Texture> {
  load(
    url: string,
    onLoad?: (data: THREE.Texture) => void,
    onProgress?: (event: ProgressEvent<EventTarget>) => void,
    onError?: (event: unknown) => void
  ) {
    if (url.toLowerCase().endsWith(".ktx2")) {
      const renderer = getActiveKtx2Renderer();
      if (!renderer) {
        const error = new Error("KTX2 renderer support has not been configured yet.");
        onError?.(error);
        return new THREE.Texture();
      }

      const loader = new KTX2Loader(this.manager);
      configureKtx2LoaderInstance(loader, renderer);
      return loader.load(url, onLoad, onProgress, onError);
    }

    const loader = new THREE.TextureLoader(this.manager);
    return loader.load(url, onLoad, onProgress, onError);
  }
}
