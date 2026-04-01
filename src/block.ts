import { Asset } from "./asset.js";
import type { AddOn } from "./addon.js";
import type { LootTable } from "./lootTable.js";
import type { SoundEventBinding } from "./sounds.js";
import type { Texture } from "./texture.js";
import { shortname, resolveDisplayName } from "./identifiers.js";

/**
 * Represents a block definition file from the behavior pack's `blocks/` directory.
 *
 * Access via `addon.blocks.get(id)`.
 *
 * @example
 * ```ts
 * const ore = addon.blocks.get("mypack:copper_ore");
 * console.log(ore?.displayName);         // "Copper Ore"
 * console.log(ore?.texture?.id);         // "textures/blocks/copper_ore"
 * console.log(ore?.lootTable?.itemIds);  // ["minecraft:raw_copper"]
 * ```
 */
export class Block extends Asset {
  /** The namespaced block identifier, e.g. `"minecraft:dirt"`. */
  readonly id: string;
  private readonly _addon: AddOn;

  constructor(id: string, filePath: string, data: Record<string, unknown>, rawText: string, addon: AddOn) {
    super(filePath, data, rawText);
    this.id = id;
    this._addon = addon;
  }

  /**
   * The display name for this block from the `en_US` language file.
   * Tries the `tile.*` key first (legacy), then `block.*`. Falls back to the identifier.
   */
  get displayName(): string {
    return resolveDisplayName(this._addon.getLangFile("en_US"), this.id, ["tile", "block", "item", "entity"]);
  }

  /**
   * The resolved texture for the default (`*`) face of this block, or `undefined`
   * if it cannot be resolved from `terrain_texture.json` or the texture file
   * is not present in the addon.
   */
  get texture(): Texture | undefined {
    const atlas = this._addon._state.terrainTextures;
    if (!atlas) return undefined;
    const materialInstances = this._components["minecraft:material_instances"] as Record<string, unknown> | undefined;
    if (!materialInstances) return undefined;
    const instance = (materialInstances["*"] as Record<string, unknown>) ?? (materialInstances["up"] as Record<string, unknown>);
    const sn = instance?.["texture"] as string | undefined;
    if (!sn) return undefined;
    const entry = atlas.get(sn);
    if (!entry) return undefined;
    const path = Array.isArray(entry) ? entry[0] : entry;
    return path ? this._addon.textures.get(path) : undefined;
  }

  /**
   * The loot table for this block, or `undefined` if none is referenced or found.
   */
  get lootTable(): LootTable | undefined {
    const lootPath = this._components["minecraft:loot"];
    if (typeof lootPath !== "string") return undefined;
    return this._addon.lootTables.get(lootPath);
  }

  /**
   * Sound events for this block from `sounds.json`.
   */
  get soundEvents(): SoundEventBinding[] {
    return this._addon._state.sounds?.getBlockSoundEvents(shortname(this.id))?.all ?? [];
  }

  private get _components(): Record<string, unknown> {
    const blockDef = (this.data["minecraft:block"] as Record<string, unknown>) ?? {};
    return (blockDef["components"] as Record<string, unknown>) ?? {};
  }
}
