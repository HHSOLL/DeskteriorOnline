"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { RefreshCcw, SlidersHorizontal, Sparkles, Trash2 } from "lucide-react";
import {
  getCatalogGenerationBadge,
  getCatalogPreviewClasses,
  hasSpecificCatalogThumbnail,
  type LibraryCatalogItem
} from "../../lib/builder/catalog";
import {
  buildReplacementZoneSummary,
  inferReplacementRoomZone,
  type ReplacementCatalogCandidate,
  type ReplacementPlacedAssetZoneSummary,
  type ReplacementPreviewFamilyId,
  type ReplacementRoomZoneId
} from "../../lib/builder/replacement-candidates";
import {
  degreesToRadians,
  metersToMillimeters,
  millimetersToMeters,
  radiansToDegrees
} from "../../lib/domain/scene-placement";
import { SCENE_ANCHOR_TYPES, type SceneAnchorType } from "../../lib/scene/anchor-types";
import { isSupportAnchorType } from "../../lib/scene/support-profiles";
import {
  PrecisionSurfaceMicroView,
  type PrecisionSurfaceLockInfo
} from "./PrecisionSurfaceMicroView";
import { PrecisionSurfaceProjectionView } from "./PrecisionSurfaceProjectionView";
import { builderCeilingFinishes, builderFloorFinishes, builderWallFinishes } from "../../lib/builder/templates";
import {
  CEILING_TEXTURE_PRESETS,
  FLOOR_TEXTURE_PRESETS,
  WALL_TEXTURE_PRESETS
} from "../../lib/textures/room-shell-textures";
import {
  DEFAULT_LIGHTING_GRID_SNAP_MM,
  createDefaultDirectLightingFixtures,
  normalizeDirectLightCount,
  normalizeLightingFixtures,
  resolveLightingFixtures,
  resolveLightingPositionMmFromNormalized,
  type LightingColorTemperature,
  type LightingFixture,
  type LightingLayoutBoundsMm
} from "../../lib/scene/lighting-layout";
import {
  LIGHTING_PRESETS,
  inferLightingPresetId,
  type LightingPresetId
} from "../../lib/scene/lighting-presets";
import {
  ROOM_MOOD_RECIPES,
  getRoomMoodRecipeSwatches,
  resolveRoomMoodRecipeApplication,
  type RoomMoodRecipeApplication
} from "../../lib/scene/room-mood-recipes";
import type {
  EditorTopMode,
  TransformMode,
  TransformSpace
} from "../../lib/stores/useEditorStore";
import type { LightingSettings, SceneAsset } from "../../lib/stores/useSceneStore";
import {
  CatalogLiveModelPreview,
  isCatalogLiveModelPreviewEligible
} from "./CatalogLiveModelPreview";
import {
  describeEditorRoomStylingBundle,
  EDITOR_ROOM_STYLING_BUNDLES,
  type EditorRoomStylingBundleId
} from "../../lib/builder/editor-styling-bundles";
import type { WorkspaceFlexClusterId } from "../../lib/builder/seeded-assets";

type BuilderInspectorPanelProps = {
  visible: boolean;
  layout?: "overlay" | "inline";
  className?: string;
  topMode: EditorTopMode;
  transformMode: TransformMode;
  transformSpace: TransformSpace;
  wallMaterialIndex: number;
  floorMaterialIndex: number;
  ceilingMaterialIndex: number;
  lighting: LightingSettings;
  lightingBoundsMm: LightingLayoutBoundsMm;
  wallsCount: number;
  floorsCount: number;
  assetsCount: number;
  placedZoneSummaries: ReplacementPlacedAssetZoneSummary[];
  catalogItems: LibraryCatalogItem[];
  selectedAsset: SceneAsset | null;
  selectedAssetMeta: LibraryCatalogItem | null;
  replacementItems: ReplacementCatalogCandidate[];
  surfaceLockInfo: PrecisionSurfaceLockInfo | null;
  onTransformModeChange: (mode: TransformMode) => void;
  onTransformSpaceChange: (space: TransformSpace) => void;
  onWallMaterialChange: (index: number) => void;
  onFloorMaterialChange: (index: number) => void;
  onCeilingMaterialChange: (index: number) => void;
  onLightingChange: (lighting: Partial<LightingSettings>) => void;
  onLightingCommit: () => void;
  onApplyLightingPreset: (presetId: LightingPresetId) => void;
  onApplyRoomMoodRecipe: (recipe: RoomMoodRecipeApplication) => void;
  onApplyRoomStylingBundle: (
    bundleId: EditorRoomStylingBundleId,
    clusterIds: readonly WorkspaceFlexClusterId[],
    label: string
  ) => void;
  onReplaceAsset: (id: string, item: LibraryCatalogItem) => void;
  onSelectPlacedAsset: (id: string) => void;
  onApplyPlacedZoneReplacements: (zoneId: ReplacementRoomZoneId) => void;
  onUpdateAsset: (id: string, updates: Partial<SceneAsset>) => void;
  onRemoveAsset: (id: string) => void;
  formatAssetLabel: (assetId: string) => string;
};

function formatDimensionsMm(
  dimensions: { width: number; depth: number; height: number } | null | undefined
) {
  if (!dimensions) return null;
  return `W ${dimensions.width} / D ${dimensions.depth} / H ${dimensions.height} mm`;
}

function toRoundedDegree(value: number) {
  return Math.round(radiansToDegrees(value) * 10) / 10;
}

function materialPreviewStyle(preset: { previewThumbnail?: string; topColor: string }) {
  return {
    backgroundColor: preset.topColor,
    backgroundImage: preset.previewThumbnail ? `url(${preset.previewThumbnail})` : undefined
  };
}

const DIRECT_LIGHT_COUNT_OPTIONS = [1, 2, 3, 4, 6] as const;
const DIRECT_LIGHT_TEMPERATURE_OPTIONS: Array<{ id: LightingColorTemperature; label: string; color: string }> = [
  { id: "warm", label: "Warm", color: "#ffd9a3" },
  { id: "neutral", label: "Neutral", color: "#fff1d3" },
  { id: "cool", label: "Cool", color: "#dceaff" }
];
const DEFAULT_REPLACEMENT_PREVIEW_SCALE = {
  width: 0.62,
  depth: 0.5,
  height: 0.58
} satisfies ReplacementCatalogCandidate["previewScale"];

function formatMetersFromMillimeters(value: number) {
  return `${(value / 1000).toFixed(2)}m`;
}

function resolveFixtureGridPosition(
  fixture: LightingFixture,
  bounds: LightingLayoutBoundsMm
) {
  const width = Math.max(1, bounds.maxXMm - bounds.minXMm);
  const depth = Math.max(1, bounds.maxZMm - bounds.minZMm);
  return {
    left: `${Math.min(100, Math.max(0, ((fixture.positionMm[0] - bounds.minXMm) / width) * 100))}%`,
    top: `${Math.min(100, Math.max(0, ((fixture.positionMm[2] - bounds.minZMm) / depth) * 100))}%`
  };
}

function ReplacementSilhouette({ family }: { family: ReplacementPreviewFamilyId }) {
  if (family === "chair") {
    return (
      <>
        <span className="absolute bottom-[38%] left-[22%] h-[50%] w-[55%] rounded-t-[16px] rounded-b-[7px] bg-[#35302c] shadow-[inset_8px_0_0_rgba(255,255,255,0.12)]" />
        <span className="absolute bottom-[28%] left-[15%] h-[24%] w-[70%] rounded-[13px] bg-[#5f554d] shadow-[inset_0_6px_0_rgba(255,255,255,0.16)]" />
        <span className="absolute bottom-[10%] left-[28%] h-[26%] w-[7%] rounded-full bg-[#2c2825]" />
        <span className="absolute bottom-[10%] right-[28%] h-[26%] w-[7%] rounded-full bg-[#2c2825]" />
        <span className="absolute bottom-[17%] left-[17%] h-[7%] w-[22%] rounded-full bg-[#292622]" />
        <span className="absolute bottom-[17%] right-[17%] h-[7%] w-[22%] rounded-full bg-[#292622]" />
      </>
    );
  }

  if (family === "sofa") {
    return (
      <>
        <span className="absolute bottom-[30%] left-[5%] h-[42%] w-[90%] rounded-t-[18px] bg-[#3a353c] shadow-[inset_0_10px_0_rgba(255,255,255,0.12)]" />
        <span className="absolute bottom-[20%] left-[1%] h-[30%] w-[98%] rounded-[16px] bg-[#58505a]" />
        <span className="absolute bottom-[16%] left-[11%] h-[8%] w-[10%] rounded-full bg-[#302b31]" />
        <span className="absolute bottom-[16%] right-[11%] h-[8%] w-[10%] rounded-full bg-[#302b31]" />
      </>
    );
  }

  if (family === "desk" || family === "table") {
    return (
      <>
        <span className="absolute bottom-[47%] left-[2%] h-[16%] w-[96%] rounded-[8px] bg-[#9a714a] shadow-[inset_0_5px_0_rgba(255,255,255,0.2)]" />
        <span className="absolute bottom-[16%] left-[14%] h-[35%] w-[7%] rounded-full bg-[#43352b]" />
        <span className="absolute bottom-[16%] right-[14%] h-[35%] w-[7%] rounded-full bg-[#43352b]" />
        {family === "desk" ? (
          <span className="absolute bottom-[34%] left-[36%] h-[18%] w-[28%] rounded-t-[8px] bg-[#f1e2c8]/60" />
        ) : null}
      </>
    );
  }

  if (family === "storage") {
    return (
      <>
        <span className="absolute bottom-[16%] left-[8%] h-[70%] w-[84%] rounded-[12px] bg-[#8d6746] shadow-[inset_0_8px_0_rgba(255,255,255,0.16)]" />
        <span className="absolute bottom-[47%] left-[16%] h-px w-[68%] bg-black/20" />
        <span className="absolute bottom-[27%] left-[18%] h-[8%] w-[24%] rounded-full bg-white/25" />
        <span className="absolute bottom-[27%] right-[18%] h-[8%] w-[24%] rounded-full bg-white/25" />
      </>
    );
  }

  if (family === "display") {
    return (
      <>
        <span className="absolute bottom-[38%] left-[4%] h-[48%] w-[92%] rounded-[8px] bg-[#1b1c22] shadow-[inset_0_0_0_4px_rgba(255,255,255,0.08)]" />
        <span className="absolute bottom-[43%] left-[9%] h-[35%] w-[82%] rounded-[5px] bg-[linear-gradient(135deg,#2e3445,#0d0f16)]" />
        <span className="absolute bottom-[22%] left-[46%] h-[18%] w-[8%] rounded-full bg-[#2a2b30]" />
        <span className="absolute bottom-[17%] left-[34%] h-[6%] w-[32%] rounded-full bg-[#292a2f]" />
      </>
    );
  }

  if (family === "lighting") {
    return (
      <>
        <span className="absolute bottom-[14%] left-[38%] h-[8%] w-[24%] rounded-full bg-[#3d3328]" />
        <span className="absolute bottom-[21%] left-[47%] h-[45%] w-[6%] origin-bottom -rotate-12 rounded-full bg-[#3d3328]" />
        <span className="absolute bottom-[59%] left-[46%] h-[22%] w-[32%] -rotate-12 rounded-full bg-[#fff2c8] shadow-[0_0_24px_rgba(255,210,126,0.65)]" />
      </>
    );
  }

  if (family === "plant") {
    return (
      <>
        <span className="absolute bottom-[13%] left-[34%] h-[30%] w-[32%] rounded-b-[12px] rounded-t-[5px] bg-[#6f5541]" />
        <span className="absolute bottom-[40%] left-[25%] h-[26%] w-[30%] -rotate-12 rounded-full bg-[#47724d]" />
        <span className="absolute bottom-[47%] left-[44%] h-[34%] w-[28%] rotate-12 rounded-full bg-[#2f5d3c]" />
        <span className="absolute bottom-[35%] right-[20%] h-[24%] w-[26%] rotate-45 rounded-full bg-[#5f8a5c]" />
      </>
    );
  }

  return (
    <>
      <span className="absolute bottom-[18%] left-[18%] h-[54%] w-[64%] rounded-[16px] bg-[#766b60] shadow-[inset_0_8px_0_rgba(255,255,255,0.16)]" />
      <span className="absolute bottom-[61%] left-[35%] h-[26%] w-[30%] rounded-full bg-white/30" />
    </>
  );
}

