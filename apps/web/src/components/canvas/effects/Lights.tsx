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
  const isBuilderPreview = viewMode === "builder-preview";
  const isDioramaSurface = interactionMode === "preview" || viewMode === "builder-preview" || viewMode === "top";
  const polish = resolveSharedViewerPresentationPolish(isViewerShowcase ? "showcase" : "shared");
  const ambientIntensity =
    lighting.ambientIntensity * (isBuilderPreview ? 0.78 : isDioramaSurface ? 0.96 : 1.04) * polish.ambientBoost;
  const hemisphereIntensity =
    lighting.hemisphereIntensity * (isBuilderPreview ? 0.98 : isDioramaSurface ? 1.14 : 1.08) * polish.hemisphereBoost;
  const directionalIntensity =
    lighting.directionalIntensity * (isBuilderPreview ? 1.24 : isDioramaSurface ? 1.16 : 1.08) * polish.directionalBoost;
  const fillIntensity =
    Math.max(0.18, lighting.directionalIntensity * (isBuilderPreview ? 0.4 : 0.3)) * polish.fillBoost;
  const showShowcaseRim = isViewerShowcase && viewMode === "walk";

  return (
    <>
      <ambientLight intensity={ambientIntensity} color={isViewerShowcase ? "#fff0e3" : "#fff2e6"} />
      <hemisphereLight
        intensity={hemisphereIntensity}
        color={isViewerShowcase ? "#fff3e6" : "#fff7ef"}
        groundColor={isViewerShowcase ? "#bba28f" : "#c4ad98"}
      />
      <directionalLight
        position={[6.5, 12.5, 7.5]}
        intensity={directionalIntensity}
        color="#ffe5c7"
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
          position={[-8.5, 8.5, -10]}
          intensity={fillIntensity}
          color={isViewerShowcase ? "#cddcff" : "#d4e0ff"}
        />
      ) : null}
      {showShowcaseRim ? (
        <directionalLight
          position={[-6, 7.5, 10]}
          intensity={Math.max(0.08, lighting.directionalIntensity * polish.rimBoost * 0.82)}
          color="#ffc29f"
        />
      ) : null}
    </>
  );
}
