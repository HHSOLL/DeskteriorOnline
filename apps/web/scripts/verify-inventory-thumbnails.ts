import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_CATALOG, normalizeCatalog } from "../src/lib/builder/catalog";

const publicRoot = fileURLToPath(new URL("../public", import.meta.url));
const thumbnailItems = DEFAULT_CATALOG.filter((item) => item.thumbnail);
const thumbnailCoverage = thumbnailItems.length / DEFAULT_CATALOG.length;

assert.ok(
  thumbnailCoverage >= 0.95,
  `inventory thumbnail coverage should stay at or above 95% (${thumbnailItems.length}/${DEFAULT_CATALOG.length})`
);

const missingThumbnailFiles = thumbnailItems
  .filter((item) => item.thumbnail?.startsWith("/"))
  .filter((item) => !existsSync(join(publicRoot, item.thumbnail!.slice(1))))
  .map((item) => `${item.id}: ${item.thumbnail}`);

assert.deepEqual(missingThumbnailFiles, [], "inventory thumbnail files should exist under public/");

const [normalizedRelativeThumbnail] = normalizeCatalog([
  {
    ...DEFAULT_CATALOG[0],
    id: "relative-thumbnail-smoke",
    thumbnail: "/assets/catalog/thumbnails/p2s_desk_oak.webp"
  }
]);

assert.equal(
  normalizedRelativeThumbnail?.thumbnail,
  "/assets/catalog/thumbnails/p2s_desk_oak.webp",
  "catalog API normalization should preserve app-relative inventory thumbnail paths"
);

console.log(
  `Inventory thumbnail contract passed (${thumbnailItems.length}/${DEFAULT_CATALOG.length} catalog items have thumbnails).`
);
