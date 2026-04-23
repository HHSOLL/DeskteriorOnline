import { normalizeSceneAnchorType, type SceneAnchorType } from "./anchor-types";
import {
  resolveAssetSupportProfile,
  type AssetSupportProfile,
  type SupportAnchorType
} from "./support-profiles";

const DEFAULT_CEILING_HEIGHT = 2.8;

type WallLike = {
  start: [number, number];
  end: [number, number];
  height?: number;
};

type CeilingLike = {
  height: number;
};

type AnchorAssetLike = {
  id: string;
  assetId: string;
  catalogItemId?: string | null;
  product?: {
    dimensionsMm?: {
      width: number;
      depth: number;
      height: number;
    } | null;
  } | null;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  anchorType?: SceneAnchorType;
  supportAssetId?: string | null;
  supportProfile?: AssetSupportProfile | null;
};

type ActivePlacementAssetLike = {
  id?: string;
  assetId: string;
  catalogItemId?: string | null;
  product?: AnchorAssetLike["product"] | null;
  scale?: [number, number, number];
  supportProfile?: AssetSupportProfile | null;
};

type ProductDimensionsMm = {
  width: number;
  depth: number;
  height: number;
};

type Position = [number, number, number];
type Rotation = [number, number, number];
type SurfacePlacement = {
  position: Position;
  supportAssetId: string | null;
};
type WorldBounds = {
  width: number;
  depth: number;
  height: number;
  halfWidth: number;
  halfDepth: number;
  radius: number;
};

const SMALL_OBJECT_KEYWORDS = [
  "monitor",
  "keyboard",
  "mouse",
  "laptop",
  "tablet",
  "speaker",
  "headset",
  "microphone"
];
const WALL_OBJECT_KEYWORDS = ["mirror", "wall art", "wall", "painting", "frame", "sconce"];
const CEILING_OBJECT_KEYWORDS = ["pendant", "chandelier", "ceiling"];
const SHELF_OBJECT_KEYWORDS = ["book", "vase", "figurine", "ornament", "frame"];
const DESK_SURFACE_SUPPORT_KEYWORDS = ["desk", "table", "workbench", "console"];
const SHELF_SURFACE_SUPPORT_KEYWORDS = ["shelf", "bookcase", "rack", "cabinet"];
const FURNITURE_SURFACE_SUPPORT_KEYWORDS = [
  "desk",
  "table",
  "shelf",
  "bookcase",
  "cabinet",
  "console",
  "dresser",
  "stand",
  "nightstand",
  "bedside"
];

const DEFAULT_ACTIVE_BOUNDS_BY_ANCHOR: Record<SceneAnchorType, ProductDimensionsMm> = {
  floor: { width: 900, depth: 620, height: 900 },
  wall: { width: 520, depth: 120, height: 620 },
  ceiling: { width: 420, depth: 420, height: 360 },
  furniture_surface: { width: 320, depth: 220, height: 280 },
  desk_surface: { width: 280, depth: 180, height: 220 },
  shelf_surface: { width: 220, depth: 160, height: 260 }
};

const FLOOR_WALL_CLEARANCE = 0.04;
const SURFACE_WALL_CLEARANCE = 0.02;
const FLOOR_SEPARATION_GAP = 0.05;
const SURFACE_SEPARATION_GAP = 0.025;
const MAX_RELAXATION_ITERATIONS = 6;
const MAX_RELAXATION_STEP = 0.18;
const POSITION_EPSILON = 1e-4;

function projectPointToSegment2D(
  pointX: number,
  pointZ: number,
  startX: number,
  startZ: number,
  endX: number,
  endZ: number
) {
  const deltaX = endX - startX;
  const deltaZ = endZ - startZ;
  const lenSq = deltaX * deltaX + deltaZ * deltaZ;
  if (lenSq <= Number.EPSILON) {
    return {
      x: startX,
      z: startZ,
      distanceSq: (pointX - startX) ** 2 + (pointZ - startZ) ** 2,
      yaw: 0
    };
  }
  const t = Math.max(0, Math.min(1, ((pointX - startX) * deltaX + (pointZ - startZ) * deltaZ) / lenSq));
  const x = startX + deltaX * t;
  const z = startZ + deltaZ * t;
  return {
    x,
    z,
    distanceSq: (pointX - x) ** 2 + (pointZ - z) ** 2,
    yaw: Math.atan2(deltaZ, deltaX)
  };
}

