import type { LibraryCatalogItem } from "../builder/catalog";
import type { SharePreviewMeta } from "../share/preview";
import { buildShowcaseViewerHref } from "../viewer/presentation";

export type PublishedSnapshotCardModel = {
  projectName: string;
  totalAssets: number;
  primaryCollection: string;
  secondaryLabel: string;
  versionBadgeLabel: string;
  publishedAtLabel: string;
  primaryTone: LibraryCatalogItem["tone"];
};

export function buildPublishedSnapshotCardModel(input: {
  previewMeta: SharePreviewMeta | null;
  publishedAt: string;
}): PublishedSnapshotCardModel {
  const { previewMeta, publishedAt } = input;
  const projectName = previewMeta?.projectName ?? "공유 공간";
  const totalAssets = previewMeta?.assetSummary?.totalAssets ?? 0;
  const primaryCollection = previewMeta?.assetSummary?.primaryCollection ?? "가구 배치";

  return {
    projectName,
    totalAssets,
    primaryCollection,
    secondaryLabel: totalAssets > 0 ? `제품 ${totalAssets}개` : "읽기 전용 뷰어",
    versionBadgeLabel: previewMeta?.versionNumber ? `장면 v${previewMeta.versionNumber}` : "발행 장면",
    publishedAtLabel: new Date(publishedAt).toLocaleDateString("ko-KR"),
    primaryTone: previewMeta?.assetSummary?.primaryTone ?? "sand"
  };
}

export function buildPublishedSnapshotCardHref(token: string) {
  return buildShowcaseViewerHref(token);
}
