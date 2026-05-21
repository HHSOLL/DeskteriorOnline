import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { DEFAULT_CATALOG } from "../src/lib/builder/catalog";
import {
  SO_ONG_VIDEO_LISTED_ONLY_PRODUCTS,
  SO_ONG_VIDEO_PRODUCTS,
  SO_ONG_VIDEO_SCENE_OBJECTS,
  SO_ONG_VIDEO_VISIBLE_PRODUCTS
} from "../src/lib/builder/so-ong-video-reference";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const publicRoot = fileURLToPath(new URL("../public", import.meta.url));
const referenceRoot = join(repoRoot, "assets/references/video-scenes/so-ong-space-2026-05-desk-setup");
const catalogById = new Map(DEFAULT_CATALOG.map((item) => [item.id, item]));

async function readPreviewColorCoverage(imagePath: string) {
  const { data, info } = await sharp(imagePath)
    .resize({ width: 256, withoutEnlargement: true })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixelCount = info.width * info.height;
  let darkPixels = 0;
  let nonWhitePixels = 0;
  let saturatedPixels = 0;

  for (let index = 0; index < data.length; index += info.channels) {
    const red = data[index] ?? 0;
    const green = data[index + 1] ?? 0;
    const blue = data[index + 2] ?? 0;
    const max = Math.max(red, green, blue);
    const min = Math.min(red, green, blue);

    if (!(red > 226 && green > 226 && blue > 226)) {
      nonWhitePixels += 1;
    }
    if (red < 80 && green < 80 && blue < 90) {
      darkPixels += 1;
    }
    if (max - min > 32) {
      saturatedPixels += 1;
    }
  }

  return {
    darkRatio: darkPixels / pixelCount,
    nonWhiteRatio: nonWhitePixels / pixelCount,
    saturatedRatio: saturatedPixels / pixelCount
  };
}

const productIds = SO_ONG_VIDEO_PRODUCTS.map((product) => product.catalogItemId);
const uniqueProductIds = new Set(productIds);
const sceneCatalogIds = new Set<string>(SO_ONG_VIDEO_SCENE_OBJECTS.map((object) => object.catalogItemId));
const visibleReferenceCatalogIds = new Set(SO_ONG_VIDEO_VISIBLE_PRODUCTS.map((product) => product.catalogItemId));
const listedOnlyCatalogIds = new Set(SO_ONG_VIDEO_LISTED_ONLY_PRODUCTS.map((product) => product.catalogItemId));

assert.equal(SO_ONG_VIDEO_PRODUCTS.length, 28, "So Ong video pack should track the supplied 28 unique product references");
assert.equal(uniqueProductIds.size, 28, "So Ong video product catalog ids should be unique");
assert.equal(SO_ONG_VIDEO_VISIBLE_PRODUCTS.length, 17, "visible-crop generation should only include the 17 products visible in the supplied reference still");
assert.equal(SO_ONG_VIDEO_LISTED_ONLY_PRODUCTS.length, 11, "listed-only metadata should remain separate from generated visible-crop assets");

