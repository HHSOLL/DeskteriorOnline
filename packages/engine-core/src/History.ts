import type { SceneCommand } from "./CommandBuffer";

export class History {
  private readonly past: SceneCommand[] = [];
  private readonly future: SceneCommand[] = [];

  push(command: SceneCommand) {
    this.past.push(command);
    this.future.length = 0;
  }

  undo() {
    const command = this.past.pop() ?? null;
    if (command) {
      this.future.push(command);
    }
    return command;
  }

  redo() {
    const command = this.future.pop() ?? null;
    if (command) {
      this.past.push(command);
    }
    return command;
  }

  snapshot() {
    return {
      past: [...this.past],
      future: [...this.future]
    };
  }
}
