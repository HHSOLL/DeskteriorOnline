import type { AttachmentType } from "@deskterioronline/scene-schema";
import { BufferGeometry, Mesh, Raycaster, Vector3, type Intersection } from "three";
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from "three-mesh-bvh";
import type { SurfaceResolver } from "./SurfaceResolver";
import type { SurfaceHit } from "./types";

export type RayPickerInput = {
  supportObjectId: string;
  attachmentType: AttachmentType;
  preferredSurfaceId?: string;
  compatibleWith?: string[];
  surfaceHits?: SurfaceHit[];
};

export type RayPickerGeometryCandidate = {
  objectId: string;
  surfaceId: string;
  surface: SurfaceHit["surface"];
  mesh: Mesh;
  buildBoundsTree?: boolean;
  worldPointToSurfaceLocalMm?: (
    point: Vector3,
    intersection: Intersection
  ) => Partial<NonNullable<SurfaceHit["localPose"]>>;
};

export type RayPickerGeometryInput = Omit<RayPickerInput, "surfaceHits"> & {
  ray: {
    origin: [number, number, number];
    direction: [number, number, number];
    near?: number;
    far?: number;
  };
  candidates: RayPickerGeometryCandidate[];
};

let bvhInstalled = false;

function installBvhRaycast() {
  if (bvhInstalled) {
    return;
  }

  BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
  BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
  Mesh.prototype.raycast = acceleratedRaycast;
  bvhInstalled = true;
}

function normalizeVector(input: [number, number, number]) {
  return new Vector3(input[0], input[1], input[2]).normalize();
}

function projectWorldPointToSurfaceLocalMm(
  candidate: RayPickerGeometryCandidate,
  intersection: Intersection
): Partial<NonNullable<SurfaceHit["localPose"]>> {
  if (candidate.worldPointToSurfaceLocalMm) {
    return candidate.worldPointToSurfaceLocalMm(intersection.point, intersection);
  }

  const localPointMm = candidate.mesh.worldToLocal(intersection.point.clone()).multiplyScalar(1000);
  const frame = candidate.surface.localFrame;
  const origin = new Vector3(frame.originMm[0], frame.originMm[1], frame.originMm[2]);
  const tangentU = normalizeVector(frame.tangentU);
  const tangentV = normalizeVector(frame.tangentV);
  const normal = normalizeVector(frame.normal);
  const delta = localPointMm.sub(origin);

  return {
    uMm: delta.dot(tangentU),
    vMm: delta.dot(tangentV),
    normalOffsetMm: delta.dot(normal)
  };
}

export class RayPicker {
  constructor(private readonly surfaceResolver: SurfaceResolver) {}

  pick(input: RayPickerInput): SurfaceHit | null {
    return this.surfaceResolver.resolveCompatibleSurface(
      input.supportObjectId,
      input.attachmentType,
      input.preferredSurfaceId,
      input.compatibleWith,
      input.surfaceHits
    );
  }

  pickGeometry(input: RayPickerGeometryInput): SurfaceHit | null {
    installBvhRaycast();

    const compatibleSurfaces = new Set(
      this.surfaceResolver
        .listCompatibleSurfaces(input.supportObjectId, input.attachmentType, input.compatibleWith)
        .map((surface) => surface.id)
    );
    const raycaster = new Raycaster(
      new Vector3(input.ray.origin[0], input.ray.origin[1], input.ray.origin[2]),
      normalizeVector(input.ray.direction),
      input.ray.near,
      input.ray.far
    );
    raycaster.firstHitOnly = true;

    const hits: SurfaceHit[] = [];
    for (const candidate of input.candidates) {
      if (candidate.objectId !== input.supportObjectId || !compatibleSurfaces.has(candidate.surfaceId)) {
        continue;
      }

      if (candidate.buildBoundsTree !== false && !candidate.mesh.geometry.boundsTree) {
        candidate.mesh.geometry.computeBoundsTree();
      }

      const [intersection] = raycaster.intersectObject(candidate.mesh, false);
      if (!intersection) {
        continue;
      }

      const localPose = projectWorldPointToSurfaceLocalMm(candidate, intersection);
      hits.push({
        objectId: candidate.objectId,
        surfaceId: candidate.surfaceId,
        surface: candidate.surface,
        distance: intersection.distance,
        localPose,
        worldPointMm: [
          intersection.point.x * 1000,
          intersection.point.y * 1000,
          intersection.point.z * 1000
        ]
      });
    }

    return this.surfaceResolver.resolveCompatibleSurface(
      input.supportObjectId,
      input.attachmentType,
      input.preferredSurfaceId,
      input.compatibleWith,
      hits
    );
  }
}
