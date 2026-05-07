export type LightingFixtureType = "downlight" | "ceiling_light" | "indirect_strip";
export type LightingColorTemperature = "warm" | "neutral" | "cool";

export type LightingFixture = {
  id: string;
  type: LightingFixtureType;
  positionMm: [number, number, number];
  intensity: number;
  colorTemperature: LightingColorTemperature;
  beamRadiusMm: number;
  spread: number;
  enabled: boolean;
};

export type LightingLayoutBoundsMm = {
  minXMm: number;
  maxXMm: number;
  minZMm: number;
  maxZMm: number;
  ceilingHeightMm: number;
};

export const DEFAULT_LIGHTING_LAYOUT_BOUNDS_MM: LightingLayoutBoundsMm = {
  minXMm: -5000,
  maxXMm: 5000,
  minZMm: -4000,
  maxZMm: 4000,
  ceilingHeightMm: 2550
};

export const DEFAULT_LIGHTING_GRID_SNAP_MM = 500;

const DIRECT_LIGHT_COUNT_OPTIONS = [1, 2, 3, 4, 6] as const;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function toFiniteNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function resolveSafeBounds(bounds: LightingLayoutBoundsMm): LightingLayoutBoundsMm {
  const minXMm = Math.min(bounds.minXMm, bounds.maxXMm);
  const maxXMm = Math.max(bounds.minXMm, bounds.maxXMm);
  const minZMm = Math.min(bounds.minZMm, bounds.maxZMm);
  const maxZMm = Math.max(bounds.minZMm, bounds.maxZMm);

  return {
    minXMm,
    maxXMm,
    minZMm,
    maxZMm,
    ceilingHeightMm: Math.max(2100, bounds.ceilingHeightMm)
  };
}