function getDefaultAnchorHeight(anchorType: SceneAnchorType, ceilingHeight: number): number {
  switch (anchorType) {
    case "ceiling":
      return ceilingHeight;
    case "desk_surface":
      return 0.74;
    case "furniture_surface":
      return 0.82;
    case "shelf_surface":
      return 1.35;
    case "wall":
      return Math.min(Math.max(ceilingHeight * 0.5, 0.9), ceilingHeight - 0.25);
    case "floor":
    default:
      return 0;
  }
}

function normalizeDimensionsMm(dimensionsMm?: ProductDimensionsMm | null) {
  if (!dimensionsMm) return null;
  const width = Number(dimensionsMm.width);
  const depth = Number(dimensionsMm.depth);
  const height = Number(dimensionsMm.height);
  if (!Number.isFinite(width) || !Number.isFinite(depth) || !Number.isFinite(height)) {
    return null;
  }
  if (width <= 0 || depth <= 0 || height <= 0) {
    return null;
  }
  return { width: width / 1000, depth: depth / 1000, height: height / 1000 };
}

function inferAssetBounds(assetId: string, dimensionsMm?: ProductDimensionsMm | null) {
  const dimensionsBounds = normalizeDimensionsMm(dimensionsMm);
  if (dimensionsBounds) {
    return dimensionsBounds;
  }

  const haystack = assetId.toLowerCase();
  if (haystack.includes("desk") || haystack.includes("table")) {
    return { width: 1.4, depth: 0.7, height: 0.75 };
  }
  if (haystack.includes("shelf") || haystack.includes("bookcase") || haystack.includes("cabinet")) {
    return { width: 1.0, depth: 0.38, height: 1.75 };
  }
  if (haystack.includes("sofa")) {
    return { width: 2.1, depth: 0.92, height: 0.9 };
  }
  if (haystack.includes("bed")) {
    return { width: 2.0, depth: 1.65, height: 0.58 };
  }
  if (haystack.includes("chair") || haystack.includes("stool")) {
    return { width: 0.62, depth: 0.62, height: 0.92 };
  }
  return { width: 1.0, depth: 1.0, height: 1.0 };
}

function createWorldBounds(width: number, depth: number, height: number): WorldBounds {
  const nextWidth = Math.max(width, 0.05);
  const nextDepth = Math.max(depth, 0.05);
  const nextHeight = Math.max(height, 0.05);
  const halfWidth = nextWidth / 2;
  const halfDepth = nextDepth / 2;
  return {
    width: nextWidth,
    depth: nextDepth,
    height: nextHeight,
    halfWidth,
    halfDepth,
    radius: Math.max(Math.hypot(halfWidth, halfDepth), 0.05)
  };
}

function getScaleMagnitude(scale: [number, number, number]) {
  return {
    x: Math.max(Math.abs(scale[0]), 0.1),
    y: Math.max(Math.abs(scale[1]), 0.1),
    z: Math.max(Math.abs(scale[2]), 0.1)
  };
}

function isSurfaceAnchorType(anchorType: SceneAnchorType): anchorType is SupportAnchorType {
  return (
    anchorType === "desk_surface" ||
    anchorType === "shelf_surface" ||
    anchorType === "furniture_surface"
  );
}

function matchesSupportCandidate(anchorType: SceneAnchorType, assetId: string) {
  const haystack = assetId.toLowerCase();
  if (anchorType === "desk_surface") {
    return DESK_SURFACE_SUPPORT_KEYWORDS.some((keyword) => haystack.includes(keyword));
  }
  if (anchorType === "shelf_surface") {
    return SHELF_SURFACE_SUPPORT_KEYWORDS.some((keyword) => haystack.includes(keyword));
  }
  if (anchorType === "furniture_surface") {
    return FURNITURE_SURFACE_SUPPORT_KEYWORDS.some((keyword) => haystack.includes(keyword));
  }
  return false;
}

