import type { EditorTopMode, EditorViewMode } from "../stores/useEditorStore";

export type SceneInteractionMode =
  | "editor"
  | "viewer-shared"
  | "viewer-showcase"
  | "preview";

export type SceneRenderQuality = {
  frameLoop: "always" | "demand";
  dpr: [number, number];
  toneMapping: "aces" | "neutral";
  toneMappingExposure: number;
  enableShadows: boolean;
  shadowMapSize: number;
  enablePostEffects: boolean;
  enableBloom: boolean;
  bloomIntensity: number;
  vignetteDarkness: number;
  noiseOpacity: number;
  enableSsao: boolean;
  enableSSR: boolean;
  ssrIntensity: number;
  ssrMaxRoughness: number;
  ssrThickness: number;
  composerMultisampling: number;
  enableContactShadows: boolean;
  contactShadowResolution: number;
  contactShadowBlur: number;
  contactShadowOpacity: number;
  allowDynamicLights: boolean;
  enableFillLight: boolean;
};

type SceneRenderQualityInput = {
  interactionMode: SceneInteractionMode;
  viewMode: EditorViewMode;
  topMode: EditorTopMode;
  coarsePointer: boolean;
  devicePixelRatio: number;
  hardwareConcurrency: number;
  viewportWidth: number;
};

function clampRange(min: number, max: number): [number, number] {
  return [min, Math.max(min, max)];
}

