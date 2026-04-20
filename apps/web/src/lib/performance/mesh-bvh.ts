"use client";

import * as THREE from "three";
import {
  acceleratedRaycast,
  computeBoundsTree,
  disposeBoundsTree,
  MeshBVH,
  type MeshBVHOptions
} from "three-mesh-bvh";
import { emitBvhBuild } from "./scene-telemetry";

type BVHBufferGeometry = THREE.BufferGeometry & {
  boundsTree?: MeshBVH;
  computeBoundsTree?: (options?: MeshBVHOptions) => MeshBVH;
  disposeBoundsTree?: () => void;
};

type BvhWorkerRequest = {
  requestId: number;
  position: Float32Array;
  index:
    | Uint32Array
    | Uint16Array
    | Uint8Array
    | Int32Array
    | Int16Array
    | Int8Array
    | null;
  groups: Array<{
    start: number;
    count: number;
    materialIndex?: number;
  }>;
  options: Omit<MeshBVHOptions, "onProgress" | "useSharedArrayBuffer" | "range">;
};

type BvhWorkerResponse =
  | {
      requestId: number;
      ok: true;
      serialized: ReturnType<typeof MeshBVH.serialize>;
      boundingBox: {
        min: [number, number, number];
        max: [number, number, number];
      };
    }
  | {
      requestId: number;
      ok: false;
      error: string;
    };

const WORKER_TRIANGLE_THRESHOLD = 512;

let meshBvhInstalled = false;
let requestSequence = 0;
let workerQueue = Promise.resolve();
let buildWorker: Worker | null = null;
const pendingGenerations = new WeakMap<BVHBufferGeometry, Promise<MeshBVH>>();

function installMeshBvhRaycast() {
  const geometryPrototype =
    THREE.BufferGeometry.prototype as BVHBufferGeometry;

  if (!geometryPrototype.computeBoundsTree) {
    geometryPrototype.computeBoundsTree = computeBoundsTree;
  }

  if (!geometryPrototype.disposeBoundsTree) {
    geometryPrototype.disposeBoundsTree = disposeBoundsTree;
  }

  if (!meshBvhInstalled) {
    THREE.Mesh.prototype.raycast = acceleratedRaycast;
    meshBvhInstalled = true;
  }
}

function getTriangleCount(geometry: THREE.BufferGeometry) {
  if (geometry.index) {
    return geometry.index.count / 3;
  }

  return geometry.attributes.position
    ? geometry.attributes.position.count / 3
    : 0;
}

function getPathname() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.location.pathname;
}

function reportBvhBuild(
  geometry: BVHBufferGeometry,
  triangleCount: number,
  startedAt: number,
  mode: "sync" | "worker",
  status: "success" | "error",
  reason?: string
) {
  emitBvhBuild({
    timestamp: new Date().toISOString(),
    path: getPathname(),
    geometryUuid: geometry.uuid,
    triangleCount,
    durationMs: Number((performance.now() - startedAt).toFixed(2)),
    mode,
    status,
    ...(reason ? { reason } : {})
  });
}

function cloneIndexArray(
  geometry: THREE.BufferGeometry
): BvhWorkerRequest["index"] {
  const array = geometry.index?.array;
  if (!array) {
    return null;
  }

  return array.slice() as BvhWorkerRequest["index"];
}

function isInterleavedAttribute(
  attribute:
    | THREE.BufferAttribute
    | THREE.InterleavedBufferAttribute
    | undefined
    | null
) {
  return Boolean(
    attribute &&
      "isInterleavedBufferAttribute" in attribute &&
      attribute.isInterleavedBufferAttribute
  );
}

function buildSyncBoundsTree(
  geometry: BVHBufferGeometry,
  options?: MeshBVHOptions,
  reason?: string
) {
  const startedAt = performance.now();
  const triangleCount = getTriangleCount(geometry);

  try {
    const bvh = geometry.computeBoundsTree?.(options);
    if (!geometry.boundsTree && bvh) {
      geometry.boundsTree = bvh;
    }

    reportBvhBuild(geometry, triangleCount, startedAt, "sync", "success", reason);
  } catch (error) {
    reportBvhBuild(
      geometry,
      triangleCount,
      startedAt,
      "sync",
      "error",
      error instanceof Error ? error.message : reason
    );
  }
}

