import { buildSharePreviewMeta } from "../src/lib/share/preview";
import {
  buildShowcaseActivityMetrics,
  compareShowcaseActivityRank
} from "../src/lib/showcase/activity";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const now = new Date("2026-04-20T12:00:00.000Z");

const recentDense = {
  id: "share-recent",
  published_at: "2026-04-19T18:00:00.000Z",
  previewMeta: buildSharePreviewMeta({
    projectName: "Dense Workspace",
    projectDescription: "Desk layering with lighting and storage accents.",
    versionNumber: 7,
    assetSummary: {
      totalAssets: 8,
      highlightedItems: [
        {
          catalogItemId: "desk-oak",
          assetId: "p2s_desk_oak",
          label: "Oak Desk",
          category: "Tables",
          collection: "Worksurface",
          tone: "sand",
          count: 1
        },
        {
          catalogItemId: "desk-lamp-glow",
          assetId: "p2s_desk_lamp_glow",
          label: "Desk Lamp Glow",
          category: "Lighting",
          collection: "Atmosphere",
          tone: "ember",
          count: 1
        }
      ],
      collections: [
        { label: "Worksurface", count: 3 },
        { label: "Atmosphere", count: 3 },
        { label: "Storage", count: 2 }
      ],
      uncataloguedCount: 0,
      primaryTone: "sand",
      primaryCollection: "Worksurface"
    }
  })
};

const olderSparse = {
  id: "share-older",
  published_at: "2026-04-12T08:00:00.000Z",
  previewMeta: buildSharePreviewMeta({
    projectName: "Minimal Corner",
    projectDescription: null,
    versionNumber: 2,
    assetSummary: {
      totalAssets: 2,
      highlightedItems: [
        {
          catalogItemId: "ceramic-mug",
          assetId: "p2s_ceramic_mug",
          label: "Ceramic Mug",
          category: "Decor",
          collection: "Atmosphere",
          tone: "sand",
          count: 1
        }
      ],
      collections: [{ label: "Atmosphere", count: 2 }],
      uncataloguedCount: 0,
      primaryTone: "sand",
      primaryCollection: "Atmosphere"
    }
  })
};

try {
  const recentMetrics = buildShowcaseActivityMetrics({
    previewMeta: recentDense.previewMeta,
    publishedAt: recentDense.published_at,
    now
  });
  const olderMetrics = buildShowcaseActivityMetrics({
    previewMeta: olderSparse.previewMeta,
    publishedAt: olderSparse.published_at,
    now
  });

  assert(
    recentMetrics.activityScore > olderMetrics.activityScore,
    `recent dense score should outrank older sparse score (${recentMetrics.activityScore} <= ${olderMetrics.activityScore})`
  );
  assert(
    recentMetrics.estimatedViews > olderMetrics.estimatedViews,
    `recent dense view estimate should outrank older sparse (${recentMetrics.estimatedViews} <= ${olderMetrics.estimatedViews})`
  );

  const ranked = [olderSparse, recentDense].sort((left, right) =>
    compareShowcaseActivityRank(left, right, now)
  );
  assert(ranked[0]?.id === "share-recent", `unexpected top-ranked showcase item: ${ranked[0]?.id}`);

  console.log("showcase activity ranking ok");
  console.log(
    JSON.stringify(
      {
        topRankedId: ranked[0]?.id,
        recentMetrics,
        olderMetrics
      },
      null,
      2
    )
  );
} catch (error) {
  console.error("[verify-showcase-activity-ranking] failed");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
