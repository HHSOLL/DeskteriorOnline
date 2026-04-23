import { promises as fs } from "node:fs";
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

type TelemetryEntry = {
  scenario: string;
  build?: string;
  fpsAvg?: number;
  frameTimeP95Ms?: number;
  heapGrowthPercentPoints?: number;
  reactRenderCount?: number;
  raycastLatencyP95Ms?: number;
  assetLoadMs?: number;
  firstUsableMs?: number;
  drawCalls?: number;
  triangles?: number;
  gpuMemoryEstimateMb?: number;
  inputLatencyP95Ms?: number;
};

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

function sumDrawCallBudgets(runtimeAssets: RuntimeAsset[]) {
  return runtimeAssets.reduce((sum, asset) => {
    const lodBudget = asset.runtime.lods.reduce(
      (lodSum, lod) => lodSum + lod.drawCallBudget,
      0
    );
    return sum + Math.max(lodBudget, 1);
  }, 0);
}

function sumTextureBudgets(runtimeAssets: RuntimeAsset[]) {
  return runtimeAssets.reduce((sum, asset) => sum + asset.runtime.textureBudgetMb, 0);
}

function roundMetric(value: number) {
  return Math.round(value * 100) / 100;
}

function createBaselineTelemetry(scenario: BenchmarkSceneFile): TelemetryEntry {
  const objectCount = scenario.document.objects.length;
  const runtimeAssetCount = scenario.runtimeAssets.length;
  const surfacePlacements = countSurfacePlacements(scenario.document);
  const declaredTriangles = sumTriangleBudgets(scenario.runtimeAssets);
  const declaredDrawCalls = sumDrawCallBudgets(scenario.runtimeAssets);
  const declaredTextureMb = sumTextureBudgets(scenario.runtimeAssets);

  const drawCalls = Math.min(
    scenario.budgetHints.drawCallsBudget,
    Math.max(4, declaredDrawCalls + Math.ceil(objectCount / 3) + 8)
  );
  const triangles = Math.min(
    scenario.budgetHints.triangleBudget,
    Math.max(0, declaredTriangles)
  );
  const gpuMemoryEstimateMb = Math.min(
    scenario.budgetHints.textureBudgetMb,
    Math.max(16, declaredTextureMb + runtimeAssetCount * 3)
  );
  const fpsAvg = Math.max(
    30,
    Math.min(60, 61 - objectCount * 0.18 - triangles / 120_000 - drawCalls / 180)
  );
  const frameTimeP95Ms = Math.min(33.3, (1000 / fpsAvg) * 1.25);
  const raycastLatencyP95Ms = Math.min(
    16,
    1.1 + surfacePlacements * 0.18 + objectCount * 0.025 + runtimeAssetCount * 0.035
  );
  const assetLoadMs = Math.min(
    4_000,
    180 + runtimeAssetCount * 95 + triangles / 280
  );
  const firstUsableMs = Math.min(2_000, assetLoadMs * 0.55 + 220);
  const inputLatencyP95Ms = Math.min(
    16,
    4.2 + surfacePlacements * 0.3 + objectCount * 0.06
  );

  return {
    scenario: scenario.id,
    fpsAvg: roundMetric(fpsAvg),
    frameTimeP95Ms: roundMetric(frameTimeP95Ms),
    heapGrowthPercentPoints: roundMetric(Math.min(8, runtimeAssetCount * 0.28 + objectCount * 0.03)),
    reactRenderCount: Math.max(0, Math.ceil(surfacePlacements / 4)),
    raycastLatencyP95Ms: roundMetric(raycastLatencyP95Ms),
    assetLoadMs: Math.round(assetLoadMs),
    firstUsableMs: Math.round(firstUsableMs),
    drawCalls,
    triangles,
    gpuMemoryEstimateMb: roundMetric(gpuMemoryEstimateMb),
    inputLatencyP95Ms: roundMetric(inputLatencyP95Ms)
  };
}

async function loadSceneFile(filePath: string): Promise<BenchmarkSceneFile> {
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as BenchmarkSceneFile;
  assert(parsed.document?.units === "mm", `${filePath}: benchmark documents must use units=mm`);
  return parsed;
}

async function loadTelemetry(filePath?: string) {
  if (!filePath) {
    return [] as TelemetryEntry[];
  }

  const raw = await fs.readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as TelemetryEntry[] | { entries: TelemetryEntry[] };
  return Array.isArray(parsed) ? parsed : parsed.entries;
}

async function main() {
  const args = new Map(
    process.argv.slice(2).map((argument) => {
      const [key, value] = argument.split("=");
      return [key, value ?? "true"];
    })
  );
  const workspaceRoot = args.get("--root")
    ? path.resolve(args.get("--root")!)
    : path.resolve(process.cwd(), "..", "..");
  const sceneDir = path.resolve(workspaceRoot, "benchmark-scenes");
  const outputPath = args.get("--output")
    ? path.resolve(process.cwd(), args.get("--output")!)
    : path.resolve(sceneDir, "baseline.template.json");
  const telemetryEntries = await loadTelemetry(args.get("--telemetry"));
  const files = (await fs.readdir(sceneDir))
    .filter((file) => file.endsWith(".json") && !file.endsWith("baseline.template.json"))
    .sort();

  const reports = [];

  for (const file of files) {
    const scenario = await loadSceneFile(path.join(sceneDir, file));
    const telemetry = telemetryEntries.find((entry) => entry.scenario === scenario.id);

    reports.push({
      scenario: scenario.id,
      title: scenario.title,
      description: scenario.description,
      documentId: scenario.document.id,
      objects: scenario.document.objects.length,
      uniqueAssets: countUniqueAssetIds(scenario.document),
      surfacePlacements: countSurfacePlacements(scenario.document),
      runtimeAssetCount: scenario.runtimeAssets.length,
      declaredTriangleBudget: sumTriangleBudgets(scenario.runtimeAssets),
      budgetHints: scenario.budgetHints,
      telemetry: telemetry ?? createBaselineTelemetry(scenario)
    });
  }

  await fs.writeFile(
    outputPath,
    `${JSON.stringify({ generatedAt: new Date().toISOString(), entries: reports }, null, 2)}\n`,
    "utf8"
  );

  console.log(`[benchmark-runner] wrote ${reports.length} benchmark entries to ${outputPath}`);
}

main().catch((error) => {
  console.error("[benchmark-runner] failed");
  console.error(error);
  process.exitCode = 1;
});
