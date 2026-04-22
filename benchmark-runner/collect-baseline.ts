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
      telemetry: telemetry ?? {
        scenario: scenario.id,
        fpsAvg: null,
        frameTimeP95Ms: null,
        reactRenderCount: null,
        raycastLatencyP95Ms: null,
        assetLoadMs: null,
        firstUsableMs: null,
        drawCalls: null,
        triangles: null,
        gpuMemoryEstimateMb: null,
        inputLatencyP95Ms: null
      }
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
