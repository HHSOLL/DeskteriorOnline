import type { SurfaceHit } from "./types";

export type RayPickerInput = {
  objectId: string;
  surfaceId: string;
  distance?: number;
};

export class RayPicker {
  pick(input: RayPickerInput): SurfaceHit | null {
    return null;
  }
}
