"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  InteractionLatencyDetail,
  RendererStatsDetail
} from "../../../lib/performance/performance-regression";
import {
  evaluateBvhBuildBudget,
  evaluateInteractionLatencyBudget,
  evaluateRendererStatsBudget,
  type PerformanceBudgetIssue
} from "../../../lib/performance/performance-budgets";
import {
  getLatestBvhBuildSnapshot,
  getLatestInteractionLatencySnapshot,
  getLatestRendererStatsSnapshot,
  isSceneTelemetryEnabled,
  PLAN2SPACE_BVH_BUILD_EVENT,
  PLAN2SPACE_INTERACTION_LATENCY_EVENT,
  PLAN2SPACE_RENDERER_STATS_EVENT,
  type BvhBuildDetail
} from "../../../lib/performance/scene-telemetry";

type PerformanceSnapshotState = {
  renderer: RendererStatsDetail | null;
  interaction: InteractionLatencyDetail | null;
  bvh: BvhBuildDetail | null;
};

const INTERACTION_ISSUE_MAX_AGE_MS = 8000;
const BVH_ISSUE_MAX_AGE_MS = 12000;

function isFreshSnapshot(
  timestamp: string | undefined,
  maxAgeMs: number,
  nowMs: number
) {
  if (!timestamp) {
    return false;
  }

  const parsed = Date.parse(timestamp);
  if (Number.isNaN(parsed)) {
    return false;
  }

  return nowMs - parsed <= maxAgeMs;
}

function resolveIssueClassName(severity: PerformanceBudgetIssue["severity"]) {
  return severity === "critical"
    ? "border-rose-300/30 bg-rose-500/12 text-rose-100"
    : "border-amber-300/30 bg-amber-500/12 text-amber-100";
}

function sortIssues(issues: PerformanceBudgetIssue[]) {
  return [...issues].sort((left, right) => {
    if (left.severity !== right.severity) {
      return left.severity === "critical" ? -1 : 1;
    }

    return right.value - left.value;
  });
}

function formatHeapStat(renderer: RendererStatsDetail) {
  if (
    typeof renderer.heapUsedMb !== "number" ||
    !Number.isFinite(renderer.heapUsedMb)
  ) {
    return null;
  }

  const used = `${renderer.heapUsedMb.toFixed(1)}MB`;
  if (
    typeof renderer.heapGrowthPercentPoints === "number" &&
    Number.isFinite(renderer.heapGrowthPercentPoints)
  ) {
    return `${used} (+${renderer.heapGrowthPercentPoints.toFixed(2)}%p)`;
  }

  return used;
}

