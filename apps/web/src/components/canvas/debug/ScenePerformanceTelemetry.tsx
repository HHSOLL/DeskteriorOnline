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
};

function createAggregate(startedAt: number): RendererAggregate {
  return {
    startedAt,
    frames: 0,
    maxDrawCalls: 0,
    maxTriangles: 0,
    maxTextures: 0,
    maxGeometries: 0
  };
}

export default function ScenePerformanceTelemetry({
  interactionMode
}: ScenePerformanceTelemetryProps) {
  const viewMode = useEditorStore((state) => state.viewMode);
  const topMode = useEditorStore((state) => state.topMode);
  const aggregateRef = useRef<RendererAggregate>(createAggregate(0));

  useEffect(() => {
    aggregateRef.current = createAggregate(performance.now());
  }, [interactionMode, topMode, viewMode]);

  useFrame(({ gl }) => {
    if (!isSceneTelemetryEnabled()) {
      return;
    }

    const now = performance.now();
    if (aggregateRef.current.startedAt === 0) {
      aggregateRef.current = createAggregate(now);
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

    const elapsedMs = now - aggregate.startedAt;
    if (elapsedMs < 1000) {
      return;
    }

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
      geometries: aggregate.maxGeometries
    });

    aggregateRef.current = createAggregate(now);
  });

  return null;
}
