import { getShowcaseSnapshotProfile } from "../src/lib/api/showcase";
import {
  buildPublishedSnapshotCardHref,
  buildPublishedSnapshotCardModel
} from "../src/lib/showcase/published-snapshot-card";
import { buildSharePreviewMeta } from "../src/lib/share/preview";
import { buildPublicScenePayload } from "../src/lib/server/public-scenes";
import {
  buildShowcaseSnapshotItem,
  resolveShowcaseThumbnailSource
} from "../src/lib/server/showcase";
import { buildSceneDocumentBootstrapFromSavePayload } from "../src/lib/server/project-versions";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const savePayload = {
  roomShell: {
    scale: 1,
    scaleInfo: {
      value: 1,
      source: "user_measure",
      confidence: 0.94
    },
    walls: [],
    openings: [],
    floors: [
      {
        id: "floor-1",
        outline: [
          [0, 0],
          [3.4, 0],
          [3.4, 2.4],
          [0, 2.4]
        ],
        materialId: null,
        roomId: "room-1",
        roomType: "other",
        label: "Main Room"
      }
    ]
  },
  assets: [
    {
      id: "desk-1",
      assetId: "p2s_desk_oak",
      catalogItemId: "desk-oak",
      anchorType: "floor",
      position: [1.48, 0, 1.06],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      materialId: null,
      supportProfile: {
        surfaces: [
          {
            id: "desk-top",
            anchorTypes: ["desk_surface", "furniture_surface"],
            center: [0, 0],
            size: [1.24, 0.68],
            top: 0.74,
            margin: [0.08, 0.06]
          }
        ]
      },
      product: {
        id: "desk-oak",
        name: "Oak Desk",
        category: "Tables",
        brand: "Plan2Space",
        price: "₩420,000",
        options: "1400 x 700",
        externalUrl: "https://example.com/desk",
        thumbnail: "https://example.com/desk.png",
        dimensionsMm: {
          width: 1400,
          depth: 700,
          height: 740
        },
        finishColor: "oak",
        finishMaterial: "veneered wood",
        detailNotes: "Rounded front edge",
        scaleLocked: true
      }
    },
    {
      id: "lamp-1",
      assetId: "p2s_desk_lamp_glow",
      catalogItemId: "desk-lamp-glow",
      anchorType: "desk_surface",
      supportAssetId: "desk-1",
      position: [1.56, 0.77, 1.0],
      rotation: [0, Math.PI / 8, 0],
      scale: [1, 1, 1],
      materialId: null,
      product: {
        id: "desk-lamp-glow",
        name: "Desk Lamp Glow",
        category: "Lighting",
        brand: "Plan2Space",
        price: "₩98,000",
        options: "Warm light",
        externalUrl: "https://example.com/lamp",
        thumbnail: "https://example.com/lamp.png",
        dimensionsMm: {
          width: 220,
          depth: 180,
          height: 420
        },
        finishColor: "cream",
        finishMaterial: "powder coated steel",
        detailNotes: "Emitter head with soft glow",
        scaleLocked: true
      }
    }
  ],
  materials: {
    wallIndex: 3,
    floorIndex: 2
  },
  lighting: {
    mode: "direct",
    ambientIntensity: 0.44,
    hemisphereIntensity: 0.54,
    directionalIntensity: 1.24,
    environmentBlur: 0.14,
    accentIntensity: 0.82,
    beamOpacity: 0.18
  }
};

