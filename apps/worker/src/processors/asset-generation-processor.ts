import { createGeneratedAsset } from "../repositories/assets-repo";
import {
  markJobDeadLetter,
  markJobFailed,
  markJobRetrying,
  markJobSucceeded,
  type JobRow
} from "../repositories/jobs-repo";
import { env } from "../config/env";

export type AssetProviderKey = "triposr" | "meshy";

export type AssetProviderConfig = {
  key: AssetProviderKey;
  apiUrl?: string;
  apiKey?: string;
  statusUrl?: string;
};

class AssetProviderRequestError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = "AssetProviderRequestError";
    this.status = status;
  }
}

class AssetProviderBudgetError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "AssetProviderBudgetError";
    this.code = code;
  }
}

const ASSET_PROVIDERS: AssetProviderConfig[] = [
  {
    key: "triposr",
    apiUrl: env.TRIPOSR_API_URL,
    apiKey: env.TRIPOSR_API_KEY,
    statusUrl: env.TRIPOSR_STATUS_URL
  },
  {
    key: "meshy",
    apiUrl: env.MESHY_API_URL,
    apiKey: env.MESHY_API_KEY,
    statusUrl: env.MESHY_STATUS_URL
  }
];

type MeshyBudgetPolicy = "required" | "optional";

type MeshyBudgetGuardInput = {
  policy?: MeshyBudgetPolicy;
  remainingBudget?: number;
  reserveBudget?: number;
  costPerTask?: number;
  maxBudgetPerJob?: number;
  reservedBudget?: number;
  requestCount?: number;
  attemptsPerRequest?: number;
};

type MeshyBudgetGuardStatus = {
  allowed: boolean;
  configured: boolean;
  reason: "MESHY_BUDGET_UNCONFIGURED" | "MESHY_JOB_BUDGET_EXCEEDED" | "MESHY_BUDGET_EXCEEDED" | null;
  estimatedBudgetUse: number;
  availableBudget: number | null;
};

let reservedMeshyBudget = 0;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function evaluateMeshyBudgetGuard(input: MeshyBudgetGuardInput): MeshyBudgetGuardStatus {
  const policy = input.policy ?? "required";
  const hasBudgetConfig =
    input.remainingBudget !== undefined || input.costPerTask !== undefined || input.maxBudgetPerJob !== undefined;
  if (policy === "optional" && !hasBudgetConfig) {
    return {
      allowed: true,
      configured: false,
      reason: null,
      estimatedBudgetUse: 0,
      availableBudget: null
    };
  }

  if (input.remainingBudget === undefined || input.costPerTask === undefined) {
    return {
      allowed: false,
      configured: false,
      reason: "MESHY_BUDGET_UNCONFIGURED",
      estimatedBudgetUse: 0,
      availableBudget: null
    };
  }

  const requestCount = Math.max(1, Math.floor(input.requestCount ?? 1));
  const attemptsPerRequest = Math.max(1, Math.floor(input.attemptsPerRequest ?? 1));
  const estimatedBudgetUse = requestCount * attemptsPerRequest * input.costPerTask;
  const availableBudget = input.remainingBudget - (input.reserveBudget ?? 0) - (input.reservedBudget ?? 0);

  if (input.maxBudgetPerJob !== undefined && estimatedBudgetUse > input.maxBudgetPerJob) {
    return {
      allowed: false,
      configured: true,
      reason: "MESHY_JOB_BUDGET_EXCEEDED",
      estimatedBudgetUse,
      availableBudget
    };
  }

  if (estimatedBudgetUse > availableBudget) {
    return {
      allowed: false,
      configured: true,
      reason: "MESHY_BUDGET_EXCEEDED",
      estimatedBudgetUse,
      availableBudget
    };
  }

  return {
    allowed: true,
    configured: true,
    reason: null,
    estimatedBudgetUse,
    availableBudget
  };
}

export function isAssetProviderBudgetError(error: unknown) {
  return error instanceof AssetProviderBudgetError;
}

