"use client";

import type { SceneInteractionMode, SceneRenderQuality } from "../../../lib/scene/render-quality";
import { resolveSharedViewerPresentationPolish } from "../../../lib/viewer/presentation";
import { useEditorStore } from "../../../lib/stores/useEditorStore";
import { useShellSelector } from "../../../lib/stores/scene-slices";

export default function Lights({
  quality,
  interactionMode
}: {
  quality: SceneRenderQuality;
  interactionMode: SceneInteractionMode;
}) {
  const lighting = useShellSelector((slice) => slice.lighting);
  const viewMode = useEditorStore((state) => state.viewMode);
  const isViewerShowcase = interactionMode === "viewer-showcase";
  const polish = resolveSharedViewerPresentationPolish(isViewerShowcase ? "showcase" : "shared");
  const ambientIntensity = lighting.ambientIntensity * 1.06 * polish.ambientBoost;
  const hemisphereIntensity = lighting.hemisphereIntensity * 1.08 * polish.hemisphereBoost;
  const directionalIntensity = lighting.directionalIntensity * 1.08 * polish.directionalBoost;
  const fillIntensity = Math.max(0.16, lighting.directionalIntensity * 0.24) * polish.fillBoost;
  const showShowcaseRim = isViewerShowcase && viewMode === "walk";

  return (
    <>
      <ambientLight intensity={ambientIntensity} color={isViewerShowcase ? "#fff4ea" : "#fff2e6"} />
      <hemisphereLight
        intensity={hemisphereIntensity}
        color={isViewerShowcase ? "#fff8f1" : "#fff7ef"}
        groundColor={isViewerShowcase ? "#c4b2a5" : "#c7b6a2"}
      />
      <directionalLight
        position={[8, 14, 6]}
        intensity={directionalIntensity}
        color="#fff0de"
        castShadow={quality.enableShadows}
        shadow-mapSize={[quality.shadowMapSize, quality.shadowMapSize]}
        shadow-bias={-0.0001}
        shadow-normalBias={0.05}
        shadow-camera-near={0.5}
        shadow-camera-far={48}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
      />
      {quality.enableFillLight ? (
        <directionalLight
          position={[-9, 10, -7]}
          intensity={fillIntensity}
          color={isViewerShowcase ? "#dbe9ff" : "#d7e4ff"}
        />
      ) : null}
      {showShowcaseRim ? (
        <directionalLight
          position={[-6, 7.5, 10]}
          intensity={Math.max(0.1, lighting.directionalIntensity * polish.rimBoost)}
          color="#ffd9bf"
        />
      ) : null}
    </>
  );
}
