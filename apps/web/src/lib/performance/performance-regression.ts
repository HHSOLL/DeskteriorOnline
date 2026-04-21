export const PERFORMANCE_SCENARIOS = [
  "empty-room",
  "furnished-room",
  "dense-desk",
  "high-fidelity-toggle"
] as const;

export const PERFORMANCE_BUILDS = ["dev", "production"] as const;

export const PERFORMANCE_INTERACTION_PROFILES = [
  "builder-preview",
  "room-mode",
  "desk-precision",
  "shared-viewer"
] as const;

export const TELEMETRY_INTERACTION_KINDS = [
  "hover",
  "select",
  "drag-start",
  "gizmo-drag-start"
] as const;

export type PerformanceScenario = (typeof PERFORMANCE_SCENARIOS)[number];
export type PerformanceBuild = (typeof PERFORMANCE_BUILDS)[number];
export type PerformanceInteractionProfile =
  (typeof PERFORMANCE_INTERACTION_PROFILES)[number];
export type TelemetryInteractionKind =
  (typeof TELEMETRY_INTERACTION_KINDS)[number];

export type RendererStatsDetail = {
  timestamp: string;
  path: string;
  interactionMode: string;
  viewMode: string;
  topMode: string;
  dpr: number;
  fps: number;
  frames: number;
  drawCalls: number;
  triangles: number;
  textures: number;
  geometries: number;
};

export type InteractionLatencyDetail = {
  timestamp: string;
  path: string;
  kind: string;
  durationMs: number;
  viewMode?: string;
  topMode?: string;
  targetId?: string | null;
};

export type TelemetryCaptureInput = {
  route?: string;
  scenario: PerformanceScenario;
  build: PerformanceBuild;
  interactionProfile: PerformanceInteractionProfile;
  label?: string;
};

export type TelemetryCaptureSession = TelemetryCaptureInput & {
  startedAt: string;
  startedAtMs: number;
  rendererSamples: RendererStatsDetail[];
  interactionSamples: InteractionLatencyDetail[];
};

export type FinalizeTelemetryCaptureInput = {
  fcpP95Ms: number;
  heapGrowthPercentPoints: number;
  placementToleranceMm?: number | null;
  interactionNote: string;
};

export type PerformanceRegressionEntry = {
  recordedAt: string;
  route: string;
  scenario: PerformanceScenario;
  build: PerformanceBuild;
  interactionProfile: PerformanceInteractionProfile;
  label?: string;
  fcpP95Ms: number;
  heapGrowthPercentPoints: number;
  fpsAvg: number;
  fpsMin: number;
  drawCalls: number;
  triangles: number;
  textures: number;
  geometries: number;
  pickingLatencyP95Ms: number;
  placementToleranceMm?: number | null;
  interactionNote: string;
  latencyByKind: Partial<Record<TelemetryInteractionKind, number>>;
  sampleDurationMs: number;
  rendererSampleCount: number;
  interactionSampleCount: number;
};

export type PerformanceRegressionReport = {
  generatedAt: string;
  entries: PerformanceRegressionEntry[];
  notes?: string[];
};

export type PerformanceRegressionDelta = {
  key: string;
  current: PerformanceRegressionEntry;
  baseline: PerformanceRegressionEntry;
  delta: {
    fcpP95Ms: number;
    heapGrowthPercentPoints: number;
    fpsAvg: number;
    drawCalls: number;
    textures: number;
    geometries: number;
    pickingLatencyP95Ms: number;
    placementToleranceMm: number | null;
  };
};

