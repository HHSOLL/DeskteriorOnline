import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
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

test("product asset generation strategy routes hard-surface products away from image-to-3D", async () => {
  const { resolveProductAssetCategoryProfile } = await import("./product-asset-category-profiles");
  const { resolveProductAssetGenerationStrategy, strategyUsesProvider } = await import(
    "./product-asset-generation-strategy"
  );

  const deskProfile = resolveProductAssetCategoryProfile({ title: "1400mm standing desk" });
  const deskDecision = resolveProductAssetGenerationStrategy({ categoryProfile: deskProfile, title: "1400mm standing desk" });
  assert.equal(deskProfile.key, "desk");
  assert.equal(deskDecision.strategy, "cad_parametric");
  assert.equal(strategyUsesProvider(deskDecision), false);

  const keyboardProfile = resolveProductAssetCategoryProfile({ title: "full size mechanical keyboard" });
  const keyboardDecision = resolveProductAssetGenerationStrategy({ categoryProfile: keyboardProfile, title: "keyboard" });
  assert.equal(keyboardDecision.strategy, "cad_parametric");
  assert.equal(keyboardDecision.qaTargets.requiresInteractionAnchors, true);

  const mouseProfile = resolveProductAssetCategoryProfile({ title: "Razer Cobra Pro mouse" });
  const mouseDecision = resolveProductAssetGenerationStrategy({ categoryProfile: mouseProfile, title: "Razer Cobra Pro mouse" });
  assert.equal(mouseDecision.strategy, "hybrid_cad_blender");
  assert.equal(mouseDecision.manualReviewRequired, true);

  const plantProfile = resolveProductAssetCategoryProfile({ title: "small ivy planter" });
  const plantDecision = resolveProductAssetGenerationStrategy({ categoryProfile: plantProfile, title: "small ivy planter" });
  assert.equal(plantDecision.strategy, "image_to_3d");
  assert.equal(strategyUsesProvider(plantDecision), true);
});

test("CAD-first POC generator emits desk, keyboard, and PC case runtime sidecars", async () => {
  const { resolveProductAssetCategoryProfile } = await import("./product-asset-category-profiles");
  const { resolveProductAssetGenerationStrategy } = await import("./product-asset-generation-strategy");
  const { generateCadParametricProductAsset } = await import("./product-asset-cad-generator");
  const baseDir = await mkdtemp(path.join(tmpdir(), "deskterior-cad-poc-"));

  try {
    for (const fixture of [
      { title: "1400mm CAD desk", expectedProfile: "desk", expectedStrategy: "cad_parametric" },
      { title: "pressable mechanical keyboard", expectedProfile: "keyboard", expectedStrategy: "cad_parametric" },
      { title: "white PC case with fan and radiator mounts", expectedProfile: "pc_case", expectedStrategy: "cad_parametric" }
    ]) {
      const categoryProfile = resolveProductAssetCategoryProfile({ title: fixture.title });
      const decision = resolveProductAssetGenerationStrategy({ categoryProfile, title: fixture.title });
      const draft = buildReferenceDraft(fixture.title, categoryProfile.key);
      const generated = await generateCadParametricProductAsset({
        outputDir: path.join(baseDir, categoryProfile.key),
        fileName: fixture.title,
        draft,
        categoryProfile,
        decision
      });
      const runtimePackage = generated.runtimePackage as {
        generation: {
          cadStepExport: { status: string };
        };
        runtimeAsset: {
          dimensionsMm: { width: number; depth: number; height: number };
          colliders: unknown[];
          supportSurfaces: unknown[];
          attachmentPoints: unknown[];
          interactionAnchors: unknown[];
        };
      };

      assert.equal(categoryProfile.key, fixture.expectedProfile);
      assert.equal(generated.strategy, fixture.expectedStrategy);
      assert.ok(generated.glbBuffer.byteLength > 1024);
      assert.ok(generated.sidecars.some((sidecar) => sidecar.suffix === "model.py"));
      assert.ok(generated.sidecars.some((sidecar) => sidecar.suffix === "model.step"));
      assert.ok(generated.sidecars.some((sidecar) => sidecar.suffix === "runtime-package.json"));
      assert.equal(runtimePackage.generation.cadStepExport.status, "pending_build123d_execution");
      assert.ok(runtimePackage.runtimeAsset.dimensionsMm.width > 0);
      assert.ok(runtimePackage.runtimeAsset.colliders.length >= 1);

      if (categoryProfile.key === "desk") {
        assert.ok(runtimePackage.runtimeAsset.supportSurfaces.some((surface: any) => surface.id === "desktop_top"));
      }
      if (categoryProfile.key === "keyboard") {
        assert.ok(runtimePackage.runtimeAsset.interactionAnchors.length >= 5);
      }
      if (categoryProfile.key === "pc_case") {
        assert.ok(runtimePackage.runtimeAsset.attachmentPoints.length >= 5);
      }
    }
  } finally {
    await rm(baseDir, { recursive: true, force: true });
  }
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

function buildReferenceDraft(title: string, categoryKey: string) {
  const dimensionsByCategory: Record<string, { width: number; depth: number; height: number }> = {
    desk: { width: 1400, depth: 700, height: 720 },
    keyboard: { width: 468, depth: 148, height: 36 },
    pc_case: { width: 285, depth: 470, height: 490 }
  };
  const dimensionsMm = dimensionsByCategory[categoryKey] ?? { width: 240, depth: 180, height: 160 };
  return {
    schemaVersion: "product-url-reference-alpha-v1",
    generatedAt: new Date().toISOString(),
    assetKey: `test-${categoryKey}`,
    sourceUrl: "https://example.com/product",
    product: {
      title,
      sku: `TEST-${categoryKey}`,
      manufacturer: "DeskteriorOnline Test",
      price: null,
      currency: null,
      dimensionsMm,
      options: []
    },
    extraction: {
      dimensionSource: "test_fixture",
      warnings: []
    },
    referenceImages: [
      {
        url: "https://example.com/front.jpg",
        view: "front",
        source: "open_graph",
        score: 180
      }
    ],
    materialHints: [],
    referencePack: {
      sku: `TEST-${categoryKey}`,
      manufacturer: "DeskteriorOnline Test",
      canonicalProductUrl: "https://example.com/product",
      dimensionSourceUrl: null,
      referenceImages: [
        {
          view: "front",
          url: "https://example.com/front.jpg",
          required: true,
          license: "private_reference_only"
        }
      ],
      finishReferences: [],
      license: {
        spdx: "LicenseRef-Private-Reference",
        label: "Private reference only",
        requiresAttribution: false
      },
      status: "reference_collected",
      notes: "test fixture"
    }
  } as any;
}
