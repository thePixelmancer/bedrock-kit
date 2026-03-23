import type { AddOn } from "./addon.js";
import type { Attachable } from "./attachable.js";
import type { Recipe } from "./recipe.js";

/**
 * Represents an item definition file from the behavior pack's `items/` directory.
 *
 * @example
 * ```ts
 * const spear = addon.getItem("minecraft:copper_spear");
 * console.log(spear?.getTexturePath()); // "textures/items/spear/copper_spear"
 * console.log(spear?.getAttachable());  // Attachable | null
 * console.log(spear?.getRecipes());     // Recipe[]
 * ```
 */
export class Item {
  /** The namespaced item identifier, e.g. `"minecraft:copper_spear"`. */
  readonly identifier: string;
  /** The raw parsed JSON of the item's behavior file. */
  readonly data: Record<string, unknown>;
  /**
   * Absolute path to the item's behavior file on disk.
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
    const entry = textures.texture_data[icon];
    if (!entry) return null;
    const tex = entry.textures;
    return Array.isArray(tex) ? (tex[0] ?? null) : tex;
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
