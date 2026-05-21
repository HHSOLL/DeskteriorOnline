import { env } from "../config/env";
import { supabaseService } from "../services/supabase";

type AssetRow = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  glb_path: string;
  thumbnail_path: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
};

function readRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readDimensionsMm(meta: Record<string, unknown> | null) {
  const runtimeAsset = readRecord(meta?.runtimeAsset);
  const dimensions = readRecord(runtimeAsset?.dimensionsMm ?? meta?.dimensionsMm);
  const width = typeof dimensions?.width === "number" ? dimensions.width : null;
  const depth = typeof dimensions?.depth === "number" ? dimensions.depth : null;
  const height = typeof dimensions?.height === "number" ? dimensions.height : null;
  return width && depth && height ? { width, depth, height } : null;
}

function readQualityScore(meta: Record<string, unknown> | null) {
  const generation = readRecord(meta?.generation);
  const qa = readRecord(meta?.qa);
  const value = qa?.visualFidelityScore ?? generation?.qualityScore;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

async function resolveStorageUrl(path: string | null) {
  if (!path) return null;
  const signed = await supabaseService.storage.from(env.ASSET_STORAGE_BUCKET).createSignedUrl(path, 60 * 60);
  if (!signed.error && signed.data?.signedUrl) {
    return signed.data.signedUrl;
  }
  return supabaseService.storage.from(env.ASSET_STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function listGeneratedAssetsForOwner(ownerId: string) {
  const { data, error } = await supabaseService
    .from("assets")
    .select("id, name, description, category, glb_path, thumbnail_path, meta, created_at")
    .eq("owner_id", ownerId)
    .eq("is_public", false)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const rows = (data ?? []) as AssetRow[];
  return Promise.all(
    rows.map(async (row) => {
      const meta = readRecord(row.meta);
      const source = readRecord(meta?.source);
      const runtimeAsset = readRecord(meta?.runtimeAsset);
      return {
        id: row.id,
        label: row.name,
        category: row.category || "custom",
        assetId: (await resolveStorageUrl(row.glb_path)) ?? "",
        thumbnail: await resolveStorageUrl(row.thumbnail_path),
        dimensionsMm: readDimensionsMm(meta),
        scaleLocked: typeof runtimeAsset?.scaleLocked === "boolean" ? runtimeAsset.scaleLocked : true,
        source: "generated" as const,
        qualityScore: readQualityScore(meta),
        externalUrl: readString(source?.url),
        brand: readString(source?.manufacturer),
        description: row.description
      };
    })
  );
}
