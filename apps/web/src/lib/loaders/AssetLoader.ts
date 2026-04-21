"use client";

import { useEffect } from "react";
import { useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { ensureSceneBoundsTrees } from "../performance/mesh-bvh";

const dracoLoader = new DRACOLoader();
const decoderPathRaw =
  process.env.NEXT_PUBLIC_DRACO_DECODER_PATH ??
  "https://www.gstatic.com/draco/v1/decoders/";
const decoderPath = decoderPathRaw.endsWith("/") ? decoderPathRaw : `${decoderPathRaw}/`;
const workerLimit =
  typeof navigator !== "undefined" && navigator.hardwareConcurrency
    ? Math.min(4, Math.max(2, Math.floor(navigator.hardwareConcurrency / 2)))
    : 2;
const ktx2TranscoderPathRaw =
  process.env.NEXT_PUBLIC_KTX2_TRANSCODER_PATH ??
  "/assets/transcoders/basis/";
const ktx2TranscoderPath = ktx2TranscoderPathRaw.endsWith("/")
  ? ktx2TranscoderPathRaw
  : `${ktx2TranscoderPathRaw}/`;
const ktx2Loader = new KTX2Loader();
let activeKtx2Renderer: THREE.WebGLRenderer | null = null;

dracoLoader.setDecoderPath(decoderPath);
dracoLoader.setWorkerLimit(workerLimit);
dracoLoader.preload();

export function configureKtx2LoaderInstance(
  loader: KTX2Loader,
  renderer?: THREE.WebGLRenderer | null
) {
  loader.setTranscoderPath(ktx2TranscoderPath);
  loader.setWorkerLimit(workerLimit);
  if (renderer) {
    loader.detectSupport(renderer);
    void loader.init();
  }
}

export function getActiveKtx2Renderer() {
  return activeKtx2Renderer;
}

configureKtx2LoaderInstance(ktx2Loader);

export function configureRuntimeAssetLoaders(renderer: THREE.WebGLRenderer) {
  if (activeKtx2Renderer === renderer) {
    return;
  }

  configureKtx2LoaderInstance(ktx2Loader, renderer);
  activeKtx2Renderer = renderer;
}

export function useGLBAsset(path: string): GLTF {
  const gltf = useLoader(GLTFLoader, path, (loader) => {
    loader.setDRACOLoader(dracoLoader);
    loader.setKTX2Loader(ktx2Loader);
    loader.setMeshoptDecoder(MeshoptDecoder);
  });

  useEffect(() => {
    ensureSceneBoundsTrees(gltf.scene);
  }, [gltf]);

  return gltf;
}