export default function ScenePerformanceBudgetHud() {
  const [snapshots, setSnapshots] = useState<PerformanceSnapshotState>({
    renderer: null,
    interaction: null,
    bvh: null
  });
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!isSceneTelemetryEnabled()) {
      return;
    }

    setSnapshots({
      renderer: getLatestRendererStatsSnapshot(),
      interaction: getLatestInteractionLatencySnapshot(),
      bvh: getLatestBvhBuildSnapshot()
    });

    const onRendererStats = (event: Event) => {
      const detail = (event as CustomEvent<RendererStatsDetail>).detail;
      setSnapshots((current) => ({ ...current, renderer: detail }));
    };

    const onInteractionLatency = (event: Event) => {
      const detail = (event as CustomEvent<InteractionLatencyDetail>).detail;
      setSnapshots((current) => ({ ...current, interaction: detail }));
    };

    const onBvhBuild = (event: Event) => {
      const detail = (event as CustomEvent<BvhBuildDetail>).detail;
      setSnapshots((current) => ({ ...current, bvh: detail }));
    };

    window.addEventListener(
      PLAN2SPACE_RENDERER_STATS_EVENT,
      onRendererStats as EventListener
    );
    window.addEventListener(
      PLAN2SPACE_INTERACTION_LATENCY_EVENT,
      onInteractionLatency as EventListener
    );
    window.addEventListener(
      PLAN2SPACE_BVH_BUILD_EVENT,
      onBvhBuild as EventListener
    );

    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      window.removeEventListener(
        PLAN2SPACE_RENDERER_STATS_EVENT,
        onRendererStats as EventListener
      );
      window.removeEventListener(
        PLAN2SPACE_INTERACTION_LATENCY_EVENT,
        onInteractionLatency as EventListener
      );
      window.removeEventListener(
        PLAN2SPACE_BVH_BUILD_EVENT,
        onBvhBuild as EventListener
      );
      window.clearInterval(intervalId);
    };
  }, []);

  const issues = useMemo(() => {
    if (!isSceneTelemetryEnabled()) {
      return [];
    }

    const capturedNow = now;
    const nextIssues: PerformanceBudgetIssue[] = [];

    if (snapshots.renderer) {
      nextIssues.push(...evaluateRendererStatsBudget(snapshots.renderer));
    }

    if (
      snapshots.interaction &&
      isFreshSnapshot(
        snapshots.interaction.timestamp,
        INTERACTION_ISSUE_MAX_AGE_MS,
        capturedNow
      )
    ) {
      nextIssues.push(...evaluateInteractionLatencyBudget(snapshots.interaction));
    }

    if (
      snapshots.bvh &&
      isFreshSnapshot(snapshots.bvh.timestamp, BVH_ISSUE_MAX_AGE_MS, capturedNow)
    ) {
      nextIssues.push(...evaluateBvhBuildBudget(snapshots.bvh));
    }

    return sortIssues(nextIssues).slice(0, 4);
  }, [now, snapshots]);

  if (!isSceneTelemetryEnabled() || issues.length === 0) {
    return null;
  }

  const criticalCount = issues.filter(
    (issue) => issue.severity === "critical"
  ).length;
  const badgeTone =
    criticalCount > 0
      ? "border-rose-300/30 bg-rose-500/15 text-rose-100"
      : "border-amber-300/30 bg-amber-500/15 text-amber-100";
  const heapStat = snapshots.renderer
    ? formatHeapStat(snapshots.renderer)
    : null;
  const statsGridClassName = heapStat
    ? "mt-3 grid grid-cols-4 gap-2 text-sm text-white/78"
    : "mt-3 grid grid-cols-3 gap-2 text-sm text-white/78";

  return (
    <div className="pointer-events-none absolute bottom-4 right-4 z-40 w-[min(360px,calc(100%-2rem))] rounded-[24px] border border-white/14 bg-black/55 px-4 py-4 text-white shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.32em] text-white/55">
            Perf Guard
          </div>
          <div className="mt-1 text-sm font-semibold text-white">
            Live budget warnings
          </div>
        </div>
        <div
          className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] ${badgeTone}`}
        >
          {criticalCount > 0 ? `${criticalCount} Critical` : `${issues.length} Warning`}
        </div>
      </div>

      {snapshots.renderer ? (
        <div className={statsGridClassName}>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
            <div className="text-[10px] uppercase tracking-[0.24em] text-white/45">FPS</div>
            <div className="mt-1 font-medium text-white">
              {snapshots.renderer.fps.toFixed(1)}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
            <div className="text-[10px] uppercase tracking-[0.24em] text-white/45">Draw</div>
            <div className="mt-1 font-medium text-white">
              {snapshots.renderer.drawCalls}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
            <div className="text-[10px] uppercase tracking-[0.24em] text-white/45">Tris</div>
            <div className="mt-1 font-medium text-white">
              {snapshots.renderer.triangles.toLocaleString()}
            </div>
          </div>
          {heapStat ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.24em] text-white/45">
                Heap
              </div>
              <div className="mt-1 font-medium text-white">{heapStat}</div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3 grid gap-2">
        {issues.map((issue) => (
          <div
            key={`${issue.id}-${issue.metric}`}
            className={`rounded-xl border px-3 py-2 ${resolveIssueClassName(issue.severity)}`}
          >
            <div className="text-[9px] uppercase tracking-[0.22em] text-white/45">
              {issue.label}
            </div>
            <div className="mt-1 text-sm font-medium">{issue.message}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