function reserveAssetProviderBudget(provider: AssetProviderConfig, requestCount = 1, attemptsPerRequest = 1) {
  if (provider.key !== "meshy") return null;

  const status = evaluateMeshyBudgetGuard({
    policy: env.MESHY_BUDGET_MODE,
    remainingBudget: env.MESHY_BUDGET_REMAINING,
    reserveBudget: env.MESHY_BUDGET_RESERVE,
    costPerTask: env.MESHY_BUDGET_COST_PER_TASK,
    maxBudgetPerJob: env.MESHY_MAX_BUDGET_PER_JOB,
    reservedBudget: reservedMeshyBudget,
    requestCount,
    attemptsPerRequest
  });

  if (!status.allowed) {
    const details =
      status.availableBudget === null
        ? "Set MESHY_BUDGET_REMAINING and MESHY_BUDGET_COST_PER_TASK before enabling Meshy, or set MESHY_BUDGET_MODE=optional only when an external account-level limit is already enforced."
        : `Estimated ${status.estimatedBudgetUse} token/credit units with ${Math.max(
            0,
            status.availableBudget
          )} available after reserve.`;
    throw new AssetProviderBudgetError(
      status.reason ?? "MESHY_BUDGET_BLOCKED",
      `${status.reason ?? "MESHY_BUDGET_BLOCKED"}: ${details}`
    );
  }

  reservedMeshyBudget += status.estimatedBudgetUse;
  return status;
}

export function isRetryableAssetProviderError(error: unknown) {
  if (error instanceof AssetProviderRequestError) {
    return (
      error.status === null ||
      error.status === 408 ||
      error.status === 409 ||
      error.status === 425 ||
      error.status === 429 ||
      error.status === 500 ||
      error.status === 502 ||
      error.status === 503 ||
      error.status === 504
    );
  }
  if (error instanceof TypeError) return true;
  if (!(error instanceof Error)) return false;
  return /timed out|timeout|network|ECONNRESET|ETIMEDOUT|fetch failed/i.test(error.message);
}

export async function withAssetProviderRetry<T>(
  operation: (attempt: number) => Promise<T>,
  options?: { maxAttempts?: number; baseDelayMs?: number }
) {
  const maxAttempts = Math.max(1, Math.min(5, options?.maxAttempts ?? env.ASSET_GENERATION_PROVIDER_MAX_ATTEMPTS));
  const baseDelayMs = Math.max(0, options?.baseDelayMs ?? env.ASSET_GENERATION_PROVIDER_RETRY_BASE_MS);
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts || !isRetryableAssetProviderError(error)) {
        throw error;
      }
      await delay(baseDelayMs * Math.pow(2, attempt - 1));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function extractValue<T = unknown>(data: unknown, path: string): T | null {
  if (!data || typeof data !== "object") return null;
  const parts = path.split(".");
  let current: any = data;
  for (const part of parts) {
    if (!current || typeof current !== "object" || !(part in current)) return null;
    current = current[part];
  }
  return current as T;
}

export function extractAssetProviderModelUrl(data: unknown) {
  const candidates = [
    "model_url",
    "glb_url",
    "gltf_url",
    "output_url",
    "url",
    "model_urls.glb",
    "model_urls.pre_remeshed_glb",
    "result.model_url",
    "result.glb_url",
    "result.url",
    "result.model_urls.glb",
    "result.model_urls.pre_remeshed_glb",
    "data.model_url",
    "data.url",
    "data.model_urls.glb",
    "data.model_urls.pre_remeshed_glb"
  ];
  for (const path of candidates) {
    const value = extractValue<string>(data, path);
    if (value && typeof value === "string") return value;
  }
  return null;
}

export function extractAssetProviderJobId(data: unknown) {
  const candidates = ["job_id", "task_id", "id", "result", "result.id", "data.id", "data.task_id"];
  for (const path of candidates) {
    const value = extractValue<string>(data, path);
    if (value && typeof value === "string") return value;
  }
  return null;
}

function parsePayload(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const record = payload as Record<string, unknown>;
  const ownerId = typeof record.ownerId === "string" ? record.ownerId : null;
  const image = typeof record.image === "string" ? record.image : null;
  const fileName = typeof record.fileName === "string" ? record.fileName : "generated-asset";
  const provider: AssetProviderKey | null =
    record.provider === "triposr" || record.provider === "meshy" ? record.provider : null;

  if (!ownerId || !image) return null;
  return { ownerId, image, fileName, provider };
}

export function getAssetProvider(preferred?: AssetProviderKey | null) {
  const preferredProvider = preferred ? ASSET_PROVIDERS.find((provider) => provider.key === preferred) : null;
  if (preferredProvider?.apiUrl && preferredProvider.apiKey) return preferredProvider;
  return ASSET_PROVIDERS.find((provider) => provider.apiUrl && provider.apiKey) ?? null;
}

export function getConfiguredAssetProviders(preferred?: AssetProviderKey | "both" | null) {
  if (preferred === "both") {
    return ASSET_PROVIDERS.filter((provider) => provider.apiUrl && provider.apiKey);
  }
  const provider = getAssetProvider(preferred ?? null);
  return provider ? [provider] : [];
}

