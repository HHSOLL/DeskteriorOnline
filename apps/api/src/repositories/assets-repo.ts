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

type SidecarUpload = {
  suffix: string;
  path: string;
  contentType: string;
};

type SignedSidecarUpload = SidecarUpload & {
  url: string | null;
};

function readRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function readArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
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

function readVector2Mm(value: unknown): [number, number] | null {
  if (Array.isArray(value) && value.length >= 2) {
    const x = readNumber(value[0]);
    const y = readNumber(value[1]);
    return x !== null && y !== null ? [x, y] : null;
  }

  const record = readRecord(value);
  const x = readNumber(record?.x);
  const y = readNumber(record?.y);
  return x !== null && y !== null ? [x, y] : null;
}

function readVector3Mm(value: unknown): [number, number, number] | null {
  if (Array.isArray(value) && value.length >= 3) {
    const x = readNumber(value[0]);
    const y = readNumber(value[1]);
    const z = readNumber(value[2]);
    return x !== null && y !== null && z !== null ? [x, y, z] : null;
  }

  const record = readRecord(value);
  const x = readNumber(record?.x);
  const y = readNumber(record?.y);
  const z = readNumber(record?.z);
  return x !== null && y !== null && z !== null ? [x, y, z] : null;
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

function normalizeSidecarUpload(value: unknown): SidecarUpload | null {
  const record = readRecord(value);
  const suffix = readString(record?.suffix);
  const path = readString(record?.path);
  const contentType = readString(record?.contentType);
  return suffix && path && contentType ? { suffix, path, contentType } : null;
}

function readSidecarUploads(meta: Record<string, unknown> | null) {
  const generation = readRecord(meta?.generation);
  const runtimeAsset = readRecord(meta?.runtimeAsset);
  const runtimeSidecars = readRecord(runtimeAsset?.sidecars);
  const candidates = [
    ...readArray(generation?.sidecarUploads),
    ...readArray(runtimeSidecars?.all),
    ...Object.values(runtimeSidecars ?? {})
  ];
  const uploads = candidates
    .map(normalizeSidecarUpload)
    .filter((upload): upload is SidecarUpload => upload !== null);
  const deduped = new Map<string, SidecarUpload>();
  uploads.forEach((upload) => {
    deduped.set(`${upload.suffix}:${upload.path}`, upload);
  });
  return Array.from(deduped.values());
}

async function resolveStorageUrl(path: string | null) {
  if (!path) return null;
  const signed = await supabaseService.storage.from(env.ASSET_STORAGE_BUCKET).createSignedUrl(path, 60 * 60);
  if (!signed.error && signed.data?.signedUrl) {
    return signed.data.signedUrl;
  }
  return supabaseService.storage.from(env.ASSET_STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}

async function resolveSignedSidecars(meta: Record<string, unknown> | null) {
  const uploads = readSidecarUploads(meta);
  return Promise.all(
    uploads.map(async (upload) => ({
      ...upload,
      url: await resolveStorageUrl(upload.path)
    }))
  );
}

function buildSidecarResponse(sidecars: SignedSidecarUpload[]) {
  return sidecars.reduce<Record<string, unknown>>(
    (accumulator, sidecar) => {
      accumulator[sidecarKeyForSuffix(sidecar.suffix)] = sidecar;
      return accumulator;
    },
    { all: sidecars }
  );
}

function readRuntimePackage(meta: Record<string, unknown> | null) {
  const qa = readRecord(meta?.qa);
  return readRecord(qa?.runtimePackage);
}

function buildRuntimeAssetMetadata(
  meta: Record<string, unknown> | null,
  sidecars: Record<string, unknown>
): Record<string, unknown> {
  const runtimePackage = readRuntimePackage(meta);
  const packageRuntimeAsset = readRecord(runtimePackage?.runtimeAsset) ?? {};
  const rowRuntimeAsset = readRecord(meta?.runtimeAsset) ?? {};
  return {
    ...packageRuntimeAsset,
    ...rowRuntimeAsset,
    sidecars
  };
}

function anchorTypesForSurfaceType(type: string | null): string[] {
  if (type === "desktop_top" || type === "desk_edge" || type === "desk_underside") {
    return ["desk_surface", "furniture_surface"];
  }
  if (type === "shelf_top") {
    return ["shelf_surface", "furniture_surface"];
  }
  return ["furniture_surface"];
}

function normalizeSupportSurfaceForCatalog(surface: unknown) {
  const record = readRecord(surface);
  const id = readString(record?.id);
  const type = readString(record?.type);
  const bounds = readRecord(record?.boundsMm);
  const min = readVector2Mm(bounds?.min);
  const max = readVector2Mm(bounds?.max);
  const localFrame = readRecord(record?.localFrame);
  const origin = readVector3Mm(localFrame?.originMm);
  if (!id || !min || !max || !origin) return null;

  const width = Math.max(0, max[0] - min[0]) / 1000;
  const depth = Math.max(0, max[1] - min[1]) / 1000;
  if (width <= 0 || depth <= 0) return null;

  const allowedAttachments = readArray(record?.allowedAttachments)
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => (entry === "under_desk_mount" ? "underside_screw" : entry));

  return {
    id,
    anchorTypes: anchorTypesForSurfaceType(type),
    center: [(min[0] + max[0]) / 2000, (min[1] + max[1]) / 2000],
    size: [width, depth],
    top: origin[1] / 1000,
    margin: [0, 0],
    ...(type ? { surfaceType: type } : {}),
    ...(allowedAttachments.length > 0 ? { allowedAttachments } : {}),
    ...(typeof record?.thicknessMm === "number" ? { thicknessMm: record.thicknessMm } : {}),
    ...(readRecord(record?.localFrame) ? { localFrame: record.localFrame } : {})
  };
}

function buildSupportProfileFromRuntimeAsset(runtimeAsset: Record<string, unknown>) {
  const surfaces = readArray(runtimeAsset.supportSurfaces)
    .map(normalizeSupportSurfaceForCatalog)
    .filter((surface): surface is NonNullable<ReturnType<typeof normalizeSupportSurfaceForCatalog>> => surface !== null);
  return surfaces.length > 0 ? { surfaces } : null;
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
      const signedSidecars = await resolveSignedSidecars(meta);
      const sidecars = buildSidecarResponse(signedSidecars);
      const runtimePackage = readRuntimePackage(meta);
      const runtimeAssetMetadata = buildRuntimeAssetMetadata(meta, sidecars);
      const generation = readRecord(meta?.generation);
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
        description: row.description,
        generationStrategy: readString(runtimeAsset?.generationStrategy ?? generation?.strategy),
        runtimePackage,
        runtimeAsset: runtimeAssetMetadata,
        sidecars,
        supportProfile: buildSupportProfileFromRuntimeAsset(runtimeAssetMetadata),
        interactionAnchors: readArray(runtimeAssetMetadata.interactionAnchors),
        attachmentPoints: readArray(runtimeAssetMetadata.attachmentPoints)
      };
    })
  );
}
