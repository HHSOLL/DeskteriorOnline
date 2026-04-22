import type { RuntimeObjectRecord } from "./types";

export class ObjectRegistry {
  private readonly objects = new Map<string, RuntimeObjectRecord>();

  constructor(initialObjects?: Iterable<RuntimeObjectRecord>) {
    if (!initialObjects) return;
    for (const object of initialObjects) {
      this.objects.set(object.id, object);
    }
  }

  get(objectId: string) {
    return this.objects.get(objectId) ?? null;
  }

  set(object: RuntimeObjectRecord) {
    this.objects.set(object.id, object);
  }

  delete(objectId: string) {
    this.objects.delete(objectId);
  }

  values() {
    return this.objects.values();
  }

  entries() {
    return this.objects.entries();
  }

  toMap() {
    return new Map(this.objects);
  }
}