function buildProviderRequestPayload(provider: AssetProviderConfig, image: string, prompt?: string | null) {
  const trimmedPrompt = prompt?.trim().slice(0, 600) || undefined;
  if (provider.key === "meshy") {
    return {
      image_url: image,
      enable_pbr: true,
      should_remesh: true,
      target_polycount: 100000,
      should_texture: true,
      target_formats: ["glb"],
      texture_prompt: trimmedPrompt
    };
  }

  return {
    image,
    image_url: image,
    output: "glb",
    texture: true,
    pbr: true,
    texture_alignment: "original_image",
    prompt: trimmedPrompt
  };
}

async function requestProviderGeneration(provider: AssetProviderConfig, image: string, prompt?: string | null) {
  const response = await fetch(provider.apiUrl!, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(buildProviderRequestPayload(provider, image, prompt))
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new AssetProviderRequestError(
      data && typeof data === "object" && "error" in data && typeof data.error === "string"
        ? data.error
        : `Asset provider request failed (${response.status}).`,
      response.status
    );
  }

  return data;
}

async function pollProviderResult(provider: AssetProviderConfig, externalJobId: string) {
  if (!provider.statusUrl) {
    throw new Error(`Provider ${provider.key} did not return a model URL and has no status URL configured.`);
  }

  for (let attempt = 0; attempt < env.ASSET_GENERATION_MAX_POLLS; attempt += 1) {
    const resolvedUrl = provider.statusUrl.includes("{id}")
      ? provider.statusUrl.replace("{id}", externalJobId)
      : `${provider.statusUrl.replace(/\/$/, "")}/${externalJobId}`;
    const response = await fetch(resolvedUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        "Content-Type": "application/json"
      },
      cache: "no-store"
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new AssetProviderRequestError(
        data && typeof data === "object" && "error" in data && typeof data.error === "string"
          ? data.error
          : `Asset provider polling failed (${response.status}).`,
        response.status
      );
    }

    const modelUrl = extractAssetProviderModelUrl(data);
    if (modelUrl) return modelUrl;

    await delay(env.ASSET_GENERATION_POLL_INTERVAL_MS);
  }

  throw new AssetProviderRequestError("Asset generation timed out while waiting for provider result.");
}

export async function resolveAssetProviderModelUrl(provider: AssetProviderConfig, image: string, prompt?: string | null) {
  reserveAssetProviderBudget(provider, 1, env.ASSET_GENERATION_PROVIDER_MAX_ATTEMPTS);
  return withAssetProviderRetry(async () => {
    const initial = await requestProviderGeneration(provider, image, prompt);
    const directUrl = extractAssetProviderModelUrl(initial);
    if (directUrl) return directUrl;

    const externalJobId = extractAssetProviderJobId(initial);
    if (!externalJobId) {
      throw new Error("Provider did not return a model URL or job ID.");
    }

    return pollProviderResult(provider, externalJobId);
  });
}

export async function processAssetGenerationJob(job: JobRow) {
  const payload = parsePayload(job.payload);
  if (!payload) {
    await markJobDeadLetter(job.id, "Invalid asset generation payload.", "INVALID_ASSET_JOB_PAYLOAD");
    return;
  }

  const provider = getAssetProvider(payload.provider);
  if (!provider) {
    await markJobFailed(job.id, {
      errorCode: "PROVIDER_NOT_CONFIGURED",
      error: "No asset generation provider configured.",
      recoverable: false,
      details: "Configure TRIPOSR or Meshy environment variables on the worker."
    });
    return;
  }

  try {
    const modelUrl = await resolveAssetProviderModelUrl(provider, payload.image);
    const modelResponse = await fetch(modelUrl, { cache: "no-store" });
    if (!modelResponse.ok) {
      throw new Error(`Failed to download generated asset (${modelResponse.status}).`);
    }

    const buffer = await modelResponse.arrayBuffer();
    const asset = await createGeneratedAsset({
      ownerId: payload.ownerId,
      fileName: payload.fileName,
      provider: provider.key,
      buffer
    });

    await markJobSucceeded(job.id, {
      asset,
      provider: provider.key
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (isAssetProviderBudgetError(error)) {
      await markJobFailed(job.id, {
        errorCode: error.code,
        error: message,
        recoverable: false,
        details: "Meshy generation was blocked before the provider request because the configured token/credit budget was missing or insufficient."
      });
      return;
    }

    if (job.attempts >= job.max_attempts) {
      await markJobDeadLetter(job.id, message, "ASSET_GENERATION_FAILED");
      return;
    }

    await markJobRetrying(job.id, job.attempts);
  }
}
