"use client";

import * as THREE from "three";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import {
  configureKtx2LoaderInstance,
  getActiveKtx2Renderer
} from "./AssetLoader";

function buildFallbackTextureCandidates(url: string) {
  const base = url.replace(/\.ktx2$/i, "");
  return [`${base}.jpg`, `${base}.jpeg`, `${base}.png`, `${base}.webp`];
}

export class RuntimeTextureLoader extends THREE.Loader<THREE.Texture> {
  load(
    url: string,
    onLoad?: (data: THREE.Texture) => void,
    onProgress?: (event: ProgressEvent<EventTarget>) => void,
    onError?: (event: unknown) => void
  ) {
    const imageLoader = new THREE.TextureLoader(this.manager);
    const loadImageFallback = (reason: unknown) => {
      const candidates = buildFallbackTextureCandidates(url);
      let attemptIndex = 0;

      const attemptNext = (): THREE.Texture => {
        const candidate = candidates[attemptIndex];
        attemptIndex += 1;
        if (!candidate) {
          onError?.(reason);
          return new THREE.Texture();
        }

        return imageLoader.load(candidate, onLoad, onProgress, () => attemptNext());
      };

      return attemptNext();
    };

    if (url.toLowerCase().endsWith(".ktx2")) {
      const renderer = getActiveKtx2Renderer();
      if (!renderer) {
        return loadImageFallback(
          new Error("KTX2 renderer support has not been configured yet.")
        );
      }

      const loader = new KTX2Loader(this.manager);
      configureKtx2LoaderInstance(loader, renderer);
      return loader.load(url, onLoad, onProgress, (event) => {
        loadImageFallback(event);
      });
    }

    return imageLoader.load(url, onLoad, onProgress, onError);
  }
}