try {
  const bootstrap = buildSceneDocumentBootstrapFromSavePayload(savePayload);
  const previewMeta = buildSharePreviewMeta({
    projectName: "Desk Precision Share",
    projectDescription: "Gallery/community card regression guard",
    versionNumber: 7,
    assetSummary: {
      totalAssets: 2,
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
          collection: "Lighting",
          tone: "ember",
          count: 1
        }
      ],
      collections: [
        {
          label: "Worksurface",
          count: 1
        }
      ],
      uncataloguedCount: 0,
      primaryTone: "sand",
      primaryCollection: "Worksurface"
    }
  });

  const project = {
    id: "project-1",
    name: "Fallback Project Name",
    description: "Fallback project description",
    thumbnail_path: "project-1/thumb.png"
  };
  const versionRow = {
    id: "version-1",
    version: 7,
    message: "publish",
    customization: {
      sceneDocument: bootstrap.document
    }
  };
  const sharedProject = {
    id: "share-1",
    token: "sharetoken123",
    project_id: "project-1",
    project_version_id: "version-1",
    permissions: "view",
    expires_at: null,
    preview_meta: previewMeta,
    published_at: "2026-04-19T09:15:00.000Z"
  };

  const publicPayload = buildPublicScenePayload({
    sharedProject,
    project,
    versionRow
  });
  const showcaseItem = buildShowcaseSnapshotItem({
    sharedProject,
    thumbnail: "https://example.com/version-1-snapshot.png"
  });
  const cardModel = buildPublishedSnapshotCardModel({
    previewMeta: showcaseItem.previewMeta,
    publishedAt: showcaseItem.published_at
  });
  const cardHref = buildPublishedSnapshotCardHref(showcaseItem.token);
  const profile = getShowcaseSnapshotProfile(showcaseItem);
  const thumbnailSource = resolveShowcaseThumbnailSource(
    {
      meta: null,
      thumbnail_path: "project-1/thumb.png"
    },
    {
      snapshot_path: "project-1/version-1-snapshot.png"
    }
  );

  assert(showcaseItem.token === publicPayload.token, "showcase token mismatch");
  assert(showcaseItem.project_id === publicPayload.projectId, "showcase projectId mismatch");
  assert(showcaseItem.project_version_id === publicPayload.projectVersionId, "showcase versionId mismatch");
  assert(showcaseItem.previewMeta?.projectName === publicPayload.projectName, "showcase projectName mismatch");
  assert(
    showcaseItem.previewMeta?.projectDescription === publicPayload.projectDescription,
    "showcase projectDescription mismatch"
  );
  assert(showcaseItem.previewMeta?.versionNumber === publicPayload.pinnedVersionNumber, "showcase version mismatch");
  assert(
    showcaseItem.previewMeta?.assetSummary?.totalAssets === publicPayload.previewAssetSummary?.totalAssets,
    "showcase asset total mismatch"
  );
  assert(
    showcaseItem.previewMeta?.assetSummary?.primaryCollection === publicPayload.previewAssetSummary?.primaryCollection,
    "showcase primary collection mismatch"
  );
  assert(thumbnailSource === "project-1/version-1-snapshot.png", `thumbnail source mismatch: ${thumbnailSource}`);
  assert(cardModel.projectName === publicPayload.projectName, "card projectName mismatch");
  assert(cardModel.secondaryLabel === "제품 2개", `card secondary label mismatch: ${cardModel.secondaryLabel}`);
  assert(cardModel.primaryCollection === "Worksurface", `card collection mismatch: ${cardModel.primaryCollection}`);
  assert(cardModel.versionBadgeLabel === "장면 v7", `card version badge mismatch: ${cardModel.versionBadgeLabel}`);
  assert(cardHref === "/shared/sharetoken123?source=showcase", `card href mismatch: ${cardHref}`);
  assert(profile.room === "workspace", `showcase room profile mismatch: ${profile.room}`);
  assert(profile.tone === "sand", `showcase tone profile mismatch: ${profile.tone}`);
  assert(profile.density === "minimal", `showcase density profile mismatch: ${profile.density}`);

  console.log("showcase scene consistency ok");
  console.log(
    JSON.stringify(
      {
        token: showcaseItem.token,
        href: cardHref,
        projectName: cardModel.projectName,
        versionBadgeLabel: cardModel.versionBadgeLabel,
        thumbnailSource,
        showcaseProfile: profile
      },
      null,
      2
    )
  );
} catch (error) {
  console.error("[verify-showcase-scene-consistency] failed");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