function rotateXZ(x: number, z: number, yaw: number) {
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  return {
    x: x * cos - z * sin,
    z: x * sin + z * cos
  };
}

function inverseRotateXZ(x: number, z: number, yaw: number) {
  return rotateXZ(x, z, -yaw);
}

function getWorldBoundsForAsset(
  assetId: string,
  scale: [number, number, number],
  dimensionsMm?: ProductDimensionsMm | null
) {
  const baseBounds = inferAssetBounds(assetId, dimensionsMm);
  const magnitude = getScaleMagnitude(scale);
  return createWorldBounds(
    baseBounds.width * magnitude.x,
    baseBounds.depth * magnitude.z,
    baseBounds.height * magnitude.y
  );
}

function getWorldBoundsForSceneAsset(asset: AnchorAssetLike) {
  return getWorldBoundsForAsset(asset.assetId, asset.scale, asset.product?.dimensionsMm ?? null);
}

function getFallbackBoundsForAnchor(anchorType: SceneAnchorType) {
  const fallback = DEFAULT_ACTIVE_BOUNDS_BY_ANCHOR[anchorType];
  return getWorldBoundsForAsset(`fallback-${anchorType}`, [1, 1, 1], fallback);
}

function resolveActiveAssetBounds(
  anchorType: SceneAnchorType,
  sceneAssets: AnchorAssetLike[],
  activeAssetId?: string,
  activeAssetDescriptor?: ActivePlacementAssetLike
) {
  if (activeAssetDescriptor) {
    return getWorldBoundsForAsset(
      activeAssetDescriptor.assetId,
      activeAssetDescriptor.scale ?? [1, 1, 1],
      activeAssetDescriptor.product?.dimensionsMm ?? null
    );
  }
  const activeSceneAsset =
    typeof activeAssetId === "string" && activeAssetId.length > 0
      ? sceneAssets.find((asset) => asset.id === activeAssetId) ?? null
      : null;
  if (!activeSceneAsset) {
    return getFallbackBoundsForAnchor(anchorType);
  }
  return getWorldBoundsForSceneAsset(activeSceneAsset);
}

function getProjectedHalfExtent(bounds: WorldBounds, yaw: number, axisX: number, axisZ: number) {
  const localXAxisX = Math.cos(yaw);
  const localXAxisZ = Math.sin(yaw);
  const localZAxisX = -Math.sin(yaw);
  const localZAxisZ = Math.cos(yaw);
  return (
    Math.abs(axisX * localXAxisX + axisZ * localXAxisZ) * bounds.halfWidth +
    Math.abs(axisX * localZAxisX + axisZ * localZAxisZ) * bounds.halfDepth
  );
}

function resolveClearanceNormal(
  pointX: number,
  pointZ: number,
  projectedX: number,
  projectedZ: number,
  yaw: number
) {
  const deltaX = pointX - projectedX;
  const deltaZ = pointZ - projectedZ;
  const length = Math.hypot(deltaX, deltaZ);
  if (length > Number.EPSILON) {
    return {
      x: deltaX / length,
      z: deltaZ / length,
      distance: length
    };
  }
  return {
    x: -Math.sin(yaw),
    z: Math.cos(yaw),
    distance: 0
  };
}

function getHeuristicSupportProfile(
  anchorType: SupportAnchorType,
  assetId: string,
  dimensionsMm?: ProductDimensionsMm | null
) {
  if (!matchesSupportCandidate(anchorType, assetId)) {
    return null;
  }

  const bounds = inferAssetBounds(assetId, dimensionsMm);
  if (anchorType === "shelf_surface") {
    return {
      surfaces: [
        {
          id: "heuristic-shelf",
          anchorTypes: ["shelf_surface"],
          center: [0, 0],
          size: [Math.max(bounds.width * 0.82, 0.28), Math.max(bounds.depth * 0.72, 0.18)],
          top: Math.max(bounds.height * 0.72, 0.8),
          margin: [0.06, 0.04]
        }
      ]
    } satisfies AssetSupportProfile;
  }

  return {
    surfaces: [
      {
        id: "heuristic-top",
        anchorTypes: [anchorType, "furniture_surface"],
        center: [0, 0],
        size: [Math.max(bounds.width * 0.86, 0.3), Math.max(bounds.depth * 0.82, 0.2)],
        top: bounds.height,
        margin: [0.08, 0.06]
      }
    ]
  } satisfies AssetSupportProfile;
}

