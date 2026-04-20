import { getSharePreviewMeta } from "../share/preview";
import type { ShowcasePersistedActivity } from "../showcase/activity";

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
  activity: ShowcasePersistedActivity | null;
};

export type ShowcaseRoomFilter = "all" | "living" | "workspace" | "bedroom" | "flex";
export type ShowcaseToneFilter = "all" | "sand" | "olive" | "slate" | "ember";
export type ShowcaseDensityFilter = "all" | "minimal" | "layered" | "collected";

export type ShowcaseFilters = {
  room: ShowcaseRoomFilter;
  tone: ShowcaseToneFilter;
  density: ShowcaseDensityFilter;
};

export type ShowcaseSnapshotProfile = {
  room: Exclude<ShowcaseRoomFilter, "all">;
  tone: Exclude<ShowcaseToneFilter, "all">;
  density: Exclude<ShowcaseDensityFilter, "all">;
  totalAssets: number;
  collectionCount: number;
};

export type ShowcaseSnapshotWithProfile = ShowcaseSnapshotItem & {
  showcaseProfile: ShowcaseSnapshotProfile;
};

type ShowcaseFetchOptions = {
  limit?: number;
  cursor?: string | null;
  totalHint?: number | null;
  room?: ShowcaseRoomFilter | null;
  tone?: ShowcaseToneFilter | null;
  density?: ShowcaseDensityFilter | null;
  baseUrl?: string;
  requestInit?: RequestInit;
};
export type ShowcaseFeedResult = {
  items: ShowcaseSnapshotItem[];
  total: number;
  nextCursor: string | null;
  hasMore: boolean;
};

function clampLimit(limit: number) {
  return Math.min(Math.max(limit, 1), 240);
}

function resolveFetchOptions(input: number | ShowcaseFetchOptions) {
  if (typeof input === "number") {
    return {
      limit: input,
      cursor: undefined,
      totalHint: undefined,
      room: undefined,
      tone: undefined,
      density: undefined,
      baseUrl: undefined,
      requestInit: undefined
    };
  }

  return {
    limit: input.limit ?? 24,
    cursor: input.cursor,
    totalHint: input.totalHint,
    room: input.room,
    tone: input.tone,
    density: input.density,
    baseUrl: input.baseUrl,
    requestInit: input.requestInit
  };
}

function buildShowcaseUrl(
  limit: number,
  options: Pick<ShowcaseFetchOptions, "baseUrl" | "cursor" | "totalHint" | "room" | "tone" | "density">
) {
  const searchParams = new URLSearchParams();
  searchParams.set("limit", String(clampLimit(limit)));
  if (options.cursor) searchParams.set("cursor", options.cursor);
  if (typeof options.totalHint === "number" && Number.isFinite(options.totalHint) && options.totalHint >= 0) {
    searchParams.set("total", String(Math.trunc(options.totalHint)));
  }
  if (options.room && options.room !== "all") searchParams.set("room", options.room);
  if (options.tone && options.tone !== "all") searchParams.set("tone", options.tone);
  if (options.density && options.density !== "all") searchParams.set("density", options.density);

  const path = `/api/v1/showcase?${searchParams.toString()}`;
  if (!options.baseUrl) return path;
  return new URL(path, options.baseUrl).toString();
}

export async function fetchShowcaseSnapshots(
  input: number | ShowcaseFetchOptions = 24
): Promise<ShowcaseFeedResult> {
  const { limit, cursor, totalHint, room, tone, density, baseUrl, requestInit } = resolveFetchOptions(input);
  const response = await fetch(buildShowcaseUrl(limit, { baseUrl, cursor, totalHint, room, tone, density }), {
    cache: "force-cache",
    credentials: "include",
    ...requestInit
  });

  const payload = (await response.json().catch(() => null)) as
    | {
        items?: Array<ShowcaseSnapshot & { activity?: ShowcasePersistedActivity | null }>;
        total?: number;
        nextCursor?: string | null;
        hasMore?: boolean;
      }
    | null;

  if (!response.ok) {
    throw new Error(`Showcase request failed (${response.status})`);
  }

  const items = (payload?.items ?? []).map((item) => ({
    ...item,
    previewMeta: getSharePreviewMeta(item.preview_meta),
    activity: item.activity ?? null
  }));
  const total = typeof payload?.total === "number" && Number.isFinite(payload.total) ? payload.total : items.length;
  const nextCursor = typeof payload?.nextCursor === "string" && payload.nextCursor.length > 0 ? payload.nextCursor : null;
  const hasMore = payload?.hasMore === true;
  return { items, total, nextCursor, hasMore };
}

