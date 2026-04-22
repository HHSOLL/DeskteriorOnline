export class TextureRegistry {
  private readonly textureKeys = new Map<string, string>();

  set(key: string, textureId: string) {
    this.textureKeys.set(key, textureId);
  }

  get(key: string) {
    return this.textureKeys.get(key) ?? null;
  }
}