function resolveSupportProfileForAsset(asset: AnchorAssetLike, anchorType: SupportAnchorType) {
  return (
    resolveAssetSupportProfile({
      catalogItemId: asset.catalogItemId,
      assetId: asset.assetId,
      dimensionsMm: asset.product?.dimensionsMm ?? null,
      supportProfile: asset.supportProfile
    }) ?? getHeuristicSupportProfile(anchorType, asset.assetId, asset.product?.dimensionsMm)
  );
}

function resolveSurfacePlacementForCandidate(
  anchorType: SupportAnchorType,
  position: Position,
  asset: AnchorAssetLike,
  options?: {
    activeBounds?: WorldBounds;
    activeRotationY?: number;
  }
) {
  const profile = resolveSupportProfileForAsset(asset, anchorType);
  if (!profile) {
    return null;
  }

  const [x, , z] = position;
  const scale = getScaleMagnitude(asset.scale);
  const yaw = asset.rotation[1] ?? 0;
  const hoverOffset = anchorType === "shelf_surface" ? 0.05 : 0.03;

  return profile.surfaces
    .filter((surface) => surface.anchorTypes.some((entry) => entry === anchorType))
    .reduce<{
      position: Position;
      distanceSq: number;
      supportAssetId: string;
      explicit: boolean;
    } | null>((best, surface) => {
      const centerOffset = rotateXZ(surface.center[0] * scale.x, surface.center[1] * scale.z, yaw);
      const surfaceCenterX = asset.position[0] + centerOffset.x;
      const surfaceCenterZ = asset.position[2] + centerOffset.z;
      const localPoint = inverseRotateXZ(x - surfaceCenterX, z - surfaceCenterZ, yaw);
      const halfWidth = Math.max((surface.size[0] * scale.x) / 2, 0);
      const halfDepth = Math.max((surface.size[1] * scale.z) / 2, 0);
      const marginX = Math.min(surface.margin?.[0] ?? 0.08, halfWidth);
      const marginZ = Math.min(surface.margin?.[1] ?? 0.06, halfDepth);
      const activeBounds = options?.activeBounds;
      const activeRotationY = options?.activeRotationY ?? 0;
      const relativeYaw = activeRotationY - yaw;
      const activeHalfWidthLocal = activeBounds
        ? Math.abs(Math.cos(relativeYaw)) * activeBounds.halfWidth +
          Math.abs(Math.sin(relativeYaw)) * activeBounds.halfDepth
        : 0;
      const activeHalfDepthLocal = activeBounds
        ? Math.abs(Math.sin(relativeYaw)) * activeBounds.halfWidth +
          Math.abs(Math.cos(relativeYaw)) * activeBounds.halfDepth
        : 0;
      const usableHalfWidth = Math.max(halfWidth - marginX - activeHalfWidthLocal, 0);
      const usableHalfDepth = Math.max(halfDepth - marginZ - activeHalfDepthLocal, 0);
      const minX = -usableHalfWidth;
      const maxX = usableHalfWidth;
      const minZ = -usableHalfDepth;
      const maxZ = usableHalfDepth;
      const clampedLocalX = Math.min(maxX, Math.max(minX, localPoint.x));
      const clampedLocalZ = Math.min(maxZ, Math.max(minZ, localPoint.z));
      const worldOffset = rotateXZ(clampedLocalX, clampedLocalZ, yaw);
      const clampedX = surfaceCenterX + worldOffset.x;
      const clampedZ = surfaceCenterZ + worldOffset.z;
      const topY = asset.position[1] + surface.top * scale.y + hoverOffset;
      const distanceSq = (clampedX - x) ** 2 + (clampedZ - z) ** 2;
      const candidatePlacement = {
        position: [clampedX, topY, clampedZ] as Position,
        distanceSq,
        supportAssetId: asset.id,
        explicit: Boolean(asset.supportProfile)
      };
      if (!best) {
        return candidatePlacement;
      }
      if (candidatePlacement.distanceSq < best.distanceSq - 1e-6) {
        return candidatePlacement;
      }
      if (
        Math.abs(candidatePlacement.distanceSq - best.distanceSq) <= 1e-6 &&
        candidatePlacement.explicit &&
        !best.explicit
      ) {
        return candidatePlacement;
      }
      return best;
    }, null);
}

