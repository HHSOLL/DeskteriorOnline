import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import {
  DEFAULT_CATALOG,
  getCatalogGenerationBadge,
  isGeneratedCatalogItem
} from "../src/lib/builder/catalog";

const require = createRequire(import.meta.url);
const gltfValidator = require("gltf-validator") as {
  validateBytes: (
    bytes: Uint8Array,
    options?: Record<string, unknown>
  ) => Promise<{ issues: { numErrors: number; numWarnings: number; messages: Array<{ code: string; message: string }> } }>;
};

const repoRoot = path.resolve(process.cwd(), "../..");
const catalogItemId = "p2s_meshy_pastel_mascot_stack";
const modelPath = path.join(
  repoRoot,
  "apps/web/public/assets/models/p2s_meshy_pastel_mascot_stack/p2s_meshy_pastel_mascot_stack.glb"
);
const proxyPath = path.join(
  repoRoot,
  "apps/web/public/assets/models/p2s_meshy_pastel_mascot_stack/p2s_meshy_pastel_mascot_stack.proxy.glb"
);
const thumbnailPath = path.join(
  repoRoot,
  "apps/web/public/assets/catalog/thumbnails/p2s_meshy_pastel_mascot_stack.webp"
);
const reportPath = path.join(repoRoot, "assets/references/meshy-room-decor/meshy-room-decor-report.json");
const packageSource = readFileSync(path.join(repoRoot, "apps/web/package.json"), "utf8");
const seededAssetsSource = readFileSync(path.join(repoRoot, "apps/web/src/lib/builder/seeded-assets.ts"), "utf8");
const builderStyleSource = readFileSync(path.join(repoRoot, "apps/web/src/features/builder/steps/BuilderStyleStep.tsx"), "utf8");
const libraryShelfSource = readFileSync(path.join(repoRoot, "apps/web/src/components/editor/BuilderLibraryShelf.tsx"), "utf8");
const inspectorSource = readFileSync(path.join(repoRoot, "apps/web/src/components/editor/BuilderInspectorPanel.tsx"), "utf8");
const furnitureSource = readFileSync(path.join(repoRoot, "apps/web/src/components/canvas/features/Furniture.tsx"), "utf8");
const liveModelPreviewSource = readFileSync(
  path.join(repoRoot, "apps/web/src/components/editor/CatalogLiveModelPreview.tsx"),
  "utf8"
);
const livePreviewQaRouteSource = readFileSync(
  path.join(repoRoot, "apps/web/src/app/labs/qa/meshy-live-preview/page.tsx"),
  "utf8"
);
const livePreviewVerifierSource = readFileSync(
  path.join(repoRoot, "apps/web/scripts/verify-meshy-live-preview.ts"),
  "utf8"
);
const editorSceneQaRouteSource = readFileSync(
  path.join(repoRoot, "apps/web/src/app/labs/qa/meshy-editor-scene/page.tsx"),
  "utf8"
);
const editorSceneVerifierSource = readFileSync(
  path.join(repoRoot, "apps/web/scripts/verify-meshy-editor-scene.ts"),
  "utf8"
);
const finalizerSource = readFileSync(path.join(repoRoot, "scripts/blender/finalize-product-asset.py"), "utf8");

assert.ok(existsSync(modelPath), "Meshy decor GLB should exist");
assert.ok(existsSync(proxyPath), "Meshy decor proxy GLB should exist");
assert.ok(existsSync(thumbnailPath), "Meshy decor thumbnail should exist");
assert.ok(existsSync(reportPath), "Meshy decor generation report should exist");
assert.ok(statSync(modelPath).size > 1_000_000, "Meshy decor GLB should be a real generated asset");
assert.ok(statSync(proxyPath).size > 1_000_000, "Meshy decor proxy GLB should be a real generated asset");
assert.ok(statSync(thumbnailPath).size > 5_000, "Meshy decor thumbnail should be a real render artifact");

const report = JSON.parse(readFileSync(reportPath, "utf8")) as {
  schemaVersion?: string;
  asset?: {
    catalogItemId?: string;
    finalizerStatus?: string;
    outputGlb?: string;
    outputProxyGlb?: string;
    outputThumbnail?: string;
  };
  budget?: {
    source?: string;
    remaining?: number;
    costPerTask?: number;
    maxBudgetPerJob?: number;
    reservedEstimate?: number;
  };
};

