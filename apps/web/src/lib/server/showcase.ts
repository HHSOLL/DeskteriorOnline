import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSharePreviewMeta } from "../share/preview";
import { compareShowcaseActivityRank } from "../showcase/activity";
import { fetchShowcaseActivityMap } from "./showcase-activity";
import { createSupabaseServerClient } from "../supabase/server";
import type { Database } from "../../../../../types/database";
import {
  getShowcaseSnapshotProfileFromPreviewMeta,
  normalizeShowcaseFilters,
  type ShowcaseDensityFilter,
  type ShowcaseRoomFilter,
  type ShowcaseToneFilter
} from "../api/showcase";

export type ShowcaseSnapshot = {
  id: string;
  token: string;
  project_id: string;
  project_version_id: string | null;
  preview_meta: unknown;
  published_at: string;
  thumbnail?: string;
};

export type ShowcaseSnapshotItem = ShowcaseSnapshot & {
  previewMeta: ReturnType<typeof getSharePreviewMeta>;
  activity: import("../showcase/activity").ShowcasePersistedActivity | null;
};
export type ShowcaseSnapshotFeed = {
  items: ShowcaseSnapshotItem[];
  total: number;
  nextCursor: string | null;
  hasMore: boolean;
};

export type ShowcaseArchiveSummary = {
  matchingTotal: number;
  archiveTotal: number;
  latestPublishedAt: string | null;
  topCollection: { label: string; count: number } | null;
  featuredItem: ShowcaseSnapshotItem | null;
};

type ShowcaseProjectRow = {
  meta: Record<string, unknown> | null;
  thumbnail_path: string | null;
};
type ShowcaseVersionRow = {
  snapshot_path: string | null;
};

type ShowcaseProjectLike = {
  meta: Record<string, unknown> | null;
  thumbnail_path: string | null;
};

type ShowcaseVersionLike = {
  snapshot_path: string | null;
};

type ShowcaseShareLike = {
  id: string;
  token: string;
  project_id: string;
  project_version_id: string | null;
  preview_meta: unknown;
  published_at: string;
};

type ShowcaseRow = {
  id: string;
  token: string;
  project_id: string;
  project_version_id: string | null;
  preview_meta: unknown;
  published_at: string | null;
  updated_at: string;
  projects: ShowcaseProjectRow | ShowcaseProjectRow[] | null;
  project_versions: ShowcaseVersionRow | ShowcaseVersionRow[] | null;
};

type ShowcaseFeedInput = {
  limit?: number;
  cursor?: string | null;
  totalHint?: number | null;
  room?: ShowcaseRoomFilter | null;
  tone?: ShowcaseToneFilter | null;
  density?: ShowcaseDensityFilter | null;
};

type ShowcaseCursorPayload = {
  publishedAt: string;
  id: string;
};

type ShowcaseBatchRow = ShowcaseRow & {
  published_at: string;
};

function clampLimit(limit: number) {
  return Math.min(Math.max(limit, 1), 240);
}

function resolveThumbnailBucket(metadata: Record<string, unknown> | null) {
  if (metadata && typeof metadata.thumbnailBucket === "string" && metadata.thumbnailBucket.length > 0) {
    return metadata.thumbnailBucket;
  }
  return process.env.PROJECT_MEDIA_BUCKET ?? process.env.NEXT_PUBLIC_PROJECT_MEDIA_BUCKET ?? "project-media";
}