function constrainToSupportingSurface(
  anchorType: SupportAnchorType,
  position: Position,
  sceneAssets: AnchorAssetLike[],
  options?: {
    activeAssetId?: string;
    supportAssetId?: string | null;
    activeBounds?: WorldBounds;
    activeRotationY?: number;
  }
): SurfacePlacement | null {
  const supportCandidates = sceneAssets.filter((asset) => {
    if (asset.id === options?.activeAssetId) return false;
    const candidateAnchorType = normalizeSceneAnchorType(asset.anchorType);
    if (candidateAnchorType === "ceiling") return false;
    return Boolean(resolveSupportProfileForAsset(asset, anchorType));
  });

  if (supportCandidates.length === 0) {
    return null;
  }

  const picked = supportCandidates.reduce<{
    position: Position;
    distanceSq: number;
    supportAssetId: string;
  } | null>((best, candidate) => {
    const placement = resolveSurfacePlacementForCandidate(anchorType, position, candidate, {
      activeBounds: options?.activeBounds,
      activeRotationY: options?.activeRotationY
    });
    if (!placement) {
      return best;
    }
    if (!best || placement.distanceSq < best.distanceSq) {
      return placement;
    }
    return best;
  }, null);

  if (!picked) {
    return null;
  }

  const assignedSupport = options?.supportAssetId
    ? supportCandidates.find((asset) => asset.id === options.supportAssetId)
    : null;
  const assignedPlacement =
    assignedSupport &&
    resolveSurfacePlacementForCandidate(anchorType, position, assignedSupport, {
      activeBounds: options?.activeBounds,
      activeRotationY: options?.activeRotationY
    });
  if (!assignedPlacement) {
    return {
      position: picked.position,
      supportAssetId: picked.supportAssetId
    };
  }

  const SUPPORT_STICKY_DISTANCE_SQ = 0.18;
  if (assignedPlacement.distanceSq <= picked.distanceSq + SUPPORT_STICKY_DISTANCE_SQ) {
    return {
      position: assignedPlacement.position,
      supportAssetId: assignedPlacement.supportAssetId
    };
  }

  return {
    position: picked.position,
    supportAssetId: picked.supportAssetId
  };
}

function applyWallClearance(
  anchorType: SceneAnchorType,
  position: Position,
  rotationY: number,
  bounds: WorldBounds,
  walls: WallLike[],
  scale: number
) {
  if (walls.length === 0 || (anchorType !== "floor" && !isSurfaceAnchorType(anchorType))) {
    return position;
  }

  const clearance = anchorType === "floor" ? FLOOR_WALL_CLEARANCE : SURFACE_WALL_CLEARANCE;
  let nextX = position[0];
  let nextZ = position[2];

  for (let iteration = 0; iteration < 2; iteration += 1) {
    let moved = false;
    for (const wall of walls) {
      const startX = wall.start[0] * scale;
      const startZ = wall.start[1] * scale;
      const endX = wall.end[0] * scale;
      const endZ = wall.end[1] * scale;
      const projected = projectPointToSegment2D(nextX, nextZ, startX, startZ, endX, endZ);
      const normal = resolveClearanceNormal(nextX, nextZ, projected.x, projected.z, projected.yaw);
      const requiredDistance = getProjectedHalfExtent(bounds, rotationY, normal.x, normal.z) + clearance;
      if (normal.distance + 1e-6 >= requiredDistance) {
        continue;
      }
      const pushDistance = requiredDistance - normal.distance;
      nextX += normal.x * pushDistance;
      nextZ += normal.z * pushDistance;
      moved = true;
    }
    if (!moved) {
      break;
    }
  }

  return [nextX, position[1], nextZ] as Position;
}

function getPlacementHeightRange(position: Position, bounds: WorldBounds) {
  return {
    minY: position[1],
    maxY: position[1] + bounds.height
  };
}

