export class DirtyFlags {
  private readonly dirtyIds = new Set<string>();

  mark(objectId: string) {
    this.dirtyIds.add(objectId);
  }

  clear(objectId?: string) {
    if (objectId) {
      this.dirtyIds.delete(objectId);
      return;
    }

    this.dirtyIds.clear();
  }

  values() {
    return Array.from(this.dirtyIds);
  }
}
