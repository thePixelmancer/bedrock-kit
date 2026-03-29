import { Asset } from "./asset.js";

/**
 * Represents an attachable definition from the resource pack's `attachables/` directory.
 * Attachables define how items are visually rendered when held or equipped.
 *
 * @example
 * ```ts
 * const att = addon.getAttachable("minecraft:bow");
 * console.log(att?.textures);  // { default: "textures/items/bow_standby", ... }
 * console.log(att?.materials); // { default: "entity_alphatest", ... }
 * ```
 */
export class Attachable extends Asset {
  /** The namespaced item identifier this attachable is for, e.g. `"minecraft:bow"`. */
  readonly identifier: string;

  constructor(identifier: string, filePath: string, data: Record<string, unknown>, rawText: string) {
    super(filePath, data, rawText);
    this.identifier = identifier;
  }

  private get _description(): Record<string, unknown> {
    const inner = (this.data["minecraft:attachable"] as Record<string, unknown>) ?? {};
    return (inner["description"] as Record<string, unknown>) ?? {};
  }

  /** Map of shortname -> texture path. e.g. `{ "default": "textures/items/bow_standby" }`. */
  get textures(): Record<string, string> {
    return (this._description["textures"] as Record<string, string>) ?? {};
  }
  /** Map of shortname -> material name. e.g. `{ "default": "entity_alphatest" }`. */
  get materials(): Record<string, string> {
    return (this._description["materials"] as Record<string, string>) ?? {};
  }
  /** Map of shortname -> geometry identifier. */
  get geometry(): Record<string, string> {
    return (this._description["geometry"] as Record<string, string>) ?? {};
  }
}