function rangesOverlap(
  aMin: number,
  aMax: number,
  bMin: number,
  bMax: number,
  tolerance = 0.02
) {
  return aMin < bMax - tolerance && bMin < aMax - tolerance;
}

function isCollisionCandidate(
  anchorType: SceneAnchorType,
  supportAssetId: string | null,
  candidate: AnchorAssetLike,
  activeAssetId: string | undefined,
  activePosition: Position,
  activeBounds: WorldBounds
) {
  if (candidate.id === activeAssetId) return false;
  if (candidate.id === supportAssetId || candidate.supportAssetId === activeAssetId) {
    return false;
  }

  const candidateAnchorType = normalizeSceneAnchorType(candidate.anchorType);
  if (candidateAnchorType === "wall" || candidateAnchorType === "ceiling") {
    return false;
  }

  const candidateBounds = getWorldBoundsForSceneAsset(candidate);
  const activeHeightRange = getPlacementHeightRange(activePosition, activeBounds);
  const candidateHeightRange = getPlacementHeightRange(candidate.position, candidateBounds);
  if (
    !rangesOverlap(
      activeHeightRange.minY,
      activeHeightRange.maxY,
      candidateHeightRange.minY,
      candidateHeightRange.maxY
    )
  ) {
    return false;
  }

  if (
    isSurfaceAnchorType(anchorType) &&
    isSurfaceAnchorType(candidateAnchorType) &&
    supportAssetId &&
    candidate.supportAssetId &&
    supportAssetId !== candidate.supportAssetId
  ) {
    const supportDistance = Math.hypot(
      activePosition[0] - candidate.position[0],
      activePosition[2] - candidate.position[2]
    );
    if (supportDistance > activeBounds.radius + candidateBounds.radius + 0.35) {
      return false;
    }
  }

  return true;
}

function getCollisionFallbackDirection(candidateId: string) {
  let hash = 0;
  for (let index = 0; index < candidateId.length; index += 1) {
    hash = (hash * 33 + candidateId.charCodeAt(index)) >>> 0;
  }
  const angle = (hash % 360) * (Math.PI / 180);
  return {
    x: Math.cos(angle) || 1,
    z: Math.sin(angle) || 0
  };
}

function relaxAgainstSceneAssets(
  anchorType: SceneAnchorType,
  position: Position,
  activeBounds: WorldBounds,
  supportAssetId: string | null,
  sceneAssets: AnchorAssetLike[],
  activeAssetId?: string
) {
  if (sceneAssets.length === 0 || (anchorType !== "floor" && !isSurfaceAnchorType(anchorType))) {
    return position;
  }

  const separationGap = anchorType === "floor" ? FLOOR_SEPARATION_GAP : SURFACE_SEPARATION_GAP;
  let nextX = position[0];
  let nextZ = position[2];

  for (let iteration = 0; iteration < MAX_RELAXATION_ITERATIONS; iteration += 1) {
    let pushX = 0;
    let pushZ = 0;
    let collisionCount = 0;

    for (const candidate of sceneAssets) {
      if (
        !isCollisionCandidate(
          anchorType,
          supportAssetId,
          candidate,
          activeAssetId,
          [nextX, position[1], nextZ],
          activeBounds
        )
      ) {
        continue;
      }

      const candidateBounds = getWorldBoundsForSceneAsset(candidate);
      const requiredDistance = activeBounds.radius + candidateBounds.radius + separationGap;
      let deltaX = nextX - candidate.position[0];
      let deltaZ = nextZ - candidate.position[2];
      let distance = Math.hypot(deltaX, deltaZ);

      if (distance + 1e-6 >= requiredDistance) {
        continue;
      }

      if (distance <= Number.EPSILON) {
        const fallbackDirection = getCollisionFallbackDirection(candidate.id);
        deltaX = fallbackDirection.x;
        deltaZ = fallbackDirection.z;
        distance = 1;
      } else {
        deltaX /= distance;
        deltaZ /= distance;
      }

      const overlap = requiredDistance - distance;
      pushX += deltaX * overlap;
      pushZ += deltaZ * overlap;
      collisionCount += 1;
    }

    if (collisionCount === 0) {
      break;
    }

    const pushLength = Math.hypot(pushX, pushZ);
    if (pushLength <= POSITION_EPSILON) {
      break;
    }

    const averageStep = Math.min(pushLength / collisionCount, MAX_RELAXATION_STEP);
    nextX += (pushX / pushLength) * averageStep;
    nextZ += (pushZ / pushLength) * averageStep;
  }

  return [nextX, position[1], nextZ] as Position;
}

