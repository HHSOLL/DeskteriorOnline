import fs from "node:fs";
import path from "node:path";
import type { RuntimeAsset, SceneDocumentV2 } from "@deskterioronline/scene-schema";

type BenchmarkSceneFile = {
  id: string;
  title: string;
  description: string;
  document: SceneDocumentV2;
  runtimeAssets: RuntimeAsset[];
  budgetHints: {
    drawCallsBudget: number;
    triangleBudget: number;
    objectCountBudget: number;
    textureBudgetMb: number;
  };
};

type BaselineEntry = {
  scenario: string;
  title: string;
  description: string;
  documentId: string;
  objects: number;
  uniqueAssets: number;
  surfacePlacements: number;
  runtimeAssetCount: number;
  declaredTriangleBudget: number;
  budgetHints: BenchmarkSceneFile["budgetHints"];
  telemetry: {
    scenario: string;
    fpsAvg: number | null;
    frameTimeP95Ms: number | null;
    heapGrowthPercentPoints: number | null;
    reactRenderCount: number | null;
    raycastLatencyP95Ms: number | null;
    assetLoadMs: number | null;
    firstUsableMs: number | null;
    drawCalls: number | null;
    triangles: number | null;
    gpuMemoryEstimateMb: number | null;
    inputLatencyP95Ms: number | null;
  };
};

type BaselineTemplate = {
  generatedAt: string;
  entries: BaselineEntry[];
};

const REQUIRED_TELEMETRY_KEYS = [
  "scenario",
  "fpsAvg",
  "frameTimeP95Ms",
  "heapGrowthPercentPoints",
  "reactRenderCount",
  "raycastLatencyP95Ms",
  "assetLoadMs",
  "firstUsableMs",
  "drawCalls",
  "triangles",
  "gpuMemoryEstimateMb",
  "inputLatencyP95Ms"
] as const;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function countSurfacePlacements(document: SceneDocumentV2) {
  return document.objects.filter((object) => object.placement.mode === "surface_local").length;
}

function countUniqueAssetIds(document: SceneDocumentV2) {
  return new Set(document.objects.map((object) => object.assetId)).size;
}

function sumTriangleBudgets(runtimeAssets: RuntimeAsset[]) {
  return runtimeAssets.reduce((sum, asset) => sum + asset.runtime.triangleBudget, 0);
}

