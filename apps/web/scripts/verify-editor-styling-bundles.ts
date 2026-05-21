import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_CATALOG } from "../src/lib/builder/catalog";
import {
  buildEditorRoomStylingBundleAssets,
  describeEditorRoomStylingBundle,
  EDITOR_ROOM_STYLING_BUNDLES
} from "../src/lib/builder/editor-styling-bundles";
import { deriveBlankRoomShell } from "../src/lib/domain/room-shell";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(__dirname, "..");

const roomShell = deriveBlankRoomShell({
  scale: 1,
  scaleInfo: {
    value: 1,
    source: "user_measure",
    confidence: 1,
    evidence: {
      notes: "editor styling bundle verification shell"
    }
  },
  walls: [
    { id: "wall-back", start: [-2.8, -1.8], end: [2.8, -1.8], thickness: 0.12, height: 2.8 },
    { id: "wall-right", start: [2.8, -1.8], end: [2.8, 1.8], thickness: 0.12, height: 2.8 },
    { id: "wall-front", start: [2.8, 1.8], end: [-2.8, 1.8], thickness: 0.12, height: 2.8 },
    { id: "wall-left", start: [-2.8, 1.8], end: [-2.8, -1.8], thickness: 0.12, height: 2.8 }
  ],
  openings: [],
  floors: [
    {
      id: "floor-main",
      outline: [
        [-2.8, -1.8],
        [2.8, -1.8],
        [2.8, 1.8],
        [-2.8, 1.8]
      ],
      materialId: null,
      roomId: "room-main",
      roomType: "other",
      label: "Verification Room"
    }
  ]
});

function readSource(relativePath: string) {
  return readFileSync(path.join(APP_ROOT, relativePath), "utf8");
}

const fullRoomBundle = EDITOR_ROOM_STYLING_BUNDLES.find((bundle) => bundle.id === "complete-room");
const creatorDeskBundle = EDITOR_ROOM_STYLING_BUNDLES.find((bundle) => bundle.id === "creator-desk");
const mediaLoungeBundle = EDITOR_ROOM_STYLING_BUNDLES.find((bundle) => bundle.id === "media-lounge");
const galleryStudioBundle = EDITOR_ROOM_STYLING_BUNDLES.find((bundle) => bundle.id === "gallery-studio");
const meshyCatalogItemId = "p2s_meshy_pastel_mascot_stack";

assert(fullRoomBundle, "editor styling bundles should expose complete-room");
assert(creatorDeskBundle, "editor styling bundles should expose creator-desk");
assert(mediaLoungeBundle, "editor styling bundles should expose media-lounge");
assert(galleryStudioBundle, "editor styling bundles should expose gallery-studio");

const firstMediaApply = buildEditorRoomStylingBundleAssets({
  catalog: DEFAULT_CATALOG,
  roomShell,
  existingAssets: [],
  clusterIds: mediaLoungeBundle.clusterIds
});

assert(
  firstMediaApply.addedAssets.length >= 6,
  `media-lounge should add a dense visible room cluster, got ${firstMediaApply.addedAssets.length}`
);
assert.equal(
  firstMediaApply.nextAssets.length,
  firstMediaApply.addedAssets.length,
  "initial bundle apply should only contain newly added assets"
);

const secondMediaApply = buildEditorRoomStylingBundleAssets({
  catalog: DEFAULT_CATALOG,
  roomShell,
  existingAssets: firstMediaApply.nextAssets,
  clusterIds: mediaLoungeBundle.clusterIds
});

assert.equal(secondMediaApply.addedAssets.length, 0, "same editor bundle should not duplicate existing assets");
assert.equal(
  secondMediaApply.skippedAssets.length,
  firstMediaApply.requestedAssets.length,
  "same editor bundle should report skipped requested assets"
);

const creatorDeskApply = buildEditorRoomStylingBundleAssets({
  catalog: DEFAULT_CATALOG,
  roomShell,
  existingAssets: [],
  clusterIds: creatorDeskBundle.clusterIds
});
const supportIds = new Set(creatorDeskApply.nextAssets.map((asset) => asset.id));
const surfaceAssets = creatorDeskApply.addedAssets.filter((asset) =>
  asset.anchorType === "desk_surface" ||
  asset.anchorType === "shelf_surface" ||
  asset.anchorType === "furniture_surface"
);
assert(surfaceAssets.length >= 4, "creator-desk bundle should include surface-anchored desk/shelf props");
assert(
  surfaceAssets.every((asset) => asset.supportAssetId && supportIds.has(asset.supportAssetId)),
  "surface props added by editor bundles should reference a valid support asset"
);

const galleryStudioPreview = describeEditorRoomStylingBundle({
  catalog: DEFAULT_CATALOG,
  clusterIds: galleryStudioBundle.clusterIds
});
assert(
  galleryStudioPreview.generatedCatalogItemIds.includes(meshyCatalogItemId),
  "gallery-studio styling bundle should disclose the generated Meshy decor asset before apply"
);
assert.equal(
  galleryStudioPreview.generatedProviderLabels.includes("Meshy"),
  true,
  "generated styling bundle preview should expose the Meshy provider label"
);
assert.equal(
  galleryStudioPreview.requiresGeneratedReview,
  true,
  "generated styling bundle preview should flag review-required generated assets"
);

const panelSource = readSource("src/components/editor/BuilderInspectorPanel.tsx");
assert.match(
  panelSource,
  /data-testid="editor-room-styling-bundles"/,
  "editor inspector should expose the room styling bundle section"
);
assert.match(
  panelSource,
  /data-testid=\{`editor-room-styling-bundle-\$\{bundle\.id\}`\}/,
  "editor styling bundle buttons should have stable browser QA ids"
);
assert.match(
  panelSource,
  /onApplyRoomStylingBundle\(bundle\.id, bundle\.clusterIds, bundle\.label\)/,
  "editor styling bundle buttons should call the editor bundle apply callback"
);
assert.match(
  panelSource,
  /data-testid=\{`editor-room-styling-bundle-generated-badge-\$\{bundle\.id\}`\}/,
  "editor styling bundle buttons should expose generated asset badges for browser QA"
);
assert.match(
  panelSource,
  /describeEditorRoomStylingBundle/,
  "editor inspector should summarize generated/provenance bundle content before apply"
);

const projectPageSource = readSource("src/app/(editor)/project/[id]/page.tsx");
assert.match(
  projectPageSource,
  /buildEditorRoomStylingBundleAssets/,
  "project editor should use the editor bundle merge helper"
);
assert.match(
  projectPageSource,
  /setAssets\(result\.nextAssets\)/,
  "project editor should apply styling bundles as one merged asset update"
);
assert.match(
  projectPageSource,
  /recordSnapshot\(`스타일링 번들 적용: \$\{label\}`\)/,
  "project editor should create one undo snapshot for styling bundle apply"
);
assert.match(
  projectPageSource,
  /onApplyRoomStylingBundle=\{applyRoomStylingBundle\}/,
  "project editor should wire styling bundle apply into the inspector"
);
assert.match(
  projectPageSource,
  /catalogItems=\{libraryCatalog\}/,
  "project editor should pass the catalog into the inspector for generated bundle disclosure"
);

console.log("[verify:editor-styling-bundles] PASS");
