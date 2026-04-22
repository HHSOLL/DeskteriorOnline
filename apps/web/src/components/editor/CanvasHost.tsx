"use client";

import type { ComponentProps } from "react";
import { SceneViewport } from "./SceneViewport";
import { RuntimeEngineProvider } from "../../lib/runtime/runtime-engine-context";
import { useRuntimeEngineBridge } from "../../lib/runtime/useRuntimeEngineBridge";

type CanvasHostProps = ComponentProps<typeof SceneViewport>;

export function CanvasHost(props: CanvasHostProps) {
  const runtimeBridge = useRuntimeEngineBridge();

  return (
    <RuntimeEngineProvider
      value={{
        engineRef: runtimeBridge.engineRef,
        sceneDocumentId: runtimeBridge.sceneDocumentId
      }}
    >
      <SceneViewport {...props} />
    </RuntimeEngineProvider>
  );
}
