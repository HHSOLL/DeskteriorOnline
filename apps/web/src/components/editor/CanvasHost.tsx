"use client";

import type { ComponentProps } from "react";
import { SceneViewport } from "./SceneViewport";
import { useRuntimeEngineBridge } from "../../lib/runtime/useRuntimeEngineBridge";

type CanvasHostProps = ComponentProps<typeof SceneViewport>;

export function CanvasHost(props: CanvasHostProps) {
  useRuntimeEngineBridge();
  return <SceneViewport {...props} />;
}
