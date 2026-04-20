import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../../../../types/database";
import { createSupabaseServerClient } from "../supabase/server";
import {
  type ShowcaseActivityEventType,
  type ShowcasePersistedActivity
} from "../showcase/activity";

function createShowcaseActivityReadSupabaseClient(): SupabaseClient<Database> {
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

function createShowcaseActivityWriteSupabaseClient(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase activity tracking env not configured.");
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

export async function fetchShowcaseActivityMap(sharedProjectIds: string[]) {
  const normalizedIds = Array.from(new Set(sharedProjectIds.filter((value) => typeof value === "string" && value.length > 0)));
  const activityById = new Map<string, ShowcasePersistedActivity>();

  if (normalizedIds.length === 0) {
    return activityById;
  }

  for (const id of normalizedIds) {
    activityById.set(id, {
      viewCount: 0,
      productFocusCount: 0,
      lastEventAt: null
    });
  }

  let lookup: {
    data: Array<{
      shared_project_id: string;
      event_type: string;
      created_at: string;
    }> | null;
    error: { message: string } | null;
  } | null = null;
  try {
    const supabase = createShowcaseActivityReadSupabaseClient();
    lookup = await supabase
      .from("shared_project_activity_events")
      .select("shared_project_id, event_type, created_at")
      .in("shared_project_id", normalizedIds);
  } catch {
    return activityById;
  }

  if (lookup.error) {
    return activityById;
  }

  for (const row of lookup.data ?? []) {
    const existing = activityById.get(row.shared_project_id);
    if (!existing) continue;

    if (row.event_type === "view") {
      existing.viewCount += 1;
    } else if (row.event_type === "product_focus") {
      existing.productFocusCount += 1;
    }

    if (!existing.lastEventAt || row.created_at > existing.lastEventAt) {
      existing.lastEventAt = row.created_at;
    }
  }

  return activityById;
}

export async function recordSharedProjectActivityByToken(input: {
  token: string;
  eventType: ShowcaseActivityEventType;
  sessionKey: string;
  source: string | null;
  assetId?: string | null;
}) {
  const normalizedToken = input.token.trim();
  if (!normalizedToken) {
    throw new Error("Token is required.");
  }

  const normalizedSessionKey = input.sessionKey.trim();
  if (!normalizedSessionKey) {
    throw new Error("Session key is required.");
  }

  const normalizedAssetId = input.assetId?.trim() || null;
  if (input.eventType === "product_focus" && !normalizedAssetId) {
    throw new Error("Asset id is required for product_focus events.");
  }

  const supabase = createShowcaseActivityWriteSupabaseClient();
  const shareLookup = await supabase
    .from("shared_projects")
    .select("id, project_id")
    .eq("token", normalizedToken)
    .maybeSingle();

  if (shareLookup.error) {
    throw new Error(shareLookup.error.message);
  }

  const sharedProject = shareLookup.data;
  if (!sharedProject) {
    return { recorded: false, deduped: false } as const;
  }

  const insertResult = await supabase.from("shared_project_activity_events").insert({
    shared_project_id: sharedProject.id,
    project_id: sharedProject.project_id,
    event_type: input.eventType,
    asset_id: normalizedAssetId,
    source: input.source,
    session_key: normalizedSessionKey
  });

  if (!insertResult.error) {
    return { recorded: true, deduped: false } as const;
  }

  if (insertResult.error.code === "23505") {
    return { recorded: false, deduped: true } as const;
  }

  throw new Error(insertResult.error.message);
}