for (const product of SO_ONG_VIDEO_PRODUCTS) {
  assert.match(product.catalogItemId, /^p2s_video_so_ong_/, `${product.catalogItemId} should use the video pack namespace`);
  assert.ok(product.sourceUrl.startsWith("http"), `${product.catalogItemId} should retain the source product URL`);
  assert.ok(
    product.dimensionConfidence === "visual_estimate_pending_qa" ||
      product.dimensionConfidence === "manufacturer_or_vendor_page",
    `${product.catalogItemId} should declare dimension confidence`
  );

  const catalogItem = catalogById.get(product.catalogItemId);
  if (product.visibleInStill === "listed_only") {
    assert.equal(catalogItem, undefined, `${product.catalogItemId} should not be exposed/generated for this visible-crop scene`);
    const listedOnlyModelPath = join(publicRoot, "assets/models", product.catalogItemId, `${product.catalogItemId}.glb`);
    const listedOnlyThumbnailPath = join(publicRoot, "assets/catalog/thumbnails", `${product.catalogItemId}.webp`);
    assert.ok(!existsSync(listedOnlyModelPath), `${product.catalogItemId} should not have a generated visible-crop GLB`);
    assert.ok(!existsSync(listedOnlyThumbnailPath), `${product.catalogItemId} should not have a generated visible-crop thumbnail`);
    assert.ok(
      !sceneCatalogIds.has(product.catalogItemId),
      `${product.catalogItemId} should stay out of the visible-crop reference layout`
    );
    continue;
  }

  assert.ok(catalogItem, `${product.catalogItemId} should be exposed in DEFAULT_CATALOG`);
  assert.equal(catalogItem?.externalUrl, product.sourceUrl, `${product.catalogItemId} should preserve external URL`);
  assert.equal(catalogItem?.scaleLocked, true, `${product.catalogItemId} should be scale locked`);
  assert.equal(catalogItem?.license?.spdx, "LicenseRef-Video-Reference-Prototype-Only");
  assert.equal(catalogItem?.license?.requiresAttribution, true);
  assert.ok(
    catalogItem?.detailNotes?.includes("commercial asset gate: blocked"),
    `${product.catalogItemId} should remain prototype/reference-only`
  );

  const modelPath = join(publicRoot, catalogItem!.assetId.slice(1));
  const thumbnailPath = join(publicRoot, catalogItem!.thumbnail!.slice(1));
  assert.ok(existsSync(modelPath), `${product.catalogItemId} model should exist: ${modelPath}`);
  assert.ok(statSync(modelPath).size > 4096, `${product.catalogItemId} model should be a non-empty GLB`);
  assert.ok(
    catalogItem?.thumbnail?.endsWith(".webp"),
    `${product.catalogItemId} thumbnail should be a rendered WebP artifact`
  );
  assert.ok(existsSync(thumbnailPath), `${product.catalogItemId} thumbnail should exist: ${thumbnailPath}`);
  const thumbnailSizeBytes = statSync(thumbnailPath).size;
  assert.ok(thumbnailSizeBytes > 1200, `${product.catalogItemId} thumbnail should not be an empty placeholder`);
  if (product.visibleInStill === "primary") {
    assert.ok(thumbnailSizeBytes > 1800, `${product.catalogItemId} primary thumbnail should be a real model render`);
  }
  assert.ok(
    sceneCatalogIds.has(product.catalogItemId),
    `${product.catalogItemId} should be represented in the visible-crop reference layout`
  );
}

const primaryVisibleProducts = SO_ONG_VIDEO_PRODUCTS.filter((product) => product.visibleInStill === "primary");
assert.ok(primaryVisibleProducts.length >= 8, "reference pack should identify the primary products visible in the supplied still");

const productsById = new Map(SO_ONG_VIDEO_PRODUCTS.map((product) => [product.catalogItemId, product]));
const expectedReconciledDimensions = [
  ["p2s_video_so_ong_gravastar_mars_pro", { width: 201, depth: 180, height: 191 }],
  ["p2s_video_so_ong_offrame_dual_monitor_riser", { width: 1000, depth: 250, height: 120 }],
  ["p2s_video_so_ong_elgato_stream_deck_neo", { width: 107, depth: 78, height: 26 }]
] as const;

for (const [productId, dimensions] of expectedReconciledDimensions) {
  assert.deepEqual(
    productsById.get(productId)?.dimensionsMm,
    dimensions,
    `${productId} should retain the product-detail reconciled dimensions`
  );
  assert.equal(
    productsById.get(productId)?.dimensionConfidence,
    "manufacturer_or_vendor_page",
    `${productId} should be marked as vendor-backed after reconciliation`
  );
}

const previewPath = join(referenceRoot, "so-ong-space-reference-preview.png");
assert.ok(existsSync(previewPath), "So Ong reference preview render should exist");
assert.ok(statSync(previewPath).size > 100_000, "So Ong reference preview render should be a real visual artifact");

const meshyPreviewPath = join(referenceRoot, "so-ong-space-meshy-preview.png");
const meshyColorPreviewPath = join(referenceRoot, "so-ong-space-meshy-preview-color-v2.png");
assert.ok(existsSync(meshyPreviewPath), "So Ong Meshy placement preview render should exist");
assert.ok(existsSync(meshyColorPreviewPath), "So Ong Meshy color QA preview render should exist");
assert.ok(statSync(meshyPreviewPath).size > 100_000, "So Ong Meshy preview render should be a real visual artifact");
assert.ok(
  statSync(meshyColorPreviewPath).size > 100_000,
  "So Ong Meshy color QA preview render should be a real visual artifact"
);

const fidelityReportPath = join(referenceRoot, "visual-fidelity-report.json");
assert.ok(existsSync(fidelityReportPath), "So Ong visual fidelity report should exist");
const fidelityReport = JSON.parse(readFileSync(fidelityReportPath, "utf8")) as {
  legalBoundary: string;
  assetCount: number;
  heroAssetCount: number;
  minimumHeroSignatureScore: number;
  assets: Array<{
    assetKey: string;
    kind: string;
    objectCount: number;
    modelSizeBytes: number;
    requiredSignatureFragments: string[];
    signatureScore: number | null;
    prototypeStatus: string;
  }>;
};
assert.equal(fidelityReport.assetCount, 17, "visual fidelity report should cover only visible-crop generated So Ong product assets");
assert.ok(
  fidelityReport.legalBoundary.includes("private/prototype"),
  "visual fidelity report should preserve private/prototype legal boundary"
);
assert.ok(fidelityReport.heroAssetCount >= 8, "visual fidelity report should enforce hero product signature checks");
assert.ok(
  fidelityReport.minimumHeroSignatureScore >= 1,
  "every hero product should contain all required signature geometry fragments"
);

