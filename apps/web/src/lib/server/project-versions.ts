import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "../../../../../types/database";
import type {
  ProductCollisionProxyMetadata,
  ProductDimensionsMm,
  ProductLicenseMetadata,
  ProductLodProfileMetadata,
  ProductPivotMetadata,
  ProductSourceMetadata,
  ProductTextureSetMetadata
} from "../builder/catalog";
import {
  resolveScenePlacementVectors,
  serializeScenePlacement
} from "../domain/scene-placement";
import { deriveBlankRoomShell } from "../domain/room-shell";
import type { Floor, Opening, ScaleInfo, Wall } from "../stores/useSceneStore";

const ASSET_ANCHOR_TYPES = new Set([
  "floor",
  "wall",
  "ceiling",
  "furniture_surface",
  "desk_surface",
  "shelf_surface"
]);

const AssetSummarySchema = z.object({
  totalAssets: z.number(),
  highlightedItems: z
    .array(
      z.object({
        catalogItemId: z.string().nullable(),
        assetId: z.string(),
        label: z.string(),
        category: z.string(),
        collection: z.string(),
        tone: z.enum(["sand", "olive", "slate", "ember"]),
        count: z.number()
      })
    )
    .default([]),
  collections: z
    .array(
      z.object({
        label: z.string(),
        count: z.number()
      })
    )
    .default([]),
  uncataloguedCount: z.number(),
  primaryTone: z.enum(["sand", "olive", "slate", "ember"]),
  primaryCollection: z.string().nullable()
});

const RoomShellSchema = z.object({
  scale: z.number(),
  scaleInfo: z.record(z.string(), z.unknown()).optional(),
  walls: z.array(z.record(z.string(), z.unknown())),
  openings: z.array(z.record(z.string(), z.unknown())),
  floors: z.array(z.record(z.string(), z.unknown())).default([]),
  ceilings: z.array(z.record(z.string(), z.unknown())).default([]),
  rooms: z.array(z.record(z.string(), z.unknown())).default([]),
  cameraAnchors: z.array(z.record(z.string(), z.unknown())).default([]),
  navGraph: z
    .object({
      nodes: z.array(z.record(z.string(), z.unknown())).default([]),
      edges: z.array(z.record(z.string(), z.unknown())).default([])
    })
    .default({ nodes: [], edges: [] }),
  entranceId: z.string().nullable().optional()
});

export const SaveVersionSchema = z.object({
  message: z.string().optional(),
  roomShell: RoomShellSchema,
  assets: z.array(z.record(z.string(), z.unknown())).default([]),
  materials: z.object({
    wallIndex: z.number(),
    floorIndex: z.number()
  }),
  lighting: z
    .object({
      mode: z.enum(["direct", "indirect"]).optional(),
      ambientIntensity: z.number(),
      hemisphereIntensity: z.number(),
      directionalIntensity: z.number(),
      environmentBlur: z.number(),
      accentIntensity: z.number().optional(),
      beamOpacity: z.number().optional()
    })
    .optional(),
  thumbnailDataUrl: z.string().nullable().optional(),
  assetSummary: AssetSummarySchema.nullable().optional(),
  projectName: z.string().optional(),
  projectDescription: z.string().nullable().optional()
});

type SaveVersionPayload = z.infer<typeof SaveVersionSchema>;
type RoomShellPayload = SaveVersionPayload["roomShell"];
type MaterialsPayload = SaveVersionPayload["materials"];
type LightingPayload = NonNullable<SaveVersionPayload["lighting"]>;
type ProjectRow = Pick<Database["public"]["Tables"]["projects"]["Row"], "id" | "owner_id" | "meta" | "current_version_id">;
type ProjectVersionRow = Pick<
  Database["public"]["Tables"]["project_versions"]["Row"],
  "id" | "project_id" | "version" | "created_by" | "message" | "customization" | "snapshot_path" | "created_at" | "updated_at"
>;

const PROJECT_VERSION_SELECT =
  "id, project_id, version, created_by, message, customization, snapshot_path, created_at, updated_at";

export class ProjectVersionApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function resolveUploadBucket() {
  return process.env.PROJECT_MEDIA_BUCKET ?? process.env.NEXT_PUBLIC_PROJECT_MEDIA_BUCKET ?? "project-media";
}