export function isShowcaseRoomFilter(value: string | null | undefined): value is ShowcaseRoomFilter {
  return value === "all" || value === "living" || value === "workspace" || value === "bedroom" || value === "flex";
}

export function isShowcaseToneFilter(value: string | null | undefined): value is ShowcaseToneFilter {
  return value === "all" || value === "sand" || value === "olive" || value === "slate" || value === "ember";
}

export function isShowcaseDensityFilter(value: string | null | undefined): value is ShowcaseDensityFilter {
  return value === "all" || value === "minimal" || value === "layered" || value === "collected";
}

export function normalizeShowcaseFilters(input: {
  room?: string | null;
  tone?: string | null;
  density?: string | null;
}): ShowcaseFilters {
  return {
    room: isShowcaseRoomFilter(input.room) ? input.room : "all",
    tone: isShowcaseToneFilter(input.tone) ? input.tone : "all",
    density: isShowcaseDensityFilter(input.density) ? input.density : "all"
  };
}

function keywordScore(text: string, keywords: string[]) {
  return keywords.reduce((score, keyword) => score + (text.includes(keyword) ? 1 : 0), 0);
}

export function getShowcaseSnapshotProfileFromPreviewMeta(
  previewMeta: ReturnType<typeof getSharePreviewMeta>
): ShowcaseSnapshotProfile {
  const summary = previewMeta?.assetSummary;
  const totalAssets = summary?.totalAssets ?? 0;
  const collectionCount = summary?.collections.length ?? 0;
  const searchableText = [
    previewMeta?.projectName,
    previewMeta?.projectDescription,
    ...(summary?.highlightedItems.flatMap((item) => [item.label, item.category, item.collection]) ?? []),
    ...(summary?.collections.map((collection) => collection.label) ?? [])
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ")
    .toLowerCase();

  const livingScore = keywordScore(searchableText, [
    "living",
    "lounge",
    "sofa",
    "coffee table",
    "media",
    "tv",
    "armchair"
  ]);
  const workspaceScore = keywordScore(searchableText, [
    "workspace",
    "office",
    "desk",
    "monitor",
    "keyboard",
    "studio",
    "task chair"
  ]);
  const bedroomScore = keywordScore(searchableText, [
    "bedroom",
    "bed",
    "nightstand",
    "wardrobe",
    "dresser",
    "sleep"
  ]);

  let room: ShowcaseSnapshotProfile["room"] = "flex";
  if (bedroomScore > livingScore && bedroomScore > workspaceScore) {
    room = "bedroom";
  } else if (workspaceScore > livingScore && workspaceScore > 0) {
    room = "workspace";
  } else if (livingScore > 0) {
    room = "living";
  }

  let density: ShowcaseSnapshotProfile["density"] = "minimal";
  if (totalAssets >= 7) {
    density = "collected";
  } else if (totalAssets >= 4) {
    density = "layered";
  }

  return {
    room,
    tone: summary?.primaryTone ?? "sand",
    density,
    totalAssets,
    collectionCount
  };
}

export function getShowcaseSnapshotProfile(snapshot: ShowcaseSnapshotItem): ShowcaseSnapshotProfile {
  return getShowcaseSnapshotProfileFromPreviewMeta(snapshot.previewMeta);
}

export function filterShowcaseSnapshots(
  snapshots: ShowcaseSnapshotItem[],
  filters: Partial<ShowcaseFilters>
): ShowcaseSnapshotWithProfile[] {
  const normalized = normalizeShowcaseFilters(filters);

  return snapshots
    .map((snapshot) => ({
      ...snapshot,
      showcaseProfile: getShowcaseSnapshotProfile(snapshot)
    }))
    .filter((snapshot) => {
      if (normalized.room !== "all" && snapshot.showcaseProfile.room !== normalized.room) {
        return false;
      }
      if (normalized.tone !== "all" && snapshot.showcaseProfile.tone !== normalized.tone) {
        return false;
      }
      if (normalized.density !== "all" && snapshot.showcaseProfile.density !== normalized.density) {
        return false;
      }
      return true;
    });
}

function toShowcaseErrorMessage(error: unknown) {
  return "Showcase feed is unavailable right now.";
}

export async function fetchShowcaseSnapshotResult(
  input: number | ShowcaseFetchOptions = 24
): Promise<{
  items: ShowcaseSnapshotItem[];
  total: number;
  nextCursor: string | null;
  hasMore: boolean;
  error: string | null;
}> {
  try {
    const feed = await fetchShowcaseSnapshots(input);
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