function toFixedNumber(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function percentile(values: number[], fraction: number) {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * fraction) - 1)
  );
  return sorted[index] ?? 0;
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function resolveFcpBudget(route: string) {
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

function resolveDrawCallBudget(profile: PerformanceInteractionProfile) {
  if (profile === "desk-precision") {
    return 700;
  }

  return 500;
}

function resolveFpsFloor(profile: PerformanceInteractionProfile) {
  if (profile === "room-mode") {
    return 55;
  }
  if (profile === "desk-precision") {
    return 45;
  }
  return 45;
}

function resolvePlacementToleranceBudget(
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

export function createTelemetryCaptureSession(
  input: TelemetryCaptureInput
): TelemetryCaptureSession {
  const now = Date.now();
  return {
    ...input,
    startedAt: new Date(now).toISOString(),
    startedAtMs: now,
    rendererSamples: [],
    interactionSamples: []
  };
}

export function summarizeTelemetryCapture(
  session: TelemetryCaptureSession,
  finalize: FinalizeTelemetryCaptureInput
): PerformanceRegressionEntry {
  const fpsSamples = session.rendererSamples.map((sample) => sample.fps);
  const drawCallSamples = session.rendererSamples.map(
    (sample) => sample.drawCalls
  );
  const triangleSamples = session.rendererSamples.map(
    (sample) => sample.triangles
  );
  const textureSamples = session.rendererSamples.map(
    (sample) => sample.textures
  );
  const geometrySamples = session.rendererSamples.map(
    (sample) => sample.geometries
  );
  const interactionSamples = session.interactionSamples
    .map((sample) => sample.durationMs)
    .filter(isFiniteNumber);

  const latencyByKind = Object.fromEntries(
    TELEMETRY_INTERACTION_KINDS.map((kind) => {
      const values = session.interactionSamples
        .filter((sample) => sample.kind === kind)
        .map((sample) => sample.durationMs)
        .filter(isFiniteNumber);

      return [kind, values.length > 0 ? toFixedNumber(percentile(values, 0.95)) : undefined];
    }).filter((entry) => entry[1] !== undefined)
  ) as Partial<Record<TelemetryInteractionKind, number>>;

  const route =
    session.route ??
    session.rendererSamples[0]?.path ??
    session.interactionSamples[0]?.path ??
    "/project/[id]";

  return {
    recordedAt: new Date().toISOString(),
    route,
    scenario: session.scenario,
    build: session.build,
    interactionProfile: session.interactionProfile,
    label: session.label,
    fcpP95Ms: toFixedNumber(finalize.fcpP95Ms),
    heapGrowthPercentPoints: toFixedNumber(finalize.heapGrowthPercentPoints),
    fpsAvg: toFixedNumber(average(fpsSamples), 1),
    fpsMin: toFixedNumber(
      fpsSamples.length > 0 ? Math.min(...fpsSamples) : 0,
      1
    ),
    drawCalls: Math.max(...drawCallSamples, 0),
    triangles: Math.max(...triangleSamples, 0),
    textures: Math.max(...textureSamples, 0),
    geometries: Math.max(...geometrySamples, 0),
    pickingLatencyP95Ms: toFixedNumber(
      interactionSamples.length > 0 ? percentile(interactionSamples, 0.95) : 0
    ),
    placementToleranceMm:
      finalize.placementToleranceMm === null ||
      finalize.placementToleranceMm === undefined
        ? finalize.placementToleranceMm ?? null
        : toFixedNumber(finalize.placementToleranceMm),
    interactionNote: finalize.interactionNote.trim(),
    latencyByKind,
    sampleDurationMs: Math.max(0, Date.now() - session.startedAtMs),
    rendererSampleCount: session.rendererSamples.length,
    interactionSampleCount: session.interactionSamples.length
  };
}

export function createPerformanceRegressionKey(
  entry: Pick<
    PerformanceRegressionEntry,
    "route" | "scenario" | "build" | "interactionProfile"
  >
) {
  return [
    entry.route,
    entry.scenario,
    entry.build,
    entry.interactionProfile
  ].join("|");
}

export function comparePerformanceRegressionReports(
  current: PerformanceRegressionReport,
  baseline: PerformanceRegressionReport
) {
  const baselineMap = new Map(
    baseline.entries.map((entry) => [
      createPerformanceRegressionKey(entry),
      entry
    ])
  );

  return current.entries
    .map((entry) => {
      const key = createPerformanceRegressionKey(entry);
      const baselineEntry = baselineMap.get(key);
      if (!baselineEntry) {
        return null;
      }

      return {
        key,
        current: entry,
        baseline: baselineEntry,
        delta: {
          fcpP95Ms: toFixedNumber(entry.fcpP95Ms - baselineEntry.fcpP95Ms),
          heapGrowthPercentPoints: toFixedNumber(
            entry.heapGrowthPercentPoints -
              baselineEntry.heapGrowthPercentPoints
          ),
          fpsAvg: toFixedNumber(entry.fpsAvg - baselineEntry.fpsAvg, 1),
          drawCalls: entry.drawCalls - baselineEntry.drawCalls,
          textures: entry.textures - baselineEntry.textures,
          geometries: entry.geometries - baselineEntry.geometries,
          pickingLatencyP95Ms: toFixedNumber(
            entry.pickingLatencyP95Ms - baselineEntry.pickingLatencyP95Ms
          ),
          placementToleranceMm:
            entry.placementToleranceMm === null ||
            entry.placementToleranceMm === undefined ||
            baselineEntry.placementToleranceMm === null ||
            baselineEntry.placementToleranceMm === undefined
              ? null
              : toFixedNumber(
                  entry.placementToleranceMm -
                    baselineEntry.placementToleranceMm
                )
        }
      } satisfies PerformanceRegressionDelta;
    })
    .filter((entry): entry is PerformanceRegressionDelta => entry !== null);
}

export function validatePerformanceRegressionReport(
  report: PerformanceRegressionReport
) {
  const issues: string[] = [];

  if (!Array.isArray(report.entries) || report.entries.length === 0) {
    issues.push("report.entries must contain at least one regression entry.");
    return issues;
  }

  const scenarios = new Set(report.entries.map((entry) => entry.scenario));
  const builds = new Set(report.entries.map((entry) => entry.build));

  for (const scenario of PERFORMANCE_SCENARIOS) {
    if (!scenarios.has(scenario)) {
      issues.push(`missing required scenario coverage: ${scenario}`);
    }
  }

  for (const build of PERFORMANCE_BUILDS) {
    if (!builds.has(build)) {
      issues.push(`missing required build coverage: ${build}`);
    }
  }

  for (const entry of report.entries) {
    if (!entry.route.trim()) {
      issues.push("route must not be empty.");
    }

    const numericChecks: Array<[string, number]> = [
      ["fcpP95Ms", entry.fcpP95Ms],
      ["heapGrowthPercentPoints", entry.heapGrowthPercentPoints],
      ["fpsAvg", entry.fpsAvg],
      ["fpsMin", entry.fpsMin],
      ["drawCalls", entry.drawCalls],
      ["triangles", entry.triangles],
      ["textures", entry.textures],
      ["geometries", entry.geometries],
      ["pickingLatencyP95Ms", entry.pickingLatencyP95Ms]
    ];

    for (const [label, value] of numericChecks) {
      if (!isFiniteNumber(value) || value < 0) {
        issues.push(`${entry.route} ${entry.scenario} ${entry.build}: ${label} must be a non-negative number.`);
      }
    }

    if (!entry.interactionNote.trim()) {
      issues.push(
        `${entry.route} ${entry.scenario} ${entry.build}: interactionNote must not be empty.`
      );
    }

    const fcpBudget = resolveFcpBudget(entry.route);
    if (fcpBudget !== null && entry.fcpP95Ms > fcpBudget) {
      issues.push(
        `${entry.route} ${entry.scenario} ${entry.build}: FCP p95 ${entry.fcpP95Ms}ms exceeds budget ${fcpBudget}ms.`
      );
    }

    if (entry.heapGrowthPercentPoints > 0.8) {
      issues.push(
        `${entry.route} ${entry.scenario} ${entry.build}: heap growth ${entry.heapGrowthPercentPoints}%p exceeds budget 0.8%p.`
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

    if (entry.pickingLatencyP95Ms > 50) {
      issues.push(
        `${entry.route} ${entry.scenario} ${entry.build}: pickingLatencyP95Ms ${entry.pickingLatencyP95Ms}ms exceeds budget 50ms.`
      );
    }

    const toleranceBudget = resolvePlacementToleranceBudget(
      entry.interactionProfile
    );
    if (
      toleranceBudget !== null &&
      isFiniteNumber(entry.placementToleranceMm) &&
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
  }

  return issues;
}
