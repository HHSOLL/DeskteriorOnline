import type { RenderReason, RendererMode } from "./types";

export class RenderScheduler {
  private mode: RendererMode = "demand";
  private lastReason: RenderReason = "demand";

  constructor(private readonly invalidate: (reason: RenderReason) => void) {}

  setMode(mode: RendererMode) {
    this.mode = mode;
  }

  getMode() {
    return this.mode;
  }

  request(reason: RenderReason) {
    this.lastReason = reason;
    this.invalidate(reason);
  }

  getLastReason() {
    return this.lastReason;
  }
}