function isRecoverableThumbnailUploadError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("bucket") ||
    normalized.includes("object not found") ||
    normalized.includes("not found") ||
    normalized.includes("permission") ||
    normalized.includes("policy") ||
    normalized.includes("row-level security")
  );
}

async function ensureUploadBucket(
  supabase: SupabaseClient<Database>,
  bucketName: string
) {
  const lookup = await supabase.storage.getBucket(bucketName);
  if (!lookup.error && lookup.data) {
    return true;
  }

  const create = await supabase.storage.createBucket(bucketName, {
    public: false,
    fileSizeLimit: 5 * 1024 * 1024,
    allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "image/svg+xml"]
  });

  if (!create.error) {
    return true;
  }

  return create.error.message.toLowerCase().includes("already exists");
}

function createPrivilegedSupabaseClient(userScopedSupabase: SupabaseClient<Database>) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return userScopedSupabase;
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

function normalizeAssetAnchor(value: unknown) {
  return typeof value === "string" && ASSET_ANCHOR_TYPES.has(value) ? value : "floor";
}

function normalizeAssetMetadataText(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeAssetMetadataUrl(value: unknown) {
  const normalized = normalizeAssetMetadataText(value);
  if (!normalized) return null;
  return normalized.startsWith("http://") || normalized.startsWith("https://") ? normalized : null;
}

function normalizeAssetMetadataPrice(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return normalizeAssetMetadataText(value);
}

function normalizeAssetMetadataBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return false;
}

function normalizeAssetMetadataStrictBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return null;
}