export function computeLightingBoundsMm(
  walls: readonly { start: [number, number]; end: [number, number]; height: number }[],
  scale = 1
): LightingLayoutBoundsMm {
  if (walls.length === 0) {
    return DEFAULT_LIGHTING_LAYOUT_BOUNDS_MM;
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  let ceilingHeight = 2.55;

  walls.forEach((wall) => {
    [wall.start, wall.end].forEach(([x, z]) => {
      const scaledX = x * scale;
      const scaledZ = z * scale;
      minX = Math.min(minX, scaledX);
      maxX = Math.max(maxX, scaledX);
      minZ = Math.min(minZ, scaledZ);
      maxZ = Math.max(maxZ, scaledZ);
    });
    ceilingHeight = Math.max(ceilingHeight, wall.height * scale - 0.15);
  });

  if (!Number.isFinite(minX) || !Number.isFinite(maxX) || !Number.isFinite(minZ) || !Number.isFinite(maxZ)) {
    return DEFAULT_LIGHTING_LAYOUT_BOUNDS_MM;
  }

  return resolveSafeBounds({
    minXMm: Math.round(minX * 1000),
    maxXMm: Math.round(maxX * 1000),
    minZMm: Math.round(minZ * 1000),
    maxZMm: Math.round(maxZ * 1000),
    ceilingHeightMm: Math.round(ceilingHeight * 1000)
  });
}

function resolveFixtureGrid(count: number) {
  if (count <= 1) return { columns: 1, rows: 1 };
  if (count === 2) return { columns: 2, rows: 1 };
  if (count === 3) return { columns: 3, rows: 1 };
  if (count === 4) return { columns: 2, rows: 2 };
  return { columns: 3, rows: 2 };
}

function clampNormalizedRatio(value: number) {
  return clamp(toFiniteNumber(value, 0.5), 0, 1);
}

function snapToGridWithinRange(value: number, min: number, max: number, snapMm = DEFAULT_LIGHTING_GRID_SNAP_MM) {
  const safeMin = Math.min(min, max);
  const safeMax = Math.max(min, max);
  const clamped = clamp(value, safeMin, safeMax);
  if (snapMm <= 1) {
    return Math.round(clamped);
  }

  const snappedMin = Math.ceil(safeMin / snapMm) * snapMm;
  const snappedMax = Math.floor(safeMax / snapMm) * snapMm;
  if (snappedMin > snappedMax) {
    return Math.round(clamped);
  }

  const snapped = Math.round(clamped / snapMm) * snapMm;
  return clamp(snapped, snappedMin, snappedMax);
}

export function snapLightingPositionMm(
  positionMm: [number, number, number],
  boundsInput = DEFAULT_LIGHTING_LAYOUT_BOUNDS_MM,
  snapMm = DEFAULT_LIGHTING_GRID_SNAP_MM
): [number, number, number] {
  const bounds = resolveSafeBounds(boundsInput);
  const minX = bounds.minXMm + 250;
  const maxX = bounds.maxXMm - 250;
  const minZ = bounds.minZMm + 250;
  const maxZ = bounds.maxZMm - 250;

  return [
    snapToGridWithinRange(positionMm[0], minX, maxX, snapMm),
    Math.round(clamp(positionMm[1], 2100, bounds.ceilingHeightMm)),
    snapToGridWithinRange(positionMm[2], minZ, maxZ, snapMm)
  ];
}

export function resolveLightingPositionMmFromNormalized(
  xRatioInput: number,
  zRatioInput: number,
  boundsInput = DEFAULT_LIGHTING_LAYOUT_BOUNDS_MM,
  snapMm = DEFAULT_LIGHTING_GRID_SNAP_MM
): [number, number, number] {
  const bounds = resolveSafeBounds(boundsInput);
  const xRatio = clampNormalizedRatio(xRatioInput);
  const zRatio = clampNormalizedRatio(zRatioInput);
  const nextX = bounds.minXMm + (bounds.maxXMm - bounds.minXMm) * xRatio;
  const nextZ = bounds.minZMm + (bounds.maxZMm - bounds.minZMm) * zRatio;

  return snapLightingPositionMm([nextX, bounds.ceilingHeightMm, nextZ], bounds, snapMm);
}

export function normalizeDirectLightCount(count: number) {
  const normalized = DIRECT_LIGHT_COUNT_OPTIONS.reduce((best, option) => {
    return Math.abs(option - count) < Math.abs(best - count) ? option : best;
  }, DIRECT_LIGHT_COUNT_OPTIONS[0]);
  return normalized;
}

export function createDefaultDirectLightingFixtures(
  boundsInput: LightingLayoutBoundsMm,
  requestedCount = 3,
  templateFixture?: Partial<LightingFixture>
): LightingFixture[] {
  const bounds = resolveSafeBounds(boundsInput);
  const count = normalizeDirectLightCount(requestedCount);
  const { columns, rows } = resolveFixtureGrid(count);
  const width = Math.max(1, bounds.maxXMm - bounds.minXMm);
  const depth = Math.max(1, bounds.maxZMm - bounds.minZMm);
  const insetX = Math.min(650, Math.max(320, width * 0.12));
  const insetZ = Math.min(650, Math.max(320, depth * 0.12));
  const minX = bounds.minXMm + insetX;
  const maxX = bounds.maxXMm - insetX;
  const minZ = bounds.minZMm + insetZ;
  const maxZ = bounds.maxZMm - insetZ;
  const beamRadiusMm = Math.round(Math.max(850, Math.min(width, depth) * 0.22));
  const fixtures: LightingFixture[] = [];

  for (let index = 0; index < count; index += 1) {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const xRatio = columns === 1 ? 0.5 : column / (columns - 1);
    const zRatio = rows === 1 ? 0.5 : row / (rows - 1);
    const positionMm = snapLightingPositionMm(
      [
        minX + (maxX - minX) * xRatio,
        bounds.ceilingHeightMm,
        minZ + (maxZ - minZ) * zRatio
      ],
      bounds
    );

    fixtures.push({
      id: `ceiling-downlight-${index + 1}`,
      type: "downlight",
      positionMm,
      intensity: templateFixture?.intensity ?? (count > 3 ? 0.62 : 0.74),
      colorTemperature: templateFixture?.colorTemperature ?? "neutral",
      beamRadiusMm: templateFixture?.beamRadiusMm ?? beamRadiusMm,
      spread: templateFixture?.spread ?? 0.58,
      enabled: templateFixture?.enabled ?? true
    });
  }

  return fixtures;
}

export function normalizeLightingFixture(
  fixture: Partial<LightingFixture>,
  boundsInput = DEFAULT_LIGHTING_LAYOUT_BOUNDS_MM,
  index = 0
): LightingFixture {
  const bounds = resolveSafeBounds(boundsInput);
  const fallback = createDefaultDirectLightingFixtures(bounds, 1)[0]!;
  const x = toFiniteNumber(fixture.positionMm?.[0], fallback.positionMm[0]);
  const y = toFiniteNumber(fixture.positionMm?.[1], bounds.ceilingHeightMm);
  const z = toFiniteNumber(fixture.positionMm?.[2], fallback.positionMm[2]);
  const colorTemperature =
    fixture.colorTemperature === "warm" || fixture.colorTemperature === "cool" ? fixture.colorTemperature : "neutral";
  const positionMm = snapLightingPositionMm([x, y, z], bounds);

  return {
    id: typeof fixture.id === "string" && fixture.id.length > 0 ? fixture.id : `ceiling-downlight-${index + 1}`,
    type:
      fixture.type === "ceiling_light" || fixture.type === "indirect_strip" || fixture.type === "downlight"
        ? fixture.type
        : "downlight",
    positionMm,
    intensity: clamp(toFiniteNumber(fixture.intensity, 0.72), 0.1, 2.4),
    colorTemperature,
    beamRadiusMm: Math.round(clamp(toFiniteNumber(fixture.beamRadiusMm, 1050), 450, 3200)),
    spread: clamp(toFiniteNumber(fixture.spread, 0.58), 0.28, 1.08),
    enabled: fixture.enabled !== false
  };
}

export function normalizeLightingFixtures(
  fixtures: readonly Partial<LightingFixture>[] | undefined,
  bounds = DEFAULT_LIGHTING_LAYOUT_BOUNDS_MM
): LightingFixture[] {
  if (!fixtures || fixtures.length === 0) {
    return [];
  }

  return fixtures.slice(0, 6).map((fixture, index) => normalizeLightingFixture(fixture, bounds, index));
}

export function resolveLightingFixtures(
  fixtures: readonly Partial<LightingFixture>[] | undefined,
  bounds: LightingLayoutBoundsMm,
  fallbackCount = 3
) {
  const normalized = normalizeLightingFixtures(fixtures, bounds);
  return normalized.length > 0 ? normalized : createDefaultDirectLightingFixtures(bounds, fallbackCount);
}

export function resolveLightingFixtureColor(colorTemperature: LightingColorTemperature) {
  switch (colorTemperature) {
    case "warm":
      return "#ffd9a3";
    case "cool":
      return "#dceaff";
    case "neutral":
    default:
      return "#fff1d3";
  }
}
