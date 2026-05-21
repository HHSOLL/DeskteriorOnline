import type { LibraryCatalogItem, ProductDimensionsMm } from "./catalog";
import { inferAnchorTypeForCatalogItem } from "../scene/anchors";
import { normalizeSceneAnchorType, type SceneAnchorType } from "../scene/anchor-types";

type ReplacementSourceAsset = {
  assetId: string;
  catalogItemId?: string | null;
  anchorType?: SceneAnchorType | null;
  product?: {
    dimensionsMm?: ProductDimensionsMm | null;
  } | null;
};

export type ReplacementCatalogCandidate = {
  item: LibraryCatalogItem;
  anchorType: SceneAnchorType;
  matchScore: number;
  matchPercent: number;
  matchLabel: "추천" | "호환" | "검토";
  detailLabel: string;
  dimensionFitLabel: string;
  roomZone: ReplacementRoomZone;
  previewFamily: ReplacementPreviewFamilyId;
  previewScale: ReplacementPreviewScale;
};

export type ReplacementRoomZoneId = "workstation" | "media" | "lounge" | "display" | "flex";

export type ReplacementRoomZone = {
  id: ReplacementRoomZoneId;
  label: string;
};

export type ReplacementZoneSummary = {
  zone: ReplacementRoomZone;
  count: number;
  recommendedCount: number;
  averageMatchPercent: number;
  topCandidateItemId: string;
  topCandidateLabel: string;
  isSelectedZone: boolean;
};

export type ReplacementPlacedAssetZoneItem = {
  id: string;
  label: string;
  zone: ReplacementRoomZone;
  isSelected: boolean;
  supportDependentCount?: number | null;
  replacementItemId?: string | null;
  replacementLabel?: string | null;
  replacementMatchPercent?: number | null;
  replacementPreviewFamily?: ReplacementPreviewFamilyId | null;
  replacementPreviewScale?: ReplacementPreviewScale | null;
};

export type ReplacementPlacedAssetZoneSummary = {
  zone: ReplacementRoomZone;
  count: number;
  replaceableCount: number;
  topAssetId: string;
  topAssetLabel: string;
  topReplacementItemId: string | null;
  topReplacementLabel: string | null;
  topReplacementMatchPercent: number | null;
  topReplacementPreviewFamily: ReplacementPreviewFamilyId | null;
  topReplacementPreviewScale: ReplacementPreviewScale | null;
  topSupportDependentCount: number;
  isSelectedZone: boolean;
};

export type ReplacementPreviewFamilyId =
  | "chair"
  | "sofa"
  | "desk"
  | "table"
  | "storage"
  | "display"
  | "lighting"
  | "plant"
  | "decor"
  | "generic";

export type ReplacementPreviewScale = {
  width: number;
  depth: number;
  height: number;
};

const ANCHOR_LABELS: Record<SceneAnchorType, string> = {
  floor: "바닥",
  wall: "벽",
  ceiling: "천장",
  furniture_surface: "가구 표면",
  desk_surface: "데스크 표면",
  shelf_surface: "선반 표면"
};

const FAMILY_KEYWORDS: Array<{
  id: Exclude<ReplacementPreviewFamilyId, "generic">;
  keywords: string[];
}> = [
  {
    id: "chair",
    keywords: ["chair", "체어", "의자", "stool", "스툴"]
  },
  {
    id: "sofa",
    keywords: ["sofa", "소파", "couch", "lounge", "라운지", "loveseat"]
  },
  {
    id: "desk",
    keywords: ["desk", "데스크", "workbench", "작업대"]
  },
  {
    id: "table",
    keywords: ["table", "테이블", "coffee table", "side table"]
  },
  {
    id: "storage",
    keywords: ["cabinet", "console", "shelf", "bookcase", "drawer", "수납", "선반", "콘솔"]
  },
  {
    id: "display",
    keywords: ["monitor", "display", "tv", "television", "screen", "모니터", "디스플레이"]
  },
  {
    id: "lighting",
    keywords: ["lamp", "light", "lighting", "sconce", "조명", "램프"]
  },
  {
    id: "plant",
    keywords: ["plant", "planter", "greenery", "화분", "식물"]
  },
  {
    id: "decor",
    keywords: ["decor", "vase", "figure", "poster", "art", "소품", "장식"]
  }
];

