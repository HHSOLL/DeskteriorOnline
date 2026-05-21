import { supabaseService } from "../services/supabase";

export type JobRow = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  status: string;
  attempts: number;
  max_attempts: number;
  result?: Record<string, unknown> | null;
};

export async function claimNextJobs(workerId: string, limit: number, type: string): Promise<JobRow[]> {
  const { data, error } = await supabaseService.rpc("claim_jobs", {
    p_worker_id: workerId,
    p_limit: limit,
    p_type: type
  });

  if (error) throw error;
  return (data ?? []) as JobRow[];
}

export async function markJobSucceeded(jobId: string, result: Record<string, unknown> | null = null) {
  const { error } = await supabaseService
    .from("jobs")
    .update({
      status: "succeeded",
      progress: 100,
      result,
      locked_at: null,
      locked_by: null,
      updated_at: new Date().toISOString()
    })
    .eq("id", jobId);

  if (error) throw error;
}

export async function updateJobProgress(jobId: string, progress: number, details?: string | null) {
  const { error } = await supabaseService
    .from("jobs")
    .update({
      progress: Math.max(0, Math.min(100, Math.round(progress))),
      details: details ?? null,
      updated_at: new Date().toISOString()
    })
    .eq("id", jobId);

  if (error) throw error;
}

export async function markJobFailed(jobId: string, payload: {
  errorCode?: string;
  error?: string;
  recoverable?: boolean;
  providerStatus?: unknown[];
  providerErrors?: string[];
  details?: string;
}) {
  const { error } = await supabaseService
    .from("jobs")
    .update({
      status: "failed",
      error_code: payload.errorCode ?? null,
      error: payload.error ?? null,
      recoverable: payload.recoverable ?? null,
      provider_status: payload.providerStatus ?? null,
      provider_errors: payload.providerErrors ?? null,
      details: payload.details ?? null,
      result: null,
      locked_at: null,
      locked_by: null,
      updated_at: new Date().toISOString()
    })
    .eq("id", jobId);

  if (error) throw error;
}

export async function markJobRetrying(jobId: string, attempts: number) {
  const delaySeconds = Math.min(Math.pow(2, attempts) * 5, 900);
  const runAt = new Date(Date.now() + delaySeconds * 1000).toISOString();

  const { error } = await supabaseService
    .from("jobs")
    .update({
      status: "retrying",
      run_at: runAt,
      result: null,
      locked_at: null,
      locked_by: null,
      updated_at: new Date().toISOString()
    })
    .eq("id", jobId);

  if (error) throw error;
}

export async function markJobDeadLetter(jobId: string, errorMessage: string, errorCode = "MAX_RETRIES_EXCEEDED") {
  const { error } = await supabaseService
    .from("jobs")
    .update({
      status: "dead_letter",
      error_code: errorCode,
      error: errorMessage,
      result: null,
      locked_at: null,
      locked_by: null,
      updated_at: new Date().toISOString()
    })
    .eq("id", jobId);

  if (error) throw error;
}
