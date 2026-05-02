import { createHash } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../../../../types/database";
import type { ProjectAssetSummary } from "../builder/catalog";
import { mapProjectVersionToSceneDocument, type SceneDocumentBootstrap } from "../domain/scene-document";
import { normalizeSharePermission, type SharePermission } from "../share/permissions";
import { getSharePreviewMeta, type SharePreviewMeta } from "../share/preview";
import { createSupabaseServerClient } from "../supabase/server";

type PublicSceneProjectRow = Pick<
  Database["public"]["Tables"]["projects"]["Row"],
  "id" | "name" | "description" | "thumbnail_path" | "meta"
>;

type PublicSceneVersionRow = Pick<
  Database["public"]["Tables"]["project_versions"]["Row"],
  "id" | "version" | "message" | "customization"
>;

type PublicSceneShareRow = Pick<
  Database["public"]["Tables"]["shared_projects"]["Row"],
  "id" | "token" | "project_id" | "project_version_id" | "permissions" | "expires_at" | "preview_meta"
> & {
  projects: PublicSceneProjectRow | PublicSceneProjectRow[] | null;
};

type PublicSceneProjectLike = {
  id: string;
  name: string;
  description: string | null;
  thumbnail_path: string | null;
};

type PublicSceneVersionLike = {
  id: string;
  version: number | null;
  message: string | null;
  customization: unknown;
};

type PublicSceneShareLike = {
  id: string;
  token: string;
  project_id: string;
  project_version_id: string;
  permissions: string | null;
  expires_at: string | null;
  preview_meta: unknown;
};

export type PublicScenePayload = {
  shareId: string;
  token: string;
  projectId: string;
  projectVersionId: string;
  linkPermission: SharePermission;
  expiresAt: string | null;
  pinnedVersionNumber: number | null;
  project: {
    id: string;
    name: string;
    description: string | null;
    thumbnailPath: string | null;
  };
  projectName: string;
  projectDescription: string | null;
  previewMeta: SharePreviewMeta | null;
  previewAssetSummary: ProjectAssetSummary | null;
  sceneBootstrap: SceneDocumentBootstrap | null;
  sceneSnapshot: PublicSceneSnapshot | null;
};

export type PublicSceneRuntimeAssetRef = {
  nodeId: string;
  assetId: string;
  catalogItemId: string | null;
  productId: string | null;
  placementMode: string | null;
  scaleLocked: boolean;
};

export type PublicSceneSnapshot = {
  projectVersionId: string;
  pinnedVersionNumber: number | null;
  documentHash: string;
  documentSchemaVersion: 1 | 2;
  nodeCount: number;
  productSnapshotCount: number;
  placementSnapshotCount: number;
  previewAssetCount: number | null;
  runtimeAssetIds: string[];
  runtimeAssetRefs: PublicSceneRuntimeAssetRef[];
};

export class PublicSceneError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function resolveProjectRow(
  value: PublicSceneProjectRow | PublicSceneProjectRow[] | null
): PublicSceneProjectRow | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function resolvePinnedVersionNumber(previewMeta: SharePreviewMeta | null, versionRow: PublicSceneVersionLike) {
  if (typeof previewMeta?.versionNumber === "number") {
    return previewMeta.versionNumber;
  }
  return typeof versionRow.version === "number" ? versionRow.version : null;
}

function isExpired(expiresAt: string | null) {
  if (!expiresAt) return false;
  const expiresAtMs = new Date(expiresAt).getTime();
  if (!Number.isFinite(expiresAtMs)) return false;
  return expiresAtMs < Date.now();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function readBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return false;
}

function createSceneDocumentHash(sceneBootstrap: SceneDocumentBootstrap) {
  return `sha256:${createHash("sha256").update(JSON.stringify(sceneBootstrap.document)).digest("hex")}`;
}

