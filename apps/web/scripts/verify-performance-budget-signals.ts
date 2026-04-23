import assert from "node:assert/strict";
import {
  evaluateBvhBuildBudget,
  evaluateInteractionLatencyBudget,
  evaluateRegressionEntryBudgets,
  evaluateRendererStatsBudget,
  resolveInteractionProfileFromSnapshot
} from "../src/lib/performance/performance-budgets";
import type {
  InteractionLatencyDetail,
  PerformanceRegressionEntry,
  RendererStatsDetail
} from "../src/lib/performance/performance-regression";
import type { BvhBuildDetail } from "../src/lib/performance/scene-telemetry";

const baseRendererDetail: RendererStatsDetail = {
  timestamp: new Date().toISOString(),
  path: "/project/demo",
  interactionMode: "editor",
  viewMode: "top",
  topMode: "desk-precision",
  dpr: 1,
  fps: 58,
  frames: 60,
  drawCalls: 620,
  triangles: 120_000,
  textures: 24,
  geometries: 18
};

const overBudgetRendererDetail: RendererStatsDetail = {
  ...baseRendererDetail,
  fps: 38,
  drawCalls: 742,
  heapUsedMb: 132.4,
  heapLimitMb: 512,
  heapGrowthPercentPoints: 1.1
};

const interactionDetail: InteractionLatencyDetail = {
  timestamp: new Date().toISOString(),
  path: "/project/demo",
  kind: "hover",
  durationMs: 68.5
};

const bvhDetail: BvhBuildDetail = {
  timestamp: new Date().toISOString(),
  path: "/project/demo",
  geometryUuid: "geometry-1",
  triangleCount: 4096,
  durationMs: 18.4,
  mode: "sync",
  status: "success"
};

const regressionEntry: PerformanceRegressionEntry = {
  recordedAt: new Date().toISOString(),
  route: "/project/demo",
  scenario: "dense-desk",
  build: "production",
  interactionProfile: "desk-precision",
  fcpP95Ms: 3100,
  heapGrowthPercentPoints: 0.5,
  fpsAvg: 42,
  fpsMin: 39,
  drawCalls: 728,
  triangles: 240_000,
  textures: 48,
  geometries: 29,
  pickingLatencyP95Ms: 57,
  placementToleranceMm: 3,
  interactionNote: "budget drift smoke",
  latencyByKind: {
    hover: 57
  },
  sampleDurationMs: 20_000,
  rendererSampleCount: 12,
  interactionSampleCount: 4
};

function main() {
  assert.equal(
    resolveInteractionProfileFromSnapshot(baseRendererDetail),
    "desk-precision"
  );
  assert.equal(evaluateRendererStatsBudget(baseRendererDetail).length, 0);

  const rendererIssues = evaluateRendererStatsBudget(overBudgetRendererDetail);
  assert.equal(rendererIssues.length, 3);
  assert(rendererIssues.some((issue) => issue.id === "fps-floor"));
  assert(rendererIssues.some((issue) => issue.id === "draw-calls"));
  assert(rendererIssues.some((issue) => issue.id === "heap-growth"));

  const interactionIssues = evaluateInteractionLatencyBudget(interactionDetail);
  assert.equal(interactionIssues.length, 1);
  assert.equal(interactionIssues[0]?.metric, "interactionLatencyMs");

  const bvhIssues = evaluateBvhBuildBudget(bvhDetail);
  assert.equal(bvhIssues.length, 1);
  assert.equal(bvhIssues[0]?.id, "bvh-sync-large-geometry");

  const regressionIssues = evaluateRegressionEntryBudgets(regressionEntry);
  assert.equal(regressionIssues.length, 3);
  assert(
    regressionIssues.some((issue) => issue.includes("FCP p95 3100ms exceeds budget 3200ms")) === false
  );
  assert(
    regressionIssues.some((issue) => issue.includes("fpsAvg 42 is below floor 45."))
  );
  assert(
    regressionIssues.some((issue) =>
      issue.includes("drawCalls 728 exceeds budget 700.")
    )
  );
  assert(
    regressionIssues.some((issue) =>
      issue.includes("pickingLatencyP95Ms 57ms exceeds budget 50ms.")
    )
  );

  console.log(
    JSON.stringify(
      {
        rendererIssues: rendererIssues.map((issue) => issue.id),
        interactionIssues: interactionIssues.map((issue) => issue.id),
        bvhIssues: bvhIssues.map((issue) => issue.id),
        regressionIssueCount: regressionIssues.length
      },
      null,
      2
    )
  );
}

main();
