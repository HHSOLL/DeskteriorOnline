import type { SharePreviewMeta } from "../share/preview";

export type ShowcaseActivityMetrics = {
  activityScore: number;
  recencyScore: number;
  richnessScore: number;
  diversityScore: number;
  editorialScore: number;
  estimatedViews: number;
  estimatedLikes: number;
  estimatedReplies: number;
};

type ShowcaseActivityInput = {
  previewMeta: SharePreviewMeta | null;
  publishedAt: string;
  now?: Date;
};

type ShowcaseActivityRankable = {
  id: string;
  published_at: string;
  previewMeta: SharePreviewMeta | null;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function resolveAgeHours(publishedAt: string, now: Date) {
  const publishedAtDate = new Date(publishedAt);
  if (Number.isNaN(publishedAtDate.getTime())) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.max(0, (now.getTime() - publishedAtDate.getTime()) / (1000 * 60 * 60));
}

export function buildShowcaseActivityMetrics({
  previewMeta,
  publishedAt,
  now = new Date()
}: ShowcaseActivityInput): ShowcaseActivityMetrics {
  const assetSummary = previewMeta?.assetSummary;
  const totalAssets = assetSummary?.totalAssets ?? 0;
  const collectionCount = assetSummary?.collections.length ?? 0;
  const highlightedCount = assetSummary?.highlightedItems.length ?? 0;
  const hasDescription = Boolean(previewMeta?.projectDescription && previewMeta.projectDescription.trim().length > 0);
  const ageHours = resolveAgeHours(publishedAt, now);

  const recencyScore =
    ageHours === Number.POSITIVE_INFINITY
      ? 0
      : clamp(Math.round(60 - Math.min(60, ageHours / 2)), 0, 60);
  const richnessScore = clamp(totalAssets * 4, 0, 28);
  const diversityScore = clamp(collectionCount * 6, 0, 18);
  const editorialScore = clamp(highlightedCount * 3 + (hasDescription ? 5 : 0), 0, 17);

  const activityScore = recencyScore + richnessScore + diversityScore + editorialScore;

  return {
    activityScore,
    recencyScore,
    richnessScore,
    diversityScore,
    editorialScore,
    estimatedViews: Math.max(24, Math.round(activityScore * 3.6 + totalAssets * 8)),
    estimatedLikes: Math.max(8, Math.round(activityScore * 0.55 + collectionCount * 4)),
    estimatedReplies: Math.max(4, Math.round(activityScore * 0.26 + totalAssets * 1.4))
  };
}

export function compareShowcaseActivityRank(
  left: ShowcaseActivityRankable,
  right: ShowcaseActivityRankable,
  now = new Date()
) {
  const leftMetrics = buildShowcaseActivityMetrics({
    previewMeta: left.previewMeta,
    publishedAt: left.published_at,
    now
  });
  const rightMetrics = buildShowcaseActivityMetrics({
    previewMeta: right.previewMeta,
    publishedAt: right.published_at,
    now
  });

  if (leftMetrics.activityScore !== rightMetrics.activityScore) {
    return rightMetrics.activityScore - leftMetrics.activityScore;
  }

  const publishedDelta = new Date(right.published_at).getTime() - new Date(left.published_at).getTime();
  if (!Number.isNaN(publishedDelta) && publishedDelta !== 0) {
    return publishedDelta;
  }

  return right.id.localeCompare(left.id);
}
