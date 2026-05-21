import { z } from "zod";

export const ProductAssetProviderModeSchema = z.enum(["auto", "meshy", "triposr", "tripo", "both"]).default("auto");

export const ProductAssetGenerationRequestSchema = z.object({
  productUrl: z.string().url(),
  fileName: z.string().min(1).optional(),
  categoryHint: z.string().min(1).optional(),
  providerMode: ProductAssetProviderModeSchema,
  maxCandidates: z.coerce.number().int().min(1).max(8).default(4),
  autoApproveThreshold: z.coerce.number().min(0).max(1).default(0.82),
  visibility: z.literal("private").default("private")
});

export const ProductAssetGenerationEnqueueResponseSchema = z.object({
  jobId: z.string().uuid(),
  status: z.literal("queued")
});

export const GeneratedAssetSidecarSchema = z.object({
  suffix: z.string().min(1),
  path: z.string().min(1),
  contentType: z.string().min(1),
  url: z.string().url().nullable()
});

export const GeneratedAssetSidecarsSchema = z
  .object({
    all: z.array(GeneratedAssetSidecarSchema),
    modelSource: GeneratedAssetSidecarSchema.optional(),
    step: GeneratedAssetSidecarSchema.optional(),
    runtimePackage: GeneratedAssetSidecarSchema.optional(),
    colliders: GeneratedAssetSidecarSchema.optional(),
    supportSurfaces: GeneratedAssetSidecarSchema.optional(),
    attachmentPoints: GeneratedAssetSidecarSchema.optional(),
    interactionAnchors: GeneratedAssetSidecarSchema.optional(),
    materialVariants: GeneratedAssetSidecarSchema.optional(),
    qaReport: GeneratedAssetSidecarSchema.optional()
  })
  .passthrough();

export const UserAssetCatalogItemSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1),
  category: z.string().min(1),
  assetId: z.string().url(),
  thumbnail: z.string().url().nullable(),
  dimensionsMm: z
    .object({
      width: z.number(),
      depth: z.number(),
      height: z.number()
    })
    .nullable(),
  scaleLocked: z.boolean(),
  source: z.literal("generated"),
  qualityScore: z.number().min(0).max(1).nullable(),
  externalUrl: z.string().url().nullable(),
  brand: z.string().nullable(),
  description: z.string().nullable(),
  generationStrategy: z.string().min(1).nullable().optional(),
  runtimePackage: z.record(z.string(), z.unknown()).nullable().optional(),
  runtimeAsset: z.record(z.string(), z.unknown()).nullable().optional(),
  sidecars: GeneratedAssetSidecarsSchema.nullable().optional(),
  supportProfile: z.record(z.string(), z.unknown()).nullable().optional(),
  interactionAnchors: z.array(z.unknown()).optional(),
  attachmentPoints: z.array(z.unknown()).optional()
});

export const UserAssetsListResponseSchema = z.object({
  items: z.array(UserAssetCatalogItemSchema)
});

export type ProductAssetProviderMode = z.infer<typeof ProductAssetProviderModeSchema>;
export type ProductAssetGenerationRequest = z.infer<typeof ProductAssetGenerationRequestSchema>;
export type ProductAssetGenerationEnqueueResponse = z.infer<typeof ProductAssetGenerationEnqueueResponseSchema>;
export type GeneratedAssetSidecar = z.infer<typeof GeneratedAssetSidecarSchema>;
export type GeneratedAssetSidecars = z.infer<typeof GeneratedAssetSidecarsSchema>;
export type UserAssetCatalogItem = z.infer<typeof UserAssetCatalogItemSchema>;
export type UserAssetsListResponse = z.infer<typeof UserAssetsListResponseSchema>;