const ROOM_ZONE_LABELS: Record<ReplacementRoomZoneId, string> = {
  workstation: "워크 존",
  media: "미디어 존",
  lounge: "라운지",
  display: "디스플레이",
  flex: "공용"
};

const ROOM_ZONE_KEYWORDS: Array<{
  id: Exclude<ReplacementRoomZoneId, "flex">;
  keywords: string[];
}> = [
  {
    id: "media",
    keywords: [
      "tv",
      "television",
      "game console",
      "gaming_console",
      "controller",
      "remote",
      "media",
      "screenbar",
      "티비",
      "텔레비전",
      "게임",
      "콘솔",
      "리모컨",
      "미디어"
    ]
  },
  {
    id: "workstation",
    keywords: [
      "desk",
      "desktop_top",
      "keyboard",
      "mouse",
      "monitor",
      "headphone",
      "headset",
      "speaker",
      "soundbar",
      "mat",
      "workstation",
      "creator",
      "surface-placeable",
      "데스크",
      "책상",
      "작업",
      "키보드",
      "마우스",
      "모니터",
      "헤드폰",
      "헤드셋",
      "스피커",
      "사운드바",
      "매트"
    ]
  },
  {
    id: "lounge",
    keywords: [
      "sofa",
      "couch",
      "lounge",
      "coffee table",
      "side table",
      "stool",
      "armchair",
      "소파",
      "라운지",
      "커피 테이블",
      "사이드 테이블",
      "스툴"
    ]
  },
  {
    id: "display",
    keywords: [
      "shelf",
      "book",
      "plant",
      "planter",
      "decor",
      "poster",
      "art",
      "figure",
      "collectible",
      "display",
      "선반",
      "책",
      "북",
      "식물",
      "화분",
      "소품",
      "장식",
      "포스터",
      "아트",
      "피규어",
      "디스플레이"
    ]
  }
];

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "").toLowerCase();
}

function getItemSearchText(item: LibraryCatalogItem) {
  return [
    item.id,
    item.label,
    item.description,
    item.options,
    item.detailNotes,
    item.assetId
  ]
    .map(normalizeText)
    .join(" ");
}

function inferProductFamilyFromText(text: string): Exclude<ReplacementPreviewFamilyId, "generic"> | null {
  const normalized = normalizeText(text);
  const family = FAMILY_KEYWORDS.find((entry) =>
    entry.keywords.some((keyword) => normalized.includes(keyword.toLowerCase()))
  );
  return family?.id ?? null;
}

function inferProductFamily(
  item: LibraryCatalogItem | null,
  fallbackAssetId?: string | null
): Exclude<ReplacementPreviewFamilyId, "generic"> | null {
  if (item) {
    return inferProductFamilyFromText(getItemSearchText(item));
  }
  return inferProductFamilyFromText(fallbackAssetId ?? "");
}

function makeRoomZone(id: ReplacementRoomZoneId): ReplacementRoomZone {
  return {
    id,
    label: ROOM_ZONE_LABELS[id]
  };
}

function inferRoomZoneFromText(text: string): ReplacementRoomZone {
  const normalized = normalizeText(text);
  const zone = ROOM_ZONE_KEYWORDS.find((entry) =>
    entry.keywords.some((keyword) => normalized.includes(keyword.toLowerCase()))
  );
  return makeRoomZone(zone?.id ?? "flex");
}

export function inferReplacementRoomZone(
  item: LibraryCatalogItem | null,
  fallbackAssetId?: string | null
): ReplacementRoomZone {
  if (item) {
    return inferRoomZoneFromText(getItemSearchText(item));
  }
  return inferRoomZoneFromText(fallbackAssetId ?? "");
}

