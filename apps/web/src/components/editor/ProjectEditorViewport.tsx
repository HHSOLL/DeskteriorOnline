import type { ComponentProps, ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { SceneViewport } from "./SceneViewport";

type ProjectEditorViewportProps = {
  gl?: ComponentProps<typeof Canvas>["gl"];
  modeBadge?: ReactNode;
  bottomNotice?: ReactNode;
};

export function ProjectEditorViewport({
  gl,
  modeBadge,
  bottomNotice
}: ProjectEditorViewportProps) {
  return (
    <SceneViewport
      className="rounded-none border-0 shadow-none"
      gl={gl}
      camera={{ fov: 40, position: [0, 10, 20] }}
      chromeTone="light"
      interactionMode="editor"
      modeBadge={modeBadge}
      bottomNotice={bottomNotice}
    />
  );
}
