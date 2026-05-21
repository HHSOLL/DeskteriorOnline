import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../../../../types/database";

type JobRow = Pick<
  Database["public"]["Tables"]["jobs"]["Row"],
  | "id"
  | "type"
  | "status"
  | "attempts"
  | "max_attempts"
  | "progress"
  | "error_code"
  | "error"
  | "recoverable"
  | "provider_errors"
  | "provider_status"
  | "details"
  | "result"
  | "payload"
  | "created_at"
  | "updated_at"
>;

export type JobRecord = {
  id: string;
  type: string;
  status: string;
  attempts: number;
  maxAttempts: number;
  progress: number;
  errorCode: string | null;
  error: string | null;
  recoverable?: boolean;
  providerErrors: unknown[];
  providerStatus: unknown[];
  details: string | null;
  result: unknown;
  created_at: string;
  updated_at: string;
};

export class JobApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
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

function toJobRecord(job: JobRow): JobRecord {
  return {
    id: job.id,
    type: job.type,
    status: job.status,
    attempts: job.attempts,
    maxAttempts: job.max_attempts,
    progress: job.progress ?? 0,
    errorCode: job.error_code ?? null,
    error: job.error ?? null,
    recoverable: job.recoverable ?? undefined,
    providerErrors: Array.isArray(job.provider_errors) ? job.provider_errors : [],
    providerStatus: Array.isArray(job.provider_status) ? job.provider_status : [],
    details: job.details ?? null,
    result: job.result ?? null,
    created_at: job.created_at,
    updated_at: job.updated_at
  };
}

function getPayloadOwnerId(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const record = payload as Record<string, unknown>;
  return typeof record.ownerId === "string" ? record.ownerId : null;
}

export async function getJobForOwner(
  userScopedSupabase: SupabaseClient<Database>,
  ownerId: string,
  jobId: string
) {
  const supabase = createPrivilegedSupabaseClient(userScopedSupabase);

  const lookup = await supabase
    .from("jobs")
    .select(
      "id, type, status, attempts, max_attempts, progress, error_code, error, recoverable, provider_errors, provider_status, details, result, payload, created_at, updated_at"
    )
    .eq("id", jobId)
    .maybeSingle();

  if (lookup.error) {
    throw new JobApiError(500, lookup.error.message);
  }
  if (!lookup.data) {
    return null;
  }

  if (lookup.data.type !== "ASSET_GENERATION" && lookup.data.type !== "PRODUCT_ASSET_GENERATION") {
    return null;
  }

  const payloadOwnerId = getPayloadOwnerId(lookup.data.payload);
  if (!payloadOwnerId || payloadOwnerId !== ownerId) {
    return null;
  }

  return toJobRecord(lookup.data);
}
