import assert from "node:assert/strict";
import test from "node:test";

process.env.SUPABASE_URL = process.env.SUPABASE_URL ?? "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "service-role-test-key";

test("extractAssetProviderModelUrl finds direct and nested model URLs", () => {
  return loadProcessorHelpers().then(({ extractAssetProviderModelUrl }) => {
    assert.equal(extractAssetProviderModelUrl({ model_url: "https://example.com/a.glb" }), "https://example.com/a.glb");
    assert.equal(
      extractAssetProviderModelUrl({ result: { glb_url: "https://example.com/b.glb" } }),
      "https://example.com/b.glb"
    );
    assert.equal(
      extractAssetProviderModelUrl({ data: { url: "https://example.com/c.glb" } }),
      "https://example.com/c.glb"
    );
    assert.equal(extractAssetProviderModelUrl({ foo: "bar" }), null);
  });
});

test("extractAssetProviderJobId finds direct and nested async job IDs", () => {
  return loadProcessorHelpers().then(({ extractAssetProviderJobId }) => {
    assert.equal(extractAssetProviderJobId({ job_id: "job-1" }), "job-1");
    assert.equal(extractAssetProviderJobId({ result: { id: "job-2" } }), "job-2");
    assert.equal(extractAssetProviderJobId({ data: { id: "job-3" } }), "job-3");
    assert.equal(extractAssetProviderJobId({ foo: "bar" }), null);
  });
});

test("withAssetProviderRetry retries transient provider failures", () => {
  return loadProcessorHelpers().then(async ({ withAssetProviderRetry }) => {
    let attempts = 0;
    const result = await withAssetProviderRetry(
      async () => {
        attempts += 1;
        if (attempts < 3) {
          throw new TypeError("fetch failed");
        }
        return "ok";
      },
      { maxAttempts: 3, baseDelayMs: 0 }
    );

    assert.equal(result, "ok");
    assert.equal(attempts, 3);
  });
});

test("evaluateMeshyBudgetGuard blocks unbudgeted and over-budget Meshy requests", () => {
  return loadProcessorHelpers().then(({ evaluateMeshyBudgetGuard }) => {
    assert.equal(evaluateMeshyBudgetGuard({ policy: "required" }).allowed, false);
    assert.equal(
      evaluateMeshyBudgetGuard({
        policy: "required",
        remainingBudget: 4,
        reserveBudget: 1,
        costPerTask: 1,
        requestCount: 2,
        attemptsPerRequest: 2
      }).reason,
      "MESHY_BUDGET_EXCEEDED"
    );
    assert.equal(
      evaluateMeshyBudgetGuard({
        policy: "required",
        remainingBudget: 8,
        reserveBudget: 1,
        costPerTask: 1,
        requestCount: 2,
        attemptsPerRequest: 2
      }).allowed,
      true
    );
  });
});

test("selectProviderReferenceImages prefers product hero views over detail sheets", async () => {
  const { selectProviderReferenceImages } = await import("./product-asset-generation-processor");
  const selected = selectProviderReferenceImages(
    [
      {
        url: "https://example.com/detail-sheet.jpg",
        view: "detail",
        source: "detail_image",
        score: 270
      },
      {
        url: "https://example.com/product-front.jpg",
        view: "front",
        source: "json_ld",
        score: 120
      }
    ],
    1
  );

  assert.equal(selected[0]?.url, "https://example.com/product-front.jpg");
});

async function loadProcessorHelpers() {
  return (await import("./asset-generation-processor")) as {
    evaluateMeshyBudgetGuard: (input: {
      policy?: "required" | "optional";
      remainingBudget?: number;
      reserveBudget?: number;
      costPerTask?: number;
      maxBudgetPerJob?: number;
      reservedBudget?: number;
      requestCount?: number;
      attemptsPerRequest?: number;
    }) => {
      allowed: boolean;
      configured: boolean;
      reason: string | null;
      estimatedBudgetUse: number;
      availableBudget: number | null;
    };
    extractAssetProviderJobId: (data: unknown) => string | null;
    extractAssetProviderModelUrl: (data: unknown) => string | null;
    withAssetProviderRetry: <T>(
      operation: (attempt: number) => Promise<T>,
      options?: { maxAttempts?: number; baseDelayMs?: number }
    ) => Promise<T>;
  };
}
