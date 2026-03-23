import type { AddOn } from "./addon.js";
import type { LootTable } from "./lootTable.js";
import type { SoundEvent } from "./sound.js";
import { shortname } from "./utils.js";

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
export class Block {
  /** The namespaced block identifier, e.g. `"minecraft:dirt"`. */
  readonly identifier: string;
  /** The raw parsed JSON of the block's behavior file. */
  readonly data: Record<string, unknown>;
  /**
   * Absolute path to the block's behavior file on disk.
   * Empty string when loaded from browser `File[]`.
   */
  readonly filePath: string;
  private readonly _addon: AddOn;

  constructor(identifier: string, data: Record<string, unknown>, filePath: string, addon: AddOn) {
    this.identifier = identifier;
    this.data = data;
    this.filePath = filePath;
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
    const entry = textures.texture_data[sn];
    if (!entry) return null;
    const tex = entry.textures;
    return Array.isArray(tex) ? (tex[0] ?? null) : tex;
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
   * Looks up the block's shortname (e.g. `"minecraft:amethyst_block"` → `"amethyst_block"`)
   * in `block_sounds`. Returns an empty array if no sound events are defined.
   *
   * @example
   * ```ts
   * addon.getBlock("minecraft:amethyst_block")?.getSoundEvents()
   *   .find(e => e.event === "break")?.definitionId;
   * // "break.amethyst_block"
   * ```
   */
  getSoundEvents(): SoundEvent[] {
    return this._addon.getBlockSoundEvents(shortname(this.identifier));
  }

  private _getComponents(): Record<string, unknown> {
    const blockDef = (this.data["minecraft:block"] as Record<string, unknown>) ?? {};
    return (blockDef["components"] as Record<string, unknown>) ?? {};
  }
}