export function buildReplacementZoneSummary(
  candidates: ReplacementCatalogCandidate[],
  selectedZone: ReplacementRoomZone | null
): ReplacementZoneSummary[] {
  const zoneMap = new Map<
    ReplacementRoomZoneId,
    {
      zone: ReplacementRoomZone;
      count: number;
      recommendedCount: number;
      matchPercentTotal: number;
      topCandidateItemId: string;
      topCandidateLabel: string;
      topMatchPercent: number;
    }
  >();

  for (const candidate of candidates) {
    const existing = zoneMap.get(candidate.roomZone.id);
    if (!existing) {
      zoneMap.set(candidate.roomZone.id, {
        zone: candidate.roomZone,
        count: 1,
        recommendedCount: candidate.matchLabel === "추천" ? 1 : 0,
        matchPercentTotal: candidate.matchPercent,
        topCandidateItemId: candidate.item.id,
        topCandidateLabel: candidate.item.label,
        topMatchPercent: candidate.matchPercent
      });
      continue;
    }

    existing.count += 1;
    existing.matchPercentTotal += candidate.matchPercent;
    if (candidate.matchLabel === "추천") {
      existing.recommendedCount += 1;
    }
    if (candidate.matchPercent > existing.topMatchPercent) {
      existing.topCandidateItemId = candidate.item.id;
      existing.topCandidateLabel = candidate.item.label;
      existing.topMatchPercent = candidate.matchPercent;
    }
  }

  return Array.from(zoneMap.values())
    .map((entry) => ({
      zone: entry.zone,
      count: entry.count,
      recommendedCount: entry.recommendedCount,
      averageMatchPercent: Math.round(entry.matchPercentTotal / entry.count),
      topCandidateItemId: entry.topCandidateItemId,
      topCandidateLabel: entry.topCandidateLabel,
      isSelectedZone: selectedZone?.id === entry.zone.id
    }))
    .sort((left, right) => {
      if (left.isSelectedZone !== right.isSelectedZone) return left.isSelectedZone ? -1 : 1;
      if (right.recommendedCount !== left.recommendedCount) return right.recommendedCount - left.recommendedCount;
      if (right.count !== left.count) return right.count - left.count;
      if (right.averageMatchPercent !== left.averageMatchPercent) {
        return right.averageMatchPercent - left.averageMatchPercent;
      }
      return left.zone.label.localeCompare(right.zone.label, "ko");
    });
}

