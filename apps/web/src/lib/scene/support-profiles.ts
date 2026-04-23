import type { SupportSurface } from "@deskterioronline/scene-schema";
import { normalizeSceneAnchorType, type SceneAnchorType } from "./anchor-types";

export type SupportAnchorType = Extract<
  SceneAnchorType,
  "desk_surface" | "shelf_surface" | "furniture_surface"
>;

export type AssetSupportSurface = {
  id: string;
  anchorTypes: SupportAnchorType[];
  center: [number, number];
  size: [number, number];
  top: number;
  margin?: [number, number];
  surfaceType?: SupportSurface["type"];
  allowedAttachments?: SupportSurface["allowedAttachments"];
  thicknessMm?: number;
  localFrame?: SupportSurface["localFrame"];
};

export type AssetSupportProfile = {
  surfaces: AssetSupportSurface[];
};

export type SupportSurfaceLockAssetLike = {
  id: string;
  assetId: string;
  catalogItemId?: string | null;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  supportProfile?: AssetSupportProfile | null;
  product?: {
    dimensionsMm?: {
      width: number;
      depth: number;
      height: number;
    } | null;
  } | null;
};

export type ActiveSupportMeasurementAssetLike = {
  assetId: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  product?: {
    dimensionsMm?: {
      width: number;
      depth: number;
      height: number;
    } | null;
  } | null;
};

export type SurfaceClearanceMm = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  min: number;
};

export type ResolvedSupportSurfaceLock = {
  supportAssetId: string;
  surface: AssetSupportSurface;
  sizeMm: [number, number];
  usableSizeMm: [number, number];
  marginMm: [number, number];
  localOffsetMm: [number, number];
  topMm: number;
  assetHeightMm: number;
  bottomOffsetMm: number;
  topOffsetMm: number;
  footprintMm: [number, number];
  projectedFootprintMm: [number, number];
  relativeYawDeg: number;
  clearanceMm: SurfaceClearanceMm;
  withinUsableBounds: boolean;
};

type SupportProfileDescriptor = {
  catalogItemId?: string | null;
  assetId: string;
  label?: string;
  category?: string;
  description?: string;
  dimensionsMm?: {
    width: number;
    depth: number;
    height: number;
  } | null;
};