export function resolveSceneRenderQuality({
  interactionMode,
  viewMode,
  topMode,
  coarsePointer,
  devicePixelRatio,
  hardwareConcurrency,
  viewportWidth
}: SceneRenderQualityInput): SceneRenderQuality {
  const isTopView = viewMode === "top";
  const isSharedViewer = interactionMode === "viewer-shared";
  const isViewerShowcase = interactionMode === "viewer-showcase";
  const isBuilderPreview = interactionMode === "preview" || viewMode === "builder-preview";
  const constrainedDevice =
    coarsePointer ||
    viewportWidth < 1280 ||
    devicePixelRatio > 1.5 ||
    (hardwareConcurrency > 0 && hardwareConcurrency <= 6);

  if (isTopView) {
    if (isSharedViewer) {
      return {
        frameLoop: "always",
        dpr: constrainedDevice ? clampRange(0.88, 1.04) : clampRange(0.98, 1.16),
        toneMapping: "aces",
        toneMappingExposure: 1.1,
        enableShadows: false,
        shadowMapSize: 512,
        enablePostEffects: false,
        enableBloom: false,
        bloomIntensity: 0,
        vignetteDarkness: 0,
        noiseOpacity: 0,
        enableSsao: false,
        enableSSR: false,
        ssrIntensity: 0,
        ssrMaxRoughness: 0,
        ssrThickness: 0,
        composerMultisampling: 0,
        enableContactShadows: false,
        contactShadowResolution: 0,
        contactShadowBlur: 0,
        contactShadowOpacity: 0,
        allowDynamicLights: false,
        enableFillLight: false
      };
    }

    if (isViewerShowcase) {
      return {
        frameLoop: "always",
        dpr: constrainedDevice ? clampRange(0.96, 1.12) : clampRange(1.04, 1.22),
        toneMapping: "neutral",
        toneMappingExposure: constrainedDevice ? 1.02 : 1.06,
        enableShadows: false,
        shadowMapSize: 512,
        enablePostEffects: !constrainedDevice,
        enableBloom: !constrainedDevice,
        bloomIntensity: constrainedDevice ? 0 : 0.18,
        vignetteDarkness: constrainedDevice ? 0 : 0.18,
        noiseOpacity: constrainedDevice ? 0 : 0.0025,
        enableSsao: false,
        enableSSR: !constrainedDevice,
        ssrIntensity: constrainedDevice ? 0 : 0.24,
        ssrMaxRoughness: constrainedDevice ? 0 : 0.62,
        ssrThickness: constrainedDevice ? 0 : 6,
        composerMultisampling: 0,
        enableContactShadows: false,
        contactShadowResolution: 0,
        contactShadowBlur: 0,
        contactShadowOpacity: 0,
        allowDynamicLights: true,
        enableFillLight: false
      };
    }

    if (topMode === "desk-precision") {
      return {
        frameLoop: "always",
        dpr: constrainedDevice ? clampRange(1.02, 1.18) : clampRange(1.14, 1.34),
        toneMapping: "neutral",
        toneMappingExposure: constrainedDevice ? 1.02 : 1.06,
        enableShadows: true,
        shadowMapSize: constrainedDevice ? 768 : 1024,
        enablePostEffects: false,
        enableBloom: false,
        bloomIntensity: 0,
        vignetteDarkness: 0,
        noiseOpacity: 0,
        enableSsao: false,
        enableSSR: false,
        ssrIntensity: 0,
        ssrMaxRoughness: 0,
        ssrThickness: 0,
        composerMultisampling: 0,
        enableContactShadows: true,
        contactShadowResolution: constrainedDevice ? 192 : 320,
        contactShadowBlur: 1.5,
        contactShadowOpacity: constrainedDevice ? 0.18 : 0.28,
        allowDynamicLights: true,
        enableFillLight: true
      };
    }

    return {
      frameLoop: "always",
      dpr: constrainedDevice ? clampRange(0.98, 1.14) : clampRange(1.08, 1.28),
      toneMapping: "neutral",
      toneMappingExposure: constrainedDevice ? 1.02 : 1.05,
      enableShadows: true,
      shadowMapSize: constrainedDevice ? 768 : 1024,
      enablePostEffects: false,
      enableBloom: false,
      bloomIntensity: 0,
      vignetteDarkness: 0,
      noiseOpacity: 0,
      enableSsao: false,
      enableSSR: false,
      ssrIntensity: 0,
      ssrMaxRoughness: 0,
      ssrThickness: 0,
      composerMultisampling: 0,
      enableContactShadows: true,
      contactShadowResolution: constrainedDevice ? 176 : 288,
      contactShadowBlur: 1.45,
      contactShadowOpacity: constrainedDevice ? 0.16 : 0.24,
      allowDynamicLights: true,
      enableFillLight: true
    };
  }

  if (isBuilderPreview) {
    return {
      frameLoop: "demand",
      dpr: constrainedDevice ? clampRange(0.8, 1) : clampRange(0.9, 1.15),
      toneMapping: "neutral",
      toneMappingExposure: constrainedDevice ? 0.98 : 1.01,
      enableShadows: !constrainedDevice,
      shadowMapSize: constrainedDevice ? 512 : 768,
      enablePostEffects: !constrainedDevice,
      enableBloom: !constrainedDevice,
      bloomIntensity: constrainedDevice ? 0 : 0.18,
      vignetteDarkness: constrainedDevice ? 0 : 0.18,
      noiseOpacity: constrainedDevice ? 0 : 0.003,
      enableSsao: false,
      enableSSR: false,
      ssrIntensity: 0,
      ssrMaxRoughness: 0,
      ssrThickness: 0,
      composerMultisampling: 0,
      enableContactShadows: true,
      contactShadowResolution: constrainedDevice ? 192 : 320,
      contactShadowBlur: 1.45,
      contactShadowOpacity: 0.28,
      allowDynamicLights: true,
      enableFillLight: false
    };
  }

  if (isSharedViewer) {
    return {
      frameLoop: "always",
      dpr: constrainedDevice ? clampRange(0.82, 1) : clampRange(0.9, 1.08),
      toneMapping: "aces",
      toneMappingExposure: 1.1,
      enableShadows: !constrainedDevice,
      shadowMapSize: constrainedDevice ? 512 : 640,
      enablePostEffects: !constrainedDevice,
      enableBloom: false,
      bloomIntensity: 0,
      vignetteDarkness: constrainedDevice ? 0 : 0.18,
      noiseOpacity: constrainedDevice ? 0 : 0.0025,
      enableSsao: false,
      enableSSR: false,
      ssrIntensity: 0,
      ssrMaxRoughness: 0,
      ssrThickness: 0,
      composerMultisampling: 0,
      enableContactShadows: constrainedDevice ? false : true,
      contactShadowResolution: constrainedDevice ? 0 : 224,
      contactShadowBlur: 1.45,
      contactShadowOpacity: 0.24,
      allowDynamicLights: true,
      enableFillLight: false
    };
  }

  if (isViewerShowcase) {
    return {
      frameLoop: "always",
      dpr: constrainedDevice ? clampRange(0.9, 1.08) : clampRange(1, 1.24),
      toneMapping: "neutral",
      toneMappingExposure: constrainedDevice ? 1.02 : 1.05,
      enableShadows: true,
      shadowMapSize: constrainedDevice ? 896 : 1280,
      enablePostEffects: true,
      enableBloom: true,
      bloomIntensity: constrainedDevice ? 0.18 : 0.28,
      vignetteDarkness: constrainedDevice ? 0.16 : 0.22,
      noiseOpacity: constrainedDevice ? 0.003 : 0.0045,
      enableSsao: !constrainedDevice,
      enableSSR: !constrainedDevice,
      ssrIntensity: constrainedDevice ? 0 : 0.32,
      ssrMaxRoughness: constrainedDevice ? 0 : 0.68,
      ssrThickness: constrainedDevice ? 0 : 7.5,
      composerMultisampling: constrainedDevice ? 0 : 2,
      enableContactShadows: true,
      contactShadowResolution: constrainedDevice ? 256 : 416,
      contactShadowBlur: constrainedDevice ? 1.55 : 1.8,
      contactShadowOpacity: constrainedDevice ? 0.24 : 0.32,
      allowDynamicLights: true,
      enableFillLight: true
    };
  }

  return {
    frameLoop: "always",
    dpr: constrainedDevice ? clampRange(0.88, 1.12) : clampRange(0.95, 1.3),
    toneMapping: "aces",
    toneMappingExposure: constrainedDevice ? 1.1 : 1.14,
    enableShadows: true,
    shadowMapSize: constrainedDevice ? 768 : 1280,
    enablePostEffects: false,
    enableBloom: false,
    bloomIntensity: 0,
    vignetteDarkness: 0,
    noiseOpacity: 0,
    enableSsao: false,
    enableSSR: false,
    ssrIntensity: 0,
    ssrMaxRoughness: 0,
    ssrThickness: 0,
    composerMultisampling: 0,
    enableContactShadows: true,
    contactShadowResolution: constrainedDevice ? 256 : 448,
    contactShadowBlur: constrainedDevice ? 1.6 : 1.9,
    contactShadowOpacity: constrainedDevice ? 0.28 : 0.36,
    allowDynamicLights: true,
    enableFillLight: true
  };
}