function normalizeAssetMetadataDimensionValue(value: unknown) {
  const numeric = typeof value === "string" ? Number(value) : value;
  return typeof numeric === "number" && Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function normalizeAssetMetadataPositiveInteger(value: unknown) {
  const numeric = typeof value === "string" ? Number(value) : value;
  return typeof numeric === "number" && Number.isInteger(numeric) && numeric > 0 ? numeric : null;
}

function normalizeAssetMetadataDimensionsMm(value: unknown): ProductDimensionsMm | null {
  if (!isRecord(value)) {
    return null;
  }

  const width = normalizeAssetMetadataDimensionValue(value.width);
  const depth = normalizeAssetMetadataDimensionValue(value.depth);
  const height = normalizeAssetMetadataDimensionValue(value.height);

  if (width === null || depth === null || height === null) {
    return null;
  }

  return {
    width,
    depth,
    height
  };
}

function normalizeAssetMetadataSource(value: unknown): ProductSourceMetadata | null {
  if (!isRecord(value)) {
    return null;
  }

  const kind = value.kind === "deskterioronline_blender" || value.kind === "open_source" ? value.kind : null;
  const name = normalizeAssetMetadataText(value.name);
  const metadataPath = normalizeAssetMetadataText(value.path);
  const url = normalizeAssetMetadataUrl(value.url);

  if (!kind || !name || (!metadataPath && !url)) {
    return null;
  }

  return {
    kind,
    name,
    path: metadataPath,
    url
  };
}

function normalizeAssetMetadataLicense(value: unknown): ProductLicenseMetadata | null {
  if (!isRecord(value)) {
    return null;
  }

  const spdx = normalizeAssetMetadataText(value.spdx);
  const label = normalizeAssetMetadataText(value.label);
  const requiresAttribution = normalizeAssetMetadataStrictBoolean(value.requiresAttribution);

  if (!spdx || !label || requiresAttribution === null) {
    return null;
  }

  return {
    spdx,
    label,
    requiresAttribution
  };
}

function normalizeAssetMetadataPivot(value: unknown): ProductPivotMetadata | null {
  if (!isRecord(value)) {
    return null;
  }

  const x = value.x === "left" || value.x === "center" || value.x === "right" ? value.x : null;
  const y = value.y === "floor" || value.y === "center" || value.y === "top" ? value.y : null;
  const z = value.z === "front" || value.z === "center" || value.z === "back" ? value.z : null;

  if (!x || !y || !z) {
    return null;
  }

  return { x, y, z };
}

function normalizeAssetMetadataCollisionProxy(value: unknown): ProductCollisionProxyMetadata | null {
  if (!isRecord(value)) {
    return null;
  }

  if (value.kind !== "box" || value.derivesFrom !== "dimensionsMm") {
    return null;
  }

  return {
    kind: "box",
    derivesFrom: "dimensionsMm"
  };
}

function normalizeAssetMetadataTextureSet(value: unknown): ProductTextureSetMetadata | null {
  if (!isRecord(value)) {
    return null;
  }

  const workflow = value.workflow === "pbr_metallic_roughness" ? value.workflow : null;
  const authored = value.authored === "procedural" || value.authored === "image_based" ? value.authored : null;
  const ktx2Ready = normalizeAssetMetadataStrictBoolean(value.ktx2Ready);

  if (!workflow || !authored || ktx2Ready === null) {
    return null;
  }

  return {
    workflow,
    authored,
    ktx2Ready
  };
}

function normalizeAssetMetadataLodProfile(value: unknown): ProductLodProfileMetadata | null {
  if (!isRecord(value)) {
    return null;
  }

  const strategy = value.strategy === "single_mesh" || value.strategy === "manual_lod" ? value.strategy : null;
  const levelCount = normalizeAssetMetadataPositiveInteger(value.levelCount);
  const maxDrawCalls = normalizeAssetMetadataPositiveInteger(value.maxDrawCalls);
  const maxTriangleCount = normalizeAssetMetadataPositiveInteger(value.maxTriangleCount);

  if (!strategy || levelCount === null || maxDrawCalls === null || maxTriangleCount === null) {
    return null;
  }

  return {
    strategy,
    levelCount,
    maxDrawCalls,
    maxTriangleCount
  };
}

function resolveAssetProductRecord(asset: Record<string, unknown>) {
  return isRecord(asset.product) ? asset.product : null;
}

function buildAssetProductMetadata(asset: Record<string, unknown>) {
  const product = resolveAssetProductRecord(asset);
  const productId = normalizeAssetMetadataText(product?.id ?? product?.productId ?? asset.catalogItemId);
  const label = normalizeAssetMetadataText(product?.name ?? asset.label);
  const category = normalizeAssetMetadataText(product?.category ?? asset.category);
  const collection = normalizeAssetMetadataText(product?.collection ?? asset.collection);
  const vendor = normalizeAssetMetadataText(product?.brand ?? product?.vendor ?? asset.vendor ?? asset.brand);
  const price = normalizeAssetMetadataPrice(product?.price ?? asset.price);
  const variant = normalizeAssetMetadataText(product?.options ?? product?.variant ?? asset.variant ?? asset.options);
  const productUrl = normalizeAssetMetadataUrl(product?.externalUrl ?? asset.productUrl ?? asset.externalUrl);
  const thumbnailUrl = normalizeAssetMetadataUrl(
    product?.thumbnail ?? asset.thumbnailUrl ?? asset.imageUrl ?? asset.previewImageUrl
  );
  const dimensionsMm = normalizeAssetMetadataDimensionsMm(product?.dimensionsMm ?? asset.dimensionsMm);
  const finishColor = normalizeAssetMetadataText(product?.finishColor ?? asset.finishColor);
  const finishMaterial = normalizeAssetMetadataText(product?.finishMaterial ?? asset.finishMaterial);
  const detailNotes = normalizeAssetMetadataText(product?.detailNotes ?? asset.detailNotes);
  const scaleLocked = normalizeAssetMetadataBoolean(product?.scaleLocked ?? asset.scaleLocked);
  const source = normalizeAssetMetadataSource(product?.source ?? asset.source);
  const license = normalizeAssetMetadataLicense(product?.license ?? asset.license);
  const pivot = normalizeAssetMetadataPivot(product?.pivot ?? asset.pivot);
  const collisionProxy = normalizeAssetMetadataCollisionProxy(product?.collisionProxy ?? asset.collisionProxy);
  const textureSet = normalizeAssetMetadataTextureSet(product?.textureSet ?? asset.textureSet);
  const lodProfile = normalizeAssetMetadataLodProfile(product?.lodProfile ?? asset.lodProfile);

  return {
    ...(productId ? { productId } : {}),
    ...(label ? { label } : {}),
    ...(category ? { category } : {}),
    ...(collection ? { collection } : {}),
    ...(vendor ? { vendor } : {}),
    ...(price !== null ? { price } : {}),
    ...(variant ? { variant } : {}),
    ...(productUrl ? { productUrl } : {}),
    ...(thumbnailUrl ? { thumbnailUrl } : {}),
    dimensionsMm,
    finishColor,
    finishMaterial,
    detailNotes,
    scaleLocked,
    source,
    license,
    pivot,
    collisionProxy,
    textureSet,
    lodProfile
  };
}

function buildSerializedAssetPlacement(asset: Record<string, unknown>) {
  const vectors = resolveScenePlacementVectors({
    position: asset.position,
    rotation: asset.rotation,
    scale: asset.scale
  });

  return {
    vectors,
    snapshot: serializeScenePlacement(vectors)
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeScaleSource(value: unknown): ScaleInfo["source"] {
  if (value === "ocr_dimension" || value === "door_heuristic" || value === "user_measure" || value === "unknown") {
    return value;
  }
  return "unknown";
}

function toScaleInfo(value: unknown, fallbackValue: number): ScaleInfo {
  if (!isRecord(value)) {
    return {
      value: fallbackValue,
      source: "unknown",
      confidence: 0
    };
  }

  const numericValue = Number(value.value);
  const confidence = Number(value.confidence);

  return {
    value: Number.isFinite(numericValue) ? numericValue : fallbackValue,
    source: normalizeScaleSource(value.source),
    confidence: Number.isFinite(confidence) ? confidence : 0,
    evidence: isRecord(value.evidence) ? value.evidence : undefined
  };
}

function dataUrlToBuffer(dataUrl: string) {
  const [header, payload = ""] = dataUrl.split(",", 2);
  const mimeMatch = header?.match(/^data:([^;,]+)/);
  const mime = mimeMatch?.[1] ?? "image/png";
  const isBase64 = header?.includes(";base64");
  return {
    mime,
    buffer: Buffer.from(isBase64 ? payload : decodeURIComponent(payload), isBase64 ? "base64" : "utf8")
  };
}

function mimeToExtension(mime: string) {
  if (mime === "image/svg+xml") return "svg";
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  return "bin";
}

function buildRoomShell(roomShell: RoomShellPayload) {
  const scale = roomShell.scale;
  const resolvedScaleInfo = toScaleInfo(roomShell.scaleInfo, scale);
  const walls = roomShell.walls as Array<Record<string, unknown>>;
  const openings = roomShell.openings as Array<Record<string, unknown>>;
  const floors = roomShell.floors as Array<Record<string, unknown>>;
  const derivedShell = deriveBlankRoomShell({
    scale,
    scaleInfo: resolvedScaleInfo,
    walls: walls as unknown as Wall[],
    openings: openings as unknown as Opening[],
    floors: floors as unknown as Floor[]
  });

  return {
    scale,
    scaleInfo: resolvedScaleInfo,
    walls,
    openings,
    floors,
    ceilings:
      Array.isArray(roomShell.ceilings) && roomShell.ceilings.length > 0
        ? (roomShell.ceilings as Array<Record<string, unknown>>)
        : (derivedShell.ceilings as unknown as Array<Record<string, unknown>>),
    rooms:
      Array.isArray(roomShell.rooms) && roomShell.rooms.length > 0
        ? (roomShell.rooms as Array<Record<string, unknown>>)
        : (derivedShell.rooms as unknown as Array<Record<string, unknown>>),
    cameraAnchors:
      Array.isArray(roomShell.cameraAnchors) && roomShell.cameraAnchors.length > 0
        ? (roomShell.cameraAnchors as Array<Record<string, unknown>>)
        : (derivedShell.cameraAnchors as unknown as Array<Record<string, unknown>>),
    navGraph: {
      nodes:
        Array.isArray(roomShell.navGraph?.nodes) && roomShell.navGraph.nodes.length > 0
          ? (roomShell.navGraph.nodes as Array<Record<string, unknown>>)
          : (derivedShell.navGraph.nodes as unknown as Array<Record<string, unknown>>),
      edges:
        Array.isArray(roomShell.navGraph?.edges) && roomShell.navGraph.edges.length > 0
          ? (roomShell.navGraph.edges as Array<Record<string, unknown>>)
          : (derivedShell.navGraph.edges as unknown as Array<Record<string, unknown>>)
    },
    entranceId:
      typeof roomShell.entranceId === "string" && roomShell.entranceId.length > 0
        ? roomShell.entranceId
        : derivedShell.entranceId
  };
}

function resolveLightingSettings(lighting?: Partial<LightingPayload>): LightingPayload {
  const fallbackLighting: LightingPayload = {
    mode: "direct",
    ambientIntensity: 0.44,
    hemisphereIntensity: 0.54,
    directionalIntensity: 1.24,
    environmentBlur: 0.14,
    accentIntensity: 0.82,
    beamOpacity: 0.18
  };

  return {
    mode: lighting?.mode === "indirect" ? "indirect" : fallbackLighting.mode,
    ambientIntensity:
      typeof lighting?.ambientIntensity === "number"
        ? lighting.ambientIntensity
        : fallbackLighting.ambientIntensity,
    hemisphereIntensity:
      typeof lighting?.hemisphereIntensity === "number"
        ? lighting.hemisphereIntensity
        : fallbackLighting.hemisphereIntensity,
    directionalIntensity:
      typeof lighting?.directionalIntensity === "number"
        ? lighting.directionalIntensity
        : fallbackLighting.directionalIntensity,
    environmentBlur:
      typeof lighting?.environmentBlur === "number"
        ? lighting.environmentBlur
        : fallbackLighting.environmentBlur,
    accentIntensity:
      typeof lighting?.accentIntensity === "number"
        ? lighting.accentIntensity
        : fallbackLighting.accentIntensity,
    beamOpacity:
      typeof lighting?.beamOpacity === "number"
        ? lighting.beamOpacity
        : fallbackLighting.beamOpacity
  };
}

function buildSceneDocument(
  roomShell: RoomShellPayload,
  assets: Array<Record<string, unknown>>,
  materials: MaterialsPayload,
  lighting?: Partial<LightingPayload>
) {
  const resolvedRoomShell = buildRoomShell(roomShell);
  const normalizedLighting = resolveLightingSettings(lighting);

  return {
    schemaVersion: 2,
    roomShell: resolvedRoomShell,
    nodes: assets.map((asset) => {
      const anchorType = normalizeAssetAnchor(asset.anchorType);
      const productMetadata = buildAssetProductMetadata(asset);
      const placement = buildSerializedAssetPlacement(asset);
      return {
        id: asset.id,
        assetId: asset.assetId,
        visible: normalizeAssetMetadataBoolean(asset.visible ?? true),
        catalogItemId: typeof asset.catalogItemId === "string" && asset.catalogItemId.length > 0 ? asset.catalogItemId : null,
        anchorType,
        supportAssetId:
          typeof asset.supportAssetId === "string" && asset.supportAssetId.length > 0 ? asset.supportAssetId : null,
        supportProfile: asset.supportProfile ?? null,
        placement: placement.snapshot,
        position: placement.vectors.position,
        rotation: placement.vectors.rotation,
        scale: placement.vectors.scale,
        materialId: asset.materialId ?? null,
        metadata: {
          anchorType,
          visible: normalizeAssetMetadataBoolean(asset.visible ?? true),
          ...(typeof asset.supportAssetId === "string" && asset.supportAssetId.length > 0
            ? { supportAssetId: asset.supportAssetId }
            : {}),
          ...(asset.supportProfile && typeof asset.supportProfile === "object"
            ? { supportProfile: asset.supportProfile }
            : {}),
          ...(typeof asset.catalogItemId === "string" && asset.catalogItemId.length > 0
            ? { catalogItemId: asset.catalogItemId }
            : {}),
          ...productMetadata
        }
      };
    }),
    materialOverride: {
      wallMaterialIndex: materials.wallIndex,
      floorMaterialIndex: materials.floorIndex
    },
    lighting: normalizedLighting
  };
}

function buildProjectVersionCustomization(
  roomShell: RoomShellPayload,
  assets: Array<Record<string, unknown>>,
  materials: MaterialsPayload,
  lighting?: Partial<LightingPayload>
) {
  const normalizedLighting = resolveLightingSettings(lighting);
  const sceneDocument = buildSceneDocument(roomShell, assets, materials, lighting);

  return {
    schemaVersion: 2,
    furniture: assets.map((asset) => {
      const anchorType = normalizeAssetAnchor(asset.anchorType);
      const productMetadata = buildAssetProductMetadata(asset);
      const placement = buildSerializedAssetPlacement(asset);
      return {
        id: asset.id,
        modelId: asset.assetId,
        visible: normalizeAssetMetadataBoolean(asset.visible ?? true),
        anchor: anchorType,
        supportAssetId:
          typeof asset.supportAssetId === "string" && asset.supportAssetId.length > 0 ? asset.supportAssetId : null,
        placement: placement.snapshot,
        position: placement.vectors.position,
        rotation: placement.vectors.rotation,
        scale: placement.vectors.scale,
        metadata: {
          path: asset.assetId,
          anchorType,
          visible: normalizeAssetMetadataBoolean(asset.visible ?? true),
          ...(typeof asset.supportAssetId === "string" && asset.supportAssetId.length > 0
            ? { supportAssetId: asset.supportAssetId }
            : {}),
          ...(asset.supportProfile && typeof asset.supportProfile === "object"
            ? { supportProfile: asset.supportProfile }
            : {}),
          ...(typeof asset.catalogItemId === "string" && asset.catalogItemId.length > 0
            ? { catalogItemId: asset.catalogItemId }
            : {}),
          ...productMetadata
        }
      };
    }),
    surfaceMaterials: {},
    defaults: {
      floor: {
        materialSkuId: `floor:${materials.floorIndex}`
      },
      wall: {
        materialSkuId: `wall:${materials.wallIndex}`
      },
      lighting: normalizedLighting
    },
    sceneDocument
  };
}

export function buildSceneDocumentBootstrapFromSavePayload(rawPayload: unknown) {
  const payload = SaveVersionSchema.parse(rawPayload);
  const resolvedRoomShell = buildRoomShell(payload.roomShell);

  return {
    document: buildSceneDocument(payload.roomShell, payload.assets, payload.materials, payload.lighting),
    entranceId: resolvedRoomShell.entranceId,
    diagnostics: {
      source: "save-payload"
    }
  };
}

async function requireOwnedProject(
  supabase: SupabaseClient<Database>,
  projectId: string,
  ownerId: string
): Promise<ProjectRow> {
  const projectLookup = await supabase
    .from("projects")
    .select("id, owner_id, meta, current_version_id")
    .eq("id", projectId)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (projectLookup.error) {
    throw new ProjectVersionApiError(500, projectLookup.error.message);
  }
  if (!projectLookup.data) {
    throw new ProjectVersionApiError(404, "Project not found.");
  }

  return projectLookup.data;
}

export async function createProjectVersion(
  supabase: SupabaseClient<Database>,
  input: {
    projectId: string;
    ownerId: string;
    payload: SaveVersionPayload;
  }
) {
  const project = await requireOwnedProject(supabase, input.projectId, input.ownerId);
  const privilegedSupabase = createPrivilegedSupabaseClient(supabase);
  const payload = input.payload;

  if (payload.projectName || payload.projectDescription !== undefined) {
    const updateProject = await privilegedSupabase
      .from("projects")
      .update({
        ...(payload.projectName ? { name: payload.projectName } : {}),
        ...(payload.projectDescription !== undefined ? { description: payload.projectDescription } : {})
      })
      .eq("id", input.projectId)
      .eq("owner_id", input.ownerId);

    if (updateProject.error) {
      throw new ProjectVersionApiError(500, updateProject.error.message);
    }
  }

  let snapshotPath: string | null = null;
  const nextMeta: Record<string, unknown> = {
    ...((project.meta as Record<string, unknown> | null) ?? {})
  };

  if (payload.thumbnailDataUrl) {
    const parsed = dataUrlToBuffer(payload.thumbnailDataUrl);
    const uploadBucket = resolveUploadBucket();
    snapshotPath = `${input.ownerId}/${input.projectId}/thumbnail-${Date.now()}.${mimeToExtension(parsed.mime)}`;
    let upload = await privilegedSupabase.storage.from(uploadBucket).upload(snapshotPath, parsed.buffer, {
      contentType: parsed.mime,
      upsert: true
    });

    if (upload.error && isRecoverableThumbnailUploadError(upload.error.message)) {
      const bucketReady = await ensureUploadBucket(privilegedSupabase, uploadBucket);
      if (bucketReady) {
        upload = await privilegedSupabase.storage.from(uploadBucket).upload(snapshotPath, parsed.buffer, {
          contentType: parsed.mime,
          upsert: true
        });
      }
    }

    if (upload.error) {
      if (!isRecoverableThumbnailUploadError(upload.error.message)) {
        throw new ProjectVersionApiError(500, upload.error.message);
      }
      snapshotPath = null;
    } else {
      nextMeta.thumbnailBucket = uploadBucket;
    }
  }

  if (payload.assetSummary !== undefined) {
    nextMeta.assetSummary = payload.assetSummary;
  }

  if (snapshotPath || payload.assetSummary !== undefined) {
    const updateSnapshotMeta = await privilegedSupabase
      .from("projects")
      .update({
        ...(snapshotPath ? { thumbnail_path: snapshotPath } : {}),
        meta: nextMeta
      })
      .eq("id", input.projectId)
      .eq("owner_id", input.ownerId);

    if (updateSnapshotMeta.error) {
      throw new ProjectVersionApiError(500, updateSnapshotMeta.error.message);
    }
  }

  const customization = buildProjectVersionCustomization(
    payload.roomShell,
    payload.assets as Array<Record<string, unknown>>,
    payload.materials,
    payload.lighting
  );

  const createVersion = await supabase.rpc("create_project_version", {
    p_project_id: input.projectId,
    p_message: payload.message ?? "Manual save",
    p_customization:
      customization as Database["public"]["Functions"]["create_project_version"]["Args"]["p_customization"],
    p_snapshot_path: snapshotPath
  });

  if (createVersion.error) {
    throw new ProjectVersionApiError(500, createVersion.error.message);
  }

  return createVersion.data;
}

function clampLimit(limit: number) {
  return Math.min(Math.max(Math.trunc(limit), 1), 100);
}

function clampOffset(offset: number) {
  return Math.max(Math.trunc(offset), 0);
}

export async function listProjectVersions(
  supabase: SupabaseClient<Database>,
  input: {
    projectId: string;
    ownerId: string;
    limit?: number;
    offset?: number;
  }
) {
  await requireOwnedProject(supabase, input.projectId, input.ownerId);

  const limit = clampLimit(input.limit ?? 20);
  const offset = clampOffset(input.offset ?? 0);

  const lookup = await supabase
    .from("project_versions")
    .select(PROJECT_VERSION_SELECT, { count: "exact" })
    .eq("project_id", input.projectId)
    .order("version", { ascending: false })
    .range(offset, offset + limit - 1);

  if (lookup.error) {
    throw new ProjectVersionApiError(500, lookup.error.message);
  }

  const items = (lookup.data ?? []) as ProjectVersionRow[];
  const total = lookup.count ?? 0;
  const nextCursor = total > offset + items.length ? String(offset + items.length) : null;

  return {
    items,
    total,
    nextCursor
  };
}

export async function getLatestProjectVersion(
  supabase: SupabaseClient<Database>,
  input: {
    projectId: string;
    ownerId: string;
  }
) {
  const project = await requireOwnedProject(supabase, input.projectId, input.ownerId);

  if (project.current_version_id) {
    const pinnedLookup = await supabase
      .from("project_versions")
      .select(PROJECT_VERSION_SELECT)
      .eq("project_id", input.projectId)
      .eq("id", project.current_version_id)
      .maybeSingle();

    if (pinnedLookup.error) {
      throw new ProjectVersionApiError(500, pinnedLookup.error.message);
    }
    if (pinnedLookup.data) {
      return pinnedLookup.data as ProjectVersionRow;
    }
  }

  const lookup = await supabase
    .from("project_versions")
    .select(PROJECT_VERSION_SELECT)
    .eq("project_id", input.projectId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lookup.error) {
    throw new ProjectVersionApiError(500, lookup.error.message);
  }

  return (lookup.data as ProjectVersionRow | null) ?? null;
}
