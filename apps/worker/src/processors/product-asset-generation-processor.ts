import path from "node:path";
import { analyzeProductUrlReference, type ProductUrlReferenceImage } from "@deskterioronline/asset-compiler";
import { ProductAssetGenerationRequestSchema } from "@deskterioronline/contracts/product-assets";
import { z } from "zod";
import { env } from "../config/env";
import { createGeneratedAsset } from "../repositories/assets-repo";
import {
  markJobDeadLetter,
  markJobFailed,
  markJobRetrying,
  markJobSucceeded,
  updateJobProgress,
  type JobRow
} from "../repositories/jobs-repo";
import {
  getConfiguredAssetProviders,
  isAssetProviderBudgetError,
  resolveAssetProviderModelUrl,
  type AssetProviderConfig,
  type AssetProviderKey
} from "./asset-generation-processor";
import {
  resolveProductAssetCategoryProfile,
  type ProductAssetCategoryProfile
} from "./product-asset-category-profiles";
import { generateCadParametricProductAsset, type ProductAssetCadPackage } from "./product-asset-cad-generator";
import { evaluateProductAssetCandidate, type ProductAssetEvaluation } from "./product-asset-evaluator";
import { finalizeProductAssetCandidate, type ProductAssetFinalizerReport } from "./product-asset-finalizer";
import {
  resolveProductAssetGenerationStrategy,
  strategyUsesProvider,
  type ProductAssetGenerationStrategyDecision
} from "./product-asset-generation-strategy";

const ProductAssetJobPayloadSchema = ProductAssetGenerationRequestSchema.extend({
  ownerId: z.string().uuid(),
  fileName: z.string().min(1).nullable().optional(),
  categoryHint: z.string().min(1).nullable().optional()
});

type ProductAssetJobPayload = z.infer<typeof ProductAssetJobPayloadSchema>;

type CandidateResult = {
  provider: AssetProviderKey;
  imageUrl: string;
  imageScore: number;
  providerPrompt: string;
  modelUrl: string;
  buffer: ArrayBuffer;
  preliminaryScore: number;
};

type DimensionsMm = { width: number; depth: number; height: number } | null | undefined;

const PRODUCT_GENERATION_VIEW_PRIORITY: Record<ProductUrlReferenceImage["view"], number> = {
  front: 0,
  right: 1,
  left: 1,
  back: 2,
  top: 3,
  scale: 4,
  material: 5,
  detail: 6,
  bottom: 7
};

const PRODUCT_GENERATION_SOURCE_PRIORITY: Record<ProductUrlReferenceImage["source"], number> = {
  json_ld: 0,
  open_graph: 1,
  html_image: 2,
  detail_image: 3
};

export function selectProviderReferenceImages(images: ProductUrlReferenceImage[], maxCandidates: number) {
  return [...images]
    .sort((left, right) => {
      const viewDelta = PRODUCT_GENERATION_VIEW_PRIORITY[left.view] - PRODUCT_GENERATION_VIEW_PRIORITY[right.view];
      if (viewDelta !== 0) return viewDelta;

      const sourceDelta =
        PRODUCT_GENERATION_SOURCE_PRIORITY[left.source] - PRODUCT_GENERATION_SOURCE_PRIORITY[right.source];
      if (sourceDelta !== 0) return sourceDelta;

      return right.score - left.score;
    })
    .slice(0, Math.max(1, maxCandidates));
}

type FinalizedCandidateResult = CandidateResult & {
  finalizedBuffer: ArrayBuffer;
  thumbnailBuffer: Buffer | null;
  thumbnailPath: string | null;
  finalizerReport: ProductAssetFinalizerReport;
  evaluation: ProductAssetEvaluation;
  qualityScore: number;
};

function normalizeProviderMode(mode: ProductAssetJobPayload["providerMode"]): AssetProviderKey | "both" | null {
  if (mode === "both") return "both";
  if (mode === "meshy") return "meshy";
  if (mode === "triposr" || mode === "tripo") return "triposr";
  return null;
}

function buildFileName(payload: ProductAssetJobPayload, title: string | null, sku: string | null) {
  return payload.fileName?.trim() || [sku, title].filter(Boolean).join(" ").slice(0, 80) || "product-generated-asset";
}

