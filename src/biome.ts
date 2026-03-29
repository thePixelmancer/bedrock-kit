import { Asset } from "./asset.js";
import type { AddOn } from "./addon.js";
import type { BpEntity } from "./entity.js";
import type { MusicDefinitionEntry } from "./musicDefinitions.js";
import { shortname } from "./identifiers.js";

/**
 * Represents a biome definition file from the behavior pack's `biomes/` directory.
 *
 * @example
 * ```ts
 * const biome = addon.getBiome("minecraft:bamboo_jungle");
 * console.log(biome?.climate?.temperature); // 0.95
 * console.log(biome?.getEntities().map(e => e.identifier));
 * ```
 */
export class Biome extends Asset {
  /** The namespaced biome identifier, e.g. `"minecraft:bamboo_jungle"`. */
  readonly identifier: string;
  private readonly _addon: AddOn;

  constructor(identifier: string, filePath: string, data: Record<string, unknown>, rawText: string, addon: AddOn) {
    super(filePath, data, rawText);
    this.identifier = identifier;
    this._addon = addon;
  }

  /**
   * Returns all entities whose spawn rule references at least one tag that this biome has.
   *
   * @example
   * ```ts
   * addon.getBiome("minecraft:bamboo_jungle")
   *   ?.getEntities()
   *   .map(e => e.identifier);
   * // ["minecraft:panda", "minecraft:ocelot", ...]
   * ```
   */
  getEntities(): BpEntity[] {
    const inner = (this.data["minecraft:biome"] as Record<string, unknown>) ?? {};
    const comps = (inner["components"] as Record<string, unknown>) ?? {};
    const tagsComp = comps["minecraft:tags"] as Record<string, unknown> | undefined;
    const biomeTags: string[] = tagsComp
      ? (tagsComp["tags"] as string[] | undefined) ?? []
      : [];
    if (biomeTags.length === 0) return [];

    return this._addon.getAllEntities().toArray().filter((entity) => {
      const spawnRule = entity.getSpawnRule();
      if (!spawnRule) return false;
      return spawnRule.getBiomeTags().some((tag) => biomeTags.includes(tag));
    });
  }

  /**
   * Returns the music definition for this biome from `sounds/music_definitions.json`.
   *
   * Looks up the biome's shortname (e.g. `"minecraft:bamboo_jungle"` -> `"bamboo_jungle"`).
   * Returns null if no music definition exists for this biome.
   *
   * @example
   * ```ts
   * addon.getBiome("minecraft:bamboo_jungle")?.getMusicDefinition()?.eventName;
   * // "music.overworld.bamboo_jungle"
   * ```
   */
  getMusicDefinition(): MusicDefinitionEntry | null {
    return this._addon.getMusicDefinition(shortname(this.identifier));
  }
}