assert.equal(report.schemaVersion, "meshy-room-decor-asset-v1", "generation report schema should be current");
assert.equal(report.asset?.catalogItemId, catalogItemId, "generation report should match the catalog item");
assert.equal(report.asset?.finalizerStatus, "finalized", "Meshy decor asset should pass Blender finalizer");
assert.ok(report.asset?.outputGlb?.endsWith(`${catalogItemId}.glb`), "report should point at the generated GLB");
assert.ok(report.asset?.outputProxyGlb?.endsWith(`${catalogItemId}.proxy.glb`), "report should point at the proxy GLB");
assert.ok(report.asset?.outputThumbnail?.endsWith(`${catalogItemId}.webp`), "report should point at the thumbnail");
assert.equal(report.budget?.source, "mesh_balance_api", "standalone Meshy run should derive budget from balance API when env budget is absent");
assert.ok((report.budget?.remaining ?? 0) >= 60, "Meshy balance should cover the reserved estimate");
assert.equal(report.budget?.costPerTask, 30, "Meshy text-to-3D cost guard should stay conservative");
assert.equal(report.budget?.maxBudgetPerJob, 60, "Meshy text-to-3D job cap should cover preview+refine only");
assert.ok((report.budget?.reservedEstimate ?? 0) <= (report.budget?.maxBudgetPerJob ?? 0), "reserved budget should not exceed job cap");

const catalogItem = DEFAULT_CATALOG.find((item) => item.id === catalogItemId);
assert.ok(catalogItem, "Meshy decor item should be exposed in the default catalog");
assert.equal(catalogItem?.categoryId, "decor", "Meshy decor item should be categorized as decor");
assert.equal(catalogItem?.assetId, `/assets/models/${catalogItemId}/${catalogItemId}.glb`);
assert.equal(catalogItem?.thumbnail, `/assets/catalog/thumbnails/${catalogItemId}.webp`);
assert.equal(catalogItem?.source?.path, "assets/references/meshy-room-decor/meshy-room-decor-report.json");
assert.equal(catalogItem?.textureSet?.authored, "image_based", "Meshy output should be marked image-based/PBR generated");
assert.equal(catalogItem?.scaleLocked, true, "generated decor should remain scale locked by physical dimensions");
assert.equal(isGeneratedCatalogItem(catalogItem!), true, "Meshy decor should be recognized as a generated catalog item");
assert.deepEqual(
  getCatalogGenerationBadge(catalogItem!),
  {
    label: "Meshy",
    reviewLabel: "검수 필요",
    providerLabel: "Meshy",
    tone: "review"
  },
  "Meshy decor should expose a generated/prototype badge contract"
);
assert.match(
  catalogItem!.assetId,
  /^\/assets\/models\/.+\.glb$/,
  "Meshy decor should remain eligible for real GLB live previews"
);

