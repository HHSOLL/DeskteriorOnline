import { createProductAssetGenerationJob } from "../repositories/jobs-repo";

export async function createProductAssetGenerationJobForOwner(
  ownerId: string,
  payload: {
    productUrl: string;
    fileName?: string;
    categoryHint?: string;
    providerMode?: "auto" | "meshy" | "triposr" | "tripo" | "both";
    maxCandidates?: number;
    autoApproveThreshold?: number;
  }
) {
  return createProductAssetGenerationJob({
    ownerId,
    productUrl: payload.productUrl,
    fileName: payload.fileName,
    categoryHint: payload.categoryHint,
    providerMode: payload.providerMode,
    maxCandidates: payload.maxCandidates,
    autoApproveThreshold: payload.autoApproveThreshold
  });
}
