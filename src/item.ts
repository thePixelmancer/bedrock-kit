import { Asset } from "./asset.js";
import type { AddOn } from "./addon.js";
import type { Attachable } from "./attachable.js";
import type { Recipe } from "./recipe.js";
import type { BpEntity } from "./entity.js";
import type { Block } from "./block.js";

/**
 * Represents an item definition file from the behavior pack's `items/` directory.
 *
 * @example
 * ```ts
 * const spear = addon.getItem("minecraft:copper_spear");
 * console.log(spear?.getTexturePath()); // "textures/items/spear/copper_spear"
 * console.log(spear?.getAttachable());  // Attachable | null
 * console.log(spear?.getRecipes());     // Recipe[]
 * console.log(spear?.getEntities());    // BpEntity[]
 * console.log(spear?.getDroppedByBlocks());   // Block[]
 * ```
 */
export class Item extends Asset {
  /** The namespaced item identifier, e.g. `"minecraft:copper_spear"`. */
  readonly identifier: string;
  private readonly _addon: AddOn;

  constructor(identifier: string, filePath: string, data: Record<string, unknown>, rawText: string, addon: AddOn) {
    super(filePath, data, rawText);
    this.identifier = identifier;
    this._addon = addon;
  }

  /**
   * Resolves this item's display texture path by reading its `minecraft:icon` component
   * shortname and looking it up in the resource pack's `item_texture.json`.
   *
   * @returns The texture file path (without extension), e.g. `"textures/items/iron_sword"`.
   * Returns null if the item has no icon component or the shortname isn't in item_texture.json.
   */
  getTexturePath(): string | null {
    const textures = this._addon.itemTextures;
    if (!textures) return null;
    const icon = this._extractIcon(this._getComponents());
    if (!icon) return null;
    const tex = textures.get(icon);
    if (!tex) return null;
    return Array.isArray(tex) ? (tex[0] ?? null) : tex;
  }

  /**
   * Returns the display name for this item from the language file.
   * Defaults to en_US if no language is specified.
   *
   * @param language - Optional language code, e.g. `"en_US"`, `"fr_CA"`. Defaults to `"en_US"`.
   * @returns The translated display name, or the identifier if translation not found.
   *
   * @example
   * ```ts
   * addon.getItem("minecraft:iron_sword")?.getDisplayName(); // "Iron Sword"
   * addon.getItem("minecraft:iron_sword")?.getDisplayName("fr_CA"); // "Épée en fer"
   * ```
   */
  getDisplayName(language?: string): string {
    const lang = this._addon.getLangFile(language);
    if (!lang) return this.identifier;
    const short = this.identifier.includes(":") ? this.identifier.split(":")[1] : this.identifier;
    const namespace = this.identifier.includes(":") ? this.identifier.split(":")[0] : "minecraft";
    const key = `item.${namespace}.${short}.name`;
    return lang.get(key);
  }

  /**
   * Returns the attachable definition for this item, or null if no attachable exists.
   */
  getAttachable(): Attachable | null {
    return this._addon.getAttachable(this.identifier);
  }

  /**
   * Returns all recipes in the addon whose result matches this item's identifier.
   */
  getRecipes(): Recipe[] {
    return this._addon.getAllRecipes().filter((r) => r.getResultStack()?.identifier === this.identifier);
  }

  /**
   * Returns all entities that can drop this item, by searching every entity's
   * loot tables for entries matching this item's identifier.
   *
   * @example
   * ```ts
   * addon.getItem("minecraft:rotten_flesh")?.getEntities()
   *   .map(e => e.identifier);
   * // ["minecraft:panda", "minecraft:ocelot", ...]
   * ```
   */
  getEntities(): BpEntity[] {
    return this._addon.getAllEntities().toArray().filter((entity) => entity.getLootTables().some((lt) => lt.getItemIdentifiers().includes(this.identifier)));
  }

  /**
   * Returns all blocks that can drop this item, by resolving each block's
   * `minecraft:loot` component and checking if this item appears in it.
   *
   * @example
   * ```ts
   * addon.getItem("minecraft:diamond")?.getDroppedByBlocks();
   * // [Block<"minecraft:diamond_ore">, ...]
   * ```
   */
  getDroppedByBlocks(): Block[] {
    return this._addon.getAllBlocks().toArray().filter((block) => {
      const lt = block.getLootTable();
      return lt !== null && lt.getItemIdentifiers().includes(this.identifier);
    });
  }

  private _getComponents(): Record<string, unknown> {
    const itemDef = (this.data["minecraft:item"] as Record<string, unknown>) ?? {};
    return (itemDef["components"] as Record<string, unknown>) ?? {};
  }

  private _extractIcon(components: Record<string, unknown>): string | null {
    const iconComp = components["minecraft:icon"];
    if (!iconComp) return null;
    if (typeof iconComp === "string") return iconComp;
    if (typeof iconComp === "object") {
      const ic = iconComp as Record<string, unknown>;
      if (typeof ic["texture"] === "string") return ic["texture"] as string;
      const textures = ic["textures"] as Record<string, string> | undefined;
      if (textures?.default) return textures.default;
    }
    return null;
  }
}
