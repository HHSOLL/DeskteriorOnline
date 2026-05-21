import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MESHY_COMMUNITY_ASSETS } from "../src/lib/qa/meshy-community-assets";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.resolve(SCRIPT_DIR, "..");
const REPO_ROOT = path.resolve(WEB_ROOT, "..", "..");
const REPORT_PATH = path.join(
  REPO_ROOT,
  "assets/references/meshy-community/normalization-report-2026-05-19.json"
);
const OPTIMIZATION_REPORT_PATH = path.join(
  REPO_ROOT,
  "assets/references/meshy-community/optimization-report-2026-05-19.json"
);
const OUTPUT_ROOT = path.join(REPO_ROOT, "assets/runtime-candidates/meshy-community");

type RuntimeCandidateSidecar = {
  schemaVersion: "deskterior-runtime-candidate-v1";
  assetPack: string;
  slug: string;
  source: {
    kind: "meshy_community_public_cc0";
    sourceGlb: string;
    pageUrl: string;
    publicTaskApi: string;
    license: "CC0-1.0";
  };
  files: {
    normalizedGlb: string;
    thumbnail: string;
    sidecar: string;
  };
  dimensionsMm: {
    width: number;
    depth: number;
    height: number;
  };
  scaleLocked: boolean;
  contractMetadata: {
    pivot: { x: "center"; y: "floor"; z: "center" };
    collisionProxy: { kind: "box"; derivesFrom: "dimensionsMm" };
    textureSet: { workflow: string; authored: "image_based"; ktx2Ready: boolean };
    lodProfile: { strategy: "single_mesh"; levelCount: number; maxDrawCalls: number; maxTriangleCount: number };
  };
  qa: {
    status: "candidate_requires_human_visual_review";
    warnings: string[];
    normalizedExportBytesBeforeMeshopt: number;
    thumbnailBytes: number;
  };
};

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function assertFile(filePath: string, label: string) {
  assert.ok(fs.existsSync(filePath), `${label} missing: ${filePath}`);
  const stat = fs.statSync(filePath);
  assert.ok(stat.size > 1024, `${label} is unexpectedly small: ${filePath}`);
  return stat.size;
}

function readGlbJson(filePath: string) {
  const buffer = fs.readFileSync(filePath);
  assert.equal(buffer.toString("utf8", 0, 4), "glTF", `${filePath} is not a GLB`);
  assert.equal(buffer.readUInt32LE(4), 2, `${filePath} must be GLB v2`);
  const jsonChunkLength = buffer.readUInt32LE(12);
  assert.equal(buffer.toString("utf8", 16, 20), "JSON", `${filePath} first chunk must be JSON`);
  const jsonText = buffer
    .toString("utf8", 20, 20 + jsonChunkLength)
    .replace(/\0+$/g, "")
    .trim();
  return JSON.parse(jsonText) as {
    asset?: { version?: string };
    extensionsUsed?: string[];
    nodes?: Array<{ name?: string }>;
    materials?: Array<{ name?: string }>;
  };
}

const normalizationReport = readJson<{
  schemaVersion: string;
  candidateCount: number;
  errorCount: number;
  candidates: RuntimeCandidateSidecar[];
}>(REPORT_PATH);

assert.equal(
  normalizationReport.schemaVersion,
  "deskterior-meshy-community-normalization-report-v1",
  "normalization report schema mismatch"
);
assert.equal(normalizationReport.candidateCount, MESHY_COMMUNITY_ASSETS.length, "candidate count mismatch");
assert.equal(normalizationReport.errorCount, 0, "normalization report contains errors");

const optimizationResults = [];

