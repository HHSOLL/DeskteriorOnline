"use client";

import { Environment as DreiEnvironment, ContactShadows } from "@react-three/drei";
import type { SceneRenderQuality } from "../../../lib/scene/render-quality";
import { useEditorStore } from "../../../lib/stores/useEditorStore";
import { useShellSelector } from "../../../lib/stores/scene-slices";

const DEFAULT_HDRI_PATH = "/assets/hdri/kiara_interior_1k.hdr";

function DioramaContactShadow({ quality }: { quality: SceneRenderQuality }) {
  if (!quality.enableContactShadows) {
    return null;
  }

  return (
    <ContactShadows
      position={[0, quality.contactShadowY, 0]}
      opacity={quality.contactShadowOpacity}
      scale={quality.contactShadowScale}
      blur={quality.contactShadowBlur}
      far={quality.contactShadowFar}
      resolution={quality.contactShadowResolution}
      color={quality.contactShadowColor}
      depthWrite={false}
    />
  );
}

export default function SceneEnvironment({ quality }: { quality: SceneRenderQuality }) {
  const viewMode = useEditorStore((state) => state.viewMode);
  const lighting = useShellSelector((slice) => slice.lighting);

  if (viewMode === "top") {
    return <DioramaContactShadow quality={quality} />;
  }

  return (
    <>
      <DreiEnvironment files={DEFAULT_HDRI_PATH} background={false} blur={lighting.environmentBlur} />
      <DioramaContactShadow quality={quality} />
    </>
  );
}
