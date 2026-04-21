"use client";

import { Bloom, EffectComposer, Noise, Vignette, SSAO, SSR } from "@react-three/postprocessing";
import { useThree } from "@react-three/fiber";
import { Suspense, useMemo } from "react";
import type { SceneRenderQuality } from "../../../lib/scene/render-quality";

export default function PostEffects({ quality }: { quality: SceneRenderQuality }) {
  const { size, gl, scene, camera } = useThree();
  const hasVisibleEffects =
    quality.enableSsao ||
    quality.enableSSR ||
    quality.enableBloom ||
    quality.vignetteDarkness > 0 ||
    quality.noiseOpacity > 0;

  const isReady = useMemo(() => {
    return (
      gl &&
      scene &&
      camera &&
      size &&
      size.width > 0 &&
      size.height > 0 &&
      !(gl as { isContextLost?: () => boolean }).isContextLost?.()
    );
  }, [gl, scene, camera, size]);

  if (!isReady || !quality.enablePostEffects || !hasVisibleEffects) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <EffectComposer
        key={`${size.width}-${size.height}`}
        multisampling={quality.composerMultisampling}
        enableNormalPass={quality.enableSsao}
        stencilBuffer={false}
        autoClear={false}
      >
        {quality.enableSsao ? (
          <SSAO
            intensity={6.5}
            radius={0.05}
            luminanceInfluence={0.42}
            bias={0.02}
            worldDistanceThreshold={1}
            worldDistanceFalloff={0.2}
            worldProximityThreshold={0.8}
            worldProximityFalloff={0.2}
            samples={10}
            rings={3}
          />
        ) : null}
        {quality.enableSSR ? (
          <SSR
            temporalResolve
            temporalResolveMix={0.72}
            temporalResolveCorrectionMix={0.42}
            intensity={quality.ssrIntensity}
            maxRoughness={quality.ssrMaxRoughness}
            thickness={quality.ssrThickness}
            blurMix={0.36}
            blurSharpness={8}
            blurKernelSize={1}
            rayStep={0.32}
            maxSamples={12}
            ENABLE_BLUR
            ENABLE_JITTERING={false}
            MAX_STEPS={20}
            NUM_BINARY_SEARCH_STEPS={5}
            STRETCH_MISSED_RAYS={false}
            USE_MRT
            USE_NORMALMAP
            USE_ROUGHNESSMAP
          />
        ) : null}
        {quality.enableBloom ? (
          <Bloom intensity={quality.bloomIntensity} luminanceThreshold={0.9} luminanceSmoothing={0.2} />
        ) : null}
        {quality.vignetteDarkness > 0 ? <Vignette offset={0.22} darkness={quality.vignetteDarkness} /> : null}
        {quality.noiseOpacity > 0 ? <Noise opacity={quality.noiseOpacity} /> : null}
      </EffectComposer>
    </Suspense>
  );
}
