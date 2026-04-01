import { Asset } from "./asset.js";
import type { AddOn } from "./addon.js";
import type { Texture } from "./texture.js";

/**
 * Represents an attachable definition from the resource pack's `attachables/` directory.
 * Attachables define how items are visually rendered when held or equipped by an entity.
 *
 * Access via `addon.attachables.get(id)` or through `item.attachable`.
 *
 * @example
 * ```ts
 * const att = addon.attachables.get("minecraft:bow");
 * console.log(att?.textures.default?.id);  // "textures/items/bow_standby"
 * console.log(att?.materials);             // { default: "entity_alphatest", ... }
 * ```
 */
export class Attachable extends Asset {
  /** The namespaced item identifier this attachable is for, e.g. `"minecraft:bow"`. */
  readonly id: string;
  private readonly _addon: AddOn;

  constructor(id: string, filePath: string, data: Record<string, unknown>, rawText: string, addon: AddOn) {
    super(filePath, data, rawText);
    this.id = id;
    this._addon = addon;
  }

  private get _description(): Record<string, unknown> {
    const inner = (this.data["minecraft:attachable"] as Record<string, unknown>) ?? {};
    return (inner["description"] as Record<string, unknown>) ?? {};
  }

  /**
   * Map of shortname → resolved `Texture`, e.g. `{ "default": Texture }`.
   * Entries whose path cannot be found in the addon's texture collection are omitted.
   */
  get textures(): Record<string, Texture> {
    const raw = (this._description["textures"] as Record<string, string>) ?? {};
    const result: Record<string, Texture> = {};
    for (const [shortname, path] of Object.entries(raw)) {
      const tex = this._addon.textures.get(path);
      if (tex) result[shortname] = tex;
    }
    return result;
  }

  /** Map of shortname → material name, e.g. `{ "default": "entity_alphatest" }`. */
  get materials(): Record<string, string> {
    return (this._description["materials"] as Record<string, string>) ?? {};
  }

  /** Map of shortname → geometry identifier. */
  get geometry(): Record<string, string> {
    return (this._description["geometry"] as Record<string, string>) ?? {};
  }
}
