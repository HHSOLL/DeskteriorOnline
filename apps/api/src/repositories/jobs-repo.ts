import { supabaseService } from "../services/supabase";

export async function createAssetGenerationJob(payload: {
  ownerId: string;
  image: string;
  fileName?: string;
  provider?: "triposr" | "meshy";
}) {
  const { data, error } = await supabaseService
    .from("jobs")
    .insert({
      type: "ASSET_GENERATION",
      payload: {
        ownerId: payload.ownerId,
        image: payload.image,
        fileName: payload.fileName ?? null,
        provider: payload.provider ?? null
      },
      status: "queued",
      attempts: 0,
      max_attempts: 3,
      progress: 0,
      run_at: new Date().toISOString(),
      result: null
    })
    .select("id, status")
    .single();

  if (error) throw error;
  return data;
}

export async function createProductAssetGenerationJob(payload: {
  ownerId: string;
  productUrl: string;
  fileName?: string;
  categoryHint?: string;
  providerMode?: "auto" | "meshy" | "triposr" | "tripo" | "both";
  maxCandidates?: number;
  autoApproveThreshold?: number;
}) {
  const { data, error } = await supabaseService
    .from("jobs")
    .insert({
      type: "PRODUCT_ASSET_GENERATION",
      payload: {
        ownerId: payload.ownerId,
        productUrl: payload.productUrl,
        fileName: payload.fileName ?? null,
        categoryHint: payload.categoryHint ?? null,
        providerMode: payload.providerMode ?? "auto",
        maxCandidates: payload.maxCandidates ?? 4,
        autoApproveThreshold: payload.autoApproveThreshold ?? 0.82,
        visibility: "private"
      },
      status: "queued",
      attempts: 0,
      max_attempts: 3,
      progress: 0,
      run_at: new Date().toISOString(),
      result: null
    })
    .select("id, status")
    .single();

  if (error) throw error;
  return data;
}
