import { Asset } from "./asset.js";

// ─── TextureAtlasFile ─────────────────────────────────────────────────────────

/**
 * Wraps a texture atlas JSON file — either `textures/item_texture.json` or
 * `textures/terrain_texture.json`. Maps shortnames to texture file paths.
 *
 * Accessed via `addon.itemTextures` and `addon.terrainTextures`.
 *
 * @example
 * ```ts
 * addon.itemTextures?.get("iron_sword");    // "textures/items/iron_sword"
 * addon.terrainTextures?.get("dirt");       // "textures/blocks/dirt"
 * addon.terrainTextures?.get("grass_side"); // ["textures/blocks/grass_side", ...]
 * ```
 */
export class TextureAtlasFile extends Asset {
  private _textures: Map<string, string | string[]>;
  /** The resource pack name declared in the file, e.g. `"vanilla"`. */
  readonly resourcePackName: string;
  /** The texture name declared in the file, e.g. `"item_texture"`. */
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
   * Returns the texture path(s) for a shortname, or `null` if not found.
   * When multiple frames are defined (animated textures), returns a `string[]`.
   *
   * @example
   * ```ts
   * atlas.get("dirt")       // "textures/blocks/dirt"
   * atlas.get("fire_0")     // ["textures/blocks/fire_0_0", "textures/blocks/fire_0_1"]
   * atlas.get("nonexistent") // null
   * ```
   */
  get(shortname: string): string | string[] | null {
    return this._textures.get(shortname) ?? null;
  }

  /** Returns all shortnames defined in this atlas. */
  get shortnames(): string[] {
    return [...this._textures.keys()];
  }

  /** Returns the number of texture entries. */
  get size(): number {
    return this._textures.size;
  }
}
