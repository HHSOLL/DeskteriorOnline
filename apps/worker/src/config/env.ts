import { z } from "zod";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const MODULE_DIR =
  typeof import.meta.dirname === "string" ? import.meta.dirname : path.dirname(fileURLToPath(import.meta.url));
const WORKER_ROOT = path.resolve(MODULE_DIR, "../..");
const REPO_ROOT = path.resolve(WORKER_ROOT, "../..");

for (const envFile of [
  path.join(REPO_ROOT, ".env"),
  path.join(REPO_ROOT, ".env.local"),
  path.join(WORKER_ROOT, ".env"),
  path.join(WORKER_ROOT, ".env.local")
]) {
  if (existsSync(envFile)) {
    process.loadEnvFile(envFile);
  }
}

const EnvSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  ASSET_STORAGE_BUCKET: z.string().default("assets-glb"),
  WORKER_CONCURRENCY: z.coerce.number().default(2),
  WORKER_POLL_INTERVAL_MS: z.coerce.number().default(1000),
  ASSET_GENERATION_POLL_INTERVAL_MS: z.coerce.number().default(2000),
  ASSET_GENERATION_MAX_POLLS: z.coerce.number().default(45),
  ASSET_GENERATION_PROVIDER_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(5).default(3),
  ASSET_GENERATION_PROVIDER_RETRY_BASE_MS: z.coerce.number().int().min(0).default(750),
  PRODUCT_ASSET_MAX_CANDIDATES: z.coerce.number().int().min(1).max(8).default(4),
  PRODUCT_ASSET_AUTO_APPROVE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.82),
  ASSET_GENERATION_WORKDIR: z.string().default("/tmp/deskterior-assets"),
  BLENDER_BIN: z.string().optional(),
  TRIPOSR_API_URL: z.string().url().optional(),
  TRIPOSR_API_KEY: z.string().min(1).optional(),
  TRIPOSR_STATUS_URL: z.string().url().optional(),
  MESHY_API_URL: z.string().url().optional(),
  MESHY_API_KEY: z.string().min(1).optional(),
  MESHY_STATUS_URL: z.string().url().optional(),
  MESHY_BUDGET_MODE: z.enum(["required", "optional"]).default("required"),
  MESHY_BUDGET_REMAINING: z.coerce.number().min(0).optional(),
  MESHY_BUDGET_RESERVE: z.coerce.number().min(0).default(0),
  MESHY_BUDGET_COST_PER_TASK: z.coerce.number().positive().optional(),
  MESHY_MAX_BUDGET_PER_JOB: z.coerce.number().positive().optional()
});

export const env = EnvSchema.parse(process.env);
