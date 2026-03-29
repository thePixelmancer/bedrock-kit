import { Asset } from "./asset.js";
import type { AddOn } from "./addon.js";
import type { LootTable } from "./lootTable.js";
import type { SoundEventBinding } from "./sounds.js";
import { shortname } from "./identifiers.js";

/**
 * Represents a block definition file from the behavior pack's `blocks/` directory.
 *
 * @example
 * ```ts
 * const block = addon.getBlock("tsunami_dungeons:golem_heart");
 * console.log(block?.getTexturePath("*")); // "textures/blocks/golem_heart"
 * console.log(block?.getLootTable());      // LootTable | null
 * ```
 */
export class Block extends Asset {
  /** The namespaced block identifier, e.g. `"minecraft:dirt"`. */
  readonly identifier: string;
  private readonly _addon: AddOn;

  constructor(identifier: string, filePath: string, data: Record<string, unknown>, rawText: string, addon: AddOn) {
    super(filePath, data, rawText);
    this.identifier = identifier;
    this._addon = addon;
  }

  /**
   * Resolves the texture path for the given face of this block by reading its
   * `minecraft:material_instances` component and looking up the shortname in
   * the resource pack's `terrain_texture.json`.
   *
   * @param face - `"up"`, `"down"`, `"side"`, or `"*"` for the wildcard/default face.
   */
  getTexturePath(face: "up" | "down" | "side" | "*" = "*"): string | null {
    const textures = this._addon.terrainTextures;
    if (!textures) return null;
    const materialInstances = this._getComponents()["minecraft:material_instances"] as
      Record<string, unknown> | undefined;
    if (!materialInstances) return null;
    const instance =
      (materialInstances[face] as Record<string, unknown>) ??
      (materialInstances["*"] as Record<string, unknown>);
    const sn = instance?.["texture"] as string | undefined;
    if (!sn) return null;
    const tex = textures.get(sn);
    if (!tex) return null;
    return Array.isArray(tex) ? (tex[0] ?? null) : tex;
  }

  /**
   * Returns the display name for this block from the language file.
   * Defaults to en_US if no language is specified.
   *
   * @param language - Optional language code, e.g. `"en_US"`, `"fr_CA"`. Defaults to `"en_US"`.
   * @returns The translated display name, or the identifier if translation not found.
   *
   * @example
   * ```ts
   * addon.getBlock("minecraft:dirt")?.getDisplayName(); // "Dirt"
   * addon.getBlock("minecraft:dirt")?.getDisplayName("fr_CA"); // "Terre"
   * ```
   */
  getDisplayName(language?: string): string {
    const lang = this._addon.getLangFile(language);
    if (!lang) return this.identifier;
    const short = this.identifier.includes(":") ? this.identifier.split(":")[1] : this.identifier;
    const namespace = this.identifier.includes(":") ? this.identifier.split(":")[0] : "minecraft";
    // Minecraft uses both "tile." and "block." prefixes for blocks
    const tileKey = `tile.${namespace}.${short}.name`;
    const blockKey = `block.${namespace}.${short}.name`;
    const tileResult = lang.getOrNull(tileKey);
    if (tileResult !== null) return tileResult;
    return lang.get(blockKey);
  }

  /**
   * Returns the loot table for this block by resolving the path in its
   * `minecraft:loot` component. Returns null if absent.
   */
  getLootTable(): LootTable | null {
    const lootPath = this._getComponents()["minecraft:loot"];
    if (typeof lootPath !== "string") return null;
    return this._addon.getLootTableByPath(lootPath);
  }

  /**
   * Returns the sound events for this block from `sounds/sounds.json`.
   *
   * Looks up the block's shortname (e.g. `"minecraft:amethyst_block"` -> `"amethyst_block"`)
   * in `block_sounds`. Returns an empty array if no sound events are defined.
   *
   * @example
   * ```ts
   * addon.getBlock("minecraft:amethyst_block")?.getSoundEvents()
   *   .find(e => e.event === "break")?.definitionId;
   * // "break.amethyst_block"
   * ```
   */
  getSoundEvents(): SoundEventBinding[] {
    return this._addon.getBlockSoundEvents(shortname(this.identifier));
  }

  private _getComponents(): Record<string, unknown> {
    const blockDef = (this.data["minecraft:block"] as Record<string, unknown>) ?? {};
    return (blockDef["components"] as Record<string, unknown>) ?? {};
  }
}
