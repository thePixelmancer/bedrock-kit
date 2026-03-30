import { Asset } from "./asset.js";
import type { AddOn } from "./addon.js";
import type { Attachable } from "./attachable.js";
import type { Recipe } from "./recipe.js";
import type { Entity } from "./entity.js";
import type { Block } from "./block.js";

/**
 * Represents an item definition file from the behavior pack's `items/` directory.
 *
 * Access via `addon.items.get(id)`.
 *
 * @example
 * ```ts
 * const spear = addon.items.get("minecraft:copper_spear");
 * console.log(spear?.displayName);   // "Copper Spear"
 * console.log(spear?.texturePath);   // "textures/items/copper_spear"
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
    const lang = this._addon.getLangFile("en_US");
    if (!lang) return this.id;
    const short = this.id.includes(":") ? this.id.split(":")[1] : this.id;
    const namespace = this.id.includes(":") ? this.id.split(":")[0] : "minecraft";
    return lang.get(`item.${namespace}.${short}.name`);
  }

  /**
   * The resolved display texture path for this item, or `undefined` if it
   * cannot be resolved from the resource pack's `item_texture.json`.
   */
  get texturePath(): string | undefined {
    const textures = this._addon._state.itemTextures;
    if (!textures) return undefined;
    const icon = this._extractIcon(this._getComponents());
    if (!icon) return undefined;
    const tex = textures.get(icon);
    if (!tex) return undefined;
    return Array.isArray(tex) ? (tex[0] ?? undefined) : tex;
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
    return this._addon.recipes.filter(r => r.result?.id === this.id).all();
  }

  /**
   * All unified entities that can drop this item via their loot tables.
   */
  get entities(): Entity[] {
    return this._addon.entities.all().filter(entity =>
      entity.lootTables.some(lt => lt.itemIds.includes(this.id))
    );
  }

  /**
   * All blocks that drop this item via their loot table.
   */
  get droppedByBlocks(): Block[] {
    return this._addon.blocks.all().filter(block => {
      const lt = block.lootTable;
      return lt !== undefined && lt.itemIds.includes(this.id);
    });
  }

  private _getComponents(): Record<string, unknown> {
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