const REPLACEMENT_ISOMETRIC_PALETTES: Record<
  ReplacementPreviewFamilyId,
  { body: string; top: string; side: string; glow: string }
> = {
  chair: {
    body: "#4c453f",
    top: "#756a60",
    side: "#2f2b28",
    glow: "rgba(244, 171, 94, 0.32)"
  },
  sofa: {
    body: "#514a52",
    top: "#746b75",
    side: "#332f35",
    glow: "rgba(140, 174, 255, 0.28)"
  },
  desk: {
    body: "#9a714a",
    top: "#c28f5e",
    side: "#634733",
    glow: "rgba(247, 177, 95, 0.35)"
  },
  table: {
    body: "#92715a",
    top: "#c0966d",
    side: "#5f493b",
    glow: "rgba(247, 177, 95, 0.35)"
  },
  storage: {
    body: "#8d6746",
    top: "#b98255",
    side: "#5a412f",
    glow: "rgba(223, 164, 104, 0.32)"
  },
  display: {
    body: "#20222a",
    top: "#3b4150",
    side: "#101219",
    glow: "rgba(108, 140, 255, 0.38)"
  },
  lighting: {
    body: "#514337",
    top: "#fff0bf",
    side: "#2f2924",
    glow: "rgba(255, 209, 111, 0.58)"
  },
  plant: {
    body: "#4f6746",
    top: "#6f935f",
    side: "#334832",
    glow: "rgba(114, 184, 112, 0.34)"
  },
  decor: {
    body: "#75695f",
    top: "#a79788",
    side: "#4c443e",
    glow: "rgba(198, 174, 143, 0.3)"
  },
  generic: {
    body: "#766b60",
    top: "#a39484",
    side: "#4d453f",
    glow: "rgba(198, 174, 143, 0.3)"
  }
};

function clampPreviewMetric(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

function ReplacementIsometricDetail({ family }: { family: ReplacementPreviewFamilyId }) {
  if (family === "display") {
    return (
      <>
        <span className="absolute bottom-[52%] left-[15%] h-[27%] w-[70%] rounded-[5px] bg-[#0d1018] shadow-[inset_0_0_0_2px_rgba(255,255,255,0.08)]" />
        <span className="absolute bottom-[57%] left-[22%] h-[16%] w-[56%] rounded-[4px] bg-[linear-gradient(135deg,#42506b,#121622)]" />
      </>
    );
  }

  if (family === "plant") {
    return (
      <>
        <span className="absolute bottom-[54%] left-[28%] h-[22%] w-[23%] -rotate-12 rounded-full bg-[#5f8a5c]" />
        <span className="absolute bottom-[57%] left-[45%] h-[27%] w-[22%] rotate-12 rounded-full bg-[#2f5d3c]" />
        <span className="absolute bottom-[48%] right-[20%] h-[20%] w-[21%] rotate-45 rounded-full bg-[#79a36b]" />
      </>
    );
  }

  if (family === "lighting") {
    return (
      <>
        <span className="absolute bottom-[44%] left-[47%] h-[30%] w-[5%] origin-bottom -rotate-12 rounded-full bg-[#3d3328]" />
        <span className="absolute bottom-[67%] left-[43%] h-[18%] w-[30%] -rotate-12 rounded-full bg-[#fff2c8] shadow-[0_0_24px_rgba(255,210,126,0.7)]" />
      </>
    );
  }

  if (family === "desk" || family === "table") {
    return (
      <>
        <span className="absolute bottom-[45%] left-[10%] h-[10%] w-[80%] rounded-[5px] bg-white/18" />
        {family === "desk" ? (
          <span className="absolute bottom-[56%] left-[42%] h-[15%] w-[22%] rounded-t-[4px] bg-[#f1e2c8]/60" />
        ) : null}
      </>
    );
  }

  if (family === "storage") {
    return (
      <>
        <span className="absolute bottom-[46%] left-[17%] h-px w-[66%] bg-black/22" />
        <span className="absolute bottom-[31%] left-[20%] h-[6%] w-[22%] rounded-full bg-white/26" />
        <span className="absolute bottom-[31%] right-[20%] h-[6%] w-[22%] rounded-full bg-white/26" />
      </>
    );
  }

  if (family === "chair" || family === "sofa") {
    return (
      <>
        <span className="absolute bottom-[41%] left-[14%] h-[8%] w-[72%] rounded-full bg-white/16" />
        <span className="absolute bottom-[18%] left-[18%] h-[6%] w-[13%] rounded-full bg-black/24" />
        <span className="absolute bottom-[18%] right-[18%] h-[6%] w-[13%] rounded-full bg-black/24" />
      </>
    );
  }

  return <span className="absolute bottom-[58%] left-[36%] h-[19%] w-[28%] rounded-full bg-white/24" />;
}

function ReplacementIsometricPreview({
  family,
  scale,
  compact = false,
  testId
}: {
  family: ReplacementPreviewFamilyId;
  scale: ReplacementCatalogCandidate["previewScale"];
  compact?: boolean;
  testId: string;
}) {
  const palette = REPLACEMENT_ISOMETRIC_PALETTES[family];
  const widthPercent = Math.round(clampPreviewMetric(scale.width, 0.28, 1) * (compact ? 54 : 62) + 24);
  const depthPercent = Math.round(clampPreviewMetric(scale.depth, 0.24, 1) * (compact ? 36 : 44) + 20);
  const heightPercent = Math.round(clampPreviewMetric(scale.height, 0.3, 1) * (compact ? 44 : 54) + 20);
  const footprintStyle = {
    width: `${widthPercent}%`,
    height: `${depthPercent}%`,
    transform: "translateX(-50%) rotateX(62deg) rotateZ(-34deg)",
    background: `linear-gradient(135deg, ${palette.top}, ${palette.side})`,
    boxShadow: `0 ${compact ? 8 : 14}px ${compact ? 15 : 26}px rgba(20, 16, 12, 0.2), 0 0 ${
      compact ? 16 : 28
    }px ${palette.glow}`
  } satisfies CSSProperties;
  const objectStyle = {
    width: `${Math.min(90, widthPercent + 2)}%`,
    height: `${Math.min(88, heightPercent)}%`,
    transform: "translateX(-50%) rotateX(8deg) rotateZ(-2deg)",
    transformStyle: "preserve-3d"
  } satisfies CSSProperties;
  const volumeStyle = {
    background: `linear-gradient(160deg, ${palette.top}, ${palette.body} 58%, ${palette.side})`,
    boxShadow: `inset 9px 10px 0 rgba(255,255,255,0.12), inset -10px -12px 0 rgba(0,0,0,0.14), 0 ${
      compact ? 6 : 10
    }px ${compact ? 12 : 18}px rgba(23, 19, 15, 0.24)`
  } satisfies CSSProperties;
  const silhouetteStyle = {
    transform: "translate3d(-50%, 0, 16px)",
    width: `${Math.min(82, widthPercent)}%`,
    height: `${Math.min(82, heightPercent + 4)}%`
  } satisfies CSSProperties;

  return (
    <span
      aria-hidden="true"
      className="absolute inset-0 overflow-hidden"
      data-preview-mode="isometric-proxy"
      data-testid={testId}
      style={{ perspective: compact ? "230px" : "360px" }}
    >
      <span
        className="absolute bottom-[12%] left-1/2 rounded-[12px] opacity-70 blur-[0.2px]"
        style={footprintStyle}
      />
      <span
        className="absolute bottom-[18%] left-1/2 z-[1] rounded-[11px] opacity-95"
        style={objectStyle}
      >
        <span className="absolute inset-x-[12%] bottom-[12%] h-[42%] rounded-[10px]" style={volumeStyle} />
        <span
          className="absolute inset-x-[18%] bottom-[52%] h-[17%] rounded-[8px] opacity-90"
          style={{
            background: palette.top,
            transform: "skewX(-22deg) translateY(10%)"
          }}
        />
        <ReplacementIsometricDetail family={family} />
      </span>
      <span className="absolute bottom-[16%] left-1/2 z-[2]" style={silhouetteStyle}>
        <ReplacementSilhouette family={family} />
      </span>
      <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_28%_18%,rgba(255,235,194,0.42),transparent_34%),radial-gradient(circle_at_78%_22%,rgba(122,154,255,0.22),transparent_38%)]" />
    </span>
  );
}

