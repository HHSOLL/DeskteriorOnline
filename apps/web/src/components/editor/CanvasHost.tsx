"use client";

import type { ComponentProps } from "react";
import { SceneViewport } from "./SceneViewport";
import { RuntimeEngineProvider } from "../../lib/runtime/runtime-engine-context";
import { RuntimeRendererProvider } from "../../lib/runtime/runtime-renderer-context";
import { useRuntimeEngineBridge } from "../../lib/runtime/useRuntimeEngineBridge";
import { useRuntimeRendererBridge } from "../../lib/runtime/useRuntimeRendererBridge";

type CanvasHostProps = ComponentProps<typeof SceneViewport>;

export function CanvasHost(props: CanvasHostProps) {
  const runtimeBridge = useRuntimeEngineBridge();
  const rendererBridge = useRuntimeRendererBridge();

  return (
    <RuntimeEngineProvider
      value={{
        engineRef: runtimeBridge.engineRef,
        sceneDocumentId: runtimeBridge.sceneDocumentId
      }}
    >
      <RuntimeRendererProvider
        value={{
          adapterRef: rendererBridge.adapterRef
        }}
      >
        <SceneViewport {...props} />
      </RuntimeRendererProvider>
    </RuntimeEngineProvider>
  );
}
