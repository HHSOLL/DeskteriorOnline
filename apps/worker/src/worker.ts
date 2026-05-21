import os from "node:os";
import { env } from "./config/env";
import { claimNextAvailableJobs } from "./queue/claim-next-job";
import { processAssetGenerationJob } from "./processors/asset-generation-processor";
import { processProductAssetGenerationJob } from "./processors/product-asset-generation-processor";

const workerId = `${os.hostname()}-${process.pid}-${crypto.randomUUID().slice(0, 8)}`;

let shuttingDown = false;
const inFlight = new Set<Promise<void>>();

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function launch(job: any) {
  const processor =
    job.type === "ASSET_GENERATION"
      ? processAssetGenerationJob(job)
      : job.type === "PRODUCT_ASSET_GENERATION"
        ? processProductAssetGenerationJob(job)
        : null;

  if (!processor) {
    console.warn(`[worker] skipping unsupported job type: ${job.type}`);
    return;
  }

  const task = processor
    .catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[worker] job ${job.id} failed with unhandled error: ${message}`);
    })
    .finally(() => {
      inFlight.delete(task);
    });

  inFlight.add(task);
}

async function runLoop() {
  console.log(`[worker] started id=${workerId} concurrency=${env.WORKER_CONCURRENCY}`);

  while (!shuttingDown) {
    try {
      const capacity = Math.max(0, env.WORKER_CONCURRENCY - inFlight.size);
      if (capacity > 0) {
        const jobs = await claimNextAvailableJobs(workerId, capacity);
        if (jobs.length > 0) {
          jobs.forEach((job) => launch(job));
          continue;
        }
      }

      if (inFlight.size > 0) {
        await Promise.race(inFlight);
      } else {
        await sleep(env.WORKER_POLL_INTERVAL_MS);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[worker] polling error: ${message}`);
      await sleep(env.WORKER_POLL_INTERVAL_MS);
    }
  }

  if (inFlight.size > 0) {
    console.log(`[worker] waiting for ${inFlight.size} in-flight job(s)`);
    await Promise.all(Array.from(inFlight));
  }

  console.log("[worker] shutdown complete");
}

function setupSignalHandlers() {
  const stop = () => {
    if (shuttingDown) return;
    shuttingDown = true;
  };

  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

setupSignalHandlers();

runLoop().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[worker] fatal error: ${message}`);
  process.exitCode = 1;
});
