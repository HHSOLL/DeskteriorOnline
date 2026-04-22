export class MaterialRegistry {
  private readonly materialIds = new Map<string, string>();

  set(objectId: string, materialId: string) {
    this.materialIds.set(objectId, materialId);
  }

  get(objectId: string) {
    return this.materialIds.get(objectId) ?? null;
  }
}
