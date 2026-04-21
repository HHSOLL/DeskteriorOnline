export type MeterVector3 = [number, number, number];
export type MillimeterVector3 = [number, number, number];
export type MilliDegreeVector3 = [number, number, number];
export type ScalePermilleVector3 = [number, number, number];

export type ScenePlacementSnapshot = {
  unit: "mm";
  positionMm: MillimeterVector3;
  rotationMilliDeg: MilliDegreeVector3;
  scalePermille: ScalePermilleVector3;
};

export type ScenePlacementVectors = {
  position: MeterVector3;
  rotation: MeterVector3;
  scale: MeterVector3;
};

export const MILLIMETERS_PER_METER = 1000;
export const MILLIDEGREES_PER_RADIAN = (180 * 1000) / Math.PI;
export const RADIANS_PER_MILLIDEGREE = Math.PI / (180 * 1000);
const SCALE_PERMILLE_FACTOR = 1000;

export function metersToMillimeters(value: number) {
  return Math.round(value * MILLIMETERS_PER_METER);
}

export function millimetersToMeters(value: number) {
  return value / MILLIMETERS_PER_METER;
}

export function radiansToDegrees(value: number) {
  return (value * 180) / Math.PI;
}

export function degreesToRadians(value: number) {
  return (value * Math.PI) / 180;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeNumericVector3(value: unknown, fallback: MeterVector3): MeterVector3 {
  if (!Array.isArray(value) || value.length < 3) {
    return fallback;
  }

  return [
    isFiniteNumber(value[0]) ? value[0] : fallback[0],
    isFiniteNumber(value[1]) ? value[1] : fallback[1],
    isFiniteNumber(value[2]) ? value[2] : fallback[2]
  ];
}

function normalizeScaleVector3(value: unknown, fallback: MeterVector3): MeterVector3 {
  const scale = normalizeNumericVector3(value, fallback);
  return [
    scale[0] > 0 ? scale[0] : fallback[0],
    scale[1] > 0 ? scale[1] : fallback[1],
    scale[2] > 0 ? scale[2] : fallback[2]
  ];
}

function isIntegerVector3(value: unknown): value is [number, number, number] {
  return (
    Array.isArray(value) &&
    value.length >= 3 &&
    Number.isInteger(value[0]) &&
    Number.isInteger(value[1]) &&
    Number.isInteger(value[2])
  );
}

export function serializeScenePlacement(input: ScenePlacementVectors): ScenePlacementSnapshot {
  return {
    unit: "mm",
    positionMm: [
      metersToMillimeters(input.position[0]),
      metersToMillimeters(input.position[1]),
      metersToMillimeters(input.position[2])
    ],
    rotationMilliDeg: [
      Math.round(input.rotation[0] * MILLIDEGREES_PER_RADIAN),
      Math.round(input.rotation[1] * MILLIDEGREES_PER_RADIAN),
      Math.round(input.rotation[2] * MILLIDEGREES_PER_RADIAN)
    ],
    scalePermille: [
      Math.round(input.scale[0] * SCALE_PERMILLE_FACTOR),
      Math.round(input.scale[1] * SCALE_PERMILLE_FACTOR),
      Math.round(input.scale[2] * SCALE_PERMILLE_FACTOR)
    ]
  };
}

export function deserializeScenePlacement(snapshot: ScenePlacementSnapshot): ScenePlacementVectors {
  return {
    position: [
      snapshot.positionMm[0] / MILLIMETERS_PER_METER,
      snapshot.positionMm[1] / MILLIMETERS_PER_METER,
      snapshot.positionMm[2] / MILLIMETERS_PER_METER
    ],
    rotation: [
      snapshot.rotationMilliDeg[0] * RADIANS_PER_MILLIDEGREE,
      snapshot.rotationMilliDeg[1] * RADIANS_PER_MILLIDEGREE,
      snapshot.rotationMilliDeg[2] * RADIANS_PER_MILLIDEGREE
    ],
    scale: [
      snapshot.scalePermille[0] / SCALE_PERMILLE_FACTOR,
      snapshot.scalePermille[1] / SCALE_PERMILLE_FACTOR,
      snapshot.scalePermille[2] / SCALE_PERMILLE_FACTOR
    ]
  };
}

export function normalizeScenePlacementSnapshot(value: unknown): ScenePlacementSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (record.unit !== "mm") {
    return null;
  }

  if (
    !isIntegerVector3(record.positionMm) ||
    !isIntegerVector3(record.rotationMilliDeg) ||
    !isIntegerVector3(record.scalePermille)
  ) {
    return null;
  }

  if (record.scalePermille[0] <= 0 || record.scalePermille[1] <= 0 || record.scalePermille[2] <= 0) {
    return null;
  }

  return {
    unit: "mm",
    positionMm: [record.positionMm[0], record.positionMm[1], record.positionMm[2]],
    rotationMilliDeg: [
      record.rotationMilliDeg[0],
      record.rotationMilliDeg[1],
      record.rotationMilliDeg[2]
    ],
    scalePermille: [record.scalePermille[0], record.scalePermille[1], record.scalePermille[2]]
  };
}

export function resolveScenePlacementVectors(input: {
  placement?: unknown;
  position?: unknown;
  rotation?: unknown;
  scale?: unknown;
}): ScenePlacementVectors {
  const snapshot = normalizeScenePlacementSnapshot(input.placement);
  if (snapshot) {
    return deserializeScenePlacement(snapshot);
  }

  return {
    position: normalizeNumericVector3(input.position, [0, 0, 0]),
    rotation: normalizeNumericVector3(input.rotation, [0, 0, 0]),
    scale: normalizeScaleVector3(input.scale, [1, 1, 1])
  };
}