export function buildPublicSceneSnapshot(input: {
  sceneBootstrap: SceneDocumentBootstrap | null;
  projectVersionId: string;
  pinnedVersionNumber: number | null;
  previewAssetSummary: ProjectAssetSummary | null;
}): PublicSceneSnapshot | null {
  const { sceneBootstrap, projectVersionId, pinnedVersionNumber, previewAssetSummary } = input;
  if (!sceneBootstrap) {
    return null;
  }

  const runtimeAssetRefs = sceneBootstrap.document.nodes.map((node) => {
    const metadata = isRecord(node.metadata) ? node.metadata : null;
    const product = isRecord(node.product) ? (node.product as Record<string, unknown>) : null;
    const placement = isRecord(node.placement) ? node.placement : null;
    const catalogItemId = readString(node.catalogItemId) ?? readString(metadata?.catalogItemId);
    const productId = readString(metadata?.productId) ?? readString(product?.id) ?? readString(product?.productId) ?? catalogItemId;

    return {
      nodeId: node.id,
      assetId: node.assetId,
      catalogItemId,
      productId,
      placementMode: readString(placement?.mode) ?? (placement ? "world" : null),
      scaleLocked: readBoolean(metadata?.scaleLocked) || readBoolean(product?.scaleLocked)
    } satisfies PublicSceneRuntimeAssetRef;
  });

  return {
    projectVersionId,
    pinnedVersionNumber,
    documentHash: createSceneDocumentHash(sceneBootstrap),
    documentSchemaVersion: sceneBootstrap.document.schemaVersion,
    nodeCount: sceneBootstrap.document.nodes.length,
    productSnapshotCount: runtimeAssetRefs.filter((ref) => ref.productId !== null).length,
    placementSnapshotCount: runtimeAssetRefs.filter((ref) => ref.placementMode !== null).length,
    previewAssetCount: previewAssetSummary?.totalAssets ?? null,
    runtimeAssetIds: Array.from(new Set(runtimeAssetRefs.map((ref) => ref.assetId))).sort(),
    runtimeAssetRefs
  };
}

function createPublicReadSupabaseClient(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && serviceRoleKey) {
    return createClient<Database>(url, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
  }

  return createSupabaseServerClient();
}

export function buildPublicScenePayload(input: {
  sharedProject: PublicSceneShareLike;
  project: PublicSceneProjectLike;
  versionRow: PublicSceneVersionLike;
}): PublicScenePayload {
  const { sharedProject, project, versionRow } = input;
  const previewMeta = getSharePreviewMeta(sharedProject.preview_meta);
  const sceneBootstrap = mapProjectVersionToSceneDocument(versionRow as unknown as Record<string, unknown>);
  const pinnedVersionNumber = resolvePinnedVersionNumber(previewMeta, versionRow);
  const previewAssetSummary = previewMeta?.assetSummary ?? null;

  return {
    shareId: sharedProject.id,
    token: sharedProject.token,
    projectId: sharedProject.project_id,
    projectVersionId: sharedProject.project_version_id,
    linkPermission: normalizeSharePermission(sharedProject.permissions),
    expiresAt: sharedProject.expires_at,
    pinnedVersionNumber,
    project: {
      id: project.id,
      name: project.name,
      description: project.description,
      thumbnailPath: project.thumbnail_path
    },
    projectName: previewMeta?.projectName ?? project.name,
    projectDescription: previewMeta?.projectDescription ?? project.description,
    previewMeta,
    previewAssetSummary,
    sceneBootstrap,
    sceneSnapshot: buildPublicSceneSnapshot({
      sceneBootstrap,
      projectVersionId: sharedProject.project_version_id,
      pinnedVersionNumber,
      previewAssetSummary
    })
  };
}

export async function fetchPublicSceneByToken(token: string): Promise<PublicScenePayload> {
  const normalizedToken = token.trim();
  if (!normalizedToken) {
    throw new PublicSceneError(400, "Token is required.");
  }

  const supabase = createPublicReadSupabaseClient();
  const shareLookup = await supabase
    .from("shared_projects")
    .select("id, token, project_id, project_version_id, permissions, expires_at, preview_meta, projects(id, name, description, thumbnail_path, meta)")
    .eq("token", normalizedToken)
    .maybeSingle();

  if (shareLookup.error) {
    throw new PublicSceneError(500, shareLookup.error.message);
  }

  const sharedProject = (shareLookup.data ?? null) as PublicSceneShareRow | null;
  const project = resolveProjectRow(sharedProject?.projects ?? null);

  if (!sharedProject || !project) {
    throw new PublicSceneError(404, "Public scene not found.");
  }

  if (isExpired(sharedProject.expires_at)) {
    throw new PublicSceneError(410, "Public scene link has expired.");
  }

  if (!sharedProject.project_version_id) {
    throw new PublicSceneError(404, "Pinned scene version not found.");
  }

  const versionLookup = await supabase
    .from("project_versions")
    .select("id, version, message, customization")
    .eq("id", sharedProject.project_version_id)
    .maybeSingle();

  if (versionLookup.error) {
    throw new PublicSceneError(500, versionLookup.error.message);
  }

  const versionRow = (versionLookup.data ?? null) as PublicSceneVersionRow | null;
  if (!versionRow) {
    throw new PublicSceneError(404, "Pinned scene version not found.");
  }

  return buildPublicScenePayload({
    sharedProject,
    project,
    versionRow
  });
}
