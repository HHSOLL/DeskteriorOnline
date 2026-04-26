"use client";

import type { ProjectAssetSummary } from "../builder/catalog";
import type { SceneDocumentBootstrap } from "../domain/scene-document";
import type { Project } from "../stores/useProjectStore";
import type {
  CameraAnchor,
  Ceiling,
  Floor,
  LightingSettings,
  NavGraph,
  Opening,
  RoomZone,
  ScaleInfo,
  SceneAsset,
  Wall
} from "../stores/useSceneStore";

export type SaveProjectPayload = {
  roomShell: {
    scale: number;
    scaleInfo?: ScaleInfo;
    walls: Wall[];
    openings: Opening[];
    floors: Floor[];
    ceilings: Ceiling[];
    rooms: RoomZone[];
    cameraAnchors: CameraAnchor[];
    navGraph: NavGraph;
    entranceId?: string | null;
  };
  assets: SceneAsset[];
  materials: {
    wallIndex: number;
    floorIndex: number;
    ceilingIndex?: number;
  };
  lighting?: LightingSettings;
  thumbnailDataUrl?: string | null;
  assetSummary?: ProjectAssetSummary | null;
  projectName?: string;
  projectDescription?: string | null;
  message?: string;
};

export type ProjectSceneBootstrapSource = "current_version" | "latest_version" | "none";

export type ProjectSceneBootstrapResponse = {
  source: ProjectSceneBootstrapSource;
  bootstrap: SceneDocumentBootstrap | null;
};

export type CreateStudioProjectInput = {
  name: string;
  description?: string | null;
  scene: SaveProjectPayload;
};

async function requestJson<T>(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers ?? {});
  if (!headers.has("Content-Type") && init.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(path, {
    ...init,
    headers,
    credentials: "include"
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const details = payload && typeof payload === "object" ? (payload as { error?: string }).error : null;
    throw new Error(details || `Request failed (${response.status})`);
  }

  return payload as T;
}

export async function saveProject(id: string, payload: SaveProjectPayload) {
  return requestJson<{ version: unknown }>(`/api/v1/projects/${id}/versions`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function createProjectDraft(payload: {
  name: string;
  description?: string | null;
}) {
  return requestJson<Project>("/api/v1/projects", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function createStudioProject(input: CreateStudioProjectInput) {
  const project = await createProjectDraft({
    name: input.name,
    description: input.description ?? null
  });

  await saveProject(project.id, input.scene);
  return project;
}

export async function fetchLatestProjectVersion(projectId: string) {
  const localPath = `/api/v1/projects/${projectId}/versions/latest`;
  return requestJson<{ version: Record<string, unknown> | null }>(localPath, {
    method: "GET",
    headers: {
      Accept: "application/json"
    },
    cache: "no-store"
  });
}

export async function fetchProjectSceneBootstrap(projectId: string) {
  return requestJson<ProjectSceneBootstrapResponse>(`/api/v1/projects/${projectId}/bootstrap`, {
    method: "GET",
    headers: {
      Accept: "application/json"
    },
    cache: "no-store"
  });
}

export async function fetchProjectVersions(
  projectId: string,
  input: {
    limit?: number;
    cursor?: string | null;
  } = {}
) {
  const query = new URLSearchParams();
  if (typeof input.limit === "number" && Number.isFinite(input.limit)) {
    query.set("limit", String(input.limit));
  }
  if (input.cursor) {
    query.set("cursor", input.cursor);
  }

  const localPath = `/api/v1/projects/${projectId}/versions${query.toString() ? `?${query.toString()}` : ""}`;
  return requestJson<{
    items: Record<string, unknown>[];
    total: number;
    nextCursor: string | null;
  }>(localPath, {
    method: "GET",
    headers: {
      Accept: "application/json"
    },
    cache: "no-store"
  });
}
