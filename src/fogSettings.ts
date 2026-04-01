import { Asset } from "./asset.js";

/**
 * Represents a fog settings definition from the resource pack's `fogs/` directory.
 *
 * Access via `addon.fogs.get(id)`, or through `biome.fog` / `clientBiome.fog`.
 *
 * @example
 * ```ts
 * const fog = addon.fogs.get("minecraft:fog_bamboo_jungle");
 * console.log(fog?.data); // raw fog settings JSON
 * ```
 */
export class Fog extends Asset {
  /** The namespaced fog identifier, e.g. `"minecraft:fog_bamboo_jungle"`. */
  readonly id: string;

  constructor(id: string, filePath: string, data: Record<string, unknown>, rawText: string) {
    super(filePath, data, rawText);
    this.id = id;
  }
}
