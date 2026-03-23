import type { AddOn } from "./addon.js";
import type { Entity } from "./entity.js";
import type { MusicDefinition } from "./sound.js";
import { shortname } from "./utils.js";

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
export class Biome {
  /** The namespaced biome identifier, e.g. `"minecraft:bamboo_jungle"`. */
  readonly identifier: string;
  /** The raw parsed JSON of the biome file. */
  readonly data: Record<string, unknown>;
  /**
   * Absolute path to the biome file on disk.
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
   * The full components object from the biome definition.
   * Keys are Bedrock component names such as `"minecraft:climate"`, `"minecraft:tags"`, etc.
   */
  get components(): Record<string, unknown> {
    const inner = (this.data["minecraft:biome"] as Record<string, unknown>) ?? {};
    return (inner["components"] as Record<string, unknown>) ?? {};
  }

  /**
   * The `minecraft:climate` component, which contains properties like
   * `temperature`, `downfall`, and `snow_accumulation`. Returns null if absent.
   */
  get climate(): Record<string, unknown> | null {
    return (this.components["minecraft:climate"] as Record<string, unknown>) ?? null;
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
  getEntities(): Entity[] {
    const tagsComp = this.components["minecraft:tags"] as Record<string, unknown> | undefined;
    const biomeTags: string[] = tagsComp
      ? (tagsComp["tags"] as string[] | undefined) ?? []
      : [];
    if (biomeTags.length === 0) return [];

    return this._addon.getAllEntities().filter((entity) => {
      const spawnRule = entity.getSpawnRule();
      if (!spawnRule) return false;
      return spawnRule.getBiomeTags().some((tag) => biomeTags.includes(tag));
    });
  }

  /**
   * Returns the music definition for this biome from `sounds/music_definitions.json`.
   *
   * Looks up the biome's shortname (e.g. `"minecraft:bamboo_jungle"` → `"bamboo_jungle"`).
   * Returns null if no music definition exists for this biome.
   *
   * @example
   * ```ts
   * addon.getBiome("minecraft:bamboo_jungle")?.getMusicDefinition()?.eventName;
   * // "music.overworld.bamboo_jungle"
   * ```
   */
  getMusicDefinition(): MusicDefinition | null {
    return this._addon.getMusicDefinition(shortname(this.identifier));
  }
}