function ReplacementPreviewStage({
  candidate,
  thumbnail
}: {
  candidate: ReplacementCatalogCandidate;
  thumbnail: string | null;
}) {
  const item = candidate.item;
  const preview = getCatalogPreviewClasses(item.tone);
  const useThumbnail = hasSpecificCatalogThumbnail(item, thumbnail);
  const useLiveModelPreview =
    !useThumbnail &&
    candidate.matchLabel !== "검토" &&
    isCatalogLiveModelPreviewEligible(item);
  const previewScale = candidate.previewScale;
  const generationBadge = getCatalogGenerationBadge(item);
  const shadowStyle = {
    width: `${Math.round(previewScale.width * 64 + previewScale.depth * 18 + 14)}%`
  } satisfies CSSProperties;

  return (
    <span
      className={`relative flex aspect-[4/3] overflow-hidden rounded-[10px] border border-black/10 ${preview.surface}`}
      data-testid={`asset-replacement-preview-${item.id}`}
    >
      <span className="absolute inset-x-0 bottom-0 h-[42%] bg-[linear-gradient(180deg,rgba(255,255,255,0),rgba(0,0,0,0.08))]" />
      <span className="absolute inset-x-3 bottom-3 h-px bg-black/10" />
      <span
        className="absolute bottom-3 left-1/2 h-2 -translate-x-1/2 rounded-full bg-black/15 blur-[2px]"
        style={shadowStyle}
      />
      {useThumbnail && thumbnail ? (
        <img
          src={thumbnail}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          className="relative z-[1] h-full w-full object-contain p-2.5 transition duration-200 group-hover:scale-[1.03]"
        />
      ) : (
        <ReplacementIsometricPreview
          family={candidate.previewFamily}
          scale={candidate.previewScale}
          testId={`asset-replacement-isometric-preview-${item.id}`}
        />
      )}
      {useLiveModelPreview ? (
        <CatalogLiveModelPreview
          item={item}
          testId={`asset-replacement-live-preview-${item.id}`}
        />
      ) : null}
      <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-white/15" />
      <span
        className={`absolute left-2 top-2 z-10 rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em] ${
          candidate.matchLabel === "추천"
            ? "bg-[#173f2a] text-white"
            : candidate.matchLabel === "호환"
              ? "bg-[#171411] text-white"
              : "bg-[#8a5b12] text-white"
        }`}
      >
        {candidate.matchLabel} {candidate.matchPercent}
      </span>
      <span className="absolute bottom-2 right-2 z-10 rounded-full bg-white/75 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.08em] text-[#5f574d] backdrop-blur">
        {candidate.dimensionFitLabel}
      </span>
      {generationBadge ? (
        <span
          className="absolute bottom-2 left-2 z-10 rounded-full border border-white/50 bg-white/82 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.08em] text-[#5f574d] backdrop-blur"
          data-testid={`asset-replacement-generated-badge-${item.id}`}
        >
          {generationBadge.label}
        </span>
      ) : null}
    </span>
  );
}

function ReplacementItemButton({
  candidate,
  selectedAssetId,
  onReplace
}: {
  candidate: ReplacementCatalogCandidate;
  selectedAssetId: string;
  onReplace: (id: string, item: LibraryCatalogItem) => void;
}) {
  const item = candidate.item;
  const thumbnail = item.thumbnail?.trim();

  return (
    <button
      type="button"
      onClick={() => onReplace(selectedAssetId, item)}
      className="group min-w-0 rounded-[14px] border border-black/10 bg-white p-2 text-left transition hover:border-black/25 hover:bg-[#fbfaf8]"
      aria-label={`${item.label}로 교체`}
      data-testid={`asset-replacement-${item.id}`}
    >
      <ReplacementPreviewStage candidate={candidate} thumbnail={thumbnail ?? null} />
      <span className="mt-2 block min-w-0 text-[10px] font-semibold leading-4 text-[#1f1b16]">
        {item.label}
      </span>
      <span className="mt-0.5 block min-w-0 truncate text-[9px] font-semibold uppercase tracking-[0.1em] text-[#8b8277]">
        {candidate.detailLabel}
      </span>
      <span className="mt-1 inline-flex rounded-full border border-black/10 bg-[#f7f4ee] px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.08em] text-[#6d6258]">
        {candidate.roomZone.label}
      </span>
      <span className="mt-0.5 block min-w-0 truncate text-[9px] uppercase tracking-[0.1em] text-[#aaa198]">
        {item.collection}
      </span>
    </button>
  );
}

