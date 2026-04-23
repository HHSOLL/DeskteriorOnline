import type { BvhBuildDetail } from "./scene-telemetry";
import type {
  InteractionLatencyDetail,
  PerformanceInteractionProfile,
  PerformanceRegressionEntry,
  RendererStatsDetail
} from "./performance-regression";

const HEAP_GROWTH_BUDGET_PERCENT_POINTS = 0.8;
const PICKING_LATENCY_BUDGET_MS = 50;
const BVH_SYNC_WARNING_TRIANGLES = 2048;

export type PerformanceBudgetIssueSeverity = "warning" | "critical";

export type PerformanceBudgetIssue = {
  id: string;
  severity: PerformanceBudgetIssueSeverity;
  label: string;
  message: string;
  metric: string;
  value: number;
  budget: number;
  unit: string;
  route?: string;
  profile?: PerformanceInteractionProfile;
};

function toFixedNumber(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function resolveInteractionLabel(kind: string) {
  switch (kind) {
    case "hover":
      return "Hover Latency";
    case "select":
      return "Select Latency";
    case "drag-start":
      return "Drag Start Latency";
    case "gizmo-drag-start":
      return "Gizmo Drag Start";
    default:
      return "Interaction Latency";
  }
}

function createIssue(input: Omit<PerformanceBudgetIssue, "message"> & { message?: string }) {
  const {
    label,
    value,
    budget,
    unit,
    profile,
    route,
    metric,
    message,
    severity,
    id
  } = input;

  return {
    id,
    severity,
    label,
    metric,
    route,
    profile,
    value,
    budget,
    unit,
    message:
      message ??
      `${label}: ${value}${unit} exceeds budget ${budget}${unit}.`
  } satisfies PerformanceBudgetIssue;
}

export function resolveFcpBudget(route: string) {
  if (route.includes("/studio/builder")) {
    return 2800;
  }
  if (route.includes("/project/")) {
    return 3200;
  }
  if (
    route.includes("/shared/") ||
    route.includes("/gallery") ||
    route.includes("/community")
  ) {
    return 2500;
  }
  return null;
}

export function resolveDrawCallBudget(profile: PerformanceInteractionProfile) {
  if (profile === "desk-precision") {
    return 700;
  }

  return 500;
}

export function resolveFpsFloor(profile: PerformanceInteractionProfile) {
  if (profile === "room-mode") {
    return 55;
  }
  if (profile === "desk-precision") {
    return 45;
  }
  return 45;
}

export function resolvePlacementToleranceBudget(
  profile: PerformanceInteractionProfile
) {
  if (profile === "room-mode") {
    return 10;
  }
  if (profile === "desk-precision") {
    return 5;
  }
  return null;
}

export function resolveInteractionProfileFromSnapshot(
  detail: Pick<
    RendererStatsDetail,
    "path" | "interactionMode" | "viewMode" | "topMode"
  >
): PerformanceInteractionProfile {
  if (
    detail.path.includes("/shared/") ||
    detail.path.includes("/gallery") ||
    detail.path.includes("/community") ||
    detail.interactionMode === "viewer-shared"
  ) {
    return "shared-viewer";
  }

  if (
    detail.path.includes("/studio/builder") ||
    detail.viewMode === "builder-preview" ||
    detail.interactionMode === "preview"
  ) {
    return "builder-preview";
  }

  if (detail.viewMode === "top" && detail.topMode === "room") {
    return "room-mode";
  }

  return "desk-precision";
}

export function evaluateRendererStatsBudget(detail: RendererStatsDetail) {
  const profile = resolveInteractionProfileFromSnapshot(detail);
  const issues: PerformanceBudgetIssue[] = [];
  const fpsFloor = resolveFpsFloor(profile);
  const drawCallBudget = resolveDrawCallBudget(profile);

  if (detail.fps < fpsFloor) {
    issues.push(
      createIssue({
        id: "fps-floor",
        severity: detail.fps < fpsFloor - 10 ? "critical" : "warning",
        label: "FPS Floor",
        metric: "fps",
        profile,
        route: detail.path,
        value: toFixedNumber(detail.fps, 1),
        budget: fpsFloor,
        unit: "",
        message: `${profile} sample dropped to ${toFixedNumber(detail.fps, 1)} FPS. Floor is ${fpsFloor}.`
      })
    );
  }

  if (detail.drawCalls > drawCallBudget) {
    issues.push(
      createIssue({
        id: "draw-calls",
        severity:
          detail.drawCalls > Math.round(drawCallBudget * 1.15)
            ? "critical"
            : "warning",
        label: "Draw Calls",
        metric: "drawCalls",
        profile,
        route: detail.path,
        value: detail.drawCalls,
        budget: drawCallBudget,
        unit: "",
        message: `${profile} sample hit ${detail.drawCalls} draw calls. Budget is ${drawCallBudget}.`
      })
    );
  }

  return issues;
}

export function evaluateInteractionLatencyBudget(
  detail: InteractionLatencyDetail
) {
  if (detail.durationMs <= PICKING_LATENCY_BUDGET_MS) {
    return [];
  }

  return [
    createIssue({
      id: `interaction-${detail.kind}`,
      severity:
        detail.durationMs > PICKING_LATENCY_BUDGET_MS * 1.5
          ? "critical"
          : "warning",
      label: resolveInteractionLabel(detail.kind),
      metric: "interactionLatencyMs",
      route: detail.path,
      value: toFixedNumber(detail.durationMs),
      budget: PICKING_LATENCY_BUDGET_MS,
      unit: "ms",
      message: `${resolveInteractionLabel(detail.kind)} reached ${toFixedNumber(detail.durationMs)}ms. Budget is ${PICKING_LATENCY_BUDGET_MS}ms.`
    })
  ];
}

export function evaluateBvhBuildBudget(detail: BvhBuildDetail) {
  if (detail.status === "error") {
    return [
      createIssue({
        id: "bvh-build-error",
        severity: "critical",
        label: "BVH Build",
        metric: "bvhBuildMs",
        route: detail.path,
        value: toFixedNumber(detail.durationMs),
        budget: 0,
        unit: "ms",
        message: `BVH build failed for ${detail.geometryUuid.slice(0, 8)} after ${toFixedNumber(detail.durationMs)}ms.`
      })
    ];
  }

  if (
    detail.mode === "sync" &&
    detail.triangleCount >= BVH_SYNC_WARNING_TRIANGLES
  ) {
    return [
      createIssue({
        id: "bvh-sync-large-geometry",
        severity: "warning",
        label: "BVH Worker Offload",
        metric: "triangleCount",
        route: detail.path,
        value: detail.triangleCount,
        budget: BVH_SYNC_WARNING_TRIANGLES,
        unit: " tris",
        message: `Large geometry (${detail.triangleCount} tris) built BVH on the main thread. Prefer worker offload above ${BVH_SYNC_WARNING_TRIANGLES} tris.`
      })
    ];
  }

  return [];
}

export function evaluateRegressionEntryBudgets(
  entry: PerformanceRegressionEntry
) {
  const issues: string[] = [];
  const fcpBudget = resolveFcpBudget(entry.route);

  if (fcpBudget !== null && entry.fcpP95Ms > fcpBudget) {
    issues.push(
      `${entry.route} ${entry.scenario} ${entry.build}: FCP p95 ${entry.fcpP95Ms}ms exceeds budget ${fcpBudget}ms.`
    );
  }

  if (entry.heapGrowthPercentPoints > HEAP_GROWTH_BUDGET_PERCENT_POINTS) {
    issues.push(
      `${entry.route} ${entry.scenario} ${entry.build}: heap growth ${entry.heapGrowthPercentPoints}%p exceeds budget ${HEAP_GROWTH_BUDGET_PERCENT_POINTS}%p.`
    );
  }

  const fpsFloor = resolveFpsFloor(entry.interactionProfile);
  if (entry.fpsAvg < fpsFloor) {
    issues.push(
      `${entry.route} ${entry.scenario} ${entry.build}: fpsAvg ${entry.fpsAvg} is below floor ${fpsFloor}.`
    );
  }

  const drawCallBudget = resolveDrawCallBudget(entry.interactionProfile);
  if (entry.drawCalls > drawCallBudget) {
    issues.push(
      `${entry.route} ${entry.scenario} ${entry.build}: drawCalls ${entry.drawCalls} exceeds budget ${drawCallBudget}.`
    );
  }

  if (entry.pickingLatencyP95Ms > PICKING_LATENCY_BUDGET_MS) {
    issues.push(
      `${entry.route} ${entry.scenario} ${entry.build}: pickingLatencyP95Ms ${entry.pickingLatencyP95Ms}ms exceeds budget ${PICKING_LATENCY_BUDGET_MS}ms.`
    );
  }

  const toleranceBudget = resolvePlacementToleranceBudget(
    entry.interactionProfile
  );
  if (
    toleranceBudget !== null &&
    typeof entry.placementToleranceMm === "number" &&
    Number.isFinite(entry.placementToleranceMm) &&
    entry.placementToleranceMm > toleranceBudget
  ) {
    issues.push(
      `${entry.route} ${entry.scenario} ${entry.build}: placementToleranceMm ${entry.placementToleranceMm} exceeds budget ${toleranceBudget}mm.`
    );
  }

  if (
    toleranceBudget !== null &&
    (entry.placementToleranceMm === null ||
      entry.placementToleranceMm === undefined)
  ) {
    issues.push(
      `${entry.route} ${entry.scenario} ${entry.build}: placementToleranceMm is required for ${entry.interactionProfile}.`
    );
  }

  return issues;
}