function solvePhysicalPlacement(
  anchorType: SceneAnchorType,
  position: Position,
  rotationY: number,
  supportAssetId: string | null,
  options: {
    walls: WallLike[];
    ceilings: CeilingLike[];
    scale: number;
    sceneAssets?: AnchorAssetLike[];
    activeAssetId?: string;
    activeAsset?: ActivePlacementAssetLike;
    activeBounds?: WorldBounds;
  }
) {
  if (anchorType !== "floor" && !isSurfaceAnchorType(anchorType)) {
    return {
      position,
      supportAssetId
    };
  }

  const sceneAssets = options.sceneAssets ?? [];
  const activeBounds =
    options.activeBounds ??
    resolveActiveAssetBounds(anchorType, sceneAssets, options.activeAssetId, options.activeAsset);
  let nextPosition = position;
  let nextSupportAssetId = supportAssetId;

  // Keep each pass small: clear walls, separate overlaps, then re-clamp to the support surface if needed.
  for (let iteration = 0; iteration < MAX_RELAXATION_ITERATIONS; iteration += 1) {
    const previousX = nextPosition[0];
    const previousY = nextPosition[1];
    const previousZ = nextPosition[2];

    nextPosition = applyWallClearance(
      anchorType,
      nextPosition,
      rotationY,
      activeBounds,
      options.walls,
      options.scale
    );

    nextPosition = relaxAgainstSceneAssets(
      anchorType,
      nextPosition,
      activeBounds,
      nextSupportAssetId,
      sceneAssets,
      options.activeAssetId
    );

    if (isSurfaceAnchorType(anchorType)) {
      const reanchoredSurface = constrainToSupportingSurface(anchorType, nextPosition, sceneAssets, {
        activeAssetId: options.activeAssetId,
        supportAssetId: nextSupportAssetId,
        activeBounds,
        activeRotationY: rotationY
      });
      if (reanchoredSurface) {
        nextPosition = reanchoredSurface.position;
        nextSupportAssetId = reanchoredSurface.supportAssetId;
      } else {
        nextPosition = [nextPosition[0], 0, nextPosition[2]];
        nextSupportAssetId = null;
      }
    } else {
      nextPosition = [nextPosition[0], 0, nextPosition[2]];
      nextSupportAssetId = null;
    }

    const delta = Math.hypot(
      nextPosition[0] - previousX,
      nextPosition[1] - previousY,
      nextPosition[2] - previousZ
    );
    if (delta <= POSITION_EPSILON) {
      break;
    }
  }

  return {
    position: nextPosition,
    supportAssetId: nextSupportAssetId
  };
}

export function inferAnchorTypeForCatalogItem(item: {
  label?: string;
  description?: string;
  category?: string;
  categoryId?: string;
}): SceneAnchorType {
  const haystack = `${item.label ?? ""} ${item.description ?? ""} ${item.category ?? ""} ${
    item.categoryId ?? ""
  }`.toLowerCase();

  if (SMALL_OBJECT_KEYWORDS.some((keyword) => haystack.includes(keyword))) {
    return "desk_surface";
  }
  if (WALL_OBJECT_KEYWORDS.some((keyword) => haystack.includes(keyword))) {
    return "wall";
  }
  if (CEILING_OBJECT_KEYWORDS.some((keyword) => haystack.includes(keyword))) {
    return "ceiling";
  }
  if (SHELF_OBJECT_KEYWORDS.some((keyword) => haystack.includes(keyword))) {
    return "shelf_surface";
  }
  if ((item.categoryId ?? "").toLowerCase() === "lighting") {
    return "ceiling";
  }
  return "floor";
}