const fidelityById = new Map(fidelityReport.assets.map((asset) => [asset.assetKey, asset]));
for (const assetId of listedOnlyCatalogIds) {
  assert.ok(!fidelityById.has(assetId), `${assetId} should not be generated in the visible-crop fidelity report`);
}
const requiredHeroFidelity = [
  ["p2s_video_so_ong_tfg40q14wp_monitor", 24],
  ["p2s_video_so_ong_hyte_y70_snow_white", 38],
  ["p2s_video_so_ong_reproducer_epic5", 10],
  ["p2s_video_so_ong_angry_miao_am_hatsu", 70],
  ["p2s_video_so_ong_zionworks_synchronize_mat", 80],
  ["p2s_video_so_ong_divoom_times_gate", 18],
  ["p2s_video_so_ong_gravastar_mars_pro", 18],
  ["p2s_video_so_ong_arturia_minifuse2", 8],
  ["p2s_video_so_ong_ivy_planter", 10]
] as const;

for (const [assetId, minimumObjectCount] of requiredHeroFidelity) {
  const report = fidelityById.get(assetId);
  assert.ok(report, `${assetId} should be present in the visual fidelity report`);
  assert.equal(report?.prototypeStatus, "private_reference_rebuild_v2");
  assert.ok(
    report!.objectCount >= minimumObjectCount,
    `${assetId} should have enough product-specific geometry to avoid placeholder quality`
  );
  assert.ok(
    report!.modelSizeBytes > 12_000,
    `${assetId} should be a detailed GLB and not a tiny placeholder export`
  );
  assert.equal(report!.signatureScore, 1, `${assetId} should pass all required signature fragments`);
}

const requiredCompositionObjects = [
  "main-monitor",
  "portable-monitor",
  "portable-monitor-stand",
  "times-gate",
  "spacecraft",
  "ivy",
  "mars-pro",
  "audio-interface",
  "diecast",
  "offrame-riser",
  "hyte-y70",
  "square1-power-cube",
  "keyboard",
  "mouse",
  "mat",
  "left-speaker",
  "right-speaker",
  "light-bar"
];
const sceneObjectIds = new Set<string>(SO_ONG_VIDEO_SCENE_OBJECTS.map((object) => object.id));
for (const objectId of requiredCompositionObjects) {
  assert.ok(sceneObjectIds.has(objectId), `reference layout should include ${objectId}`);
}

assert.equal(
  sceneCatalogIds.size - 2,
  visibleReferenceCatalogIds.size,
  "reference layout should include visible products plus desk and separate light-bar only"
);
assert.ok(!sceneObjectIds.has("stream-deck-neo"), "Stream Deck Neo is listed metadata only and should not appear in this crop");
assert.ok(!sceneObjectIds.has("ceiling-light"), "ceiling light is mood metadata only and should not appear in this crop");

readPreviewColorCoverage(meshyColorPreviewPath)
  .then((meshyColorCoverage) => {
    assert.ok(
      meshyColorCoverage.nonWhiteRatio >= 0.55,
      `So Ong Meshy preview should not read as all-white; nonWhiteRatio=${meshyColorCoverage.nonWhiteRatio.toFixed(3)}`
    );
    assert.ok(
      meshyColorCoverage.darkRatio >= 0.08,
      `So Ong Meshy preview should preserve black screens/baffles/mat/keycaps; darkRatio=${meshyColorCoverage.darkRatio.toFixed(3)}`
    );
    assert.ok(
      meshyColorCoverage.saturatedRatio >= 0.04,
      `So Ong Meshy preview should preserve product accent colors; saturatedRatio=${meshyColorCoverage.saturatedRatio.toFixed(3)}`
    );

    console.log(
      `So Ong video reference pack verified: ${SO_ONG_VIDEO_VISIBLE_PRODUCTS.length} visible generated products ` +
        `(${SO_ONG_VIDEO_PRODUCTS.length} referenced/listed), ` +
        `${SO_ONG_VIDEO_SCENE_OBJECTS.length} scene objects, preview=${previewPath}, ` +
        `meshyColorPreview=${meshyColorPreviewPath}, ` +
        `nonWhite=${meshyColorCoverage.nonWhiteRatio.toFixed(3)}, ` +
        `dark=${meshyColorCoverage.darkRatio.toFixed(3)}, ` +
        `saturated=${meshyColorCoverage.saturatedRatio.toFixed(3)}`
    );
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