function sanitizeCadOutputName(fileName: string) {
  return fileName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "cad-product-asset";
}

function buildCandidateQueue(
  providers: AssetProviderConfig[],
  images: Array<{ url: string; score: number }>,
  maxCandidates: number
) {
  const queue: Array<{ provider: AssetProviderConfig; image: { url: string; score: number } }> = [];
  for (const image of images) {
    for (const provider of providers) {
      queue.push({ provider, image });
      if (queue.length >= maxCandidates) return queue;
    }
  }
  return queue;
}

function scoreCandidate(input: { imageScore: number; bufferBytes: number }) {
  const imageScore = Math.min(1, Math.max(0, input.imageScore / 240));
  const sizeScore = input.bufferBytes > 1024 * 20 ? 0.2 : 0;
  return Math.min(0.92, 0.48 + imageScore * 0.32 + sizeScore);
}

function buildProviderPrompt(input: {
  draft: Awaited<ReturnType<typeof analyzeProductUrlReference>>["draft"];
  categoryProfile: ProductAssetCategoryProfile;
  strategyDecision: ProductAssetGenerationStrategyDecision;
}) {
  const product = input.draft.product;
  const dimensions = product.dimensionsMm
    ? `${product.dimensionsMm.width}mm W x ${product.dimensionsMm.depth}mm D x ${product.dimensionsMm.height}mm H`
    : "official dimensions unavailable";
  return [
    "Create one runtime-ready GLB of the exact product shown in the reference image.",
    `Product title: ${product.title ?? "unknown"}.`,
    `SKU: ${product.sku ?? "unknown"}. Manufacturer: ${product.manufacturer ?? "unknown"}.`,
    `Official dimensions: ${dimensions}.`,
    `Category profile: ${input.categoryProfile.key}.`,
    `Generation strategy: ${input.strategyDecision.strategy}.`,
    `Required material zones: ${input.categoryProfile.materialTargets.join(", ")}.`,
    `Repair priorities: ${input.categoryProfile.repairDirectives.join(", ")}.`,
    "Keep the mesh scale-locked, floor-centered, and avoid adding unrelated scene props."
  ].join(" ");
}

function buildAssetMeta(input: {
  payload: ProductAssetJobPayload;
  selected: FinalizedCandidateResult;
  categoryProfile: ProductAssetCategoryProfile;
  strategyDecision: ProductAssetGenerationStrategyDecision;
  candidateCount: number;
  providerCandidates: string[];
  draft: Awaited<ReturnType<typeof analyzeProductUrlReference>>["draft"];
}) {
  const { draft, payload, selected } = input;
  const dimensionsMm = draft.product.dimensionsMm;
  const qaStatus = selected.qualityScore >= payload.autoApproveThreshold ? "auto_approved" : "needs_review";

  return {
    schemaVersion: 2,
    unit: "m",
    source: {
      kind: "product_url",
      url: draft.sourceUrl,
      title: draft.product.title,
      sku: draft.product.sku,
      manufacturer: draft.product.manufacturer
    },
    generation: {
      pipeline: "product_url_private_asset_v1",
      strategy: input.strategyDecision.strategy,
      strategyReason: input.strategyDecision.reason,
      providerCandidates: input.providerCandidates,
      selectedProvider: selected.provider,
      selectedReferenceImage: selected.imageUrl,
      selectedProviderPrompt: selected.providerPrompt,
      candidateCount: input.candidateCount,
      qualityScore: selected.qualityScore,
      evaluation: "render_and_runtime_candidate_evaluator_v1"
    },
    runtimeAsset: {
      units: "mm",
      dimensionsMm,
      scaleLocked: input.categoryProfile.scaleLocked,
      pivot: {
        x: "center",
        y: "floor",
        z: "center"
      },
      categoryProfile: input.categoryProfile.key,
      placement: input.categoryProfile.runtimeMetadata
    },
    qa: {
      status: qaStatus,
      visualFidelityScore: selected.qualityScore,
      dimensionSource: draft.extraction.dimensionSource,
      referenceImageCount: draft.referenceImages.length,
      candidateEvaluation: selected.evaluation,
      finalizerReport: selected.finalizerReport,
      strategyDecision: input.strategyDecision,
      warnings: [
        ...draft.extraction.warnings,
        ...(selected.evaluation?.warnings ?? []),
        ...(selected.finalizerReport?.warnings ?? [])
      ]
    },
    materialTargets: input.categoryProfile.materialTargets,
    repairDirectives: input.categoryProfile.repairDirectives,
    referencePack: draft.referencePack,
    legalUse: {
      mode: "private_reference_only",
      releaseEligible: false
    }
  };
}

