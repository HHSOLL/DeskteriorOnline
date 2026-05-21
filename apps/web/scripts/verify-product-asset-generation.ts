import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ProductAssetGenerationRequestSchema } from "@deskterioronline/contracts/product-assets";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function read(relativePath: string) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../../..");

const parsed = ProductAssetGenerationRequestSchema.parse({
  productUrl: "https://example.com/product/desk"
});
assert(parsed.visibility === "private", "product URL generated assets must default to private visibility");
assert(parsed.providerMode === "auto", "provider mode must default to auto");
assert(parsed.maxCandidates === 4, "maxCandidates must default to 4");
assert(parsed.autoApproveThreshold === 0.82, "autoApproveThreshold must default to 0.82");

const productContracts = read("packages/contracts/src/product-assets.ts");
assert(productContracts.includes("ProductAssetGenerationRequestSchema"), "product asset request contract missing");
assert(productContracts.includes("z.literal(\"private\")"), "product asset visibility must be private-only");
assert(productContracts.includes("UserAssetCatalogItemSchema"), "private generated asset catalog item contract missing");

const webProductRoute = read("apps/web/src/app/api/v1/product-assets/generate/route.ts");
assert(webProductRoute.includes("/v1/product-assets/generate"), "web product asset route must proxy to API product-assets path");
assert(webProductRoute.includes("ProductAssetGenerationRequestSchema"), "web route must validate product asset request contract");

const webAssetsRoute = read("apps/web/src/app/api/v1/assets/route.ts");
assert(webAssetsRoute.includes("/v1/assets"), "web assets route must proxy private generated asset list");
assert(webAssetsRoute.includes("Cache-Control"), "private assets route must disable shared cache");

const apiApp = read("apps/api/src/app.ts");
assert(apiApp.includes("/v1/product-assets"), "API app must mount product asset routes behind auth");
assert(apiApp.includes("/v1/assets"), "API app must keep generated asset routes behind auth");

const apiJobsRepo = read("apps/api/src/repositories/jobs-repo.ts");
assert(apiJobsRepo.includes("PRODUCT_ASSET_GENERATION"), "API must enqueue PRODUCT_ASSET_GENERATION jobs");
assert(apiJobsRepo.includes("ownerId: payload.ownerId"), "job payload must use ownerId for web job polling");
assert(apiJobsRepo.includes("visibility: \"private\""), "product asset jobs must force private visibility");

const apiAssetsRepo = read("apps/api/src/repositories/assets-repo.ts");
assert(apiAssetsRepo.includes("createSignedUrl"), "generated asset listing must prefer signed storage URLs");
assert(apiAssetsRepo.includes(".eq(\"owner_id\", ownerId)"), "generated asset listing must be scoped to the owner");
assert(apiAssetsRepo.includes(".eq(\"is_public\", false)"), "generated asset listing must return private generated assets only");

const workerClaim = read("apps/worker/src/queue/claim-next-job.ts");
assert(workerClaim.includes("PRODUCT_ASSET_GENERATION"), "worker claim list must include product asset jobs");

const worker = read("apps/worker/src/worker.ts");
assert(worker.includes("processProductAssetGenerationJob"), "worker must route product asset jobs to the product processor");

const processor = read("apps/worker/src/processors/product-asset-generation-processor.ts");
assert(processor.includes("analyzeProductUrlReference"), "product processor must reuse asset-compiler URL reference analysis");
assert(processor.includes("resolveAssetProviderModelUrl"), "product processor must generate provider candidates");
assert(processor.includes("buildProviderPrompt"), "product processor must pass product/spec/material instructions to providers");
assert(processor.includes("finalizeProductAssetCandidate"), "product processor must run candidate finalization before registration");
assert(processor.includes("evaluateProductAssetCandidate"), "product processor must score finalized candidates before registration");
assert(processor.includes("resolveProductAssetCategoryProfile"), "product processor must apply category-specific runtime profiles");
assert(
  processor.includes("selectProviderReferenceImages"),
  "product processor must select provider input images separately from reference evidence order"
);
assert(
  processor.includes("PRODUCT_GENERATION_VIEW_PRIORITY"),
  "product processor must prefer hero/front product images over detail sheets for provider generation"
);
assert(processor.includes("createGeneratedAsset"), "product processor must register selected candidate as a private asset");
assert(processor.includes("thumbnailBuffer: selected.thumbnailBuffer"), "product processor must persist finalizer thumbnail evidence");
assert(processor.includes("private_reference_only"), "product processor must mark legal use as private reference only");
assert(processor.includes("releaseEligible: false"), "product URL generated assets must not become release eligible");
assert(processor.includes("referencePack"), "product processor must persist reference pack evidence in the job result");

