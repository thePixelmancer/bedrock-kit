import { readFileSync } from "node:fs";
import type { AddOn } from "./addon.js";
import type { Block } from "./block.js";
import type { Item } from "./item.js";
import type { Entity } from "./entity.js";

/**
 * Represents a texture file (`.png` or `.tga`) from the resource pack's `textures/` directory.
 *
 * Keyed by relative path without extension, matching how atlas files reference textures
 * (e.g. `"textures/tsu/nat/blocks/maple_log"`).
 *
 * Note: `getPixelData()` is only available in Node.js (disk) mode.
 * In browser mode the collection will be empty, and properties on other assets
 * that return `Texture` will return `undefined`.
 *
 * Access via `addon.textures.get(id)`.
 *
 * @example
 * ```ts
 * const tex = addon.textures.get("textures/tsu/nat/blocks/maple_log");
 * console.log(tex?.getPixelData()?.length);  // byte length of the PNG
 * console.log(tex?.textureSet);              // raw texture_set.json data
 * console.log(tex?.mer?.id);                 // "textures/.../maple_log_mer"
 * console.log(tex?.usedByBlocks.map(b => b.id));
 * ```
 */
export class Texture {
  /**
   * The relative path from the resource pack root, without file extension.
   * e.g. `"textures/tsu/nat/blocks/maple_log"`
   */
  readonly id: string;

  /** Absolute path to the texture file on disk. Empty string in browser mode. */
  readonly filePath: string;

  private readonly _addon: AddOn;
  private readonly _textureSetData: Record<string, unknown> | undefined;

  constructor(
    id: string,
    filePath: string,
    textureSetData: Record<string, unknown> | undefined,
    addon: AddOn,
  ) {
    this.id = id;
    this.filePath = filePath;
    this._addon = addon;
    this._textureSetData = textureSetData;
  }

  /**
   * Reads the raw bytes of this texture file from disk.
   * Returns `undefined` in browser mode or if the file cannot be read.
   */
  getPixelData(): Buffer | undefined {
    if (!this.filePath) return undefined;
    try {
      return readFileSync(this.filePath);
    } catch {
      return undefined;
    }
  }

  /**
   * The raw data from the companion `<name>.texture_set.json` file, if present.
   * Contains PBR layer definitions — use {@link normal}, {@link heightmap}, and
   * {@link mer} for resolved `Texture` objects instead of parsing this manually.
   */
  get textureSet(): Record<string, unknown> | undefined {
    if (!this._textureSetData) return undefined;
    return (this._textureSetData["minecraft:texture_set"] as Record<string, unknown>) ?? this._textureSetData;
  }

  /**
   * The normal map companion texture, resolved from `texture_set.normal`.
   * `undefined` if this texture has no texture set or no normal map entry.
   */
  get normal(): Texture | undefined {
    return this._resolveCompanion(this.textureSet?.["normal"]);
  }

  /**
   * The heightmap companion texture, resolved from `texture_set.heightmap`.
   * Heightmaps are an alternative to normal maps in Bedrock PBR.
   * `undefined` if this texture has no texture set or no heightmap entry.
   */
  get heightmap(): Texture | undefined {
    return this._resolveCompanion(this.textureSet?.["heightmap"]);
  }

  /**
   * The metalness/emissive/roughness (MER) companion texture,
   * resolved from `texture_set.metalness_emissive_roughness`.
   * `undefined` if this texture has no texture set or no MER entry.
   */
  get mer(): Texture | undefined {
    return this._resolveCompanion(this.textureSet?.["metalness_emissive_roughness"]);
  }

  /**
   * All blocks whose resolved texture matches this texture.
   */
  get usedByBlocks(): Block[] {
    return this._addon._reverseIndex.getBlocksForTexture(this.id);
  }

  /**
   * All items whose resolved texture matches this texture.
   */
  get usedByItems(): Item[] {
    return this._addon._reverseIndex.getItemsForTexture(this.id);
  }

  /**
   * All entities whose resource pack texture definitions include this texture.
   */
  get usedByEntities(): Entity[] {
    return this._addon._reverseIndex.getEntitiesForTexture(this.id);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private _resolveCompanion(name: unknown): Texture | undefined {
    if (typeof name !== "string") return undefined;
    // Values in texture_set.json are either a shortname (e.g. "maple_log_mer")
    // or a full path (e.g. "textures/blocks/maple_log_mer"). If no slash, prepend
    // the parent directory so it matches the textures collection key format.
    const id = name.includes("/") ? name : `${this._parentDir()}/${name}`;
    return this._addon.textures.get(id);
  }

  private _parentDir(): string {
    const lastSlash = this.id.lastIndexOf("/");
    return lastSlash !== -1 ? this.id.slice(0, lastSlash) : "";
  }
}
