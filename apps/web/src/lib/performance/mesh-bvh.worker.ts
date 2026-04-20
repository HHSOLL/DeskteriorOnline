import { Box3, BufferAttribute, BufferGeometry } from "three";
import { MeshBVH, type MeshBVHOptions } from "three-mesh-bvh";

export {};

type MeshBvhWorkerScope = {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage: (message: WorkerResponse, transfer?: Transferable[]) => void;
};

const workerScope = self as unknown as MeshBvhWorkerScope;

type TypedArray =
  | Float32Array
  | Uint32Array
  | Uint16Array
  | Uint8Array
  | Int32Array
  | Int16Array
  | Int8Array;

type WorkerRequest = {
  requestId: number;
  position: Float32Array;
  index: TypedArray | null;
  groups: Array<{
    start: number;
    count: number;
    materialIndex?: number;
  }>;
  options: Omit<MeshBVHOptions, "onProgress" | "useSharedArrayBuffer" | "range">;
};

type WorkerResponse =
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

workerScope.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { requestId, position, index, groups, options } = event.data;

  try {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(position, 3, false));

    if (index) {
      geometry.setIndex(new BufferAttribute(index, 1, false));
    }

    for (const group of groups) {
      geometry.addGroup(
        group.start,
        group.count,
        group.materialIndex ?? 0
      );
    }

    const bvh = new MeshBVH(geometry, {
      ...options,
      setBoundingBox: false
    });
    const serialized = MeshBVH.serialize(bvh, { cloneBuffers: false });
    const boundingBox = bvh.getBoundingBox(new Box3());

    const response: WorkerResponse = {
      requestId,
      ok: true,
      serialized,
      boundingBox: {
        min: [
          boundingBox.min.x,
          boundingBox.min.y,
          boundingBox.min.z
        ],
        max: [
          boundingBox.max.x,
          boundingBox.max.y,
          boundingBox.max.z
        ]
      }
    };

    const transferables: Transferable[] = [
      ...serialized.roots.filter(
        (value): value is ArrayBuffer => value instanceof ArrayBuffer
      )
    ];

    if (serialized.index?.buffer instanceof ArrayBuffer) {
      transferables.push(serialized.index.buffer);
    }

    workerScope.postMessage(response, transferables);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown BVH worker error.";
    const response: WorkerResponse = {
      requestId,
      ok: false,
      error: message
    };
    workerScope.postMessage(response);
  }
};