const assetProviderProcessor = read("apps/worker/src/processors/asset-generation-processor.ts");
assert(assetProviderProcessor.includes("withAssetProviderRetry"), "provider candidates must use a provider-level retry loop");
assert(
  assetProviderProcessor.includes("ASSET_GENERATION_PROVIDER_MAX_ATTEMPTS"),
  "provider retry attempts must be runtime-configurable"
);
assert(assetProviderProcessor.includes("error.status === 429"), "provider retry loop must treat provider rate limiting as retryable");
assert(assetProviderProcessor.includes("error.status === 503"), "provider retry loop must treat provider outage as retryable");
assert(assetProviderProcessor.includes("evaluateMeshyBudgetGuard"), "Meshy provider calls must have a token/credit budget guard");
assert(assetProviderProcessor.includes("MESHY_BUDGET_MODE"), "Meshy budget guard must be controlled by worker env");
assert(assetProviderProcessor.includes("AssetProviderBudgetError"), "Meshy budget blocks must use a non-retryable provider error");
assert(
  assetProviderProcessor.indexOf("reserveAssetProviderBudget(provider") <
    assetProviderProcessor.indexOf("requestProviderGeneration(provider"),
  "Meshy budget must be reserved before any provider generation request"
);

const soOngMeshyScript = read("scripts/generate-so-ong-meshy-visible-assets.ts");
assert(soOngMeshyScript.includes("reserveMeshySceneBudget"), "standalone Meshy generation script must enforce a budget guard");
assert(
  soOngMeshyScript.indexOf("reserveMeshySceneBudget(\"image-to-3d task\")") <
    soOngMeshyScript.indexOf("const apiUrl = requireEnv(\"MESHY_API_URL\")"),
  "standalone image-to-3D Meshy calls must reserve budget before reading provider credentials"
);

const finalizer = read("apps/worker/src/processors/product-asset-finalizer.ts");
assert(finalizer.includes("BLENDER_BIN_NOT_CONFIGURED"), "finalizer must explicitly report missing Blender configuration");
assert(finalizer.includes("scripts/blender/finalize-product-asset.py"), "finalizer must use the Blender product finalizer script");
assert(finalizer.includes("thumbnail.webp"), "finalizer must generate thumbnail evidence");

const evaluator = read("apps/worker/src/processors/product-asset-evaluator.ts");
assert(evaluator.includes("thumbnailSimilarity"), "candidate evaluator must include thumbnail/reference similarity evidence");
assert(evaluator.includes("dimensionFit"), "candidate evaluator must score dimension fit");

const categoryProfiles = read("apps/worker/src/processors/product-asset-category-profiles.ts");
assert(categoryProfiles.includes("vesa_mount"), "monitor profile must preserve VESA placement metadata");
assert(categoryProfiles.includes("pc_case"), "category profiles must cover PC case hero assets");
assert(categoryProfiles.includes("desk_mat"), "category profiles must cover low-profile desk mat assets");

const blenderScript = read("scripts/blender/finalize-product-asset.py");
assert(blenderScript.includes("apply_dimensions"), "Blender finalizer must apply official product dimensions");
assert(blenderScript.includes("center_on_floor"), "Blender finalizer must normalize floor-centered pivot");
assert(blenderScript.includes("render_thumbnail"), "Blender finalizer must render a thumbnail");
assert(blenderScript.includes("maxErrorPercent"), "Blender finalizer must write dimension QA evidence");

const workerAssetRepo = read("apps/worker/src/repositories/assets-repo.ts");
assert(workerAssetRepo.includes("meta: payload.meta"), "generated asset registration must preserve product metadata");
assert(workerAssetRepo.includes("thumbnail_path"), "generated asset registration must persist thumbnail storage path");
assert(workerAssetRepo.includes("createSignedUrl(storagePath"), "worker generated asset result must avoid public-only URLs");

const catalogApi = read("apps/web/src/lib/api/catalog.ts");
assert(catalogApi.includes("/api/v1/assets"), "editor catalog fetch must merge user generated assets");

const productAssetClient = read("apps/web/src/features/product-assets/generate-from-url.ts");
assert(
  productAssetClient.includes("/api/v1/product-assets/generate"),
  "client helper must enqueue product URL asset jobs through the web route"
);

const libraryShelf = read("apps/web/src/components/editor/BuilderLibraryShelf.tsx");
assert(libraryShelf.includes("상품 링크로 에셋 생성"), "inventory shelf must expose product URL generation entry");
assert(libraryShelf.includes("onGenerateProductAsset"), "inventory shelf must invoke product URL generation handler");
assert(libraryShelf.includes("검수 필요"), "inventory shelf must distinguish needs-review generated assets");

const projectPage = read("apps/web/src/app/(editor)/project/[id]/page.tsx");
assert(projectPage.includes("enqueueProductAssetGeneration"), "project editor must wire product URL generation into inventory");
assert(projectPage.includes("fetchJobStatus"), "project editor must poll generated asset jobs before refreshing catalog");

const catalogNormalizer = read("apps/web/src/lib/builder/catalog.ts");
assert(catalogNormalizer.includes("qualityScore"), "catalog normalizer must preserve generated asset quality score");

const schema = read("schema.sql");
const migration = read("supabase/migrations/20260512120000_product_asset_generation_jobs.sql");
for (const source of [schema, migration]) {
  assert(source.includes("payload ? 'ownerId'"), "jobs RLS must recognize ownerId payloads");
  assert(source.includes("payload ? 'owner_id'"), "jobs RLS must preserve legacy owner_id payload support");
  assert(source.includes("result jsonb"), "jobs table must include result jsonb for generation evidence");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      route: "/api/v1/product-assets/generate",
      workerJobType: "PRODUCT_ASSET_GENERATION",
      visibility: parsed.visibility,
      maxCandidates: parsed.maxCandidates,
      releaseEligible: false
    },
    null,
    2
  )
);
