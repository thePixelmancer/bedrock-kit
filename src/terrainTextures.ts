import { Asset } from "./asset.js";

/**
 * Wraps the `textures/terrain_texture.json` file.
 * Maps shortnames to block texture file paths.
 */
export class TerrainTextureFile extends Asset {
  private _textures: Map<string, string | string[]>;
  readonly resourcePackName: string;
  readonly textureName: string;

  constructor(filePath: string, data: Record<string, unknown>, rawText: string) {
    super(filePath, data, rawText);
    this.resourcePackName = (data["resource_pack_name"] as string) ?? "";
    this.textureName = (data["texture_name"] as string) ?? "";
    this._textures = this._parseTextures(data);
  }

  private _parseTextures(data: Record<string, unknown>): Map<string, string | string[]> {
    const map = new Map<string, string | string[]>();
    const textureData = data["texture_data"] as Record<string, { textures: string | string[] }> | undefined;
    if (!textureData) return map;
    for (const [shortname, entry] of Object.entries(textureData)) {
      if (entry && typeof entry === "object" && "textures" in entry) {
        map.set(shortname, entry.textures);
      }
    }
    return map;
  }

  /**
   * Returns the texture path(s) for a shortname, or null if not found.
   * @example `get("dirt")` → `"textures/blocks/dirt"`
   */
  get(shortname: string): string | string[] | null {
    return this._textures.get(shortname) ?? null;
  }

  /** Returns all shortnames defined in this file. */
  get shortnames(): string[] {
    return [...this._textures.keys()];
  }

  /** Returns the number of texture entries. */
  get size(): number {
    return this._textures.size;
  }
}