function createShowcaseReadSupabaseClient(): SupabaseClient<Database> {
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

async function resolveProjectThumbnail(thumbnailPath: string | null, metadata: Record<string, unknown> | null) {
  if (!thumbnailPath) return undefined;

  const supabase = createShowcaseReadSupabaseClient();
  const signed = await supabase.storage
    .from(resolveThumbnailBucket(metadata))
    .createSignedUrl(thumbnailPath, 60 * 60);

  if (signed.error || !signed.data?.signedUrl) {
    return undefined;
  }

  return signed.data.signedUrl;
}

export function resolveShowcaseThumbnailSource(
  project: ShowcaseProjectLike | null,
  versionRow: ShowcaseVersionLike | null
) {
  return versionRow?.snapshot_path ?? project?.thumbnail_path ?? null;
}

export function buildShowcaseSnapshotItem(input: {
  sharedProject: ShowcaseShareLike;
  thumbnail?: string;
  activity?: import("../showcase/activity").ShowcasePersistedActivity | null;
}): ShowcaseSnapshotItem {
  const { sharedProject, thumbnail, activity } = input;
  return {
    id: sharedProject.id,
    token: sharedProject.token,
    project_id: sharedProject.project_id,
    project_version_id: sharedProject.project_version_id,
    preview_meta: sharedProject.preview_meta,
    published_at: sharedProject.published_at,
    thumbnail,
    previewMeta: getSharePreviewMeta(sharedProject.preview_meta),
    activity: activity ?? null
  };
}

function resolveProjectRow(value: ShowcaseProjectRow | ShowcaseProjectRow[] | null) {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function resolveVersionRow(value: ShowcaseVersionRow | ShowcaseVersionRow[] | null) {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function hasActiveFilters(input: ReturnType<typeof normalizeShowcaseFilters>) {
  return input.room !== "all" || input.tone !== "all" || input.density !== "all";
}

function encodeCursor(payload: ShowcaseCursorPayload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeCursor(cursor: string | null | undefined): ShowcaseCursorPayload | null | "invalid" {
  if (!cursor) return null;

  try {
    const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as Partial<ShowcaseCursorPayload>;
    if (typeof decoded.publishedAt !== "string" || typeof decoded.id !== "string") {
      return "invalid";
    }
    if (!decoded.publishedAt || !decoded.id) {
      return "invalid";
    }
    const parsedDate = new Date(decoded.publishedAt);
    if (Number.isNaN(parsedDate.getTime())) {
      return "invalid";
    }
    return {
      publishedAt: parsedDate.toISOString(),
      id: decoded.id
    };
  } catch {
    return "invalid";
  }
}

function getItemCursor(row: Pick<ShowcaseBatchRow, "published_at" | "id">) {
  const parsedDate = new Date(row.published_at);
  return {
    publishedAt: Number.isNaN(parsedDate.getTime()) ? row.published_at : parsedDate.toISOString(),
    id: row.id
  } satisfies ShowcaseCursorPayload;
}

function matchesFilters(row: ShowcaseRow, filters: ReturnType<typeof normalizeShowcaseFilters>) {
  if (!hasActiveFilters(filters)) {
    return true;
  }

  const profile = getShowcaseSnapshotProfileFromPreviewMeta(getSharePreviewMeta(row.preview_meta));
  if (filters.room !== "all" && profile.room !== filters.room) {
    return false;
  }
  if (filters.tone !== "all" && profile.tone !== filters.tone) {
    return false;
  }
  if (filters.density !== "all" && profile.density !== filters.density) {
    return false;
  }
  return true;
}

function buildBaseShowcaseQuery() {
  const supabase = createShowcaseReadSupabaseClient();
  return supabase
    .from("shared_projects")
    .select(
      "id, token, project_id, project_version_id, preview_meta, published_at, updated_at, projects!inner(meta, thumbnail_path), project_versions(snapshot_path)"
    )
    .eq("is_gallery_visible", true)
    .eq("permissions", "view")
    .is("expires_at", null)
    .not("project_version_id", "is", null)
    .not("published_at", "is", null)
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("id", { ascending: false });
}

function applyCursor<T extends ReturnType<typeof buildBaseShowcaseQuery>>(
  query: T,
  cursor: ShowcaseCursorPayload | null
) {
  if (!cursor) {
    return query;
  }

  return query.or(`published_at.lt.${cursor.publishedAt},and(published_at.eq.${cursor.publishedAt},id.lt.${cursor.id})`);
}

async function countAllShowcaseRows() {
  const supabase = createShowcaseReadSupabaseClient();
  const lookup = await supabase
    .from("shared_projects")
    .select("id", { count: "exact", head: true })
    .eq("is_gallery_visible", true)
    .eq("permissions", "view")
    .is("expires_at", null)
    .not("project_version_id", "is", null)
    .not("published_at", "is", null);

  if (lookup.error) {
    throw new Error(lookup.error.message);
  }

  return lookup.count ?? 0;
}

async function fetchShowcaseBatch(cursor: ShowcaseCursorPayload | null, limit: number): Promise<ShowcaseBatchRow[]> {
  const lookup = await applyCursor(buildBaseShowcaseQuery(), cursor).limit(limit);

  if (lookup.error) {
    throw new Error(lookup.error.message);
  }

  return (lookup.data ?? []) as ShowcaseBatchRow[];
}

async function collectFilteredPageRows(
  filters: ReturnType<typeof normalizeShowcaseFilters>,
  cursor: ShowcaseCursorPayload | null,
  limit: number
) {
  const matches: ShowcaseBatchRow[] = [];
  let batchCursor = cursor;
  const batchSize = Math.max(Math.min(limit * 3, 120), 60);

  while (matches.length < limit + 1) {
    const batch = await fetchShowcaseBatch(batchCursor, batchSize);
    if (batch.length === 0) {
      break;
    }

    for (const row of batch) {
      if (matchesFilters(row, filters)) {
        matches.push(row);
        if (matches.length >= limit + 1) {
          break;
        }
      }
    }

    if (batch.length < batchSize) {
      break;
    }

    batchCursor = getItemCursor(batch[batch.length - 1]);
  }

  return matches;
}

async function scanShowcaseArchiveSummary(filters: ReturnType<typeof normalizeShowcaseFilters>) {
  let matchingTotal = 0;
  let batchCursor: ShowcaseCursorPayload | null = null;
  let featuredRow: ShowcaseBatchRow | null = null;
  let featuredActivity: import("../showcase/activity").ShowcasePersistedActivity | null = null;
  let latestPublishedAt: string | null = null;
  const collectionCounts = new Map<string, number>();
  const batchSize = 120;

  while (true) {
    const batch = await fetchShowcaseBatch(batchCursor, batchSize);
    if (batch.length === 0) {
      break;
    }
    const matchingRows: ShowcaseBatchRow[] = [];

    for (const row of batch) {
      if (!matchesFilters(row, filters)) {
        continue;
      }
      matchingRows.push(row);
    }

    const activityMap = await fetchShowcaseActivityMap(matchingRows.map((row) => row.id));

    for (const row of matchingRows) {
      const rowActivity = activityMap.get(row.id) ?? null;

      matchingTotal += 1;
      latestPublishedAt ??= row.published_at;
      if (
        !featuredRow ||
        compareShowcaseActivityRank(
          {
            id: row.id,
            published_at: row.published_at,
            previewMeta: getSharePreviewMeta(row.preview_meta),
            activity: rowActivity
          },
          {
            id: featuredRow.id,
            published_at: featuredRow.published_at,
            previewMeta: getSharePreviewMeta(featuredRow.preview_meta),
            activity: featuredActivity
          }
        ) < 0
      ) {
        featuredRow = row;
        featuredActivity = rowActivity;
      }

      const assetSummary = getSharePreviewMeta(row.preview_meta)?.assetSummary;
      for (const collection of assetSummary?.collections ?? []) {
        collectionCounts.set(collection.label, (collectionCounts.get(collection.label) ?? 0) + collection.count);
      }
    }

    if (batch.length < batchSize) {
      break;
    }

    batchCursor = getItemCursor(batch[batch.length - 1]);
  }

  const topCollection =
    Array.from(collectionCounts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))[0] ?? null;
  const featuredItem = featuredRow
    ? (
        await mapShowcaseRows(
          [featuredRow],
          new Map([
            [
              featuredRow.id,
              featuredActivity ?? {
                viewCount: 0,
                productFocusCount: 0,
                lastEventAt: null
              }
            ]
          ])
        )
      )[0] ?? null
    : null;

  return {
    matchingTotal,
    latestPublishedAt,
    topCollection,
    featuredItem
  };
}

async function mapShowcaseRows(
  rows: ShowcaseBatchRow[],
  activityMap?: Map<string, import("../showcase/activity").ShowcasePersistedActivity>
) {
  const resolvedActivityMap =
    activityMap ?? (await fetchShowcaseActivityMap(rows.map((row) => row.id)));

  return Promise.all(
    rows.map(async (item) => {
      const project = resolveProjectRow(item.projects);
      const version = resolveVersionRow(item.project_versions);
      const thumbnail = await resolveProjectThumbnail(resolveShowcaseThumbnailSource(project, version), project?.meta ?? null);

      return buildShowcaseSnapshotItem({
        sharedProject: item,
        thumbnail,
        activity: resolvedActivityMap.get(item.id) ?? null
      });
    })
  );
}

function resolveFeedInput(input: number | ShowcaseFeedInput) {
  if (typeof input === "number") {
    return {
      limit: input,
      cursor: null,
      totalHint: null,
      room: "all" as const,
      tone: "all" as const,
      density: "all" as const
    };
  }

    return {
      limit: input.limit ?? 24,
      cursor: input.cursor ?? null,
      totalHint: input.totalHint ?? null,
      room: input.room ?? "all",
      tone: input.tone ?? "all",
      density: input.density ?? "all"
    };
}

function normalizeTotalHint(totalHint: number | null) {
  if (typeof totalHint !== "number") return null;
  if (!Number.isFinite(totalHint) || totalHint < 0) return null;
  return Math.trunc(totalHint);
}

export async function fetchShowcaseSnapshotFeed(input: number | ShowcaseFeedInput = 24): Promise<ShowcaseSnapshotFeed> {
  const resolved = resolveFeedInput(input);
  const normalizedLimit = clampLimit(resolved.limit);
  const filters = normalizeShowcaseFilters({
    room: resolved.room,
    tone: resolved.tone,
    density: resolved.density
  });
  const decodedCursor = decodeCursor(resolved.cursor);
  if (decodedCursor === "invalid") {
    throw new Error("Invalid showcase cursor.");
  }
  const cursor = decodedCursor;

  const hintedTotal = normalizeTotalHint(resolved.totalHint);
  const total = hintedTotal ?? (await countAllShowcaseRows());

  if (!hasActiveFilters(filters)) {
    const batch = await fetchShowcaseBatch(cursor, normalizedLimit + 1);
    const pageRows = batch.slice(0, normalizedLimit);
    const items = await mapShowcaseRows(pageRows);
    const hasMore = batch.length > normalizedLimit;
    const nextCursor = hasMore && pageRows.length > 0 ? encodeCursor(getItemCursor(pageRows[pageRows.length - 1])) : null;

    return {
      items,
      total,
      nextCursor,
      hasMore
    };
  }

  const filteredRows = await collectFilteredPageRows(filters, cursor, normalizedLimit);
  const pageRows = filteredRows.slice(0, normalizedLimit);
  const items = await mapShowcaseRows(pageRows);
  const hasMore = filteredRows.length > normalizedLimit;
  const nextCursor = hasMore && pageRows.length > 0 ? encodeCursor(getItemCursor(pageRows[pageRows.length - 1])) : null;

  return {
    items,
    total,
    nextCursor,
    hasMore
  };
}

export async function fetchShowcaseArchiveSummary(
  input: Pick<ShowcaseFeedInput, "room" | "tone" | "density"> = {}
): Promise<ShowcaseArchiveSummary> {
  const filters = normalizeShowcaseFilters({
    room: input.room,
    tone: input.tone,
    density: input.density
  });
  const summary = await scanShowcaseArchiveSummary(filters);
  const archiveTotal = hasActiveFilters(filters) ? await countAllShowcaseRows() : summary.matchingTotal;

  return {
    matchingTotal: summary.matchingTotal,
    archiveTotal,
    latestPublishedAt: summary.latestPublishedAt,
    topCollection: summary.topCollection,
    featuredItem: summary.featuredItem
  };
}

export async function fetchShowcaseSnapshots(limit = 24): Promise<ShowcaseSnapshotItem[]> {
  const feed = await fetchShowcaseSnapshotFeed(limit);
  return feed.items;
}

function toShowcaseErrorMessage(_error: unknown) {
  return "Showcase feed is unavailable right now.";
}

export async function fetchShowcaseSnapshotResultServer(limit = 24): Promise<{
  items: ShowcaseSnapshotItem[];
  total: number;
  nextCursor: string | null;
  hasMore: boolean;
  error: string | null;
}> {
  try {
    const feed = await fetchShowcaseSnapshotFeed(limit);
    return {
      items: feed.items,
      total: feed.total,
      nextCursor: feed.nextCursor,
      hasMore: feed.hasMore,
      error: null
    };
  } catch (error) {
    return {
      items: [],
      total: 0,
      nextCursor: null,
      hasMore: false,
      error: toShowcaseErrorMessage(error)
    };
  }
}