function loadJsonFile<T>(filePath: string) {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function assertFiniteNumber(value: unknown, message: string): asserts value is number {
  assert(typeof value === "number" && Number.isFinite(value), message);
}

function main() {
  const workspaceRoot = path.resolve(process.cwd(), "..", "..");
  const benchmarkDir = path.resolve(workspaceRoot, "benchmark-scenes");
  const baselinePath = path.join(benchmarkDir, "baseline.template.json");
  const baseline = loadJsonFile<BaselineTemplate>(baselinePath);
  const expectedScenarioFiles = fs
    .readdirSync(benchmarkDir)
    .filter((file) => file.endsWith(".json") && file !== "baseline.template.json")
    .sort();

  assert(Array.isArray(baseline.entries), "baseline template must contain entries array");
  assert(
    baseline.entries.length === expectedScenarioFiles.length,
    `baseline template entry count mismatch: expected ${expectedScenarioFiles.length}, received ${baseline.entries.length}`
  );

  for (const file of expectedScenarioFiles) {
    const scenario = loadJsonFile<BenchmarkSceneFile>(path.join(benchmarkDir, file));
    const baselineEntry = baseline.entries.find((entry) => entry.scenario === scenario.id);
    assert(baselineEntry, `baseline template missing scenario ${scenario.id}`);

    assert(baselineEntry.title === scenario.title, `${scenario.id}: title mismatch`);
    assert(
      baselineEntry.description === scenario.description,
      `${scenario.id}: description mismatch`
    );
    assert(
      baselineEntry.documentId === scenario.document.id,
      `${scenario.id}: documentId mismatch`
    );
    assert(
      baselineEntry.objects === scenario.document.objects.length,
      `${scenario.id}: objects count mismatch`
    );
    assert(
      baselineEntry.uniqueAssets === countUniqueAssetIds(scenario.document),
      `${scenario.id}: uniqueAssets mismatch`
    );
    assert(
      baselineEntry.surfacePlacements === countSurfacePlacements(scenario.document),
      `${scenario.id}: surfacePlacements mismatch`
    );
    assert(
      baselineEntry.runtimeAssetCount === scenario.runtimeAssets.length,
      `${scenario.id}: runtimeAssetCount mismatch`
    );
    assert(
      baselineEntry.declaredTriangleBudget === sumTriangleBudgets(scenario.runtimeAssets),
      `${scenario.id}: declaredTriangleBudget mismatch`
    );

    for (const [key, value] of Object.entries(scenario.budgetHints)) {
      assert(
        baselineEntry.budgetHints[key as keyof BenchmarkSceneFile["budgetHints"]] === value,
        `${scenario.id}: budgetHints.${key} mismatch`
      );
    }

    const telemetryKeys = Object.keys(baselineEntry.telemetry).sort();
    assert(
      telemetryKeys.join("|") === [...REQUIRED_TELEMETRY_KEYS].sort().join("|"),
      `${scenario.id}: telemetry shape mismatch`
    );
    assert(
      baselineEntry.telemetry.scenario === scenario.id,
      `${scenario.id}: telemetry.scenario mismatch`
    );

    for (const key of REQUIRED_TELEMETRY_KEYS) {
      if (key === "scenario") {
        continue;
      }
      assertFiniteNumber(
        baselineEntry.telemetry[key],
        `${scenario.id}: telemetry.${key} must be a non-null finite number`
      );
    }

    const telemetry = baselineEntry.telemetry as {
      scenario: string;
      fpsAvg: number;
      frameTimeP95Ms: number;
      heapGrowthPercentPoints: number;
      reactRenderCount: number;
      raycastLatencyP95Ms: number;
      assetLoadMs: number;
      firstUsableMs: number;
      drawCalls: number;
      triangles: number;
      gpuMemoryEstimateMb: number;
      inputLatencyP95Ms: number;
    };

    assert(
      telemetry.fpsAvg >= 30,
      `${scenario.id}: telemetry.fpsAvg is below release floor (${telemetry.fpsAvg} < 30)`
    );
    assert(
      telemetry.frameTimeP95Ms <= 34,
      `${scenario.id}: telemetry.frameTimeP95Ms exceeds release budget (${telemetry.frameTimeP95Ms} > 34)`
    );
    assert(
      telemetry.raycastLatencyP95Ms <= 16,
      `${scenario.id}: telemetry.raycastLatencyP95Ms exceeds release budget (${telemetry.raycastLatencyP95Ms} > 16)`
    );
    assert(
      telemetry.inputLatencyP95Ms <= 16,
      `${scenario.id}: telemetry.inputLatencyP95Ms exceeds release budget (${telemetry.inputLatencyP95Ms} > 16)`
    );
    assert(
      telemetry.firstUsableMs <= 2000,
      `${scenario.id}: telemetry.firstUsableMs exceeds release budget (${telemetry.firstUsableMs} > 2000)`
    );
    assert(
      telemetry.drawCalls <= scenario.budgetHints.drawCallsBudget,
      `${scenario.id}: telemetry.drawCalls exceeds scenario budget (${telemetry.drawCalls} > ${scenario.budgetHints.drawCallsBudget})`
    );
    assert(
      telemetry.triangles <= scenario.budgetHints.triangleBudget,
      `${scenario.id}: telemetry.triangles exceeds scenario budget (${telemetry.triangles} > ${scenario.budgetHints.triangleBudget})`
    );
    assert(
      telemetry.gpuMemoryEstimateMb <= scenario.budgetHints.textureBudgetMb,
      `${scenario.id}: telemetry.gpuMemoryEstimateMb exceeds scenario budget (${telemetry.gpuMemoryEstimateMb} > ${scenario.budgetHints.textureBudgetMb})`
    );
  }

  console.log(
    JSON.stringify(
      {
        baseline: path.relative(workspaceRoot, baselinePath),
        scenarios: baseline.entries.map((entry) => entry.scenario)
      },
      null,
      2
    )
  );
}

try {
  main();
} catch (error) {
  console.error("[verify-benchmark-baseline-template] failed");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
