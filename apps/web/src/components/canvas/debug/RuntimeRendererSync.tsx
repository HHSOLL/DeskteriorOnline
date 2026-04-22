"use client";

import { useFrame } from "@react-three/fiber";
import { useRuntimeEngine } from "../../../lib/runtime/runtime-engine-context";
import { useRuntimeRendererAdapter } from "../../../lib/runtime/runtime-renderer-context";

export default function RuntimeRendererSync() {
  const engine = useRuntimeEngine();
  const rendererAdapter = useRuntimeRendererAdapter();

  useFrame(() => {
    if (!engine || !rendererAdapter) {
      return;
    }

    rendererAdapter.syncRuntimeScene(engine.runtimeScene);
  });

  return null;
}
