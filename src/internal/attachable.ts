import { Asset } from "./asset";

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
  /** The raw parsed JSON of the attachable file. */
  readonly data: Record<string, unknown>;
  /**
   * Absolute path to the attachable file on disk.
   * Empty string when loaded from browser `File[]`.
   */
  readonly filePath: string;

  constructor(identifier: string, data: Record<string, unknown>, filePath: string, rawText: string) {
    super(rawText);
    this.identifier = identifier;
    this.data = data;
    this.filePath = filePath;
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