export function buildPlacedAssetZoneSummary(
  items: ReplacementPlacedAssetZoneItem[]
): ReplacementPlacedAssetZoneSummary[] {
  const zoneMap = new Map<
    ReplacementRoomZoneId,
    {
      zone: ReplacementRoomZone;
      count: number;
      replaceableCount: number;
      topAssetId: string;
      topAssetLabel: string;
      topReplacementItemId: string | null;
      topReplacementLabel: string | null;
      topReplacementMatchPercent: number | null;
      topReplacementPreviewFamily: ReplacementPreviewFamilyId | null;
      topReplacementPreviewScale: ReplacementPreviewScale | null;
      topSupportDependentCount: number;
      topReplacementIsSelected: boolean;
      isSelectedZone: boolean;
    }
  >();

  for (const item of items) {
    const existing = zoneMap.get(item.zone.id);
    const replacementItemId = item.replacementItemId ?? null;
    const replacementLabel = item.replacementLabel ?? null;
    const replacementMatchPercent = item.replacementMatchPercent ?? null;
    const replacementPreviewFamily = item.replacementPreviewFamily ?? null;
    const replacementPreviewScale = item.replacementPreviewScale ?? null;
    const supportDependentCount = Math.max(0, item.supportDependentCount ?? 0);
    if (!existing) {
      zoneMap.set(item.zone.id, {
        zone: item.zone,
        count: 1,
        replaceableCount: replacementItemId ? 1 : 0,
        topAssetId: item.id,
        topAssetLabel: item.label,
        topReplacementItemId: replacementItemId,
        topReplacementLabel: replacementLabel,
        topReplacementMatchPercent: replacementItemId ? replacementMatchPercent : null,
        topReplacementPreviewFamily: replacementItemId ? replacementPreviewFamily : null,
        topReplacementPreviewScale: replacementItemId ? replacementPreviewScale : null,
        topSupportDependentCount: replacementItemId ? supportDependentCount : 0,
        topReplacementIsSelected: Boolean(replacementItemId && item.isSelected),
        isSelectedZone: item.isSelected
      });
      continue;
    }

    existing.count += 1;
    if (replacementItemId) {
      existing.replaceableCount += 1;
      const shouldUseReplacement =
        item.isSelected ||
        !existing.topReplacementItemId ||
        (!existing.topReplacementIsSelected &&
          (replacementMatchPercent ?? -1) > (existing.topReplacementMatchPercent ?? -1));
      if (shouldUseReplacement) {
        existing.topReplacementItemId = replacementItemId;
        existing.topReplacementLabel = replacementLabel;
        existing.topReplacementMatchPercent = replacementMatchPercent;
        existing.topReplacementPreviewFamily = replacementPreviewFamily;
        existing.topReplacementPreviewScale = replacementPreviewScale;
        existing.topSupportDependentCount = supportDependentCount;
        existing.topReplacementIsSelected = item.isSelected;
      }
    }
    if (item.isSelected) {
      existing.topAssetId = item.id;
      existing.topAssetLabel = item.label;
      if (replacementItemId) {
        existing.topSupportDependentCount = supportDependentCount;
      }
      existing.isSelectedZone = true;
    }
  }

  return Array.from(zoneMap.values())
    .sort((left, right) => {
      if (left.isSelectedZone !== right.isSelectedZone) return left.isSelectedZone ? -1 : 1;
      if (right.count !== left.count) return right.count - left.count;
      return left.zone.label.localeCompare(right.zone.label, "ko");
    })
    .map((entry) => ({
      zone: entry.zone,
      count: entry.count,
      replaceableCount: entry.replaceableCount,
      topAssetId: entry.topAssetId,
      topAssetLabel: entry.topAssetLabel,
      topReplacementItemId: entry.topReplacementItemId,
      topReplacementLabel: entry.topReplacementLabel,
      topReplacementMatchPercent: entry.topReplacementMatchPercent,
      topReplacementPreviewFamily: entry.topReplacementPreviewFamily,
      topReplacementPreviewScale: entry.topReplacementPreviewScale,
      topSupportDependentCount: entry.topSupportDependentCount,
      isSelectedZone: entry.isSelectedZone
    }));
}