function getBuildWorker() {
  if (typeof window === "undefined" || typeof Worker === "undefined") {
    return null;
  }

  if (buildWorker) {
    return buildWorker;
  }

  try {
    buildWorker = new Worker(
      new URL("./mesh-bvh.worker.ts", import.meta.url),
      { type: "module" }
    );
  } catch {
    buildWorker = null;
  }

  return buildWorker;
}

function generateBoundsTreeInWorker(
  geometry: BVHBufferGeometry,
  options: Omit<MeshBVHOptions, "onProgress" | "useSharedArrayBuffer" | "range">
) {
  const triangleCount = getTriangleCount(geometry);
  const worker = getBuildWorker();

  if (!worker) {
    buildSyncBoundsTree(geometry, options, "worker-unavailable");
    return Promise.resolve(geometry.boundsTree as MeshBVH);
  }

  const requestId = ++requestSequence;
  const startedAt = performance.now();
  const position = geometry.attributes.position.array.slice() as Float32Array;
  const index = cloneIndexArray(geometry);

  const task = workerQueue.then(
    () =>
      new Promise<MeshBVH>((resolve, reject) => {
        const cleanup = () => {
          worker.removeEventListener("message", handleMessage);
          worker.removeEventListener("error", handleError);
        };

        const handleMessage = (event: MessageEvent<BvhWorkerResponse>) => {
          const response = event.data;
          if (response.requestId !== requestId) {
            return;
          }

          cleanup();

          if (response.ok === false) {
            reportBvhBuild(
              geometry,
              triangleCount,
              startedAt,
              "worker",
              "error",
              response.error
            );
            reject(new Error(response.error));
            return;
          }

          const bvh = MeshBVH.deserialize(response.serialized, geometry, {
            setIndex: true
          });
          geometry.boundsTree = bvh;
          geometry.boundingBox = new THREE.Box3(
            new THREE.Vector3(...response.boundingBox.min),
            new THREE.Vector3(...response.boundingBox.max)
          );
          reportBvhBuild(
            geometry,
            triangleCount,
            startedAt,
            "worker",
            "success"
          );
          resolve(bvh);
        };

        const handleError = () => {
          cleanup();
          const message = "mesh-bvh worker crashed";
          reportBvhBuild(
            geometry,
            triangleCount,
            startedAt,
            "worker",
            "error",
            message
          );
          reject(new Error(message));
        };

        worker.addEventListener("message", handleMessage);
        worker.addEventListener("error", handleError);

        const payload: BvhWorkerRequest = {
          requestId,
          position,
          index,
          groups: geometry.groups.map((group) => ({
            start: group.start,
            count: group.count,
            materialIndex: group.materialIndex
          })),
          options
        };

        worker.postMessage(payload);
      })
  );

  workerQueue = task.catch(() => undefined);
  return task;
}

function scheduleGeometryBoundsTree(
  geometry: BVHBufferGeometry,
  options?: MeshBVHOptions
) {
  if (!geometry.attributes.position || geometry.boundsTree) {
    return;
  }

  const existing = pendingGenerations.get(geometry);
  if (existing) {
    return;
  }

  const positionAttribute = geometry.attributes.position;
  const indexAttribute = geometry.index;
  const triangleCount = getTriangleCount(geometry);
  const shouldUseWorker =
    !isInterleavedAttribute(positionAttribute) &&
    !isInterleavedAttribute(indexAttribute) &&
    triangleCount >= WORKER_TRIANGLE_THRESHOLD;

  if (!shouldUseWorker) {
    const reason =
      triangleCount < WORKER_TRIANGLE_THRESHOLD
        ? "below-worker-threshold"
        : "interleaved-attributes";
    buildSyncBoundsTree(geometry, options, reason);
    return;
  }

  const safeOptions = {
    strategy: options?.strategy,
    maxDepth: options?.maxDepth,
    maxLeafTris: options?.maxLeafTris,
    setBoundingBox: options?.setBoundingBox,
    verbose: options?.verbose
  } satisfies Omit<MeshBVHOptions, "onProgress" | "useSharedArrayBuffer" | "range">;

  const generation = generateBoundsTreeInWorker(geometry, safeOptions).finally(
    () => {
      pendingGenerations.delete(geometry);
    }
  );
  pendingGenerations.set(geometry, generation);
}

export function ensureSceneBoundsTrees(
  root: THREE.Object3D,
  options?: MeshBVHOptions
) {
  installMeshBvhRaycast();

  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return;
    }

    const geometry = child.geometry as BVHBufferGeometry | undefined;
    if (!geometry) {
      return;
    }

    scheduleGeometryBoundsTree(geometry, options);
  });
}
