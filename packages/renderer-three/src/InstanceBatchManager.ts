export type InstanceBatch = {
  key: string;
  objectIds: string[];
  dirty: boolean;
};

export class InstanceBatchManager {
  private readonly batches = new Map<string, InstanceBatch>();

  upsert(key: string, objectIds: string[]) {
    this.batches.set(key, {
      key,
      objectIds,
      dirty: true
    });
  }

  values() {
    return Array.from(this.batches.values());
  }
}
