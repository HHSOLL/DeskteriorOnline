export type SharedViewerPresentation = "shared" | "showcase";

export type SharedViewerPresentationPolish = {
  topZoomMultiplier: number;
  walkFov: number;
  walkFallbackOffset: {
    x: number;
    z: number;
  };
  walkTargetLift: number;
  ambientBoost: number;
  hemisphereBoost: number;
  directionalBoost: number;
  fillBoost: number;
  rimBoost: number;
};

const SHARED_VIEWER_PRESENTATION_POLISH: Record<SharedViewerPresentation, SharedViewerPresentationPolish> = {
  shared: {
    topZoomMultiplier: 1,
    walkFov: 60,
    walkFallbackOffset: {
      x: 0,
      z: 0.4
    },
    walkTargetLift: 0,
    ambientBoost: 1,
    hemisphereBoost: 1,
    directionalBoost: 1,
    fillBoost: 1,
    rimBoost: 0
  },
  showcase: {
    topZoomMultiplier: 1.08,
    walkFov: 54,
    walkFallbackOffset: {
      x: 0.18,
      z: 0.52
    },
    walkTargetLift: 0.12,
    ambientBoost: 1.08,
    hemisphereBoost: 1.12,
    directionalBoost: 1.1,
    fillBoost: 1.28,
    rimBoost: 0.2
  }
};

export function resolveSharedViewerPresentation(value: unknown): SharedViewerPresentation {
  const normalized = Array.isArray(value) ? value[0] : value;
  return normalized === "showcase" ? "showcase" : "shared";
}

export function resolveSharedViewerPresentationPolish(
  presentation: SharedViewerPresentation
): SharedViewerPresentationPolish {
  return SHARED_VIEWER_PRESENTATION_POLISH[presentation];
}

export function buildShowcaseViewerHref(token: string) {
  return `/shared/${encodeURIComponent(token)}?source=showcase`;
}