assert.ok(
  seededAssetsSource.includes(`"${catalogItemId}"`),
  "workspace-flex seed should place the Meshy decor asset in the display shelf cluster"
);
assert.ok(
  seededAssetsSource.includes("describeWorkspaceFlexClusterSelection"),
  "workspace-flex seed helper should expose generated asset previews for builder/editor disclosures"
);
assert.ok(
  builderStyleSource.includes("workspace-cluster-preset-generated-badge"),
  "builder style presets should disclose generated decor before project creation"
);
assert.ok(
  builderStyleSource.includes("workspace-cluster-generated-badge"),
  "builder style cluster toggles should disclose generated decor before project creation"
);
assert.ok(libraryShelfSource.includes("catalog-generated-filter"), "library shelf should let users isolate generated assets");
assert.ok(
  libraryShelfSource.includes("catalog-generated-badge"),
  "library shelf cards should show generated asset provenance"
);
assert.ok(
  inspectorSource.includes("selected-asset-generated-badge"),
  "selected asset inspector should show generated asset review state"
);
assert.ok(
  inspectorSource.includes("asset-replacement-generated-badge"),
  "replacement cards should show generated asset provenance"
);
assert.ok(
  inspectorSource.includes("asset-replacement-live-preview-${item.id}"),
  "replacement cards should expose live GLB preview slots for generated candidates"
);
assert.ok(
  liveModelPreviewSource.includes("__DESKTERIORONLINE_CATALOG_LIVE_MODEL_PREVIEWS__"),
  "live model previews should register real GLB render provenance for browser QA"
);
assert.ok(
  liveModelPreviewSource.includes('source: "real-glb-live-preview"'),
  "live model previews should identify generated GLB previews separately from proxy placeholders"
);
assert.ok(
  liveModelPreviewSource.includes("meshCount") && liveModelPreviewSource.includes("materialCount"),
  "live model previews should expose mesh/material counts for generated asset QA"
);
assert.ok(
  liveModelPreviewSource.includes("getCatalogGenerationBadge(item)"),
  "live model previews should carry Meshy provider and review status into the QA registry"
);
assert.ok(
  livePreviewQaRouteSource.includes(catalogItemId) &&
    livePreviewQaRouteSource.includes("meshy-live-preview-canvas") &&
    livePreviewQaRouteSource.includes("preserveDrawingBufferForQa"),
  "Meshy live preview QA route should render the generated catalog item through the live GLB preview"
);
assert.ok(
  livePreviewVerifierSource.includes("__DESKTERIORONLINE_CATALOG_LIVE_MODEL_PREVIEWS__") &&
    livePreviewVerifierSource.includes("__DESKTERIORONLINE_DISABLE_LOADING_OVERLAY__") &&
    livePreviewVerifierSource.includes("nonTransparentRatio"),
  "Meshy live preview verifier should check browser registry provenance, disable overlays, and read visible canvas pixels"
);
assert.ok(
  packageSource.includes('"verify:meshy-live-preview"'),
  "Meshy live preview verifier should be available as an apps/web package script"
);
assert.ok(
  furnitureSource.includes("__DESKTERIORONLINE_FURNITURE_GLB_LOADS__") &&
    furnitureSource.includes("meshCount") &&
    furnitureSource.includes("materialCount"),
  "Furniture renderer should expose loaded GLB evidence for full-room Meshy editor QA"
);
assert.ok(
  editorSceneQaRouteSource.includes(catalogItemId) &&
    editorSceneQaRouteSource.includes("meshy-editor-scene-viewport") &&
    editorSceneQaRouteSource.includes("buildSeededSceneAssets") &&
    editorSceneQaRouteSource.includes("__DESKTERIORONLINE_FORCE_REAL_GLB_TOP_VIEW_QA__") &&
    editorSceneQaRouteSource.includes('viewMode: "top"') &&
    editorSceneQaRouteSource.includes("preserveDrawingBuffer: true"),
  "Meshy editor scene QA route should render the generated asset inside a seeded cutaway top-view full-room scene"
);
assert.ok(
  editorSceneVerifierSource.includes("__DESKTERIORONLINE_FURNITURE_RENDER_SOURCES__") &&
    editorSceneVerifierSource.includes("__DESKTERIORONLINE_FURNITURE_GLB_LOADS__") &&
    editorSceneVerifierSource.includes('sourceEntry.source, "real-glb"') &&
    editorSceneVerifierSource.includes("uniqueColorBuckets"),
  "Meshy editor scene verifier should prove real GLB source, loaded mesh/material data, and visible canvas pixels"
);
assert.ok(
  packageSource.includes('"verify:meshy-editor-scene"'),
  "Meshy editor scene verifier should be available as an apps/web package script"
);
assert.ok(
  inspectorSource.includes("editor-room-styling-bundle-generated-badge"),
  "editor styling bundles should disclose generated assets before users apply them"
);
assert.ok(
  readFileSync(path.join(repoRoot, "apps/web/src/lib/builder/editor-styling-bundles.ts"), "utf8").includes(
    "describeWorkspaceFlexClusterSelection"
  ),
  "editor styling bundle previews should derive generated assets from the workspace-flex seed contract"
);
assert.ok(finalizerSource.includes("film_transparent = False"), "Meshy thumbnails should render with an opaque card background");
assert.ok(finalizerSource.includes("exposure = -0.55"), "Meshy thumbnails should avoid the overexposed transparent render");

async function main() {
  const validationReport = await gltfValidator.validateBytes(new Uint8Array(readFileSync(modelPath)), {
    maxIssues: 20
  });
  assert.equal(validationReport.issues.numErrors, 0, "Meshy decor GLB should have no glTF validation errors");

  console.log(
    `verify-meshy-room-decor-asset passed: catalog=${catalogItemId}, glbWarnings=${validationReport.issues.numWarnings}, reservedBudget=${report.budget?.reservedEstimate}`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
