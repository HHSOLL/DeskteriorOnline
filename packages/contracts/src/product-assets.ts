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
  description: z.string().nullable()
});

export const UserAssetsListResponseSchema = z.object({
  items: z.array(UserAssetCatalogItemSchema)
});

export type ProductAssetProviderMode = z.infer<typeof ProductAssetProviderModeSchema>;
export type ProductAssetGenerationRequest = z.infer<typeof ProductAssetGenerationRequestSchema>;
export type ProductAssetGenerationEnqueueResponse = z.infer<typeof ProductAssetGenerationEnqueueResponseSchema>;
export type UserAssetCatalogItem = z.infer<typeof UserAssetCatalogItemSchema>;
export type UserAssetsListResponse = z.infer<typeof UserAssetsListResponseSchema>;
