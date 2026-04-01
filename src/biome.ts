import { Asset } from "./asset.js";
import type { AddOn } from "./addon.js";
import type { Entity } from "./entity.js";
import type { MusicDefinitionEntry } from "./musicDefinitions.js";
import type { Fog } from "./fogSettings.js";
import type { SoundEventBinding } from "./sounds.js";
import { shortname } from "./identifiers.js";

// ─── BehaviorBiome ────────────────────────────────────────────────────────────

/**
 * Represents a behavior pack biome definition file (`biomes/` directory).
 * Contains server-side biome data: terrain generation, climate, biome tags.
 *
 * Access via `biome.behavior` on a unified {@link Biome}.
 *
 * @example
 * ```ts
 * const biome = addon.biomes.get("minecraft:bamboo_jungle");
 * console.log(biome?.behavior?.entities.map(e => e.id));
 * console.log(biome?.behavior?.musicDefinition?.eventName);
 * ```
 */
export class BehaviorBiome extends Asset {
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

  /** The unified biome view that contains this behavior definition. */
  get biome(): Biome | undefined {
    return this._addon._biomeStore.get(this.id);
  }
}

// ─── ClientBiome ─────────────────────────────────────────────────────────────

/**
 * Represents a resource pack client biome definition file (`biomes/` directory).
 * Contains client-side biome data: fog, sky color, foliage color, ambient sounds.
 *
 * Access via `biome.resource` on a unified {@link Biome}.
 *
 * @example
 * ```ts
 * const biome = addon.biomes.get("tsu_nat:maple_forest");
 * console.log(biome?.resource?.fog?.id);         // "tsu_nat:maple_forest_fog"
 * console.log(biome?.resource?.ambientSounds);   // SoundEventBinding[]
 * ```
 */
export class ClientBiome extends Asset {
  /** The namespaced biome identifier, e.g. `"tsu_nat:maple_forest"`. */
  readonly id: string;
  private readonly _addon: AddOn;

  constructor(id: string, filePath: string, data: Record<string, unknown>, rawText: string, addon: AddOn) {
    super(filePath, data, rawText);
    this.id = id;
    this._addon = addon;
  }

  private get _components(): Record<string, unknown> {
    const inner = (this.data["minecraft:client_biome"] as Record<string, unknown>) ?? {};
    return (inner["components"] as Record<string, unknown>) ?? {};
  }

  /**
   * The resolved fog for this biome. `undefined` if not found.
   */
  get fog(): Fog | undefined {
    const comp = this._components["minecraft:fog_appearance"] as Record<string, unknown> | undefined;
    const id = comp?.["fog_identifier"] as string | undefined;
    return id ? this._addon.fogs.get(id) : undefined;
  }

  /**
   * Ambient sound events for this biome from `minecraft:ambient_sounds`
   * (mood, loop, creatures, additions).
   */
  get ambientSounds(): SoundEventBinding[] {
    const comp = this._components["minecraft:ambient_sounds"] as Record<string, unknown> | undefined;
    if (!comp) return [];
    const bindings: SoundEventBinding[] = [];
    for (const [event, value] of Object.entries(comp)) {
      if (typeof value === "string") {
        bindings.push({ event, definitionId: value, volume: 1.0, pitch: 1.0 });
      }
    }
    return bindings;
  }

  /** The unified biome view that contains this client definition. */
  get biome(): Biome | undefined {
    return this._addon._biomeStore.get(this.id);
  }
}

// ─── Biome ───────────────────────────────────────────────────────────────────

/**
 * A unified view of a biome that bridges {@link BehaviorBiome} (server-side)
 * and {@link ClientBiome} (client-side) into a single object.
 *
 * `Biome` is not itself a file-backed asset — it is a logical grouping. Raw file
 * data is accessible through `biome.behavior.data` and `biome.resource.data`.
 *
 * Access via `addon.biomes.get(id)`.
 *
 * @example
 * ```ts
 * const biome = addon.biomes.get("tsu_nat:maple_forest");
 * console.log(biome?.behavior?.entities.map(e => e.id));
 * console.log(biome?.fog?.id);           // shortcut for biome.resource.fog.id
 * console.log(biome?.ambientSounds);     // shortcut for biome.resource.ambientSounds
 * ```
 */
export class Biome {
  /** The namespaced biome identifier, e.g. `"tsu_nat:maple_forest"`. */
  readonly id: string;
  /** The behavior pack (server-side) definition for this biome. `undefined` if not present. */
  readonly behavior: BehaviorBiome | undefined;
  /** The resource pack (client-side) definition for this biome. `undefined` if not present. */
  readonly resource: ClientBiome | undefined;

  constructor(
    id: string,
    behavior: BehaviorBiome | undefined,
    resource: ClientBiome | undefined,
  ) {
    this.id = id;
    this.behavior = behavior;
    this.resource = resource;
  }

  /**
   * Entities that can spawn in this biome. Delegated from {@link BehaviorBiome.entities}.
   */
  get entities(): Entity[] {
    return this.behavior?.entities ?? [];
  }

  /**
   * The music definition for this biome. Delegated from {@link BehaviorBiome.musicDefinition}.
   */
  get musicDefinition(): MusicDefinitionEntry | undefined {
    return this.behavior?.musicDefinition;
  }

  /**
   * The resolved fog for this biome. Shortcut for `biome.resource?.fog`.
   */
  get fog(): Fog | undefined {
    return this.resource?.fog;
  }

  /**
   * Ambient sound events for this biome. Shortcut for `biome.resource?.ambientSounds`.
   */
  get ambientSounds(): SoundEventBinding[] {
    return this.resource?.ambientSounds ?? [];
  }

  /**
   * JSDoc comment blocks parsed from the backing file.
   * Returns behavior docstrings if present, otherwise resource docstrings.
   */
  get docstrings() {
    return this.behavior?.docstrings ?? this.resource?.docstrings ?? [];
  }
}
