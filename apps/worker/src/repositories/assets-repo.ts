import { env } from "../config/env";
import { supabaseService } from "../services/supabase";

type CreateGeneratedAssetPayload = {
  ownerId: string;
  fileName: string;
  provider: "triposr" | "meshy" | "cad_parametric" | "procedural_template" | "library_step_part" | "hybrid_cad_blender";
  buffer: ArrayBuffer;
  thumbnailBuffer?: Buffer | null;
  sidecars?: Array<{
    suffix: string;
    buffer: Buffer;
    contentType: string;
  }>;
  description?: string;
  category?: string;
  tags?: string[];
  meta?: Record<string, unknown>;
};

function sanitizeFileName(fileName: string) {
  return fileName.replace(/\s+/g, "-").toLowerCase().replace(/[^a-z0-9._-]/g, "");
}

function readRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function sidecarKeyForSuffix(suffix: string) {
  switch (suffix) {
    case "model.py":
      return "modelSource";
    case "model.step":
      return "step";
    case "runtime-package.json":
      return "runtimePackage";
    case "colliders.json":
      return "colliders";
    case "support-surfaces.json":
      return "supportSurfaces";
    case "attachment-points.json":
      return "attachmentPoints";
    case "interaction-anchors.json":
      return "interactionAnchors";
    case "material-variants.json":
      return "materialVariants";
    case "qa-report.json":
      return "qaReport";
    default:
      return suffix.replace(/\.[a-z0-9]+$/i, "").replace(/[^a-z0-9]+(.)/gi, (_, character: string) =>
        character.toUpperCase()
      );
  }
}

function mergeSidecarUploadsIntoMeta(
  meta: Record<string, unknown>,
  sidecarUploads: Array<{ suffix: string; path: string; contentType: string }>
) {
  if (sidecarUploads.length === 0) return meta;

  const generation = readRecord(meta.generation) ?? {};
  const runtimeAsset = readRecord(meta.runtimeAsset) ?? {};
  const existingSidecars = readRecord(runtimeAsset.sidecars) ?? {};
  const sidecarIndex = sidecarUploads.reduce<Record<string, unknown>>(
    (accumulator, upload) => {
      accumulator[sidecarKeyForSuffix(upload.suffix)] = upload;
      return accumulator;
    },
    { all: sidecarUploads }
  );

  return {
    ...meta,
    generation: {
      ...generation,
      sidecarUploads
    },
    runtimeAsset: {
      ...runtimeAsset,
      sidecars: {
        ...existingSidecars,
        ...sidecarIndex
      }
    }
  };
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

  const sidecarUploads = await Promise.all(
    (payload.sidecars ?? []).map(async (sidecar) => {
      const suffix = sanitizeFileName(sidecar.suffix) || "sidecar.json";
      const sidecarPath = `${payload.ownerId}/generated/${assetId}-${safeName.replace(/\.glb$/i, "") || "generated-asset"}.${suffix}`;
      const upload = await supabaseService.storage.from(env.ASSET_STORAGE_BUCKET).upload(sidecarPath, sidecar.buffer, {
        contentType: sidecar.contentType,
        upsert: true
      });
      if (upload.error) throw upload.error;
      return {
        suffix,
        path: sidecarPath,
        contentType: sidecar.contentType
      };
    })
  );
  const baseMeta = payload.meta ?? {
    schemaVersion: 1,
    unit: "m",
    extra: {
      provider: payload.provider
    }
  };
  const meta = mergeSidecarUploadsIntoMeta(baseMeta, sidecarUploads);

  const insert = await supabaseService.from("assets").insert({
    id: assetId,
    owner_id: payload.ownerId,
    name: payload.fileName || "Generated Asset",
    description: payload.description ?? `Generated via ${payload.provider}`,
    category: payload.category ?? "custom",
    tags: payload.tags ?? ["generated", payload.provider],
    glb_path: storagePath,
    thumbnail_path: thumbnailPath,
    meta,
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
    category: payload.category ?? "Custom",
    sidecars: sidecarUploads
  };
}