function buildCadPrivateReadiness(cadPackage: ProductAssetCadPackage) {
  const structuralQa = cadPackage.structuralQa as { status?: string; multiViewRenderReview?: { passed?: boolean } };
  if (structuralQa.status === "failed") return 0.46;
  if (structuralQa.multiViewRenderReview?.passed) return 0.84;
  return 0.78;
}

function buildCadAssetMeta(input: {
  payload: ProductAssetJobPayload;
  cadPackage: ProductAssetCadPackage;
  categoryProfile: ProductAssetCategoryProfile;
  strategyDecision: ProductAssetGenerationStrategyDecision;
  draft: Awaited<ReturnType<typeof analyzeProductUrlReference>>["draft"];
}) {
  const { draft, cadPackage } = input;
  const runtimePackage = cadPackage.runtimePackage as { runtimeAsset?: Record<string, unknown> };
  const runtimeAsset = runtimePackage.runtimeAsset ?? {};
  const qualityScore = buildCadPrivateReadiness(cadPackage);
  const warnings = [
    ...draft.extraction.warnings,
    "TRUE_STEP_EXPORT_PENDING",
    "MULTI_VIEW_RENDER_REVIEW_PENDING",
    ...(input.strategyDecision.manualReviewRequired ? ["BLENDER_POLISH_REQUIRED"] : [])
  ];

  return {
    schemaVersion: 3,
    unit: "m",
    source: {
      kind: "product_url",
      url: draft.sourceUrl,
      title: draft.product.title,
      sku: draft.product.sku,
      manufacturer: draft.product.manufacturer
    },
    generation: {
      pipeline: "product_url_hybrid_asset_factory_v1",
      strategy: input.strategyDecision.strategy,
      strategyReason: input.strategyDecision.reason,
      cadFirst: input.strategyDecision.cadFirst,
      providerAllowed: input.strategyDecision.providerAllowed,
      selectedProvider: input.strategyDecision.strategy,
      providerCandidates: [],
      candidateCount: 1,
      qualityScore,
      evaluation: "cad_structural_runtime_package_qa_v1",
      expectedArtifacts: input.strategyDecision.expectedArtifacts,
      artifactPaths: input.cadPackage.localArtifacts
    },
    runtimeAsset: {
      units: "mm",
      dimensionsMm: runtimeAsset.dimensionsMm ?? draft.product.dimensionsMm,
      colliders: Array.isArray(runtimeAsset.colliders) ? runtimeAsset.colliders : [],
      supportSurfaces: Array.isArray(runtimeAsset.supportSurfaces) ? runtimeAsset.supportSurfaces : [],
      attachmentPoints: Array.isArray(runtimeAsset.attachmentPoints) ? runtimeAsset.attachmentPoints : [],
      interactionAnchors: Array.isArray(runtimeAsset.interactionAnchors) ? runtimeAsset.interactionAnchors : [],
      materialVariants: Array.isArray(runtimeAsset.materialVariants) ? runtimeAsset.materialVariants : [],
      scaleLocked: input.categoryProfile.scaleLocked,
      pivot: {
        x: "center",
        y: "floor",
        z: "center"
      },
      categoryProfile: input.categoryProfile.key,
      generationStrategy: input.strategyDecision.strategy,
      placement: input.categoryProfile.runtimeMetadata,
      sidecars: {
        runtimePackage: "runtime-package.json",
        colliders: "colliders.json",
        supportSurfaces: "support-surfaces.json",
        attachmentPoints: "attachment-points.json",
        interactionAnchors: "interaction-anchors.json",
        materialVariants: "material-variants.json",
        qaReport: "qa-report.json"
      }
    },
    qa: {
      status: "needs_review",
      visualFidelityScore: qualityScore,
      structuralQa: cadPackage.structuralQa,
      strategyDecision: input.strategyDecision,
      dimensionSource: draft.extraction.dimensionSource,
      referenceImageCount: draft.referenceImages.length,
      runtimePackage: cadPackage.runtimePackage,
      warnings
    },
    materialTargets: input.categoryProfile.materialTargets,
    repairDirectives: input.categoryProfile.repairDirectives,
    referencePack: draft.referencePack,
    legalUse: {
      mode: "private_reference_only",
      releaseEligible: false
    }
  };
}

