import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_CATALOG } from "../src/lib/builder/catalog";
import {
  SO_ONG_VIDEO_PRODUCTS,
  SO_ONG_VIDEO_SCENE_OBJECTS
} from "../src/lib/builder/so-ong-video-reference";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const publicRoot = fileURLToPath(new URL("../public", import.meta.url));
const referenceRoot = join(repoRoot, "assets/references/video-scenes/so-ong-space-2026-05-desk-setup");
const catalogById = new Map(DEFAULT_CATALOG.map((item) => [item.id, item]));

const productIds = SO_ONG_VIDEO_PRODUCTS.map((product) => product.catalogItemId);
const uniqueProductIds = new Set(productIds);
const sceneCatalogIds = new Set(SO_ONG_VIDEO_SCENE_OBJECTS.map((object) => object.catalogItemId));

assert.equal(SO_ONG_VIDEO_PRODUCTS.length, 28, "So Ong video pack should track the supplied 28 unique product references");
assert.equal(uniqueProductIds.size, 28, "So Ong video product catalog ids should be unique");

for (const product of SO_ONG_VIDEO_PRODUCTS) {
  assert.match(product.catalogItemId, /^p2s_video_so_ong_/, `${product.catalogItemId} should use the video pack namespace`);
  assert.ok(product.sourceUrl.startsWith("http"), `${product.catalogItemId} should retain the source product URL`);
  assert.ok(
    product.dimensionConfidence === "visual_estimate_pending_qa" ||
      product.dimensionConfidence === "manufacturer_or_vendor_page",
    `${product.catalogItemId} should declare dimension confidence`
  );

  const catalogItem = catalogById.get(product.catalogItemId);
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
  assert.ok(sceneCatalogIds.has(product.catalogItemId), `${product.catalogItemId} should be represented in the reference layout`);
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

const requiredCompositionObjects = [
  "main-monitor",
  "portable-monitor",
  "times-gate",
  "spacecraft",
  "ivy",
  "mars-pro",
  "audio-interface",
  "diecast",
  "hyte-y70",
  "keyboard",
  "mouse",
  "mat",
  "stream-deck-neo",
  "left-speaker",
  "ceiling-light"
];
const sceneObjectIds = new Set<string>(SO_ONG_VIDEO_SCENE_OBJECTS.map((object) => object.id));
for (const objectId of requiredCompositionObjects) {
  assert.ok(sceneObjectIds.has(objectId), `reference layout should include ${objectId}`);
}

console.log(
  `So Ong video reference pack verified: ${SO_ONG_VIDEO_PRODUCTS.length} products, ` +
    `${SO_ONG_VIDEO_SCENE_OBJECTS.length} scene objects, preview=${previewPath}`
);