export function resolveCeilingHeight(
  walls: WallLike[],
  ceilings: CeilingLike[],
  fallback = DEFAULT_CEILING_HEIGHT
): number {
  const fromCeilings = ceilings.reduce(
    (max, ceiling) => (Number.isFinite(ceiling.height) ? Math.max(max, ceiling.height) : max),
    0
  );
  if (fromCeilings > 0) return fromCeilings;
  const fromWalls = walls.reduce(
    (max, wall) =>
      typeof wall.height === "number" && Number.isFinite(wall.height)
        ? Math.max(max, wall.height)
        : max,
    0
  );
  if (fromWalls > 0) return fromWalls;
  return fallback;
}

export function constrainPlacementToAnchor(
  input: {
    position: Position;
    rotation: Rotation;
    anchorType?: SceneAnchorType | null;
    supportAssetId?: string | null;
  },
  options: {
    walls: WallLike[];
    ceilings: CeilingLike[];
    scale: number;
    sceneAssets?: AnchorAssetLike[];
    activeAssetId?: string;
    activeAsset?: ActivePlacementAssetLike;
  }
): {
  position: Position;
  rotation: Rotation;
  anchorType: SceneAnchorType;
  supportAssetId: string | null;
} {
  const anchorType = normalizeSceneAnchorType(input.anchorType);
  const ceilingHeight = resolveCeilingHeight(options.walls, options.ceilings);
  const sceneAssets = options.sceneAssets ?? [];
  const activeBounds = resolveActiveAssetBounds(
    anchorType,
    sceneAssets,
    options.activeAssetId,
    options.activeAsset
  );

  let [x, y, z] = input.position;
  const [rotationX, rotationY, rotationZ] = input.rotation;
  let nextRotationY = rotationY;
  let supportAssetId =
    typeof input.supportAssetId === "string" && input.supportAssetId.length > 0 ? input.supportAssetId : null;

  if (anchorType === "wall" && options.walls.length > 0) {
    const snapped = options.walls.reduce<{
      x: number;
      z: number;
      yaw: number;
      distanceSq: number;
    } | null>((closest, wall) => {
      const startX = wall.start[0] * options.scale;
      const startZ = wall.start[1] * options.scale;
      const endX = wall.end[0] * options.scale;
      const endZ = wall.end[1] * options.scale;
      const projected = projectPointToSegment2D(x, z, startX, startZ, endX, endZ);
      if (!closest || projected.distanceSq < closest.distanceSq) {
        return projected;
      }
      return closest;
    }, null);
    if (snapped) {
      x = snapped.x;
      z = snapped.z;
      nextRotationY = snapped.yaw;
    }
  }

  if (anchorType === "floor") {
    y = 0;
    supportAssetId = null;
  } else if (anchorType === "ceiling") {
    y = ceilingHeight;
    supportAssetId = null;
  } else if (anchorType === "wall") {
    const wallDefault = getDefaultAnchorHeight(anchorType, ceilingHeight);
    y =
      Number.isFinite(y) && y > 0
        ? Math.min(Math.max(y, 0.35), Math.max(0.35, ceilingHeight - 0.15))
        : wallDefault;
    supportAssetId = null;
  } else if (isSurfaceAnchorType(anchorType)) {
    const supportSurface = constrainToSupportingSurface(
      anchorType,
      [x, y, z],
      sceneAssets,
      {
        activeAssetId: options.activeAssetId,
        supportAssetId,
        activeBounds,
        activeRotationY: nextRotationY
      }
    );
    if (supportSurface) {
      [x, y, z] = supportSurface.position;
      supportAssetId = supportSurface.supportAssetId;
    } else {
      y = 0;
      supportAssetId = null;
    }
  } else {
    supportAssetId = null;
  }

  const physicallyResolvedPlacement = solvePhysicalPlacement(
    anchorType,
    [x, y, z],
    nextRotationY,
    supportAssetId,
    {
      walls: options.walls,
      ceilings: options.ceilings,
      scale: options.scale,
      sceneAssets,
      activeAssetId: options.activeAssetId,
      activeAsset: options.activeAsset,
      activeBounds
    }
  );
  [x, y, z] = physicallyResolvedPlacement.position;
  supportAssetId = physicallyResolvedPlacement.supportAssetId;

  return {
    position: [x, y, z],
    rotation: [rotationX, nextRotationY, rotationZ],
    anchorType,
    supportAssetId
  };
}