for (const asset of MESHY_COMMUNITY_ASSETS) {
  const sidecarPath = path.join(OUTPUT_ROOT, asset.slug, `${asset.slug}.runtime-candidate.json`);
  const sidecar = readJson<RuntimeCandidateSidecar>(sidecarPath);
  assert.equal(sidecar.schemaVersion, "deskterior-runtime-candidate-v1", `${asset.slug} sidecar schema mismatch`);
  assert.equal(sidecar.slug, asset.slug, `${asset.slug} sidecar slug mismatch`);
  assert.equal(sidecar.source.kind, "meshy_community_public_cc0", `${asset.slug} source kind mismatch`);
  assert.equal(sidecar.source.pageUrl, asset.pageUrl, `${asset.slug} source pageUrl mismatch`);
  assert.equal(sidecar.source.publicTaskApi, asset.publicTaskApi, `${asset.slug} publicTaskApi mismatch`);
  assert.equal(sidecar.source.license, "CC0-1.0", `${asset.slug} license mismatch`);
  assert.deepEqual(sidecar.contractMetadata.pivot, { x: "center", y: "floor", z: "center" }, `${asset.slug} pivot mismatch`);
  assert.deepEqual(
    sidecar.contractMetadata.collisionProxy,
    { kind: "box", derivesFrom: "dimensionsMm" },
    `${asset.slug} collision proxy mismatch`
  );
  assert.equal(sidecar.contractMetadata.textureSet.authored, "image_based", `${asset.slug} texture authoring mismatch`);
  assert.equal(sidecar.contractMetadata.textureSet.ktx2Ready, false, `${asset.slug} should not claim KTX2 readiness`);
  assert.equal(sidecar.contractMetadata.lodProfile.strategy, "single_mesh", `${asset.slug} LOD strategy mismatch`);
  assert.ok(sidecar.scaleLocked, `${asset.slug} must be scale locked until visual QA`);
  assert.ok(sidecar.dimensionsMm.width > 0, `${asset.slug} width must be positive`);
  assert.ok(sidecar.dimensionsMm.depth > 0, `${asset.slug} depth must be positive`);
  assert.ok(sidecar.dimensionsMm.height > 0, `${asset.slug} height must be positive`);

  const glbPath = path.join(REPO_ROOT, sidecar.files.normalizedGlb);
  const thumbnailPath = path.join(REPO_ROOT, sidecar.files.thumbnail);
  const actualGlbBytes = assertFile(glbPath, `${asset.slug} normalized GLB`);
  const actualThumbnailBytes = assertFile(thumbnailPath, `${asset.slug} thumbnail`);
  assert.ok(sidecar.qa.normalizedExportBytesBeforeMeshopt >= actualGlbBytes, `${asset.slug} Meshopt size invariant failed`);
  assert.equal(sidecar.qa.thumbnailBytes, actualThumbnailBytes, `${asset.slug} thumbnail size mismatch`);

  const gltf = readGlbJson(glbPath);
  assert.equal(gltf.asset?.version, "2.0", `${asset.slug} glTF version mismatch`);
  assert.ok(
    gltf.extensionsUsed?.includes("EXT_meshopt_compression"),
    `${asset.slug} must include EXT_meshopt_compression after runtime optimization`
  );
  const namePrefix = `meshy_cc0_${asset.slug.replace(/-/g, "_")}`;
  assert.ok(
    gltf.nodes?.some((node) => node.name?.startsWith(`${namePrefix}_mesh_`)),
    `${asset.slug} normalized mesh names missing`
  );
  assert.ok(
    gltf.materials?.some((material) => material.name?.startsWith(`${namePrefix}_mat_`)),
    `${asset.slug} normalized material names missing`
  );

  optimizationResults.push({
    slug: asset.slug,
    sourceBytes: asset.byteLength,
    normalizedExportBytesBeforeMeshopt: sidecar.qa.normalizedExportBytesBeforeMeshopt,
    optimizedBytes: actualGlbBytes,
    thumbnailBytes: actualThumbnailBytes,
    meshoptExtension: true,
    warnings: sidecar.qa.warnings
  });
}

const optimizationReport = {
  schemaVersion: "deskterior-meshy-community-optimization-report-v1",
  generatedAt: "2026-05-19",
  sourceNormalizationReport: path.relative(REPO_ROOT, REPORT_PATH),
  candidateCount: optimizationResults.length,
  optimizer: "gltf-transform meshopt",
  compressionPolicy: "medium level, texture transcoding deferred until visual promotion gate",
  publicCatalogStatus: "not-published",
  results: optimizationResults
};

fs.writeFileSync(OPTIMIZATION_REPORT_PATH, `${JSON.stringify(optimizationReport, null, 2)}\n`);

console.log(
  JSON.stringify(
    {
      ok: true,
      candidateCount: optimizationResults.length,
      optimizationReport: path.relative(REPO_ROOT, OPTIMIZATION_REPORT_PATH),
      optimizedBytes: optimizationResults.map((result) => ({
        slug: result.slug,
        bytes: result.optimizedBytes,
        warnings: result.warnings
      }))
    },
    null,
    2
  )
);