function clampPreviewScale(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function buildPreviewScale(dimensions: ProductDimensionsMm | null | undefined): ReplacementPreviewScale {
  if (!dimensions) {
    return {
      width: 0.58,
      depth: 0.52,
      height: 0.56
    };
  }

  const reference = Math.max(dimensions.width, dimensions.depth, dimensions.height * 0.72, 1);

  return {
    width: clampPreviewScale(dimensions.width / reference, 0.24, 0.92),
    depth: clampPreviewScale(dimensions.depth / reference, 0.18, 0.82),
    height: clampPreviewScale((dimensions.height * 0.72) / reference, 0.24, 0.88)
  };
}

function getDimensionFit(
  selectedDimensions: ProductDimensionsMm | null | undefined,
  candidateDimensions: ProductDimensionsMm | null | undefined
) {
  if (!selectedDimensions || !candidateDimensions) {
    return {
      score: 0.64,
      known: false
    };
  }

  const widthRatio =
    Math.min(selectedDimensions.width, candidateDimensions.width) /
    Math.max(selectedDimensions.width, candidateDimensions.width);
  const depthRatio =
    Math.min(selectedDimensions.depth, candidateDimensions.depth) /
    Math.max(selectedDimensions.depth, candidateDimensions.depth);
  const heightRatio =
    Math.min(selectedDimensions.height, candidateDimensions.height) /
    Math.max(selectedDimensions.height, candidateDimensions.height);
  const footprintScore = Math.sqrt(clamp01(widthRatio) * clamp01(depthRatio));
  const heightScore = clamp01(heightRatio);

  return {
    score: clamp01(footprintScore * 0.72 + heightScore * 0.28),
    known: true
  };
}

function getQualityScore(item: LibraryCatalogItem) {
  return typeof item.qualityScore === "number" && Number.isFinite(item.qualityScore)
    ? clamp01(item.qualityScore)
    : 0.74;
}

function getMetadataCompletenessScore(item: LibraryCatalogItem) {
  return clamp01(
    (item.dimensionsMm ? 0.38 : 0) +
      (item.scaleLocked ? 0.18 : 0) +
      (item.source ? 0.14 : 0) +
      (item.collisionProxy ? 0.12 : 0) +
      (item.textureSet ? 0.1 : 0) +
      (item.lodProfile ? 0.08 : 0)
  );
}

function getMatchLabel(score: number): ReplacementCatalogCandidate["matchLabel"] {
  if (score >= 0.84) return "추천";
  if (score >= 0.72) return "호환";
  return "검토";
}

export function buildReplacementCatalogCandidates({
  items,
  selectedAsset,
  selectedCatalogItem,
  limit = 6
}: {
  items: LibraryCatalogItem[];
  selectedAsset: ReplacementSourceAsset | null;
  selectedCatalogItem: LibraryCatalogItem | null;
  limit?: number;
}): ReplacementCatalogCandidate[] {
  if (!selectedAsset) return [];

  const selectedCatalogItemId = selectedCatalogItem?.id ?? selectedAsset.catalogItemId ?? null;
  const selectedAnchorType = normalizeSceneAnchorType(selectedAsset.anchorType);
  const selectedDimensions = selectedAsset.product?.dimensionsMm ?? selectedCatalogItem?.dimensionsMm ?? null;
  const selectedFamily = inferProductFamily(selectedCatalogItem, selectedAsset.assetId);
  const selectedRoomZone = inferReplacementRoomZone(selectedCatalogItem, selectedAsset.assetId);

  const scored = items
    .filter((item) => item.id !== selectedCatalogItemId && item.assetId !== selectedAsset.assetId)
    .map((item) => {
      const anchorType = inferAnchorTypeForCatalogItem(item);
      const categoryScore = selectedCatalogItem
        ? item.categoryId === selectedCatalogItem.categoryId
          ? 1
          : 0
        : 0.45;
      const anchorScore = anchorType === selectedAnchorType ? 1 : 0;
      const dimensionFit = getDimensionFit(selectedDimensions, item.dimensionsMm);
      const candidateFamily = inferProductFamily(item);
      const candidateRoomZone = inferReplacementRoomZone(item);
      const roomZoneScore =
        selectedRoomZone.id === "flex" || candidateRoomZone.id === "flex"
          ? 0.82
          : candidateRoomZone.id === selectedRoomZone.id
            ? 1
            : 0.36;
      const familyScore = selectedFamily
        ? candidateFamily === selectedFamily
          ? 1
          : candidateFamily && selectedCatalogItem?.categoryId === item.categoryId
            ? 0.22
            : 0.38
        : 0.56;
      const qualityScore = getQualityScore(item);
      const metadataScore = getMetadataCompletenessScore(item);
      const matchScore = clamp01(
        categoryScore * 0.22 +
          anchorScore * 0.2 +
          dimensionFit.score * 0.22 +
          familyScore * 0.14 +
          roomZoneScore * 0.1 +
          qualityScore * 0.06 +
          metadataScore * 0.06
      );
      const dimensionPercent = Math.round(dimensionFit.score * 100);
      const previewFamily: ReplacementPreviewFamilyId = candidateFamily ?? "generic";

      return {
        item,
        anchorType,
        categoryMatched: categoryScore >= 1,
        anchorMatched: anchorScore >= 1,
        matchScore,
        matchPercent: Math.round(matchScore * 100),
        matchLabel: getMatchLabel(matchScore),
        detailLabel: `${ANCHOR_LABELS[anchorType]} · ${dimensionFit.known ? `${dimensionPercent}% 크기` : "크기 확인"}`,
        dimensionFitLabel: dimensionFit.known ? `Fit ${dimensionPercent}` : "Fit 확인",
        roomZone: candidateRoomZone,
        previewFamily,
        previewScale: buildPreviewScale(item.dimensionsMm)
      };
    })
    .sort((left, right) => {
      if (right.matchScore !== left.matchScore) return right.matchScore - left.matchScore;
      return left.item.label.localeCompare(right.item.label, "ko");
    });

  const preferred = scored.filter((candidate) => candidate.categoryMatched || candidate.anchorMatched);
  return (preferred.length >= limit ? preferred : scored).slice(0, limit);
}