function buildManualAssetBrief(input: {
  payload: ProductAssetJobPayload;
  categoryProfile: ProductAssetCategoryProfile;
  strategyDecision: ProductAssetGenerationStrategyDecision;
  draft: Awaited<ReturnType<typeof analyzeProductUrlReference>>["draft"];
}) {
  return {
    schemaVersion: "product-url-manual-asset-brief-v1",
    status: "manual_blender_required",
    productUrl: input.payload.productUrl,
    product: input.draft.product,
    categoryProfile: input.categoryProfile,
    generationStrategy: input.strategyDecision,
    referencePack: input.draft.referencePack,
    requiredArtifacts: [
      "licensed or manufacturer CAD/STEP when available",
      "Blender source file with material zones",
      "runtime GLB and thumbnail",
      "collider/support/attachment/interaction sidecars where applicable",
      "multi-view render review",
      "commercial license review before any public catalog exposure"
    ],
    qaGates: [
      "dimensions within 5mm or 1%",
      "support/collider/attachment metadata aligned to runtime bounds",
      "material slot coverage for visible product zones",
      "manual product-silhouette review against licensed references",
      "releaseEligible remains false until rights and commercial QA are cleared"
    ],
    legalUse: {
      mode: "private_reference_only",
      releaseEligible: false
    }
  };
}

async function generateCandidate(provider: AssetProviderConfig, image: { url: string; score: number }, prompt: string) {
  const modelUrl = await resolveAssetProviderModelUrl(provider, image.url, prompt);
  const modelResponse = await fetch(modelUrl, { cache: "no-store" });
  if (!modelResponse.ok) {
    throw new Error(`Failed to download product asset candidate (${modelResponse.status}).`);
  }
  const buffer = await modelResponse.arrayBuffer();
  if (buffer.byteLength < 1024) {
    throw new Error("Generated product asset candidate is unexpectedly small.");
  }
  return {
    provider: provider.key,
    imageUrl: image.url,
    imageScore: image.score,
    providerPrompt: prompt,
    modelUrl,
    buffer,
    preliminaryScore: scoreCandidate({ imageScore: image.score, bufferBytes: buffer.byteLength })
  } satisfies CandidateResult;
}

async function finalizeAndEvaluateCandidate(input: {
  jobId: string;
  index: number;
  fileName: string;
  candidate: CandidateResult;
  categoryProfile: ProductAssetCategoryProfile;
  referencePack: unknown;
  dimensionsMm: DimensionsMm;
}) {
  const finalized = await finalizeProductAssetCandidate({
    jobId: input.jobId,
    candidateIndex: input.index,
    fileName: input.fileName,
    buffer: input.candidate.buffer,
    dimensionsMm: input.dimensionsMm,
    referencePack: input.referencePack,
    categoryProfile: input.categoryProfile
  });
  const evaluation = await evaluateProductAssetCandidate({
    imageScore: input.candidate.imageScore,
    outputBytes: finalized.buffer.byteLength,
    referenceImageUrl: input.candidate.imageUrl,
    finalizerReport: finalized.report,
    thumbnailPath: finalized.thumbnailPath
  });

  return {
    ...input.candidate,
    finalizedBuffer: finalized.buffer,
    thumbnailBuffer: finalized.thumbnailBuffer,
    thumbnailPath: finalized.thumbnailPath,
    finalizerReport: finalized.report,
    evaluation,
    qualityScore: evaluation.qualityScore
  } satisfies FinalizedCandidateResult;
}

