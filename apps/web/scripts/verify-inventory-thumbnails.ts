import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_CATALOG,
  hasSpecificCatalogThumbnail,
  normalizeCatalog
} from "../src/lib/builder/catalog";

const publicRoot = fileURLToPath(new URL("../public", import.meta.url));
const repoRoot = join(publicRoot, "..");
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

const sharedDeskThumbnailChair = DEFAULT_CATALOG.find((item) => item.id === "p2s_task_chair_mesh_black");
assert(sharedDeskThumbnailChair, "shared-thumbnail chair fixture should exist");
assert.equal(
  hasSpecificCatalogThumbnail(sharedDeskThumbnailChair, sharedDeskThumbnailChair.thumbnail),
  false,
  "catalog preview helper should reject shared placeholder thumbnails for mismatched assets"
);

const realDeskThumbnail = DEFAULT_CATALOG.find((item) => item.id === "p2s_desk_walnut_160");
assert(realDeskThumbnail, "specific desk thumbnail fixture should exist");
assert.equal(
  hasSpecificCatalogThumbnail(realDeskThumbnail, realDeskThumbnail.thumbnail),
  true,
  "catalog preview helper should accept thumbnails that match the asset id or catalog id"
);

const shelfSource = readFileSync(join(repoRoot, "src/components/editor/BuilderLibraryShelf.tsx"), "utf8");
assert.match(
  shelfSource,
  /hasSpecificCatalogThumbnail\(item, thumbnail\)/,
  "inventory shelf should not show shared placeholder thumbnails as if they were item-specific renders"
);

console.log(
  `Inventory thumbnail contract passed (${thumbnailItems.length}/${DEFAULT_CATALOG.length} catalog items have thumbnails).`
);
