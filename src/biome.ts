import { Asset } from "./asset.js";
import type { AddOn } from "./addon.js";
import type { Entity } from "./entity.js";
import type { MusicDefinitionEntry } from "./musicDefinitions.js";
import { shortname } from "./identifiers.js";

/**
 * Represents a biome definition file from the behavior pack's `biomes/` directory.
 *
 * Access via `addon.biomes.get(id)`.
 *
 * @example
 * ```ts
 * const biome = addon.biomes.get("minecraft:bamboo_jungle");
 * console.log(biome?.entities.map(e => e.id));
 * console.log(biome?.musicDefinition?.eventName);
 * ```
 */
export class Biome extends Asset {
  /** The namespaced biome identifier, e.g. `"minecraft:bamboo_jungle"`. */
  readonly id: string;
  private readonly _addon: AddOn;

  constructor(id: string, filePath: string, data: Record<string, unknown>, rawText: string, addon: AddOn) {
    super(filePath, data, rawText);
    this.id = id;
    this._addon = addon;
  }

  /**
   * All unified entities whose spawn rule references at least one tag that
   * this biome has.
   */
  get entities(): Entity[] {
    const inner = (this.data["minecraft:biome"] as Record<string, unknown>) ?? {};
    const comps = (inner["components"] as Record<string, unknown>) ?? {};
    const tagsComp = comps["minecraft:tags"] as Record<string, unknown> | undefined;
    const biomeTags: string[] = tagsComp
      ? (tagsComp["tags"] as string[] | undefined) ?? []
      : [];
    if (biomeTags.length === 0) return [];

    return this._addon.entities.all().filter(entity => {
      const spawnRule = entity.spawnRule;
      if (!spawnRule) return false;
      return spawnRule.biomeTags.some(tag => biomeTags.includes(tag));
    });
  }

  /**
   * The music definition for this biome from `sounds/music_definitions.json`.
   * `undefined` if not found.
   */
  get musicDefinition(): MusicDefinitionEntry | undefined {
    return this._addon.music?.get(shortname(this.id));
  }
}
