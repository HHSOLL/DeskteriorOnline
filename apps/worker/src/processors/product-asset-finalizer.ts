import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env";
import type { ProductAssetCategoryProfile } from "./product-asset-category-profiles";

type DimensionsMm = { width: number; depth: number; height: number } | null | undefined;

export type ProductAssetFinalizerReport = {
  status: "finalized" | "skipped" | "failed";
  warnings: string[];
  dimensions?: {
    inputMm?: DimensionsMm | null;
    outputMm?: DimensionsMm | null;
    maxErrorPercent?: number | null;
  };
  files?: {
    inputGlb?: string;
    outputGlb?: string;
    thumbnail?: string;
    qaReport?: string;
  };
};

export type ProductAssetFinalizerResult = {
  buffer: ArrayBuffer;
  thumbnailBuffer: Buffer | null;
  thumbnailPath: string | null;
  report: ProductAssetFinalizerReport;
};

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  const copy = new Uint8Array(buffer.byteLength);
  copy.set(buffer);
  return copy.buffer;
}

function runBlender(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(env.BLENDER_BIN!, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr.trim() || `Blender exited with code ${code}.`));
    });
  });
}

function resolveFinalizerScript() {
  return path.resolve(process.cwd(), "scripts/blender/finalize-product-asset.py");
}

export async function finalizeProductAssetCandidate(input: {
  jobId: string;
  candidateIndex: number;
  fileName: string;
  buffer: ArrayBuffer;
  dimensionsMm: DimensionsMm;
  referencePack: unknown;
  categoryProfile: ProductAssetCategoryProfile;
}) {
  const candidateDir = path.join(env.ASSET_GENERATION_WORKDIR, input.jobId, `candidate-${input.candidateIndex}`);
  await mkdir(candidateDir, { recursive: true });

  const inputPath = path.join(candidateDir, "input.glb");
  const outputPath = path.join(candidateDir, "final.glb");
  const thumbnailPath = path.join(candidateDir, "thumbnail.webp");
  const qaReportPath = path.join(candidateDir, "qa-report.json");
  const referencePackPath = path.join(candidateDir, "reference-pack.json");
  const categoryProfilePath = path.join(candidateDir, "category-profile.json");

  await Promise.all([
    writeFile(inputPath, Buffer.from(input.buffer)),
    writeFile(referencePackPath, JSON.stringify(input.referencePack, null, 2)),
    writeFile(categoryProfilePath, JSON.stringify(input.categoryProfile, null, 2))
  ]);

  const scriptPath = resolveFinalizerScript();
  if (!env.BLENDER_BIN || !existsSync(scriptPath)) {
    return {
      buffer: input.buffer,
      thumbnailBuffer: null,
      thumbnailPath: null,
      report: {
        status: "skipped",
        warnings: [!env.BLENDER_BIN ? "BLENDER_BIN_NOT_CONFIGURED" : "BLENDER_FINALIZER_SCRIPT_MISSING"],
        dimensions: {
          inputMm: input.dimensionsMm ?? null,
          outputMm: null,
          maxErrorPercent: null
        },
        files: {
          inputGlb: inputPath
        }
      }
    } satisfies ProductAssetFinalizerResult;
  }

  try {
    await runBlender([
      "-b",
      "--python",
      scriptPath,
      "--",
      "--input",
      inputPath,
      "--reference-pack",
      referencePackPath,
      "--category-profile",
      categoryProfilePath,
      "--output",
      outputPath,
      "--thumbnail",
      thumbnailPath,
      "--qa-report",
      qaReportPath,
      "--file-name",
      input.fileName
    ]);

    const outputBuffer = await readFile(outputPath);
    const reportBuffer = await readFile(qaReportPath).catch(() => null);
    const thumbnailBuffer = await readFile(thumbnailPath).catch(() => null);
    const report = reportBuffer
      ? (JSON.parse(reportBuffer.toString("utf8")) as ProductAssetFinalizerReport)
      : ({
          status: "finalized",
          warnings: ["QA_REPORT_MISSING"],
          dimensions: { inputMm: input.dimensionsMm ?? null, outputMm: null, maxErrorPercent: null }
        } satisfies ProductAssetFinalizerReport);

    return {
      buffer: toArrayBuffer(outputBuffer),
      thumbnailBuffer,
      thumbnailPath: thumbnailBuffer ? thumbnailPath : null,
      report: {
        ...report,
        files: {
          inputGlb: inputPath,
          outputGlb: outputPath,
          thumbnail: thumbnailBuffer ? thumbnailPath : undefined,
          qaReport: qaReportPath
        }
      }
    } satisfies ProductAssetFinalizerResult;
  } catch (error) {
    return {
      buffer: input.buffer,
      thumbnailBuffer: null,
      thumbnailPath: null,
      report: {
        status: "failed",
        warnings: [`BLENDER_FINALIZER_FAILED: ${error instanceof Error ? error.message : String(error)}`],
        dimensions: {
          inputMm: input.dimensionsMm ?? null,
          outputMm: null,
          maxErrorPercent: null
        },
        files: {
          inputGlb: inputPath,
          qaReport: qaReportPath
        }
      }
    } satisfies ProductAssetFinalizerResult;
  }
}
