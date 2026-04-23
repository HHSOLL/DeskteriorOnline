"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useEditorStore } from "../../../lib/stores/useEditorStore";
import {
  emitRendererStats,
  isSceneTelemetryEnabled
} from "../../../lib/performance/scene-telemetry";
import type { SceneInteractionMode } from "../../../lib/scene/render-quality";

type ScenePerformanceTelemetryProps = {
  interactionMode: SceneInteractionMode;
};

type RendererAggregate = {
  startedAt: number;
  frames: number;
  maxDrawCalls: number;
  maxTriangles: number;
  maxTextures: number;
  maxGeometries: number;
  heapBaselineMb: number | null;
  latestHeapUsedMb: number | null;
  heapLimitMb: number | null;
};

type HeapSnapshot = {
  usedMb: number;
  limitMb: number;
};

type PerformanceWithMemory = Performance & {
  memory?: {
    usedJSHeapSize?: number;
    jsHeapSizeLimit?: number;
  };
};

function readHeapSnapshot(): HeapSnapshot | null {
  const performanceWithMemory = performance as PerformanceWithMemory;
  const memory = performanceWithMemory.memory;
  if (!memory) {
    return null;
  }

  const usedJSHeapSize = memory.usedJSHeapSize;
  const jsHeapSizeLimit = memory.jsHeapSizeLimit;
  if (
    typeof usedJSHeapSize !== "number" ||
    !Number.isFinite(usedJSHeapSize) ||
    typeof jsHeapSizeLimit !== "number" ||
    !Number.isFinite(jsHeapSizeLimit) ||
    jsHeapSizeLimit <= 0
  ) {
    return null;
  }

  return {
    usedMb: Number((usedJSHeapSize / (1024 * 1024)).toFixed(1)),
    limitMb: Number((jsHeapSizeLimit / (1024 * 1024)).toFixed(1))
  };
}

function createAggregate(
  startedAt: number,
  heapSnapshot: HeapSnapshot | null = null,
  preservedHeapBaselineMb: number | null = null
): RendererAggregate {
  const heapBaselineMb = preservedHeapBaselineMb ?? heapSnapshot?.usedMb ?? null;
  return {
    startedAt,
    frames: 0,
    maxDrawCalls: 0,
    maxTriangles: 0,
    maxTextures: 0,
    maxGeometries: 0,
    heapBaselineMb,
    latestHeapUsedMb: heapSnapshot?.usedMb ?? null,
    heapLimitMb: heapSnapshot?.limitMb ?? null
  };
}

export default function ScenePerformanceTelemetry({
  interactionMode
}: ScenePerformanceTelemetryProps) {
  const viewMode = useEditorStore((state) => state.viewMode);
  const topMode = useEditorStore((state) => state.topMode);
  const aggregateRef = useRef<RendererAggregate>(createAggregate(0));

  useEffect(() => {
    aggregateRef.current = createAggregate(performance.now(), readHeapSnapshot());
  }, [interactionMode, topMode, viewMode]);

  useFrame(({ gl }) => {
    if (!isSceneTelemetryEnabled()) {
      return;
    }

    const now = performance.now();
    const heapSnapshot = readHeapSnapshot();
    if (aggregateRef.current.startedAt === 0) {
      aggregateRef.current = createAggregate(now, heapSnapshot);
    }

    const aggregate = aggregateRef.current;
    aggregate.frames += 1;
    aggregate.maxDrawCalls = Math.max(
      aggregate.maxDrawCalls,
      gl.info.render.calls
    );
    aggregate.maxTriangles = Math.max(
      aggregate.maxTriangles,
      gl.info.render.triangles
    );
    aggregate.maxTextures = Math.max(
      aggregate.maxTextures,
      gl.info.memory.textures
    );
    aggregate.maxGeometries = Math.max(
      aggregate.maxGeometries,
      gl.info.memory.geometries
    );
    if (heapSnapshot) {
      aggregate.latestHeapUsedMb = heapSnapshot.usedMb;
      aggregate.heapLimitMb = heapSnapshot.limitMb;
      if (aggregate.heapBaselineMb === null) {
        aggregate.heapBaselineMb = heapSnapshot.usedMb;
      }
    }

    const elapsedMs = now - aggregate.startedAt;
    if (elapsedMs < 1000) {
      return;
    }

    const heapGrowthPercentPoints =
      aggregate.heapBaselineMb !== null &&
      aggregate.latestHeapUsedMb !== null &&
      aggregate.heapLimitMb !== null &&
      aggregate.heapLimitMb > 0
        ? Number(
            Math.max(
              ((aggregate.latestHeapUsedMb - aggregate.heapBaselineMb) /
                aggregate.heapLimitMb) *
                100,
              0
            ).toFixed(2)
          )
        : undefined;

    emitRendererStats({
      timestamp: new Date().toISOString(),
      path: window.location.pathname,
      interactionMode,
      viewMode,
      topMode,
      dpr: Number(gl.getPixelRatio().toFixed(2)),
      fps: Number(((aggregate.frames * 1000) / elapsedMs).toFixed(1)),
      frames: aggregate.frames,
      drawCalls: aggregate.maxDrawCalls,
      triangles: aggregate.maxTriangles,
      textures: aggregate.maxTextures,
      geometries: aggregate.maxGeometries,
      heapUsedMb: aggregate.latestHeapUsedMb ?? undefined,
      heapLimitMb: aggregate.heapLimitMb ?? undefined,
      heapGrowthPercentPoints
    });

    aggregateRef.current = createAggregate(
      now,
      heapSnapshot,
      aggregate.heapBaselineMb
    );
  });

  return null;
}
