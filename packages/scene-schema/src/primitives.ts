export type Vector2Mm = [number, number];
export type Vector3Mm = [number, number, number];
export type Vector3Meters = [number, number, number];
export type Vector3Radians = [number, number, number];
export type Vector3Permille = [number, number, number];
export type Vector3MilliDeg = [number, number, number];

export const MILLIMETERS_PER_METER = 1000;
export const MILLIDEGREES_PER_DEGREE = 1000;
export const MILLIDEGREES_PER_RADIAN = (180 * MILLIDEGREES_PER_DEGREE) / Math.PI;
export const RADIANS_PER_MILLIDEGREE = Math.PI / (180 * MILLIDEGREES_PER_DEGREE);
export const SCALE_PERMILLE_FACTOR = 1000;

function roundFinite(value: number, fallback = 0) {
  return Number.isFinite(value) ? Math.round(value) : fallback;
}

export function metersToMillimeters(value: number) {
  return roundFinite(value * MILLIMETERS_PER_METER);
}

export function millimetersToMeters(value: number) {
  return value / MILLIMETERS_PER_METER;
}

export function radiansToMilliDegrees(value: number) {
  return roundFinite(value * MILLIDEGREES_PER_RADIAN);
}

export function milliDegreesToRadians(value: number) {
  return value * RADIANS_PER_MILLIDEGREE;
}

export function scaleToPermille(value: number) {
  return roundFinite(value * SCALE_PERMILLE_FACTOR, SCALE_PERMILLE_FACTOR);
}

export function permilleToScale(value: number) {
  return value / SCALE_PERMILLE_FACTOR;
}

export function vectorMetersToMillimeters(value: Vector3Meters): Vector3Mm {
  return [
    metersToMillimeters(value[0]),
    metersToMillimeters(value[1]),
    metersToMillimeters(value[2])
  ];
}

export function vectorMillimetersToMeters(value: Vector3Mm): Vector3Meters {
  return [
    millimetersToMeters(value[0]),
    millimetersToMeters(value[1]),
    millimetersToMeters(value[2])
  ];
}

export function vectorRadiansToMilliDegrees(value: Vector3Radians): Vector3MilliDeg {
  return [
    radiansToMilliDegrees(value[0]),
    radiansToMilliDegrees(value[1]),
    radiansToMilliDegrees(value[2])
  ];
}

export function vectorMilliDegreesToRadians(value: Vector3MilliDeg): Vector3Radians {
  return [
    milliDegreesToRadians(value[0]),
    milliDegreesToRadians(value[1]),
    milliDegreesToRadians(value[2])
  ];
}

export function vectorScaleToPermille(value: Vector3Meters): Vector3Permille {
  return [
    scaleToPermille(value[0]),
    scaleToPermille(value[1]),
    scaleToPermille(value[2])
  ];
}

export function vectorPermilleToScale(value: Vector3Permille): Vector3Meters {
  return [permilleToScale(value[0]), permilleToScale(value[1]), permilleToScale(value[2])];
}
