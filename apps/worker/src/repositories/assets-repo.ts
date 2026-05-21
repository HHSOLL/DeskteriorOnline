import { env } from "../config/env";
import { supabaseService } from "../services/supabase";

type CreateGeneratedAssetPayload = {
  ownerId: string;
  fileName: string;
  provider: "triposr" | "meshy";
  buffer: ArrayBuffer;
  thumbnailBuffer?: Buffer | null;
  description?: string;
  category?: string;
  tags?: string[];
  meta?: Record<string, unknown>;
};

function sanitizeFileName(fileName: string) {
  return fileName.replace(/\s+/g, "-").toLowerCase().replace(/[^a-z0-9._-]/g, "");
}

export async function createGeneratedAsset(payload: CreateGeneratedAssetPayload) {
  const assetId = crypto.randomUUID();
  const safeName = sanitizeFileName(payload.fileName) || "generated-asset.glb";
  const storagePath = `${payload.ownerId}/generated/${assetId}-${safeName.endsWith(".glb") ? safeName : `${safeName}.glb`}`;
  const thumbnailPath = payload.thumbnailBuffer
    ? `${payload.ownerId}/generated/${assetId}-${safeName.replace(/\.glb$/i, "") || "generated-asset"}.webp`
    : null;

  const upload = await supabaseService.storage.from(env.ASSET_STORAGE_BUCKET).upload(storagePath, Buffer.from(payload.buffer), {
    contentType: "model/gltf-binary",
    upsert: true
  });
  if (upload.error) throw upload.error;

  if (payload.thumbnailBuffer && thumbnailPath) {
    const thumbnailUpload = await supabaseService.storage
      .from(env.ASSET_STORAGE_BUCKET)
      .upload(thumbnailPath, payload.thumbnailBuffer, {
        contentType: "image/webp",
        upsert: true
      });
    if (thumbnailUpload.error) throw thumbnailUpload.error;
  }

  const insert = await supabaseService.from("assets").insert({
    id: assetId,
    owner_id: payload.ownerId,
    name: payload.fileName || "Generated Asset",
    description: payload.description ?? `Generated via ${payload.provider}`,
    category: payload.category ?? "custom",
    tags: payload.tags ?? ["generated", payload.provider],
    glb_path: storagePath,
    thumbnail_path: thumbnailPath,
    meta: payload.meta ?? {
      schemaVersion: 1,
      unit: "m",
      extra: {
        provider: payload.provider
      }
    },
    is_public: false
  });
  if (insert.error) throw insert.error;

  const signedAsset = await supabaseService.storage.from(env.ASSET_STORAGE_BUCKET).createSignedUrl(storagePath, 60 * 60);
  const assetUrl =
    !signedAsset.error && signedAsset.data?.signedUrl
      ? signedAsset.data.signedUrl
      : supabaseService.storage.from(env.ASSET_STORAGE_BUCKET).getPublicUrl(storagePath).data.publicUrl;
  const signedThumbnail = thumbnailPath
    ? await supabaseService.storage.from(env.ASSET_STORAGE_BUCKET).createSignedUrl(thumbnailPath, 60 * 60)
    : null;

  return {
    assetId,
    assetUrl,
    thumbnailUrl:
      signedThumbnail && !signedThumbnail.error && signedThumbnail.data?.signedUrl
        ? signedThumbnail.data.signedUrl
        : thumbnailPath
          ? supabaseService.storage.from(env.ASSET_STORAGE_BUCKET).getPublicUrl(thumbnailPath).data.publicUrl
          : null,
    label: payload.fileName || "Generated Asset",
    description: payload.description ?? `Generated via ${payload.provider}`,
    category: payload.category ?? "Custom"
  };
}
