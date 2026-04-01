import { Asset } from "./asset.js";
import type { AddOn } from "./addon.js";
import type { Attachable } from "./attachable.js";
import type { Recipe } from "./recipe.js";
import type { Entity } from "./entity.js";
import type { Block } from "./block.js";
import type { Texture } from "./texture.js";
import { resolveDisplayName } from "./identifiers.js";

/**
 * Represents an item definition file from the behavior pack's `items/` directory.
 *
 * Access via `addon.items.get(id)`.
 *
 * @example
 * ```ts
 * const spear = addon.items.get("minecraft:copper_spear");
 * console.log(spear?.displayName);   // "Copper Spear"
 * console.log(spear?.texture?.id);   // "textures/items/copper_spear"
 * console.log(spear?.recipes.length); // 1
 * ```
 */
export class Item extends Asset {
  /** The namespaced item identifier, e.g. `"minecraft:copper_spear"`. */
  readonly id: string;
  private readonly _addon: AddOn;

  constructor(id: string, filePath: string, data: Record<string, unknown>, rawText: string, addon: AddOn) {
    super(filePath, data, rawText);
    this.id = id;
    this._addon = addon;
  }

  /**
   * The display name for this item from the `en_US` language file.
   * Falls back to the standard lang key `"item.namespace:name.name"` via the lang file,
   * which itself falls back to the identifier if the key is missing.
   */
  get displayName(): string {
    return resolveDisplayName(this._addon.getLangFile("en_US"), this.id, ["item"]);
  }

  /**
   * The resolved display texture for this item, or `undefined` if it cannot be
   * resolved from the resource pack's `item_texture.json` or the texture file
   * is not present in the addon.
   */
  get texture(): Texture | undefined {
    const atlas = this._addon._state.itemTextures;
    if (!atlas) return undefined;
    const icon = this._extractIcon(this._components);
    if (!icon) return undefined;
    const entry = atlas.get(icon);
    if (!entry) return undefined;
    const path = Array.isArray(entry) ? entry[0] : entry;
    return path ? this._addon.textures.get(path) : undefined;
  }

  /**
   * The attachable definition for this item, or `undefined` if none exists.
   * Attachables define how the item looks when held or equipped.
   */
  get attachable(): Attachable | undefined {
    return this._addon.attachables.get(this.id);
  }

  /**
   * All recipes in the addon whose result is this item.
   */
  get recipes(): Recipe[] {
    return this._addon._reverseIndex.getRecipesForItem(this.id);
  }

  /**
   * All unified entities that can drop this item via their loot tables.
   */
  get entities(): Entity[] {
    return this._addon._reverseIndex.getEntitiesForItem(this.id);
  }

  /**
   * All blocks that drop this item via their loot table.
   */
  get droppedByBlocks(): Block[] {
    return this._addon._reverseIndex.getBlocksForItem(this.id);
  }

  private get _components(): Record<string, unknown> {
    const itemDef = (this.data["minecraft:item"] as Record<string, unknown>) ?? {};
    return (itemDef["components"] as Record<string, unknown>) ?? {};
  }

  private _extractIcon(components: Record<string, unknown>): string | undefined {
    const iconComp = components["minecraft:icon"];
    if (!iconComp) return undefined;
    if (typeof iconComp === "string") return iconComp;
    if (typeof iconComp === "object") {
      const ic = iconComp as Record<string, unknown>;
      if (typeof ic["texture"] === "string") return ic["texture"] as string;
      const textures = ic["textures"] as Record<string, string> | undefined;
      if (textures?.default) return textures.default;
    }
    return undefined;
  }
}
