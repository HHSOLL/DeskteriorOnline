import { readFile } from "node:fs/promises";
import sharp from "sharp";

type FinalizerQaReport = {
  status?: string;
  warnings?: string[];
  dimensions?: {
    inputMm?: { width?: number; depth?: number; height?: number } | null;
    outputMm?: { width?: number; depth?: number; height?: number } | null;
    maxErrorPercent?: number | null;
  };
};

export type ProductAssetEvaluation = {
  qualityScore: number;
  components: {
    referenceImage: number;
    modelSize: number;
    finalizer: number;
    dimensionFit: number;
    thumbnailSimilarity: number | null;
  };
  warnings: string[];
};

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function scoreModelSize(bufferBytes: number) {
  if (bufferBytes < 20 * 1024) return 0.05;
  if (bufferBytes < 80 * 1024) return 0.35;
  if (bufferBytes < 20 * 1024 * 1024) return 0.75;
  if (bufferBytes < 80 * 1024 * 1024) return 0.55;
  return 0.25;
}

function scoreDimensionFit(report: FinalizerQaReport | null) {
  const maxError = report?.dimensions?.maxErrorPercent;
  if (typeof maxError !== "number" || !Number.isFinite(maxError)) return 0.45;
  if (maxError <= 1) return 0.95;
  if (maxError <= 3) return 0.82;
  if (maxError <= 8) return 0.6;
  return 0.25;
}

function scoreFinalizer(report: FinalizerQaReport | null) {
  if (!report) return 0.45;
  if (report.status === "finalized") return 0.9;
  if (report.status === "skipped") return 0.5;
  return 0.35;
}

async function averageRgb(buffer: Buffer) {
  const { data, info } = await sharp(buffer)
    .resize(48, 48, { fit: "inside" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const channels = info.channels;
  const totals = [0, 0, 0];
  const pixels = Math.max(1, data.length / channels);
  for (let index = 0; index < data.length; index += channels) {
    totals[0] += data[index] ?? 0;
    totals[1] += data[index + 1] ?? 0;
    totals[2] += data[index + 2] ?? 0;
  }
  return totals.map((value) => value / pixels);
}

async function scoreThumbnailSimilarity(input: { thumbnailPath?: string | null; referenceImageUrl: string }) {
  if (!input.thumbnailPath) return null;
  try {
    const [thumbnailBuffer, referenceResponse] = await Promise.all([
      readFile(input.thumbnailPath),
      fetch(input.referenceImageUrl, { cache: "no-store" })
    ]);
    if (!referenceResponse.ok) return null;
    const referenceBuffer = Buffer.from(await referenceResponse.arrayBuffer());
    const [thumbnailRgb, referenceRgb] = await Promise.all([averageRgb(thumbnailBuffer), averageRgb(referenceBuffer)]);
    const distance = Math.sqrt(
      thumbnailRgb.reduce((sum, channel, index) => sum + Math.pow(channel - (referenceRgb[index] ?? 0), 2), 0)
    );
    return clamp01(1 - distance / 441.7);
  } catch {
    return null;
  }
}

export async function evaluateProductAssetCandidate(input: {
  imageScore: number;
  outputBytes: number;
  referenceImageUrl: string;
  finalizerReport: FinalizerQaReport | null;
  thumbnailPath?: string | null;
}) {
  const referenceImage = clamp01(input.imageScore / 240);
  const modelSize = scoreModelSize(input.outputBytes);
  const finalizer = scoreFinalizer(input.finalizerReport);
  const dimensionFit = scoreDimensionFit(input.finalizerReport);
  const thumbnailSimilarity = await scoreThumbnailSimilarity({
    thumbnailPath: input.thumbnailPath,
    referenceImageUrl: input.referenceImageUrl
  });

  const score =
    referenceImage * 0.22 +
    modelSize * 0.18 +
    finalizer * 0.2 +
    dimensionFit * 0.25 +
    (thumbnailSimilarity ?? 0.5) * 0.15;

  const warnings = [...(input.finalizerReport?.warnings ?? [])];
  if (thumbnailSimilarity === null) warnings.push("thumbnail_similarity_unavailable");
  if (dimensionFit < 0.6) warnings.push("dimension_fit_below_target");

  return {
    qualityScore: Number(clamp01(score).toFixed(3)),
    components: {
      referenceImage: Number(referenceImage.toFixed(3)),
      modelSize: Number(modelSize.toFixed(3)),
      finalizer: Number(finalizer.toFixed(3)),
      dimensionFit: Number(dimensionFit.toFixed(3)),
      thumbnailSimilarity: thumbnailSimilarity === null ? null : Number(thumbnailSimilarity.toFixed(3))
    },
    warnings
  } satisfies ProductAssetEvaluation;
}