export async function processProductAssetGenerationJob(job: JobRow) {
  const parsed = ProductAssetJobPayloadSchema.safeParse(job.payload);
  if (!parsed.success) {
    await markJobDeadLetter(job.id, "Invalid product asset generation payload.", "INVALID_PRODUCT_ASSET_JOB_PAYLOAD");
    return;
  }

  const payload = parsed.data;

  try {
    await updateJobProgress(job.id, 8, "Analyzing product URL reference pack.");
    const reference = await analyzeProductUrlReference({
      url: payload.productUrl,
      assetKey: null,
      outputPath: path.join(env.ASSET_GENERATION_WORKDIR, job.id, "reference-pack.json"),
      downloadImages: false,
      ocrImages: false
    });

    const categoryProfile = resolveProductAssetCategoryProfile({
      title: reference.draft.product.title,
      sku: reference.draft.product.sku,
      manufacturer: reference.draft.product.manufacturer,
      categoryHint: payload.categoryHint
    });
    const fileName = buildFileName(payload, reference.draft.product.title, reference.draft.product.sku);
    const strategyDecision = resolveProductAssetGenerationStrategy({
      categoryProfile,
      title: reference.draft.product.title,
      sku: reference.draft.product.sku,
      manufacturer: reference.draft.product.manufacturer,
      categoryHint: payload.categoryHint
    });
    const selectedImages = selectProviderReferenceImages(reference.draft.referenceImages, payload.maxCandidates);

    if (!strategyUsesProvider(strategyDecision)) {
      if (strategyDecision.strategy === "manual_blender_required") {
        const brief = buildManualAssetBrief({ payload, categoryProfile, strategyDecision, draft: reference.draft });
        await markJobSucceeded(job.id, {
          schemaVersion: "product-asset-generation-result-v2",
          status: "manual_blender_required",
          asset: null,
          referencePack: reference.draft.referencePack,
          selectedImages,
          generation: {
            strategy: strategyDecision.strategy,
            strategyReason: strategyDecision.reason,
            providerSkipped: true,
            manualAssetBrief: brief
          },
          legalUse: {
            mode: "private_reference_only",
            releaseEligible: false
          }
        });
        return;
      }

      await updateJobProgress(job.id, 36, `Generating ${strategyDecision.strategy} CAD-first private runtime package.`);
      const cadPackage = await generateCadParametricProductAsset({
        outputDir: path.join(env.ASSET_GENERATION_WORKDIR, job.id, "cad-generated", sanitizeCadOutputName(fileName)),
        fileName,
        draft: reference.draft,
        categoryProfile,
        decision: strategyDecision
      });

      await updateJobProgress(job.id, 82, "Registering private CAD-generated asset.");
      const asset = await createGeneratedAsset({
        ownerId: payload.ownerId,
        fileName,
        provider: cadPackage.strategy,
        buffer: cadPackage.glbBuffer,
        thumbnailBuffer: cadPackage.thumbnailBuffer,
        sidecars: cadPackage.sidecars,
        description: `Private CAD-first product URL asset generated from ${reference.draft.product.title ?? payload.productUrl}`,
        category: categoryProfile.catalogCategory,
        tags: ["generated", "product-url", cadPackage.strategy, categoryProfile.key, categoryProfile.catalogCategory].filter(Boolean),
        meta: buildCadAssetMeta({
          payload,
          cadPackage,
          categoryProfile,
          strategyDecision,
          draft: reference.draft
        })
      });

      await markJobSucceeded(job.id, {
        schemaVersion: "product-asset-generation-result-v2",
        status: "needs_review",
        asset,
        referencePack: reference.draft.referencePack,
        selectedImages,
        generation: {
          strategy: strategyDecision.strategy,
          strategyReason: strategyDecision.reason,
          providerSkipped: true,
          cadArtifacts: cadPackage.localArtifacts,
          sidecars: asset.sidecars,
          structuralQa: cadPackage.structuralQa,
          qualityScore: buildCadPrivateReadiness(cadPackage)
        },
        legalUse: {
          mode: "private_reference_only",
          releaseEligible: false
        }
      });
      return;
    }

    if (selectedImages.length === 0) {
      await markJobFailed(job.id, {
        errorCode: "PRODUCT_REFERENCE_IMAGES_MISSING",
        error: "No high-confidence product images were found on the product page.",
        recoverable: false,
        details: "The URL analysis completed, but provider generation needs at least one reference image."
      });
      return;
    }

    const providerMode = normalizeProviderMode(payload.providerMode);
    const providers = getConfiguredAssetProviders(providerMode);
    if (providers.length === 0) {
      await markJobFailed(job.id, {
        errorCode: "PROVIDER_NOT_CONFIGURED",
        error: "No product asset generation provider configured.",
        recoverable: false,
        details: "Configure TRIPOSR or Meshy environment variables on the worker before running URL-to-asset generation."
      });
      return;
    }

    const maxCandidates = Math.min(payload.maxCandidates, env.PRODUCT_ASSET_MAX_CANDIDATES);
    const queue = buildCandidateQueue(providers, selectedImages, maxCandidates);
    const candidates: CandidateResult[] = [];
    const finalizedCandidates: FinalizedCandidateResult[] = [];
    const providerErrors: string[] = [];
    const providerBudgetErrors: string[] = [];

    for (const [index, candidate] of queue.entries()) {
      await updateJobProgress(
        job.id,
        18 + Math.round((index / Math.max(queue.length, 1)) * 56),
        `Generating product asset candidate ${index + 1}/${queue.length}.`
      );
      try {
        candidates.push(
          await generateCandidate(
            candidate.provider,
            candidate.image,
            buildProviderPrompt({ draft: reference.draft, categoryProfile, strategyDecision })
          )
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        providerErrors.push(`${candidate.provider.key}: ${message}`);
        if (isAssetProviderBudgetError(error)) {
          providerBudgetErrors.push(`${candidate.provider.key}: ${message}`);
        }
      }
    }

    const preliminary = candidates.sort((a, b) => b.preliminaryScore - a.preliminaryScore);
    if (preliminary.length === 0) {
      if (providerBudgetErrors.length > 0 && providerBudgetErrors.length === providerErrors.length) {
        await markJobFailed(job.id, {
          errorCode: "MESHY_BUDGET_BLOCKED",
          error: providerBudgetErrors.join("; "),
          recoverable: false,
          details:
            "Meshy product asset generation was blocked before provider requests because the configured token/credit budget was missing or insufficient."
        });
        return;
      }
      throw new Error(providerErrors.join("; ") || "No provider candidates completed.");
    }

    for (const [index, candidate] of preliminary.entries()) {
      await updateJobProgress(
        job.id,
        74 + Math.round((index / Math.max(preliminary.length, 1)) * 16),
        `Finalizing and evaluating product asset candidate ${index + 1}/${preliminary.length}.`
      );
      finalizedCandidates.push(
        await finalizeAndEvaluateCandidate({
          jobId: job.id,
          index,
          fileName,
          candidate,
          categoryProfile,
          referencePack: reference.draft.referencePack,
          dimensionsMm: reference.draft.product.dimensionsMm
        })
      );
    }

    const selected = finalizedCandidates.sort((a, b) => b.qualityScore - a.qualityScore)[0];

    await updateJobProgress(job.id, 82, "Registering private generated asset.");
    const asset = await createGeneratedAsset({
      ownerId: payload.ownerId,
      fileName,
      provider: selected.provider,
      buffer: selected.finalizedBuffer,
      thumbnailBuffer: selected.thumbnailBuffer,
      description: `Private product URL asset generated from ${reference.draft.product.title ?? payload.productUrl}`,
      category: categoryProfile.catalogCategory,
      tags: ["generated", "product-url", selected.provider, categoryProfile.key, categoryProfile.catalogCategory].filter(Boolean),
      meta: buildAssetMeta({
        payload,
        selected,
        categoryProfile,
        strategyDecision,
        candidateCount: finalizedCandidates.length,
        providerCandidates: providers.map((provider) => provider.key),
        draft: reference.draft
      })
    });

    await markJobSucceeded(job.id, {
      schemaVersion: "product-asset-generation-result-v1",
      status: selected.qualityScore >= payload.autoApproveThreshold ? "auto_approved" : "needs_review",
      asset,
      referencePack: reference.draft.referencePack,
      selectedImages,
      generation: {
        selectedProvider: selected.provider,
        candidateCount: finalizedCandidates.length,
        qualityScore: selected.qualityScore,
        evaluation: selected.evaluation,
        finalizerReport: selected.finalizerReport,
        providerErrors
      },
      legalUse: {
        mode: "private_reference_only",
        releaseEligible: false
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (job.attempts >= job.max_attempts) {
      await markJobDeadLetter(job.id, message, "PRODUCT_ASSET_GENERATION_FAILED");
      return;
    }

    await markJobRetrying(job.id, job.attempts);
  }
}
