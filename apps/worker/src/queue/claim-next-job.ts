import { claimNextJobs, type JobRow } from "../repositories/jobs-repo";

const JOB_TYPES = ["ASSET_GENERATION", "PRODUCT_ASSET_GENERATION"] as const;

export async function claimNextAvailableJobs(workerId: string, limit: number) {
  const jobs: JobRow[] = [];

  for (const type of JOB_TYPES) {
    if (jobs.length >= limit) break;
    const claimed = await claimNextJobs(workerId, limit - jobs.length, type);
    jobs.push(...claimed);
  }

  return jobs;
}
