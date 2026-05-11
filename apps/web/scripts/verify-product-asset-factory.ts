import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  ProductAssetFactoryPlan,
  ProductAssetFactoryPrivateCatalogEntry,
  ProductAssetFactoryQaReport,
  RuntimePackageCatalog,
  RuntimePackageDescriptor
} from "@deskterioronline/asset-compiler";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../../..");
const publicRoot = path.join(repoRoot, "apps", "web", "public");
const assetKey = "p2s_fursys_setina_zdq012j";
const factoryDir = path.join(repoRoot, "assets", "references", "product-pages", assetKey, "asset-factory");
const planPath = path.join(factoryDir, "asset-plan.json");
const qaReportPath = path.join(factoryDir, "factory-qa-report.json");
const repairPath = path.join(factoryDir, "repair-instructions.json");
const privateCatalogEntryPath = path.join(factoryDir, "private-catalog-entry.json");
const blenderScriptPath = path.join(factoryDir, `build-${assetKey}.py`);
const runtimeDescriptorPath = path.join(
  publicRoot,
  "assets",
  "catalog",
  "runtime-packages",
  `${assetKey}.json`
);
const runtimeIndexPath = path.join(publicRoot, "assets", "catalog", "runtime-packages.json");

assert(existsSync(planPath), "asset factory plan is missing; run asset:factory first");
assert(existsSync(qaReportPath), "asset factory QA report is missing; run asset:factory first");
assert(existsSync(repairPath), "asset factory repair instructions are missing");
assert(existsSync(privateCatalogEntryPath), "asset factory private catalog entry is missing");
assert(existsSync(blenderScriptPath), "asset factory Blender scaffold is missing");

const plan = readJson<ProductAssetFactoryPlan>(planPath);
const qaReport = readJson<ProductAssetFactoryQaReport>(qaReportPath);
const repair = readJson<{ schemaVersion: string; assetKey: string; instructions: string[] }>(repairPath);
const privateCatalogEntry = readJson<ProductAssetFactoryPrivateCatalogEntry>(privateCatalogEntryPath);
const runtimeDescriptor = readJson<RuntimePackageDescriptor>(runtimeDescriptorPath);
const runtimeIndex = readJson<RuntimePackageCatalog>(runtimeIndexPath);
const blenderScript = readFileSync(blenderScriptPath, "utf8");

assert(plan.schemaVersion === "product-asset-factory-plan-alpha-v1", "unexpected plan schema");
assert(plan.assetKey === assetKey, "plan asset key mismatch");
assert(plan.visibility.mode === "private_prototype", "factory plan must be private prototype");
assert(plan.visibility.catalogExposure === "private_only", "factory plan must stay private-only");
assert(plan.visibility.releaseEligible === false, "factory plan must block release eligibility");
assert(plan.qualityTargets.targetSimilarityPercent >= 90, "factory target similarity must be near-commercial");
assert(plan.qualityTargets.requireLicensedCadForCommercial === true, "licensed CAD must be required for commercial use");
assert(
  plan.build.strategy === "blender_procedural_reference_rebuild",
  "factory plan must use the Blender procedural reference rebuild strategy"
);
assert(plan.build.requiredComponents.length >= 6, "factory plan needs product-specific component instructions");
assert(
  plan.build.requiredComponents.some((component) => component.includes("desktop slab")),
  "FURSYS desk plan must include the desktop slab"
);
assert(plan.build.materialSlots.length >= 6, "factory plan needs separated material slots");
assert(
  plan.build.materialSlots.some((slot) => slot.materialType === "wood") &&
    plan.build.materialSlots.some((slot) => slot.materialType === "metal"),
  "factory material plan must separate wood and metal slots"
);
assert(
  plan.validationGates.some((gate) => gate.includes("releaseEligible remains false")),
  "factory validation gates must include public release blocking"
);
assert(plan.referenceImages.length >= 3, "factory plan needs reference image coverage");

assert(qaReport.schemaVersion === "product-asset-factory-qa-alpha-v1", "unexpected QA report schema");
assert(qaReport.assetKey === assetKey, "QA report asset key mismatch");
assert(qaReport.status === "ready_for_private_use", "FURSYS asset should be ready for private prototype use");
assert(qaReport.privateUseOnly === true, "QA report must mark private-only use");
assert(qaReport.releaseEligible === false, "QA report must block release eligibility");
assert(qaReport.commercialStatus !== "blocked", "commercial status should provide repair path, not block the private asset");
assert(qaReport.scores.privateReadiness >= 0.75, "private readiness score is too low");
assert(qaReport.scores.visualFidelity < plan.qualityTargets.minVisualFidelityScore, "fixture should still require a repair loop before commercial use");
assert(qaReport.dimensionComparison.passed, "runtime dimensions must match official dimensions");
assert(qaReport.dimensionComparison.maxErrorMm === 0, "FURSYS dimension error should remain zero");
assert(qaReport.referenceCoverage.imageCount >= 3, "QA report needs reference image coverage");
assert(qaReport.materialCoverage.pendingSlotCount > 0, "URL-derived material slots must remain pending until material QA");
assert(qaReport.catalogVisibility.runtimePackageFound, "runtime package must be detected");
assert(qaReport.catalogVisibility.runtimeIndexFound, "runtime package index entry must be detected");
assert(qaReport.catalogVisibility.publicReleaseBlocked, "runtime package must block public release");
assert(
  qaReport.artifactChecks.every((check) => !check.required || (check.exists && (check.sizeBytes ?? 0) > 0)),
  "all required asset factory artifacts must exist"
);

assert(repair.schemaVersion === "product-asset-factory-repair-alpha-v1", "unexpected repair schema");
assert(repair.assetKey === assetKey, "repair asset key mismatch");
assert(
  repair.instructions.some((instruction) => /material/i.test(instruction)) &&
    repair.instructions.some((instruction) => /private\/prototype-only/i.test(instruction)),
  "repair instructions must cover material QA and private/prototype restrictions"
);

assert(privateCatalogEntry.schemaVersion === "product-asset-private-catalog-alpha-v1", "unexpected private catalog schema");
assert(privateCatalogEntry.assetKey === assetKey, "private catalog asset key mismatch");
assert(privateCatalogEntry.visibility === "private_prototype", "private catalog entry must stay private prototype");
assert(privateCatalogEntry.releaseEligible === false, "private catalog entry must block release eligibility");
assert(privateCatalogEntry.restrictions.some((restriction) => restriction.includes("public catalog")), "missing public catalog restriction");

assert(runtimeDescriptor.commercialReadiness.releaseEligible === false, "runtime descriptor must not be release eligible");
assert(runtimeDescriptor.runtimeAsset.commercialReadiness?.releaseEligible === false, "runtime asset must not be release eligible");
assert(
  runtimeIndex.assets.find((entry) => entry.key === assetKey)?.releaseEligible === false,
  "runtime package index must keep factory asset private"
);
assert(blenderScript.includes("DIMENSIONS_MM"), "Blender scaffold must carry official dimensions");
assert(blenderScript.includes("build_dimension_proxy"), "Blender scaffold must include a dimension-locked build path");

console.log(
  JSON.stringify(
    {
      ok: true,
      assetKey,
      privateReadiness: qaReport.scores.privateReadiness,
      visualFidelity: qaReport.scores.visualFidelity,
      materialPendingSlots: qaReport.materialCoverage.pendingSlotCount,
      repairInstructionCount: repair.instructions.length,
      releaseEligible: qaReport.releaseEligible
    },
    null,
    2
  )
);
