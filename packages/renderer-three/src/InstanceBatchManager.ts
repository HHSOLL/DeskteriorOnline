export type InstanceBatch = {
  key: string;
  objectIds: string[];
  dirty: boolean;
};

export class InstanceBatchManager {
  private readonly batches = new Map<string, InstanceBatch>();
  private readonly objectToBatch = new Map<string, string>();

  replaceAll(nextGroups: Map<string, string[]>) {
    const previous = new Map(this.batches);
    this.batches.clear();
    this.objectToBatch.clear();

    nextGroups.forEach((objectIds, key) => {
      const nextIds = [...objectIds];
      const prior = previous.get(key);
      this.batches.set(key, {
        key,
        objectIds: nextIds,
        dirty:
          !prior ||
          prior.objectIds.length !== nextIds.length ||
          prior.objectIds.some((objectId, index) => objectId !== nextIds[index])
      });
      nextIds.forEach((objectId) => {
        this.objectToBatch.set(objectId, key);
      });
    });
  }

  upsert(key: string, objectIds: string[]) {
    const previous = this.batches.get(key);
    const nextIds = [...objectIds];
    this.batches.set(key, {
      key,
      objectIds: nextIds,
      dirty:
        !previous ||
        previous.objectIds.length !== nextIds.length ||
        previous.objectIds.some((objectId, index) => objectId !== nextIds[index])
    });
    nextIds.forEach((objectId) => {
      this.objectToBatch.set(objectId, key);
    });
  }

  values() {
    return Array.from(this.batches.values());
  }

  get(key: string) {
    return this.batches.get(key) ?? null;
  }

  getBatchKey(objectId: string) {
    return this.objectToBatch.get(objectId) ?? null;
  }

  size() {
    return this.batches.size;
  }

  removeObject(objectId: string) {
    const key = this.objectToBatch.get(objectId);
    if (!key) {
      return;
    }

    this.objectToBatch.delete(objectId);
    const batch = this.batches.get(key);
    if (!batch) {
      return;
    }

    const nextIds = batch.objectIds.filter((candidateId) => candidateId !== objectId);
    if (nextIds.length === 0) {
      this.batches.delete(key);
      return;
    }

    this.batches.set(key, {
      key,
      objectIds: nextIds,
      dirty: true
    });
  }
}
