"use client";

export const PLAN2SPACE_RENDERER_STATS_EVENT = "deskterioronline:renderer-stats";
export const PLAN2SPACE_INTERACTION_LATENCY_EVENT =
  "deskterioronline:interaction-latency";
export const PLAN2SPACE_BVH_BUILD_EVENT = "deskterioronline:bvh-build";

const TELEMETRY_QUERY_PARAM = "telemetry";
const WINDOW_TELEMETRY_FLAG = "__DESKTERIORONLINE_TELEMETRY__";
const WINDOW_RENDERER_SNAPSHOT_KEY = "__DESKTERIORONLINE_LAST_RENDERER_STATS__";
const WINDOW_INTERACTION_SNAPSHOT_KEY =
  "__DESKTERIORONLINE_LAST_INTERACTION_LATENCY__";
const WINDOW_BVH_BUILD_SNAPSHOT_KEY = "__DESKTERIORONLINE_LAST_BVH_BUILD__";
const WINDOW_TELEMETRY_CAPTURE_KEY = "__DESKTERIORONLINE_TELEMETRY_CAPTURE__";
const WINDOW_ACTIVE_CAPTURE_KEY = "__DESKTERIORONLINE_ACTIVE_TELEMETRY_CAPTURE__";
const WINDOW_CAPTURE_HISTORY_KEY = "__DESKTERIORONLINE_TELEMETRY_CAPTURE_HISTORY__";

type TelemetryWindow = Window &
  Record<string, unknown> & {
    requestAnimationFrame: (callback: FrameRequestCallback) => number;
  };

import {
  createTelemetryCaptureSession,
  summarizeTelemetryCapture,
  type FinalizeTelemetryCaptureInput,
  type InteractionLatencyDetail,
  type RendererStatsDetail,
  type PerformanceRegressionEntry,
  type TelemetryCaptureInput,
  type TelemetryCaptureSession
} from "./performance-regression";

export type BvhBuildDetail = {
  timestamp: string;
  path: string;
  geometryUuid: string;
  triangleCount: number;
  durationMs: number;
  mode: "sync" | "worker";
  status: "success" | "error";
  reason?: string;
};

type TelemetryCaptureApi = {
  start: (input: TelemetryCaptureInput) => TelemetryCaptureSession;
  stop: (
    finalize: FinalizeTelemetryCaptureInput
  ) => PerformanceRegressionEntry | null;
  getActive: () => TelemetryCaptureSession | null;
  getHistory: () => PerformanceRegressionEntry[];
  clear: () => void;
};

function getTelemetryWindow(): TelemetryWindow | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window as unknown as TelemetryWindow;
}

export function isSceneTelemetryEnabled() {
  const win = getTelemetryWindow();
  if (!win) {
    return false;
  }

  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  if (win[WINDOW_TELEMETRY_FLAG] === true) {
    return true;
  }

  const search = new URLSearchParams(win.location.search);
  return search.get(TELEMETRY_QUERY_PARAM) === "1";
}

function emitTelemetryEvent<T>(
  eventName: string,
  snapshotKey: string,
  detail: T
) {
  const win = getTelemetryWindow();
  if (!win || !isSceneTelemetryEnabled()) {
    return;
  }

  ensureTelemetryCaptureBridge(win);
  win[snapshotKey] = detail;
  win.dispatchEvent(new CustomEvent(eventName, { detail }));
}

function getCaptureHistory(win: TelemetryWindow) {
  const existing = win[WINDOW_CAPTURE_HISTORY_KEY];
  if (Array.isArray(existing)) {
    return existing as PerformanceRegressionEntry[];
  }

  const nextHistory: PerformanceRegressionEntry[] = [];
  win[WINDOW_CAPTURE_HISTORY_KEY] = nextHistory;
  return nextHistory;
}

function getActiveCapture(win: TelemetryWindow) {
  const existing = win[WINDOW_ACTIVE_CAPTURE_KEY];
  return existing && typeof existing === "object"
    ? (existing as TelemetryCaptureSession)
    : null;
}

function setActiveCapture(
  win: TelemetryWindow,
  value: TelemetryCaptureSession | null
) {
  win[WINDOW_ACTIVE_CAPTURE_KEY] = value;
}

function ensureTelemetryCaptureBridge(win: TelemetryWindow) {
  if (win[WINDOW_TELEMETRY_CAPTURE_KEY]) {
    return win[WINDOW_TELEMETRY_CAPTURE_KEY] as TelemetryCaptureApi;
  }

  const api: TelemetryCaptureApi = {
    start(input) {
      const session = createTelemetryCaptureSession({
        ...input,
        route: input.route ?? win.location.pathname
      });
      setActiveCapture(win, session);
      return session;
    },
    stop(finalize) {
      const active = getActiveCapture(win);
      if (!active) {
        return null;
      }

      const summary = summarizeTelemetryCapture(active, finalize);
      getCaptureHistory(win).push(summary);
      setActiveCapture(win, null);
      return summary;
    },
    getActive() {
      return getActiveCapture(win);
    },
    getHistory() {
      return [...getCaptureHistory(win)];
    },
    clear() {
      getCaptureHistory(win).length = 0;
      setActiveCapture(win, null);
    }
  };

  win[WINDOW_TELEMETRY_CAPTURE_KEY] = api;
  return api;
}

function appendCaptureSample(
  detail: RendererStatsDetail | InteractionLatencyDetail,
  kind: "renderer" | "interaction"
) {
  const win = getTelemetryWindow();
  if (!win) {
    return;
  }

  const active = getActiveCapture(win);
  if (!active) {
    return;
  }

  if (kind === "renderer") {
    active.rendererSamples.push(detail as RendererStatsDetail);
    return;
  }

  active.interactionSamples.push(detail as InteractionLatencyDetail);
}

export function emitRendererStats(detail: RendererStatsDetail) {
  appendCaptureSample(detail, "renderer");
  emitTelemetryEvent(
    PLAN2SPACE_RENDERER_STATS_EVENT,
    WINDOW_RENDERER_SNAPSHOT_KEY,
    detail
  );
}

export function scheduleInteractionLatency(
  kind: string,
  startedAt: number,
  metadata: Omit<
    InteractionLatencyDetail,
    "timestamp" | "path" | "kind" | "durationMs"
  > = {}
) {
  const win = getTelemetryWindow();
  if (!win || !isSceneTelemetryEnabled()) {
    return;
  }

  const finalize = () => {
    const detail = {
      timestamp: new Date().toISOString(),
      path: win.location.pathname,
      kind,
      durationMs: Number((performance.now() - startedAt).toFixed(2)),
      ...metadata
    } satisfies InteractionLatencyDetail;

    appendCaptureSample(detail, "interaction");
    emitTelemetryEvent(
      PLAN2SPACE_INTERACTION_LATENCY_EVENT,
      WINDOW_INTERACTION_SNAPSHOT_KEY,
      detail
    );
  };

  win.requestAnimationFrame(() => {
    win.requestAnimationFrame(finalize);
  });
}

export function emitBvhBuild(detail: BvhBuildDetail) {
  emitTelemetryEvent(
    PLAN2SPACE_BVH_BUILD_EVENT,
    WINDOW_BVH_BUILD_SNAPSHOT_KEY,
    detail
  );
}