export function BuilderInspectorPanel({
  visible,
  layout = "overlay",
  className,
  topMode,
  transformMode,
  transformSpace,
  wallMaterialIndex,
  floorMaterialIndex,
  ceilingMaterialIndex,
  lighting,
  lightingBoundsMm,
  wallsCount,
  floorsCount,
  assetsCount,
  placedZoneSummaries,
  catalogItems,
  selectedAsset,
  selectedAssetMeta,
  replacementItems,
  surfaceLockInfo,
  onTransformModeChange,
  onTransformSpaceChange,
  onWallMaterialChange,
  onFloorMaterialChange,
  onCeilingMaterialChange,
  onLightingChange,
  onLightingCommit,
  onApplyLightingPreset,
  onApplyRoomMoodRecipe,
  onApplyRoomStylingBundle,
  onReplaceAsset,
  onSelectPlacedAsset,
  onApplyPlacedZoneReplacements,
  onUpdateAsset,
  onRemoveAsset,
  formatAssetLabel
}: BuilderInspectorPanelProps) {
  const anchorLabel: Record<SceneAnchorType, string> = {
    floor: "바닥",
    wall: "벽",
    ceiling: "천장",
    furniture_surface: "가구 표면",
    desk_surface: "데스크 표면",
    shelf_surface: "선반 표면"
  };
  const isYManagedByAnchor =
    selectedAsset?.anchorType === "floor" ||
    selectedAsset?.anchorType === "ceiling" ||
    selectedAsset?.anchorType === "desk_surface" ||
    selectedAsset?.anchorType === "furniture_surface" ||
    selectedAsset?.anchorType === "shelf_surface";
  const isRotationManagedByAnchor = selectedAsset?.anchorType === "wall";
  const productDimensions = selectedAsset?.product?.dimensionsMm ?? selectedAssetMeta?.dimensionsMm ?? null;
  const productFinishColor = selectedAsset?.product?.finishColor ?? selectedAssetMeta?.finishColor ?? null;
  const productFinishMaterial = selectedAsset?.product?.finishMaterial ?? selectedAssetMeta?.finishMaterial ?? null;
  const productDetailNotes = selectedAsset?.product?.detailNotes ?? selectedAssetMeta?.detailNotes ?? null;
  const scaleLocked =
    selectedAsset?.product?.scaleLocked ?? selectedAssetMeta?.scaleLocked ?? false;
  const dimensionsLabel = formatDimensionsMm(productDimensions);
  const selectedRoomZone = selectedAsset
    ? inferReplacementRoomZone(selectedAssetMeta, selectedAsset.assetId)
    : null;
  const selectedGenerationBadge = selectedAssetMeta ? getCatalogGenerationBadge(selectedAssetMeta) : null;
  const roomStylingBundlePreviews = useMemo(
    () =>
      new Map(
        EDITOR_ROOM_STYLING_BUNDLES.map((bundle) => [
          bundle.id,
          describeEditorRoomStylingBundle({
            catalog: catalogItems,
            clusterIds: bundle.clusterIds
          })
        ])
      ),
    [catalogItems]
  );
  const selectedRoomZoneId = selectedRoomZone?.id ?? null;
  const directLightingGridRef = useRef<HTMLDivElement | null>(null);
  const [draggingFixtureId, setDraggingFixtureId] = useState<string | null>(null);
  const [replacementZoneScope, setReplacementZoneScope] = useState<
    "same-zone" | "all" | ReplacementRoomZoneId
  >("same-zone");
  useEffect(() => {
    setReplacementZoneScope("same-zone");
  }, [selectedAsset?.id]);
  const sameZoneReplacementItems = useMemo(() => {
    if (!selectedRoomZoneId) return replacementItems;
    return replacementItems.filter(
      (candidate) =>
        candidate.roomZone.id === selectedRoomZoneId ||
        candidate.roomZone.id === "flex" ||
        selectedRoomZoneId === "flex"
    );
  }, [replacementItems, selectedRoomZoneId]);
  const canFilterSameZone =
    selectedRoomZone !== null &&
    sameZoneReplacementItems.length > 0 &&
    sameZoneReplacementItems.length < replacementItems.length;
  const replacementZoneSummaries = useMemo(
    () => buildReplacementZoneSummary(replacementItems, selectedRoomZone),
    [replacementItems, selectedRoomZone]
  );
  const replacementTopCandidateByZone = useMemo(() => {
    const candidatesByZone = new Map<ReplacementRoomZoneId, ReplacementCatalogCandidate>();
    replacementZoneSummaries.forEach((summary) => {
      const candidate = replacementItems.find((item) => item.item.id === summary.topCandidateItemId);
      if (candidate) {
        candidatesByZone.set(summary.zone.id, candidate);
      }
    });
    return candidatesByZone;
  }, [replacementItems, replacementZoneSummaries]);
  const visibleReplacementItems = useMemo(() => {
    if (replacementZoneScope === "same-zone" && canFilterSameZone) {
      return sameZoneReplacementItems;
    }
    if (replacementZoneScope === "all" || replacementZoneScope === "same-zone") {
      return replacementItems;
    }
    const zoneItems = replacementItems.filter((candidate) => candidate.roomZone.id === replacementZoneScope);
    return zoneItems.length > 0 ? zoneItems : replacementItems;
  }, [
    canFilterSameZone,
    replacementItems,
    replacementZoneScope,
    sameZoneReplacementItems
  ]);
  const directLightingFixtures = useMemo(
    () => resolveLightingFixtures(lighting.fixtures, lightingBoundsMm, 3),
    [lighting.fixtures, lightingBoundsMm]
  );
  const activeFixtureTemperature =
    directLightingFixtures.length > 0 &&
    directLightingFixtures.every(
      (fixture) => fixture.colorTemperature === directLightingFixtures[0]?.colorTemperature
    )
      ? directLightingFixtures[0]?.colorTemperature
      : null;
  const applyDirectFixtures = (nextFixtures: LightingFixture[], commit = false) => {
    onLightingChange({
      mode: "direct",
      fixtures: normalizeLightingFixtures(nextFixtures, lightingBoundsMm)
    });
    if (commit) {
      onLightingCommit();
    }
  };
  const updateDirectFixtures = (nextFixtures: LightingFixture[]) => applyDirectFixtures(nextFixtures, true);
  const setDirectFixtureCount = (count: number) => {
    updateDirectFixtures(
      createDefaultDirectLightingFixtures(
        lightingBoundsMm,
        normalizeDirectLightCount(count),
        directLightingFixtures[0]
      )
    );
  };
  const setDirectFixtureTemperature = (colorTemperature: LightingColorTemperature) => {
    updateDirectFixtures(
      directLightingFixtures.map((fixture) => ({
        ...fixture,
        colorTemperature
      }))
    );
  };
  const resolveDirectFixturePointerPosition = (event: PointerEvent<HTMLElement>) => {
    const rect = directLightingGridRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const xRatio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const zRatio = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
    return resolveLightingPositionMmFromNormalized(xRatio, zRatio, lightingBoundsMm);
  };
  const moveDirectFixtureFromPointer = (
    fixtureId: string,
    event: PointerEvent<HTMLElement>,
    commit = false
  ) => {
    const positionMm = resolveDirectFixturePointerPosition(event);
    if (!positionMm) return;
    applyDirectFixtures(
      directLightingFixtures.map((fixture) =>
        fixture.id === fixtureId
          ? {
              ...fixture,
              positionMm
            }
          : fixture
      ),
      commit
    );
  };
  const patchDirectFixture = (
    fixtureId: string,
    patch: Partial<LightingFixture>,
    commit = false
  ) => {
    applyDirectFixtures(
      directLightingFixtures.map((fixture) =>
        fixture.id === fixtureId
          ? {
              ...fixture,
              ...patch
            }
          : fixture
      ),
      commit
    );
  };
  const activeLightingPresetId = inferLightingPresetId(lighting);
  const roomMoodRecipeApplications = useMemo(
    () => ROOM_MOOD_RECIPES.map((recipe) => resolveRoomMoodRecipeApplication(recipe)),
    []
  );
  const activeRoomMoodRecipeId =
    roomMoodRecipeApplications.find(
      (recipe) =>
        recipe.wallMaterialIndex === wallMaterialIndex &&
        recipe.floorMaterialIndex === floorMaterialIndex &&
        recipe.ceilingMaterialIndex === ceilingMaterialIndex &&
        recipe.lightingPresetId === activeLightingPresetId
    )?.id ?? null;
  const topModeLabel = topMode === "room" ? "룸 배치" : "데스크 정밀";
  const usesSurfaceLock = isSupportAnchorType(selectedAsset?.anchorType);
  const surfaceLockStatus = surfaceLockInfo
    ? surfaceLockInfo.withinUsableBounds
      ? {
          label: "Locked",
          className: "border border-emerald-200 bg-emerald-50 text-emerald-700"
        }
      : {
          label: "Overflow",
          className: "border border-amber-200 bg-amber-50 text-amber-700"
        }
    : usesSurfaceLock
      ? {
          label: "Pending",
          className: "border border-amber-200 bg-amber-50 text-amber-700"
        }
      : {
          label: "Off",
          className: "border border-black/10 bg-[#f4f1eb] text-[#7a7064]"
        };
  const topModeDescription =
    topMode === "room"
      ? "제품 본체를 직접 드래그해 큰 위치를 옮깁니다. 250mm 그리드와 월드 기준 정렬만 유지합니다."
      : "선택한 제품에 gizmo를 붙여 surface/anchor 기준 미세 위치와 회전을 조정합니다. 5mm / 1도 snap과 1mm 숫자 입력을 사용합니다.";
  const containerClassName =
    layout === "inline"
      ? `flex h-full min-h-0 flex-col bg-white ${className ?? ""}`.trim()
      : `absolute inset-y-3 right-3 z-[30] flex w-[min(86vw,340px)] flex-col rounded-[24px] border border-black/10 bg-white/96 shadow-[0_18px_44px_rgba(17,19,22,0.14)] backdrop-blur-xl transition-all duration-300 xl:inset-y-5 xl:right-5 ${
          visible ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-[108%] opacity-0"
        } ${className ?? ""}`.trim();

  return (
    <aside className={containerClassName}>
      <div className="border-b border-black/10 px-4 py-4">
        <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#6f665b]">
          <SlidersHorizontal className="h-4 w-4" />
          속성 패널
        </div>
        <p className="mt-2 text-sm leading-6 text-[#5f574d]">
          마감재와 선택한 제품의 배치/변형 값을 조정합니다.
        </p>
      </div>
      <div className="flex-1 space-y-6 overflow-y-auto px-4 py-4">
        <div className="space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#7a7064]">편집 정책</p>
          <div className="rounded-[20px] border border-black/10 bg-[#faf9f7] p-4">
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#4e473d]">
              {topModeLabel}
            </div>
            <p className="mt-2 text-[12px] leading-6 text-[#746b60]">{topModeDescription}</p>
          </div>
        </div>

        <div className="space-y-3" data-testid="editor-room-mood-recipes">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#7a7064]">무드 레시피</p>
          <div className="grid gap-2">
            {ROOM_MOOD_RECIPES.map((recipe) => {
              const application = roomMoodRecipeApplications.find((item) => item.id === recipe.id);
              if (!application) return null;
              const isActive = activeRoomMoodRecipeId === recipe.id;
              const swatches = getRoomMoodRecipeSwatches(recipe);
              return (
                <button
                  key={recipe.id}
                  type="button"
                  onClick={() => onApplyRoomMoodRecipe(application)}
                  className={`rounded-[18px] border px-3 py-3 text-left transition ${
                    isActive
                      ? "border-[#1f1b16] bg-[#1f1b16] text-white"
                      : "border-black/10 bg-[#faf9f7] text-[#4e473d] hover:border-black/20 hover:bg-white"
                  }`}
                  data-testid={`editor-room-mood-recipe-${recipe.id}`}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block text-[10px] font-bold uppercase tracking-[0.16em]">
                        {recipe.label}
                      </span>
                      <span
                        className={`mt-1 block text-[11px] leading-4 ${
                          isActive ? "text-white/72" : "text-[#746b60]"
                        }`}
                      >
                        {recipe.description}
                      </span>
                    </span>
                    <span className="flex shrink-0 overflow-hidden rounded-full border border-black/10">
                      {swatches.map((color, index) => (
                        <span
                          key={`${recipe.id}-${index}`}
                          aria-hidden="true"
                          className="h-7 w-7"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3" data-testid="editor-room-styling-bundles">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#7a7064]">스타일링 번들</p>
          <div className="grid grid-cols-2 gap-2">
            {EDITOR_ROOM_STYLING_BUNDLES.map((bundle) => {
              const preview = roomStylingBundlePreviews.get(bundle.id);
              const providerLabel = preview?.generatedProviderLabels.join(" + ") ?? "AI";

              return (
                <button
                  key={bundle.id}
                  type="button"
                  onClick={() => onApplyRoomStylingBundle(bundle.id, bundle.clusterIds, bundle.label)}
                  className="min-h-[124px] rounded-[18px] border border-black/10 bg-[#faf9f7] px-3 py-3 text-left text-[#4e473d] transition hover:border-black/20 hover:bg-white"
                  data-testid={`editor-room-styling-bundle-${bundle.id}`}
                >
                  <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em]">
                    <Sparkles className="h-3.5 w-3.5 text-[#9a6a1f]" />
                    {bundle.label}
                  </span>
                  <span className="mt-2 block text-[11px] leading-4 text-[#746b60]">{bundle.description}</span>
                  <span className="mt-2 block text-[9px] font-bold uppercase tracking-[0.12em] text-[#9a6a1f]">
                    {preview?.assetCount ?? bundle.clusterIds.length}개 구성
                  </span>
                  {preview && preview.generatedAssetCount > 0 ? (
                    <span
                      className="mt-2 inline-flex max-w-full items-center gap-1 rounded-full border border-[#b87915]/25 bg-[#fff5df] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.1em] text-[#8a5b18]"
                      data-testid={`editor-room-styling-bundle-generated-badge-${bundle.id}`}
                    >
                      <Sparkles className="h-3 w-3 shrink-0" />
                      <span className="truncate">
                        {providerLabel} 생성 {preview.generatedAssetCount}개
                        {preview.requiresGeneratedReview ? " · 검수 필요" : ""}
                      </span>
                    </span>
                  ) : null}
                  <span className="mt-3 flex gap-1">
                    {bundle.clusterIds.map((clusterId) => (
                      <span
                        key={`${bundle.id}-${clusterId}`}
                        className="h-1.5 flex-1 rounded-full bg-[#1f1b16]/20"
                        aria-hidden="true"
                      />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {topMode === "desk-precision" ? (
          <>
            <div className="space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#7a7064]">변형 모드</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "translate", label: "이동" },
                  { id: "rotate", label: "회전" }
                ].map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => onTransformModeChange(mode.id as TransformMode)}
                    className={`rounded-full px-4 py-3 text-[10px] font-bold uppercase tracking-[0.16em] transition ${
                      transformMode === mode.id
                        ? "bg-[#1c1a17] text-white"
                        : "border border-black/10 bg-[#f4f4f1] text-[#4e473d] hover:border-black/20 hover:bg-white"
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#7a7064]">좌표계</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "world", label: "월드" },
                  { id: "local", label: "로컬" }
                ].map((space) => (
                  <button
                    key={space.id}
                    type="button"
                    onClick={() => onTransformSpaceChange(space.id as TransformSpace)}
                    className={`rounded-full px-4 py-3 text-[10px] font-bold uppercase tracking-[0.16em] transition ${
                      transformSpace === space.id
                        ? "bg-[#1c1a17] text-white"
                        : "border border-black/10 bg-[#f4f4f1] text-[#4e473d] hover:border-black/20 hover:bg-white"
                    }`}
                  >
                    {space.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] leading-5 text-[#82796d]">
                월드는 방 기준, 로컬은 선택한 제품 기준 축으로 이동/회전합니다.
              </p>
            </div>
          </>
        ) : null}

        <div className="space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#7a7064]">벽 마감</p>
          <div className="grid grid-cols-2 gap-2">
            {builderWallFinishes.map((finish) => {
              const preset = WALL_TEXTURE_PRESETS[finish.id] ?? WALL_TEXTURE_PRESETS[0];
              return (
                <button
                  key={finish.id}
                  type="button"
                  onClick={() => onWallMaterialChange(finish.id)}
                  className={`flex min-h-[72px] items-center gap-3 rounded-[16px] border px-2.5 py-2 text-left transition ${
                    wallMaterialIndex === finish.id
                      ? "border-[#1c1a17] bg-[#1c1a17] text-white"
                      : "border-black/10 bg-[#f4f4f1] text-[#5f584e] hover:border-black/20 hover:bg-white"
                  }`}
                >
                  <span
                    aria-hidden
                    className="h-11 w-11 shrink-0 rounded-[10px] border border-black/10 bg-cover bg-center"
                    style={materialPreviewStyle(preset)}
                  />
                  <span className="min-w-0">
                    <span className="block text-[10px] font-bold uppercase tracking-[0.12em]">{finish.name}</span>
                    <span className={`mt-1 block text-[10px] ${wallMaterialIndex === finish.id ? "text-white/65" : "text-[#81786c]"}`}>
                      {finish.category}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#7a7064]">바닥 마감</p>
          <div className="grid grid-cols-2 gap-2">
            {builderFloorFinishes.map((finish) => {
              const preset = FLOOR_TEXTURE_PRESETS[finish.id] ?? FLOOR_TEXTURE_PRESETS[0];
              return (
                <button
                  key={finish.id}
                  type="button"
                  onClick={() => onFloorMaterialChange(finish.id)}
                  className={`flex min-h-[72px] items-center gap-3 rounded-[16px] border px-2.5 py-2 text-left transition ${
                    floorMaterialIndex === finish.id
                      ? "border-[#1c1a17] bg-[#1c1a17] text-white"
                      : "border-black/10 bg-[#f4f4f1] text-[#5f584e] hover:border-black/20 hover:bg-white"
                  }`}
                >
                  <span
                    aria-hidden
                    className="h-11 w-11 shrink-0 rounded-[10px] border border-black/10 bg-cover bg-center"
                    style={materialPreviewStyle(preset)}
                  />
                  <span className="min-w-0">
                    <span className="block text-[10px] font-bold uppercase tracking-[0.12em]">{finish.name}</span>
                    <span className={`mt-1 block text-[10px] ${floorMaterialIndex === finish.id ? "text-white/65" : "text-[#81786c]"}`}>
                      {finish.category}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#7a7064]">천장 마감</p>
          <div className="grid grid-cols-2 gap-2">
            {builderCeilingFinishes.map((finish) => {
              const preset = CEILING_TEXTURE_PRESETS[finish.id] ?? CEILING_TEXTURE_PRESETS[0];
              return (
                <button
                  key={finish.id}
                  type="button"
                  onClick={() => onCeilingMaterialChange(finish.id)}
                  className={`flex min-h-[72px] items-center gap-3 rounded-[16px] border px-2.5 py-2 text-left transition ${
                    ceilingMaterialIndex === finish.id
                      ? "border-[#1c1a17] bg-[#1c1a17] text-white"
                      : "border-black/10 bg-[#f4f4f1] text-[#5f584e] hover:border-black/20 hover:bg-white"
                  }`}
                >
                  <span
                    aria-hidden
                    className="h-11 w-11 shrink-0 rounded-[10px] border border-black/10 bg-cover bg-center"
                    style={materialPreviewStyle(preset)}
                  />
                  <span className="min-w-0">
                    <span className="block text-[10px] font-bold uppercase tracking-[0.12em]">{finish.name}</span>
                    <span className={`mt-1 block text-[10px] ${ceilingMaterialIndex === finish.id ? "text-white/65" : "text-[#81786c]"}`}>
                      {finish.category}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3 rounded-[20px] border border-black/10 bg-[#faf9f7] p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#7a7064]">조명</p>
          <div className="grid gap-2">
            {LIGHTING_PRESETS.map((preset) => {
              const isActive = activeLightingPresetId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onApplyLightingPreset(preset.id)}
                  className={`rounded-[16px] border px-3 py-2 text-left transition ${
                    isActive
                      ? "border-[#1c1a17] bg-[#1c1a17] text-white"
                      : "border-black/10 bg-white text-[#4e473d] hover:border-black/20"
                  }`}
                >
                  <div className="text-[10px] font-bold uppercase tracking-[0.16em]">{preset.label}</div>
                  <div className={`mt-1 text-[11px] leading-4 ${isActive ? "text-white/80" : "text-[#6f665a]"}`}>
                    {preset.description}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="space-y-3 rounded-[16px] border border-black/10 bg-white p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#7a7064]">
                  광원 방식
                </div>
                <div className="mt-1 text-[11px] leading-4 text-[#80766a]">
                  Direct는 빔을, Indirect는 천장 확산광을 사용합니다.
                </div>
              </div>
              <div
                className="grid shrink-0 grid-cols-2 rounded-full border border-black/10 bg-[#f4f1eb] p-0.5"
                data-testid="editor-lighting-mode-controls"
              >
                {[
                  { id: "direct", label: "Direct" },
                  { id: "indirect", label: "Indirect" }
                ].map((mode) => {
                  const isActive = lighting.mode === mode.id;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => {
                        onLightingChange({ mode: mode.id as LightingSettings["mode"] });
                        onLightingCommit();
                      }}
                      className={`rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.08em] transition ${
                        isActive ? "bg-[#1f1b16] text-white" : "text-[#7a7064] hover:bg-white"
                      }`}
                      data-testid={`editor-lighting-mode-${mode.id}`}
                    >
                      {mode.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {lighting.mode === "direct" ? (
              <div className="space-y-3" data-testid="editor-direct-lighting-layout">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#7a7064]">
                    Fixture Layout
                  </div>
                  <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#9a6a1f]">
                    Snap {DEFAULT_LIGHTING_GRID_SNAP_MM}mm
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {DIRECT_LIGHT_COUNT_OPTIONS.map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setDirectFixtureCount(count)}
                      className={`rounded-full border px-2.5 py-1.5 text-[10px] font-bold transition ${
                        directLightingFixtures.length === count
                          ? "border-[#1f1b16] bg-[#1f1b16] text-white"
                          : "border-black/10 bg-[#fbfaf7] text-[#5d554a] hover:border-black/20"
                      }`}
                      data-testid={`editor-lighting-count-${count}`}
                    >
                      {count}개
                    </button>
                  ))}
                </div>
                <div
                  ref={directLightingGridRef}
                  className="relative aspect-[4/3] overflow-hidden rounded-[14px] border border-black/10 bg-[linear-gradient(90deg,rgba(0,0,0,0.05)_1px,transparent_1px),linear-gradient(rgba(0,0,0,0.05)_1px,transparent_1px)] bg-[length:26px_26px] bg-[#ede8df]"
                  data-testid="editor-lighting-grid"
                >
                  {directLightingFixtures.map((fixture, index) => (
                    <button
                      key={fixture.id}
                      type="button"
                      onPointerDown={(event) => {
                        event.preventDefault();
                        event.currentTarget.setPointerCapture(event.pointerId);
                        setDraggingFixtureId(fixture.id);
                        moveDirectFixtureFromPointer(fixture.id, event);
                      }}
                      onPointerMove={(event) => {
                        if (draggingFixtureId !== fixture.id) return;
                        moveDirectFixtureFromPointer(fixture.id, event);
                      }}
                      onPointerUp={(event) => {
                        event.preventDefault();
                        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                          event.currentTarget.releasePointerCapture(event.pointerId);
                        }
                        setDraggingFixtureId(null);
                        moveDirectFixtureFromPointer(fixture.id, event, true);
                      }}
                      onPointerCancel={() => setDraggingFixtureId(null)}
                      className="absolute grid size-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-[#f2b65b] text-[10px] font-black text-[#171411] shadow-[0_8px_18px_rgba(71,50,22,0.24)]"
                      style={resolveFixtureGridPosition(fixture, lightingBoundsMm)}
                      data-testid="editor-lighting-fixture-marker"
                      data-position-x-mm={fixture.positionMm[0]}
                      data-position-z-mm={fixture.positionMm[2]}
                      aria-label={`조명 ${index + 1} 위치 조정`}
                    >
                      {index + 1}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-1.5" data-testid="editor-lighting-temperature-controls">
                  {DIRECT_LIGHT_TEMPERATURE_OPTIONS.map((option) => {
                    const isActive = activeFixtureTemperature === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setDirectFixtureTemperature(option.id)}
                        className={`min-w-0 rounded-[12px] border px-2 py-2 text-left transition ${
                          isActive
                            ? "border-[#1f1b16] bg-[#1f1b16] text-white"
                            : "border-black/10 bg-[#fbfaf7] text-[#5d554a] hover:border-black/20"
                        }`}
                        data-testid={`editor-lighting-temperature-${option.id}`}
                      >
                        <span
                          aria-hidden
                          className="mb-1 block h-2 rounded-full"
                          style={{ backgroundColor: option.color }}
                        />
                        <span className="block truncate text-[9px] font-bold uppercase tracking-[0.08em]">
                          {option.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="space-y-2" data-testid="editor-lighting-fixture-detail-controls">
                  <div className="flex items-center justify-between gap-2 text-[9px] font-bold uppercase tracking-[0.12em] text-[#8b8277]">
                    <span>개별 조명</span>
                    <span>{DEFAULT_LIGHTING_GRID_SNAP_MM}mm snap</span>
                  </div>
                  {directLightingFixtures.map((fixture, index) => {
                    const isFixtureEnabled = fixture.enabled !== false;
                    return (
                      <div
                        key={fixture.id}
                        className="space-y-2 rounded-[14px] border border-black/10 bg-[#fbfaf7] p-2.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-[10px] font-black uppercase tracking-[0.12em] text-[#1f1b16]">
                              조명 {index + 1}
                            </div>
                            <div className="mt-1 truncate text-[9px] font-semibold text-[#8b8277]">
                              X {formatMetersFromMillimeters(fixture.positionMm[0])} · Z{" "}
                              {formatMetersFromMillimeters(fixture.positionMm[2])}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              patchDirectFixture(fixture.id, { enabled: !isFixtureEnabled }, true)
                            }
                            className={`shrink-0 rounded-full border px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em] transition ${
                              isFixtureEnabled
                                ? "border-[#1f1b16] bg-[#1f1b16] text-white"
                                : "border-black/10 bg-white text-[#8b8277]"
                            }`}
                            aria-pressed={isFixtureEnabled}
                            data-testid="editor-lighting-fixture-enabled"
                          >
                            {isFixtureEnabled ? "On" : "Off"}
                          </button>
                        </div>
                        <label className="block space-y-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[#7a7064]">
                          <span className="flex items-center justify-between gap-2">
                            <span>밝기</span>
                            <span className="font-semibold text-[#1f1b16]">
                              {fixture.intensity.toFixed(2)}
                            </span>
                          </span>
                          <input
                            type="range"
                            min="0.2"
                            max="1.8"
                            step="0.05"
                            value={fixture.intensity}
                            onChange={(event) =>
                              patchDirectFixture(fixture.id, { intensity: Number(event.target.value) })
                            }
                            onMouseUp={onLightingCommit}
                            onTouchEnd={onLightingCommit}
                            onBlur={onLightingCommit}
                            className="w-full accent-[#1c1a17]"
                            data-testid="editor-lighting-fixture-intensity"
                          />
                        </label>
                        <label className="block space-y-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[#7a7064]">
                          <span className="flex items-center justify-between gap-2">
                            <span>빔 반경</span>
                            <span className="font-semibold text-[#1f1b16]">
                              {formatMetersFromMillimeters(fixture.beamRadiusMm)}
                            </span>
                          </span>
                          <input
                            type="range"
                            min="600"
                            max="2200"
                            step="50"
                            value={fixture.beamRadiusMm}
                            onChange={(event) =>
                              patchDirectFixture(fixture.id, { beamRadiusMm: Number(event.target.value) })
                            }
                            onMouseUp={onLightingCommit}
                            onTouchEnd={onLightingCommit}
                            onBlur={onLightingCommit}
                            className="w-full accent-[#1c1a17]"
                            data-testid="editor-lighting-fixture-beam-radius"
                          />
                        </label>
                        <label className="block space-y-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[#7a7064]">
                          <span className="flex items-center justify-between gap-2">
                            <span>확산</span>
                            <span className="font-semibold text-[#1f1b16]">
                              {fixture.spread.toFixed(2)}
                            </span>
                          </span>
                          <input
                            type="range"
                            min="0.3"
                            max="1.05"
                            step="0.01"
                            value={fixture.spread}
                            onChange={(event) =>
                              patchDirectFixture(fixture.id, { spread: Number(event.target.value) })
                            }
                            onMouseUp={onLightingCommit}
                            onTouchEnd={onLightingCommit}
                            onBlur={onLightingCommit}
                            className="w-full accent-[#1c1a17]"
                            data-testid="editor-lighting-fixture-spread"
                          />
                        </label>
                      </div>
                    );
                  })}
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px] text-[#6f665b]">
                  <div className="rounded-[12px] border border-black/10 bg-[#fbfaf7] px-2.5 py-2">
                    <span className="block font-bold uppercase tracking-[0.12em] text-[#8b8277]">첫 조명</span>
                    <span className="mt-1 block font-semibold text-[#1f1b16]">
                      X {formatMetersFromMillimeters(directLightingFixtures[0]?.positionMm[0] ?? 0)}
                    </span>
                  </div>
                  <div className="rounded-[12px] border border-black/10 bg-[#fbfaf7] px-2.5 py-2">
                    <span className="block font-bold uppercase tracking-[0.12em] text-[#8b8277]">방향</span>
                    <span className="mt-1 block font-semibold text-[#1f1b16]">
                      Z {formatMetersFromMillimeters(directLightingFixtures[0]?.positionMm[2] ?? 0)}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div
                className="rounded-[14px] border border-black/10 bg-[#fbfaf7] px-3 py-3 text-[11px] leading-5 text-[#6f665b]"
                data-testid="editor-indirect-lighting-note"
              >
                간접등은 fixture marker 대신 천장 가장자리 glow와 전체 확산광으로 mood를 만듭니다.
              </div>
            )}
          </div>
          <label className="space-y-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#7a7064]">
            주변광
            <input
              type="range"
              min="0.05"
              max="1.2"
              step="0.05"
              value={lighting.ambientIntensity}
              onChange={(event) => onLightingChange({ ambientIntensity: Number(event.target.value) })}
              onMouseUp={onLightingCommit}
              onTouchEnd={onLightingCommit}
              className="w-full accent-[#1c1a17]"
            />
          </label>
          <label className="space-y-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#7a7064]">
            하늘광
            <input
              type="range"
              min="0.05"
              max="1.4"
              step="0.05"
              value={lighting.hemisphereIntensity}
              onChange={(event) => onLightingChange({ hemisphereIntensity: Number(event.target.value) })}
              onMouseUp={onLightingCommit}
              onTouchEnd={onLightingCommit}
              className="w-full accent-[#1c1a17]"
            />
          </label>
          <label className="space-y-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#7a7064]">
            직사광
            <input
              type="range"
              min="0.2"
              max="2.4"
              step="0.05"
              value={lighting.directionalIntensity}
              onChange={(event) => onLightingChange({ directionalIntensity: Number(event.target.value) })}
              onMouseUp={onLightingCommit}
              onTouchEnd={onLightingCommit}
              className="w-full accent-[#1c1a17]"
            />
          </label>
          <label className="space-y-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#7a7064]">
            환경 블러
            <input
              type="range"
              min="0"
              max="0.8"
              step="0.02"
              value={lighting.environmentBlur}
              onChange={(event) => onLightingChange({ environmentBlur: Number(event.target.value) })}
              onMouseUp={onLightingCommit}
              onTouchEnd={onLightingCommit}
              className="w-full accent-[#1c1a17]"
            />
          </label>
          <label className="space-y-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#7a7064]">
            액센트광
            <input
              type="range"
              min="0"
              max="1.4"
              step="0.01"
              value={lighting.accentIntensity}
              onChange={(event) => onLightingChange({ accentIntensity: Number(event.target.value) })}
              onMouseUp={onLightingCommit}
              onTouchEnd={onLightingCommit}
              className="w-full accent-[#1c1a17]"
            />
          </label>
          {lighting.mode === "direct" ? (
            <label className="space-y-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#7a7064]">
              빔 글로우
              <input
                type="range"
                min="0"
                max="0.45"
                step="0.01"
                value={lighting.beamOpacity}
                onChange={(event) => onLightingChange({ beamOpacity: Number(event.target.value) })}
                onMouseUp={onLightingCommit}
                onTouchEnd={onLightingCommit}
                className="w-full accent-[#1c1a17]"
              />
            </label>
          ) : null}
        </div>

        <div className="space-y-3 rounded-[20px] border border-black/10 bg-[#faf9f7] p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#7a7064]">공간 요약</p>
          <div className="space-y-2 text-sm text-[#4f473d]">
            <div className="flex items-center justify-between">
              <span>벽</span>
              <span>{wallsCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>바닥 구역</span>
              <span>{floorsCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>제품</span>
              <span>{assetsCount}</span>
            </div>
          </div>
          {placedZoneSummaries.length > 0 ? (
            <div
              className="mt-3 space-y-2 border-t border-black/10 pt-3"
              data-testid="placed-zone-summary"
            >
              <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-[0.18em] text-[#8b8277]">
                <span>배치 존</span>
                <span>{placedZoneSummaries.length}존</span>
              </div>
              <div className="space-y-1">
                {placedZoneSummaries.map((summary) => (
                  <div
                    key={summary.zone.id}
                    className={`grid grid-cols-[minmax(0,1fr)_auto] items-stretch gap-1 rounded-[10px] p-1 transition ${
                      summary.isSelectedZone
                        ? "bg-[#1f1b16] text-white"
                        : "bg-white/70 text-[#4f473d] hover:bg-white"
                    }`}
                    data-testid={`placed-zone-summary-${summary.zone.id}`}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectPlacedAsset(summary.topAssetId)}
                      className="flex min-w-0 items-center justify-between gap-3 rounded-[8px] px-2 py-1.5 text-left transition hover:bg-black/5"
                      aria-label={`${summary.zone.label} 대표 제품 ${summary.topAssetLabel} 선택`}
                      data-testid={`placed-zone-select-${summary.zone.id}`}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        {summary.topReplacementPreviewFamily ? (
                          <span
                            aria-hidden
                            className={`relative h-9 w-10 shrink-0 overflow-hidden rounded-[8px] border ${
                              summary.isSelectedZone
                                ? "border-white/15 bg-white/10"
                                : "border-black/10 bg-[#f2eee8]"
                            }`}
                            data-testid={`placed-zone-replacement-silhouette-${summary.zone.id}`}
                          >
                            <ReplacementIsometricPreview
                              compact
                              family={summary.topReplacementPreviewFamily}
                              scale={summary.topReplacementPreviewScale ?? DEFAULT_REPLACEMENT_PREVIEW_SCALE}
                              testId={`placed-zone-replacement-isometric-${summary.zone.id}`}
                            />
                          </span>
                        ) : null}
                        <span className="min-w-0">
                          <span className="block text-[11px] font-semibold leading-4">
                            {summary.zone.label}
                            {summary.isSelectedZone ? " · 선택" : ""}
                          </span>
                          <span
                            className={`block truncate text-[9px] uppercase tracking-[0.08em] ${
                              summary.isSelectedZone ? "text-white/70" : "text-[#9a9084]"
                            }`}
                          >
                            {summary.topAssetLabel}
                          </span>
                          {summary.topReplacementLabel ? (
                            <span
                              className={`block truncate text-[9px] leading-3 ${
                                summary.isSelectedZone ? "text-[#f2d7a2]" : "text-[#8f623c]"
                              }`}
                              data-testid={`placed-zone-replacement-preview-${summary.zone.id}`}
                            >
                              추천: {summary.topReplacementLabel}
                            </span>
                          ) : null}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-[11px] font-bold">{summary.count}개</span>
                        <span
                          className={`block text-[9px] uppercase tracking-[0.08em] ${
                            summary.isSelectedZone ? "text-white/70" : "text-[#9a9084]"
                          }`}
                        >
                          교체 {summary.replaceableCount}
                        </span>
                        {summary.topReplacementMatchPercent ? (
                          <span
                            className={`block text-[9px] font-semibold tabular-nums ${
                              summary.isSelectedZone ? "text-[#f2d7a2]" : "text-[#8f623c]"
                            }`}
                            data-testid={`placed-zone-replacement-score-${summary.zone.id}`}
                          >
                            추천 {summary.topReplacementMatchPercent}%
                          </span>
                        ) : null}
                        {summary.topSupportDependentCount > 0 ? (
                          <span
                            className={`block text-[9px] font-semibold ${
                              summary.isSelectedZone ? "text-white/70" : "text-[#6f675c]"
                            }`}
                            data-testid={`placed-zone-support-cascade-${summary.zone.id}`}
                          >
                            하위 {summary.topSupportDependentCount}개 유지
                          </span>
                        ) : null}
                      </span>
                    </button>
                    {summary.replaceableCount > 0 ? (
                      <button
                        type="button"
                        onClick={() => onApplyPlacedZoneReplacements(summary.zone.id)}
                        className={`inline-flex items-center justify-center gap-1 rounded-[8px] border px-2 text-[9px] font-bold uppercase tracking-[0.08em] transition ${
                          summary.isSelectedZone
                            ? "border-white/20 bg-white/12 text-white hover:bg-white/18"
                            : "border-black/10 bg-[#1f1b16] text-white hover:bg-[#3a332b]"
                        }`}
                        aria-label={`${summary.zone.label} 추천 후보 ${summary.replaceableCount}개 교체`}
                        title={summary.topReplacementLabel ?? `${summary.zone.label} 추천 교체`}
                        data-testid={`placed-zone-apply-${summary.zone.id}`}
                      >
                        <RefreshCcw className="h-3 w-3" />
                        교체
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="space-y-3 rounded-[20px] border border-black/10 bg-[#faf9f7] p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#7a7064]">선택 항목</p>
          {selectedAsset ? (
            <div className="space-y-4">
              <div>
                <div className="text-sm font-medium text-[#1f1b16]">
                  {selectedAssetMeta?.label ?? formatAssetLabel(selectedAsset.assetId)}
                </div>
                {selectedAssetMeta ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="rounded-full border border-black/10 bg-[#faf9f7] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-[#6f665a]">
                      {selectedAssetMeta.category}
                    </span>
                    <span className="rounded-full border border-black/10 bg-[#faf9f7] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-[#6f665a]">
                      {selectedAssetMeta.collection}
                    </span>
                    {selectedRoomZone ? (
                      <span
                        className="rounded-full border border-[#d8cbb8] bg-[#fff8ea] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-[#80613c]"
                        data-testid="selected-asset-room-zone"
                      >
                        {selectedRoomZone.label}
                      </span>
                    ) : null}
                    {selectedGenerationBadge ? (
                      <span
                        className={`rounded-full border px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em] ${
                          selectedGenerationBadge.tone === "ready"
                            ? "border-[#b9d7c3] bg-[#eef8f0] text-[#34543d]"
                            : "border-[#ead4ae] bg-[#fff8ea] text-[#80613c]"
                        }`}
                        data-testid="selected-asset-generated-badge"
                      >
                        {selectedGenerationBadge.label} · {selectedGenerationBadge.reviewLabel}
                      </span>
                    ) : null}
                  </div>
                ) : null}
                <div className="mt-1 text-xs text-[#83796d]">{selectedAsset.id}</div>
              </div>
              {replacementItems.length > 0 ? (
                <div className="space-y-3 border-t border-black/10 pt-3" data-testid="asset-replacement-controls">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#7a7064]">
                      <RefreshCcw className="h-3.5 w-3.5" />
                      교체
                    </div>
                    {canFilterSameZone ? (
                      <div
                        className="grid grid-cols-2 rounded-full border border-black/10 bg-[#f4f1eb] p-0.5"
                        data-testid="asset-replacement-zone-filter"
                      >
                        {[
                          {
                            id: "same-zone",
                            label: selectedRoomZone?.label ?? "같은 존",
                            count: sameZoneReplacementItems.length
                          },
                          { id: "all", label: "전체", count: replacementItems.length }
                        ].map((filter) => {
                          const isActive = replacementZoneScope === filter.id;
                          return (
                            <button
                              key={filter.id}
                              type="button"
                              onClick={() => setReplacementZoneScope(filter.id as "same-zone" | "all")}
                              className={`rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.08em] transition ${
                                isActive
                                  ? "bg-[#1f1b16] text-white"
                                  : "text-[#7a7064] hover:bg-white"
                              }`}
                              data-testid={`asset-replacement-filter-${filter.id}`}
                            >
                              {filter.label} {filter.count}
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                  {replacementZoneSummaries.length > 0 ? (
                    <div
                      className="space-y-1 border-y border-black/10 py-2"
                      data-testid="asset-replacement-zone-actions"
                    >
                      <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-[0.18em] text-[#8b8277]">
                        <span>존 커스터마이징</span>
                        <span>{visibleReplacementItems.length}개 표시</span>
                      </div>
                      <div className="space-y-1">
                        {replacementZoneSummaries.map((summary) => {
                          const isActive =
                            replacementZoneScope === summary.zone.id ||
                            (replacementZoneScope === "same-zone" && summary.isSelectedZone && canFilterSameZone);
                          const topCandidate = replacementTopCandidateByZone.get(summary.zone.id);
                          return (
                            <div
                              key={summary.zone.id}
                              className={`grid grid-cols-[minmax(0,1fr)_auto] items-stretch gap-1 rounded-[10px] p-1 transition ${
                                isActive
                                  ? "bg-[#1f1b16] text-white"
                                  : "bg-white/70 text-[#4f473d] hover:bg-white"
                              }`}
                              data-testid={`asset-replacement-zone-action-${summary.zone.id}`}
                            >
                              <button
                                type="button"
                                onClick={() => setReplacementZoneScope(summary.zone.id)}
                                className="flex min-w-0 items-center justify-between gap-3 rounded-[8px] px-2 py-1.5 text-left transition hover:bg-black/5"
                                data-testid={`asset-replacement-zone-filter-${summary.zone.id}`}
                              >
                                <span className="min-w-0">
                                  <span className="block text-[11px] font-semibold leading-4">
                                    {summary.zone.label}
                                    {summary.isSelectedZone ? " · 선택 존" : ""}
                                  </span>
                                  <span
                                    className={`block truncate text-[9px] uppercase tracking-[0.08em] ${
                                      isActive ? "text-white/70" : "text-[#9a9084]"
                                    }`}
                                  >
                                    {summary.topCandidateLabel}
                                  </span>
                                </span>
                                <span className="shrink-0 text-right">
                                  <span className="block text-[11px] font-bold">{summary.count}개</span>
                                  <span
                                    className={`block text-[9px] uppercase tracking-[0.08em] ${
                                      isActive ? "text-white/70" : "text-[#9a9084]"
                                    }`}
                                  >
                                    {summary.recommendedCount > 0
                                      ? `추천 ${summary.recommendedCount}`
                                      : `평균 ${summary.averageMatchPercent}`}
                                  </span>
                                </span>
                              </button>
                              {topCandidate ? (
                                <button
                                  type="button"
                                  onClick={() => onReplaceAsset(selectedAsset.id, topCandidate.item)}
                                  className={`rounded-[8px] border px-2.5 text-[9px] font-bold uppercase tracking-[0.08em] transition ${
                                    isActive
                                      ? "border-white/20 bg-white/12 text-white hover:bg-white/18"
                                      : "border-black/10 bg-[#1f1b16] text-white hover:bg-[#3a332b]"
                                  }`}
                                  aria-label={`${summary.zone.label} 대표 후보 ${topCandidate.item.label} 적용`}
                                  data-testid={`asset-replacement-zone-apply-${summary.zone.id}`}
                                >
                                  적용
                                </button>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                  <div className="grid grid-cols-2 gap-2">
                    {visibleReplacementItems.map((candidate) => (
                      <ReplacementItemButton
                        key={candidate.item.id}
                        candidate={candidate}
                        selectedAssetId={selectedAsset.id}
                        onReplace={onReplaceAsset}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
              {dimensionsLabel || productFinishColor || productFinishMaterial || productDetailNotes ? (
                <div className="space-y-3 rounded-[18px] border border-black/10 bg-white p-3">
                  <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#7a7064]">
                    실제 규격
                  </div>
                  {dimensionsLabel ? (
                    <div className="rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm font-semibold text-[#1f1b16]">
                      {dimensionsLabel}
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    {productFinishColor ? (
                      <span className="rounded-full border border-black/10 bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#6f665a]">
                        색상 {productFinishColor}
                      </span>
                    ) : null}
                    {productFinishMaterial ? (
                      <span className="rounded-full border border-black/10 bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#6f665a]">
                        재질 {productFinishMaterial}
                      </span>
                    ) : null}
                  </div>
                  {productDetailNotes ? (
                    <p className="text-xs leading-6 text-[#6f665b]">{productDetailNotes}</p>
                  ) : null}
                </div>
              ) : null}
              <label className="space-y-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#7a7064]">
                기준면
                <select
                  value={selectedAsset.anchorType ?? "floor"}
                  onChange={(event) =>
                    onUpdateAsset(selectedAsset.id, {
                      anchorType: event.target.value as SceneAnchorType
                    })
                  }
                  className="w-full rounded-xl border border-black/10 bg-[#faf9f7] px-3 py-2 text-sm text-[#2f2921] outline-none focus-visible:ring-2 focus-visible:ring-[#a48f79]/35"
                >
                  {SCENE_ANCHOR_TYPES.map((anchorType) => (
                    <option key={anchorType} value={anchorType}>
                      {anchorLabel[anchorType]}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#7a7064]">
                  X (mm)
                  <input
                    type="number"
                    step="1"
                    value={metersToMillimeters(selectedAsset.position[0])}
                    onChange={(event) =>
                      onUpdateAsset(selectedAsset.id, {
                        position: [
                          millimetersToMeters(Number(event.target.value)),
                          selectedAsset.position[1],
                          selectedAsset.position[2]
                        ]
                      })
                    }
                    className="w-full rounded-xl border border-black/10 bg-[#faf9f7] px-3 py-2 text-sm text-[#2f2921] outline-none focus-visible:ring-2 focus-visible:ring-[#a48f79]/35"
                  />
                </label>
                <label className="space-y-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#7a7064]">
                  Z (mm)
                  <input
                    type="number"
                    step="1"
                    value={metersToMillimeters(selectedAsset.position[2])}
                    onChange={(event) =>
                      onUpdateAsset(selectedAsset.id, {
                        position: [
                          selectedAsset.position[0],
                          selectedAsset.position[1],
                          millimetersToMeters(Number(event.target.value))
                        ]
                      })
                    }
                    className="w-full rounded-xl border border-black/10 bg-[#faf9f7] px-3 py-2 text-sm text-[#2f2921] outline-none focus-visible:ring-2 focus-visible:ring-[#a48f79]/35"
                  />
                </label>
                <label className="space-y-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#7a7064]">
                  Y (mm)
                  <input
                    type="number"
                    step="1"
                    value={metersToMillimeters(selectedAsset.position[1])}
                    disabled={isYManagedByAnchor}
                    onChange={(event) =>
                      onUpdateAsset(selectedAsset.id, {
                        position: [
                          selectedAsset.position[0],
                          millimetersToMeters(Number(event.target.value)),
                          selectedAsset.position[2]
                        ]
                      })
                    }
                    className={`w-full rounded-xl border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#a48f79]/35 ${
                      isYManagedByAnchor
                        ? "cursor-not-allowed border-black/10 bg-[#efede8] text-[#9b9287]"
                        : "border-black/10 bg-[#faf9f7] text-[#2f2921]"
                    }`}
                  />
                </label>
                <label className="space-y-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#7a7064]">
                  Y축 회전 (deg)
                  <input
                    type="number"
                    step="1"
                    value={toRoundedDegree(selectedAsset.rotation[1])}
                    disabled={isRotationManagedByAnchor}
                    onChange={(event) =>
                      onUpdateAsset(selectedAsset.id, {
                        rotation: [
                          selectedAsset.rotation[0],
                          degreesToRadians(Number(event.target.value)),
                          selectedAsset.rotation[2]
                        ]
                      })
                    }
                    className={`w-full rounded-xl border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#a48f79]/35 ${
                      isRotationManagedByAnchor
                        ? "cursor-not-allowed border-black/10 bg-[#efede8] text-[#9b9287]"
                        : "border-black/10 bg-[#faf9f7] text-[#2f2921]"
                    }`}
                  />
                </label>
                <label className="space-y-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#7a7064]">
                  크기 비율
                  <input
                    type="number"
                    step="0.1"
                    value={selectedAsset.scale[0]}
                    disabled={scaleLocked}
                    onChange={(event) => {
                      const nextValue = Number(event.target.value);
                      onUpdateAsset(selectedAsset.id, {
                        scale: [nextValue, nextValue, nextValue]
                      });
                    }}
                    className={`w-full rounded-xl border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#a48f79]/35 ${
                      scaleLocked
                        ? "cursor-not-allowed border-black/10 bg-[#efede8] text-[#9b9287]"
                        : "border-black/10 bg-[#faf9f7] text-[#2f2921]"
                    }`}
                  />
                </label>
              </div>
              {topMode === "desk-precision" ? (
                <div className="rounded-[18px] border border-black/10 bg-white p-3">
                  <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#7a7064]">
                    정밀 측정
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-[#5f574d]">
                    <div className="rounded-xl border border-black/10 bg-[#faf9f7] px-3 py-2">
                      <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#8b8277]">X</div>
                      <div className="mt-1 font-semibold text-[#1f1b16]">
                        {metersToMillimeters(selectedAsset.position[0])} mm
                      </div>
                    </div>
                    <div className="rounded-xl border border-black/10 bg-[#faf9f7] px-3 py-2">
                      <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#8b8277]">Z</div>
                      <div className="mt-1 font-semibold text-[#1f1b16]">
                        {metersToMillimeters(selectedAsset.position[2])} mm
                      </div>
                    </div>
                    <div className="rounded-xl border border-black/10 bg-[#faf9f7] px-3 py-2">
                      <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#8b8277]">Y</div>
                      <div className="mt-1 font-semibold text-[#1f1b16]">
                        {metersToMillimeters(selectedAsset.position[1])} mm
                      </div>
                    </div>
                    <div className="rounded-xl border border-black/10 bg-[#faf9f7] px-3 py-2">
                      <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#8b8277]">회전</div>
                      <div className="mt-1 font-semibold text-[#1f1b16]">
                        {toRoundedDegree(selectedAsset.rotation[1])} deg
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
              {topMode === "desk-precision" ? (
                <div className="rounded-[18px] border border-black/10 bg-white p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#7a7064]">
                      Surface Lock
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] ${surfaceLockStatus.className}`}
                    >
                      {surfaceLockStatus.label}
                    </span>
                  </div>

                  {surfaceLockInfo ? (
                    <>
                      <div className="mt-3 text-sm font-semibold text-[#1f1b16]">
                        {surfaceLockInfo.supportLabel}
                      </div>
                      <div className="mt-1 text-[11px] uppercase tracking-[0.14em] text-[#8b8277]">
                        {surfaceLockInfo.surfaceLabel}
                      </div>
                      <div className="mt-2 text-[11px] leading-5 text-[#6f665b]">
                        {surfaceLockInfo.withinUsableBounds
                          ? "현재 footprint가 usable area 안에 들어와 있습니다."
                          : "현재 footprint가 usable area 가장자리를 넘어서고 있습니다."}
                      </div>
                      <div className="mt-3">
                        <PrecisionSurfaceMicroView surfaceLockInfo={surfaceLockInfo} />
                      </div>
                      <div className="mt-3">
                        <PrecisionSurfaceProjectionView surfaceLockInfo={surfaceLockInfo} />
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-[#5f574d]">
                        <div className="rounded-xl border border-black/10 bg-[#faf9f7] px-3 py-2">
                          <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#8b8277]">
                            Surface
                          </div>
                          <div className="mt-1 font-semibold text-[#1f1b16]">
                            {surfaceLockInfo.sizeMm[0]} x {surfaceLockInfo.sizeMm[1]} mm
                          </div>
                        </div>
                        <div className="rounded-xl border border-black/10 bg-[#faf9f7] px-3 py-2">
                          <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#8b8277]">
                            Margin
                          </div>
                          <div className="mt-1 font-semibold text-[#1f1b16]">
                            {surfaceLockInfo.marginMm[0]} / {surfaceLockInfo.marginMm[1]} mm
                          </div>
                        </div>
                        <div className="rounded-xl border border-black/10 bg-[#faf9f7] px-3 py-2">
                          <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#8b8277]">
                            Footprint
                          </div>
                          <div className="mt-1 font-semibold text-[#1f1b16]">
                            {surfaceLockInfo.footprintMm[0]} x {surfaceLockInfo.footprintMm[1]} mm
                          </div>
                        </div>
                        <div className="rounded-xl border border-black/10 bg-[#faf9f7] px-3 py-2">
                          <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#8b8277]">
                            Projected
                          </div>
                          <div className="mt-1 font-semibold text-[#1f1b16]">
                            {surfaceLockInfo.projectedFootprintMm[0]} x {surfaceLockInfo.projectedFootprintMm[1]} mm
                          </div>
                        </div>
                        <div className="rounded-xl border border-black/10 bg-[#faf9f7] px-3 py-2">
                          <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#8b8277]">
                            Usable
                          </div>
                          <div className="mt-1 font-semibold text-[#1f1b16]">
                            {surfaceLockInfo.usableSizeMm[0]} x {surfaceLockInfo.usableSizeMm[1]} mm
                          </div>
                        </div>
                        <div className="rounded-xl border border-black/10 bg-[#faf9f7] px-3 py-2">
                          <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#8b8277]">
                            Offset
                          </div>
                          <div className="mt-1 font-semibold text-[#1f1b16]">
                            {surfaceLockInfo.localOffsetMm[0]} / {surfaceLockInfo.localOffsetMm[1]} mm
                          </div>
                        </div>
                        <div className="rounded-xl border border-black/10 bg-[#faf9f7] px-3 py-2">
                          <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#8b8277]">
                            Top
                          </div>
                          <div className="mt-1 font-semibold text-[#1f1b16]">{surfaceLockInfo.topMm} mm</div>
                        </div>
                        <div className="rounded-xl border border-black/10 bg-[#faf9f7] px-3 py-2">
                          <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#8b8277]">
                            Height
                          </div>
                          <div className="mt-1 font-semibold text-[#1f1b16]">
                            {surfaceLockInfo.assetHeightMm} mm
                          </div>
                        </div>
                        <div className="rounded-xl border border-black/10 bg-[#faf9f7] px-3 py-2">
                          <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#8b8277]">
                            Gap / Reach
                          </div>
                          <div className="mt-1 font-semibold text-[#1f1b16]">
                            {surfaceLockInfo.bottomOffsetMm} / {surfaceLockInfo.topOffsetMm} mm
                          </div>
                        </div>
                        <div className="rounded-xl border border-black/10 bg-[#faf9f7] px-3 py-2">
                          <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#8b8277]">
                            Clearance X
                          </div>
                          <div className="mt-1 font-semibold text-[#1f1b16]">
                            L {surfaceLockInfo.clearanceMm.left} / R {surfaceLockInfo.clearanceMm.right} mm
                          </div>
                        </div>
                        <div className="rounded-xl border border-black/10 bg-[#faf9f7] px-3 py-2">
                          <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#8b8277]">
                            Clearance Z
                          </div>
                          <div className="mt-1 font-semibold text-[#1f1b16]">
                            T {surfaceLockInfo.clearanceMm.top} / B {surfaceLockInfo.clearanceMm.bottom} mm
                          </div>
                        </div>
                        <div className="rounded-xl border border-black/10 bg-[#faf9f7] px-3 py-2">
                          <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#8b8277]">
                            Yaw Delta
                          </div>
                          <div className="mt-1 font-semibold text-[#1f1b16]">
                            {surfaceLockInfo.relativeYawDeg} deg
                          </div>
                        </div>
                        <div className="rounded-xl border border-black/10 bg-[#faf9f7] px-3 py-2">
                          <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#8b8277]">
                            Anchor
                          </div>
                          <div className="mt-1 font-semibold text-[#1f1b16]">
                            {anchorLabel[selectedAsset.anchorType ?? "floor"]}
                          </div>
                        </div>
                      </div>
                      {!surfaceLockInfo.withinUsableBounds ? (
                        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
                          최소 edge clearance가 {surfaceLockInfo.clearanceMm.min} mm 입니다. usable area 안으로 다시
                          옮기거나 회전을 줄여 주세요.
                        </div>
                      ) : null}
                    </>
                  ) : usesSurfaceLock ? (
                    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-5 text-[#8a6a2c]">
                      현재 기준면은 support surface를 사용하지만, 아직 잠긴 상면 정보를 확인하지 못했습니다.
                    </div>
                  ) : (
                    <div className="mt-3 rounded-xl border border-black/10 bg-[#faf9f7] px-3 py-2 text-[11px] leading-5 text-[#6f665b]">
                      floor / wall / ceiling 기준면은 surface lock을 사용하지 않습니다.
                    </div>
                  )}
                </div>
              ) : null}
              {isYManagedByAnchor || isRotationManagedByAnchor ? (
                <div className="text-[10px] uppercase tracking-[0.14em] text-[#8b8277]">
                  현재 기준면이
                  {isYManagedByAnchor ? " 높이" : ""}
                  {isYManagedByAnchor && isRotationManagedByAnchor ? " 및" : ""}
                  {isRotationManagedByAnchor ? " 회전" : ""}
                  값을 관리합니다.
                </div>
              ) : null}
              {scaleLocked ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-[#8a6a2c]">
                  이 제품은 실제 규격 기준으로 고정되어 있어 크기 비율을 직접 변경할 수 없습니다.
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => onRemoveAsset(selectedAsset.id)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-red-300/60 bg-red-50 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-red-700 transition hover:border-red-400 hover:bg-red-100"
              >
                <Trash2 className="h-4 w-4" />
                제품 삭제
              </button>
            </div>
          ) : (
            <div className="text-sm leading-6 text-[#6f665b]">
              상단뷰에서 배치된 제품을 선택하면 위치/회전/크기를 조정할 수 있습니다.
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