const SUPPORT_ANCHOR_TYPES: SupportAnchorType[] = [
  "desk_surface",
  "shelf_surface",
  "furniture_surface"
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isSupportAnchorType(value: unknown): value is SupportAnchorType {
  return typeof value === "string" && SUPPORT_ANCHOR_TYPES.includes(normalizeSceneAnchorType(value) as SupportAnchorType);
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

function toNumber(value: unknown, fallback: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizeAnchorTypes(value: unknown) {
  const anchorTypes = Array.isArray(value)
    ? value.map((entry) => normalizeSceneAnchorType(entry)).filter(isSupportAnchorType)
    : [];
  return anchorTypes.length > 0 ? anchorTypes : null;
}

function createSurface(
  id: string,
  anchorTypes: SupportAnchorType[],
  size: [number, number],
  top: number,
  options?: {
    center?: [number, number];
    margin?: [number, number];
  }
): AssetSupportSurface {
  return {
    id,
    anchorTypes,
    size,
    top,
    center: options?.center ?? [0, 0],
    margin: options?.margin
  };
}

function createProfile(surfaces: AssetSupportSurface[]): AssetSupportProfile {
  return { surfaces };
}

function normalizeDimensionsMm(
  value: SupportProfileDescriptor["dimensionsMm"]
): SupportProfileDescriptor["dimensionsMm"] {
  if (!value) return null;
  const width = toNumber(value.width, 0);
  const depth = toNumber(value.depth, 0);
  const height = toNumber(value.height, 0);
  if (width <= 0 || depth <= 0 || height <= 0) {
    return null;
  }
  return { width, depth, height };
}

function toMeters(value: number) {
  return value / 1000;
}

function toMillimeters(value: number) {
  return Math.round(value * 1000);
}

function toDegrees(value: number) {
  return (value * 180) / Math.PI;
}

function normalizeDegrees(value: number) {
  const normalized = ((value + 180) % 360 + 360) % 360 - 180;
  return Math.round(normalized * 10) / 10;
}

type MeasurementBoundsMeters = {
  width: number;
  depth: number;
  height: number;
  halfWidth: number;
  halfDepth: number;
};

function createMeasurementBounds(
  width: number,
  depth: number,
  height: number
): MeasurementBoundsMeters {
  const safeWidth = Math.max(width, 0.05);
  const safeDepth = Math.max(depth, 0.05);
  const safeHeight = Math.max(height, 0.03);
  return {
    width: safeWidth,
    depth: safeDepth,
    height: safeHeight,
    halfWidth: safeWidth / 2,
    halfDepth: safeDepth / 2
  };
}

function getScaleMagnitude(scale: [number, number, number]) {
  return {
    x: Math.max(Math.abs(scale[0] ?? 1), 0.1),
    y: Math.max(Math.abs(scale[1] ?? 1), 0.1),
    z: Math.max(Math.abs(scale[2] ?? 1), 0.1)
  };
}

function inferMeasurementBoundsMeters(
  descriptor: ActiveSupportMeasurementAssetLike
): MeasurementBoundsMeters {
  const dimensionsMm = normalizeDimensionsMm(descriptor.product?.dimensionsMm ?? null);
  const scale = getScaleMagnitude(descriptor.scale);

  if (dimensionsMm) {
    return createMeasurementBounds(
      toMeters(dimensionsMm.width) * scale.x,
      toMeters(dimensionsMm.depth) * scale.z,
      toMeters(dimensionsMm.height) * scale.y
    );
  }

  const haystack = descriptor.assetId.toLowerCase();
  let width = 0.28;
  let depth = 0.18;
  let height = 0.16;

  if (haystack.includes("monitor")) {
    width = 0.58;
    depth = 0.18;
    height = 0.34;
  } else if (haystack.includes("keyboard")) {
    width = 0.44;
    depth = 0.14;
    height = 0.04;
  } else if (haystack.includes("mouse")) {
    width = 0.11;
    depth = 0.07;
    height = 0.04;
  } else if (haystack.includes("speaker")) {
    width = 0.16;
    depth = 0.16;
    height = 0.24;
  } else if (haystack.includes("lamp")) {
    width = 0.22;
    depth = 0.18;
    height = 0.46;
  } else if (haystack.includes("mug")) {
    width = 0.1;
    depth = 0.1;
    height = 0.1;
  } else if (haystack.includes("tray")) {
    width = 0.32;
    depth = 0.22;
    height = 0.05;
  } else if (haystack.includes("book")) {
    width = 0.24;
    depth = 0.18;
    height = 0.03;
  } else if (haystack.includes("planter")) {
    width = 0.18;
    depth = 0.18;
    height = 0.22;
  }

  return createMeasurementBounds(width * scale.x, depth * scale.z, height * scale.y);
}

function resolveDimensionBounds(descriptor: SupportProfileDescriptor) {
  const dimensionsMm = normalizeDimensionsMm(descriptor.dimensionsMm);
  if (!dimensionsMm) return null;
  return {
    width: toMeters(dimensionsMm.width),
    depth: toMeters(dimensionsMm.depth),
    height: toMeters(dimensionsMm.height)
  };
}

export function normalizeAssetSupportProfile(value: unknown): AssetSupportProfile | null {
  if (!isRecord(value) || !Array.isArray(value.surfaces)) {
    return null;
  }

  const surfaces = value.surfaces
    .map<AssetSupportSurface | null>((surface, index) => {
      if (!isRecord(surface)) return null;
      const anchorTypes = normalizeAnchorTypes(surface.anchorTypes);
      if (!anchorTypes) return null;
      const sizeValue = Array.isArray(surface.size) ? surface.size : [surface.width, surface.depth];
      if (!Array.isArray(sizeValue) || sizeValue.length < 2) {
        return null;
      }
      const width = toNumber(sizeValue[0], 0);
      const depth = toNumber(sizeValue[1], 0);
      if (width <= 0 || depth <= 0) {
        return null;
      }
      const centerValue = Array.isArray(surface.center) ? surface.center : [surface.centerX, surface.centerZ];
      const marginValue = Array.isArray(surface.margin) ? surface.margin : [surface.marginX, surface.marginZ];
      const surfaceType =
        surface.surfaceType === "floor" ||
        surface.surfaceType === "wall" ||
        surface.surfaceType === "desktop_top" ||
        surface.surfaceType === "shelf_top" ||
        surface.surfaceType === "desk_edge" ||
        surface.surfaceType === "desk_underside" ||
        surface.surfaceType === "monitor_back" ||
        surface.surfaceType === "pegboard"
          ? surface.surfaceType
          : undefined;
      const allowedAttachments =
        Array.isArray(surface.allowedAttachments) &&
        surface.allowedAttachments.every((entry) => typeof entry === "string")
          ? surface.allowedAttachments.filter(
              (
                entry
              ): entry is
                | "place_on_surface"
                | "edge_clamp"
                | "underside_screw"
                | "vesa_mount"
                | "grommet_hole"
                | "wall_screw"
                | "adhesive_patch"
                | "magnetic_attach"
                | "cable_route"
                | "peg_slot"
                | "wall_attach" =>
                entry === "place_on_surface" ||
                entry === "edge_clamp" ||
                entry === "underside_screw" ||
                entry === "vesa_mount" ||
                entry === "grommet_hole" ||
                entry === "wall_screw" ||
                entry === "adhesive_patch" ||
                entry === "magnetic_attach" ||
                entry === "cable_route" ||
                entry === "peg_slot" ||
                entry === "wall_attach"
            )
          : undefined;
      const thicknessMm =
        typeof surface.thicknessMm === "number" && Number.isFinite(surface.thicknessMm) && surface.thicknessMm > 0
          ? surface.thicknessMm
          : undefined;
      const localFrame =
        isRecord(surface.localFrame) &&
        Array.isArray(surface.localFrame.originMm) &&
        Array.isArray(surface.localFrame.tangentU) &&
        Array.isArray(surface.localFrame.tangentV) &&
        Array.isArray(surface.localFrame.normal) &&
        surface.localFrame.originMm.length === 3 &&
        surface.localFrame.tangentU.length === 3 &&
        surface.localFrame.tangentV.length === 3 &&
        surface.localFrame.normal.length === 3 &&
        surface.localFrame.originMm.every((entry) => typeof entry === "number") &&
        surface.localFrame.tangentU.every((entry) => typeof entry === "number") &&
        surface.localFrame.tangentV.every((entry) => typeof entry === "number") &&
        surface.localFrame.normal.every((entry) => typeof entry === "number")
          ? {
              originMm: [
                toNumber(surface.localFrame.originMm[0], 0),
                toNumber(surface.localFrame.originMm[1], 0),
                toNumber(surface.localFrame.originMm[2], 0)
              ] as [number, number, number],
              tangentU: [
                toNumber(surface.localFrame.tangentU[0], 0),
                toNumber(surface.localFrame.tangentU[1], 0),
                toNumber(surface.localFrame.tangentU[2], 0)
              ] as [number, number, number],
              tangentV: [
                toNumber(surface.localFrame.tangentV[0], 0),
                toNumber(surface.localFrame.tangentV[1], 0),
                toNumber(surface.localFrame.tangentV[2], 0)
              ] as [number, number, number],
              normal: [
                toNumber(surface.localFrame.normal[0], 0),
                toNumber(surface.localFrame.normal[1], 0),
                toNumber(surface.localFrame.normal[2], 0)
              ] as [number, number, number]
            }
          : undefined;
      return {
        id: typeof surface.id === "string" && surface.id.length > 0 ? surface.id : `surface-${index + 1}`,
        anchorTypes,
        center:
          Array.isArray(centerValue) && centerValue.length >= 2
            ? [toNumber(centerValue[0], 0), toNumber(centerValue[1], 0)]
            : [0, 0],
        size: [width, depth],
        top: toNumber(surface.top, 0),
        margin:
          Array.isArray(marginValue) && marginValue.length >= 2
            ? [Math.max(0, toNumber(marginValue[0], 0)), Math.max(0, toNumber(marginValue[1], 0))]
            : undefined,
        ...(surfaceType ? { surfaceType } : {}),
        ...(allowedAttachments ? { allowedAttachments } : {}),
        ...(thicknessMm ? { thicknessMm } : {}),
        ...(localFrame ? { localFrame } : {})
      };
    })
    .filter((surface): surface is AssetSupportSurface => Boolean(surface));

  return surfaces.length > 0 ? { surfaces } : null;
}

export function inferAssetSupportProfile(descriptor: SupportProfileDescriptor): AssetSupportProfile | null {
  const bounds = resolveDimensionBounds(descriptor);
  const haystack = [
    descriptor.catalogItemId ?? "",
    descriptor.assetId,
    descriptor.label ?? "",
    descriptor.category ?? "",
    descriptor.description ?? ""
  ]
    .join(" ")
    .toLowerCase();

  if (haystack.includes("desk") || haystack.includes("workbench") || haystack.includes("dining table")) {
    return createProfile([
      createSurface(
        "desk-top",
        ["desk_surface", "furniture_surface"],
        bounds
          ? [Math.max(bounds.width * 0.9, 0.3), Math.max(bounds.depth * 0.9, 0.24)]
          : [1.25, 0.68],
        bounds ? Math.max(bounds.height, 0.4) : 0.75,
        {
          margin: [0.09, 0.08]
        }
      )
    ]);
  }

  if (
    haystack.includes("table") ||
    haystack.includes("coffee table") ||
    haystack.includes("side table")
  ) {
    return createProfile([
      createSurface(
        "table-top",
        ["desk_surface", "furniture_surface"],
        bounds
          ? [Math.max(bounds.width * 0.88, 0.28), Math.max(bounds.depth * 0.88, 0.22)]
          : [1.05, 0.62],
        bounds ? Math.max(bounds.height, 0.36) : 0.72,
        {
          margin: [0.08, 0.07]
        }
      )
    ]);
  }

  if (haystack.includes("nightstand")) {
    return createProfile([
      createSurface(
        "nightstand-top",
        ["furniture_surface"],
        bounds
          ? [Math.max(bounds.width * 0.88, 0.22), Math.max(bounds.depth * 0.88, 0.18)]
          : [0.5, 0.38],
        bounds ? Math.max(bounds.height, 0.3) : 0.68,
        {
          margin: [0.05, 0.05]
        }
      )
    ]);
  }

  if (
    haystack.includes("dresser") ||
    haystack.includes("commode") ||
    haystack.includes("drawer") ||
    haystack.includes("cabinet") ||
    haystack.includes("console")
  ) {
    return createProfile([
      createSurface(
        "casework-top",
        ["furniture_surface"],
        bounds
          ? [Math.max(bounds.width * 0.9, 0.24), Math.max(bounds.depth * 0.86, 0.18)]
          : [0.88, 0.4],
        bounds ? Math.max(bounds.height, 0.36) : 0.84,
        {
          margin: [0.07, 0.05]
        }
      )
    ]);
  }

  if (haystack.includes("cart")) {
    return createProfile([
      createSurface(
        "cart-top",
        ["furniture_surface"],
        bounds
          ? [Math.max(bounds.width * 0.88, 0.22), Math.max(bounds.depth * 0.84, 0.18)]
          : [0.72, 0.42],
        bounds ? Math.max(bounds.height, 0.36) : 0.86,
        {
          margin: [0.06, 0.05]
        }
      )
    ]);
  }

  if (haystack.includes("shelf") || haystack.includes("shelves") || haystack.includes("bookcase") || haystack.includes("rack")) {
    return createProfile([
      createSurface(
        "shelf-upper",
        ["shelf_surface"],
        bounds
          ? [Math.max(bounds.width * 0.82, 0.24), Math.max(bounds.depth * 0.74, 0.16)]
          : [0.82, 0.28],
        bounds ? Math.max(Math.min(bounds.height * 0.72, bounds.height - 0.16), 0.48) : 1.2,
        {
          margin: [0.06, 0.04]
        }
      ),
      createSurface(
        "shelf-top",
        ["furniture_surface"],
        bounds
          ? [Math.max(bounds.width * 0.9, 0.26), Math.max(bounds.depth * 0.84, 0.18)]
          : [0.9, 0.32],
        bounds ? Math.max(bounds.height, 0.54) : 1.72,
        {
          margin: [0.07, 0.05]
        }
      )
    ]);
  }

  return null;
}

export function resolveAssetSupportProfile(
  descriptor: SupportProfileDescriptor & { supportProfile?: AssetSupportProfile | null }
): AssetSupportProfile | null {
  return normalizeAssetSupportProfile(descriptor.supportProfile) ?? inferAssetSupportProfile(descriptor);
}

export function formatSupportSurfaceLabel(surfaceId: string) {
  return surfaceId
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function resolveSupportSurfaceLock(
  anchorType: SceneAnchorType | undefined,
  activeAsset: ActiveSupportMeasurementAssetLike | null,
  supportAsset: SupportSurfaceLockAssetLike | null
): ResolvedSupportSurfaceLock | null {
  if (!supportAsset || !activeAsset || !isSupportAnchorType(anchorType)) {
    return null;
  }

  const profile = resolveAssetSupportProfile({
    catalogItemId: supportAsset.catalogItemId,
    assetId: supportAsset.assetId,
    dimensionsMm: supportAsset.product?.dimensionsMm ?? null,
    supportProfile: supportAsset.supportProfile
  });

  if (!profile) {
    return null;
  }

  const yaw = supportAsset.rotation[1] ?? 0;
  const scaleX = Math.max(Math.abs(supportAsset.scale[0] ?? 1), 0.0001);
  const scaleY = Math.max(Math.abs(supportAsset.scale[1] ?? 1), 0.0001);
  const scaleZ = Math.max(Math.abs(supportAsset.scale[2] ?? 1), 0.0001);
  const [x, , z] = activeAsset.position;
  const activeBounds = inferMeasurementBoundsMeters(activeAsset);
  type SupportSurfaceCandidate = ResolvedSupportSurfaceLock & { distanceSq: number };

  return profile.surfaces
    .filter((surface) => surface.anchorTypes.includes(anchorType))
    .reduce<SupportSurfaceCandidate | null>((best, surface) => {
      const centerOffset = rotateXZ(surface.center[0] * scaleX, surface.center[1] * scaleZ, yaw);
      const surfaceCenterX = supportAsset.position[0] + centerOffset.x;
      const surfaceCenterZ = supportAsset.position[2] + centerOffset.z;
      const localPoint = inverseRotateXZ(x - surfaceCenterX, z - surfaceCenterZ, yaw);
      const halfWidth = Math.max((surface.size[0] * scaleX) / 2, 0);
      const halfDepth = Math.max((surface.size[1] * scaleZ) / 2, 0);
      const marginX = Math.min((surface.margin?.[0] ?? 0.08) * scaleX, halfWidth);
      const marginZ = Math.min((surface.margin?.[1] ?? 0.06) * scaleZ, halfDepth);
      const relativeYaw = (activeAsset.rotation[1] ?? 0) - yaw;
      const projectedHalfWidth =
        Math.abs(Math.cos(relativeYaw)) * activeBounds.halfWidth +
        Math.abs(Math.sin(relativeYaw)) * activeBounds.halfDepth;
      const projectedHalfDepth =
        Math.abs(Math.sin(relativeYaw)) * activeBounds.halfWidth +
        Math.abs(Math.cos(relativeYaw)) * activeBounds.halfDepth;
      const usableHalfWidth = Math.max(halfWidth - marginX - projectedHalfWidth, 0);
      const usableHalfDepth = Math.max(halfDepth - marginZ - projectedHalfDepth, 0);
      const clampedLocalX = Math.min(usableHalfWidth, Math.max(-usableHalfWidth, localPoint.x));
      const clampedLocalZ = Math.min(usableHalfDepth, Math.max(-usableHalfDepth, localPoint.z));
      const usableMinX = -halfWidth + marginX;
      const usableMaxX = halfWidth - marginX;
      const usableMinZ = -halfDepth + marginZ;
      const usableMaxZ = halfDepth - marginZ;
      const clearanceLeft = localPoint.x - projectedHalfWidth - usableMinX;
      const clearanceRight = usableMaxX - (localPoint.x + projectedHalfWidth);
      const clearanceTop = usableMaxZ - (localPoint.z + projectedHalfDepth);
      const clearanceBottom = localPoint.z - projectedHalfDepth - usableMinZ;
      const minimumClearance = Math.min(
        clearanceLeft,
        clearanceRight,
        clearanceTop,
        clearanceBottom
      );
      const distanceSq = (clampedLocalX - localPoint.x) ** 2 + (clampedLocalZ - localPoint.z) ** 2;
      const supportTopY = supportAsset.position[1] + surface.top * scaleY;
      const bottomOffset = activeAsset.position[1] - supportTopY;
      const topOffset = bottomOffset + activeBounds.height;
      const candidate: SupportSurfaceCandidate = {
        supportAssetId: supportAsset.id,
        surface,
        sizeMm: [toMillimeters(surface.size[0] * scaleX), toMillimeters(surface.size[1] * scaleZ)],
        usableSizeMm: [
          toMillimeters(Math.max((halfWidth - marginX) * 2, 0)),
          toMillimeters(Math.max((halfDepth - marginZ) * 2, 0))
        ],
        marginMm: [toMillimeters(marginX), toMillimeters(marginZ)],
        localOffsetMm: [toMillimeters(localPoint.x), toMillimeters(localPoint.z)],
        topMm: toMillimeters(supportTopY),
        assetHeightMm: toMillimeters(activeBounds.height),
        bottomOffsetMm: toMillimeters(bottomOffset),
        topOffsetMm: toMillimeters(topOffset),
        footprintMm: [toMillimeters(activeBounds.width), toMillimeters(activeBounds.depth)],
        projectedFootprintMm: [
          toMillimeters(projectedHalfWidth * 2),
          toMillimeters(projectedHalfDepth * 2)
        ],
        relativeYawDeg: normalizeDegrees(toDegrees(relativeYaw)),
        clearanceMm: {
          left: toMillimeters(clearanceLeft),
          right: toMillimeters(clearanceRight),
          top: toMillimeters(clearanceTop),
          bottom: toMillimeters(clearanceBottom),
          min: toMillimeters(minimumClearance)
        },
        withinUsableBounds: minimumClearance >= 0,
        distanceSq
      };

      if (!best) {
        return candidate;
      }

      return distanceSq < best.distanceSq ? candidate : best;
    }, null);
}
