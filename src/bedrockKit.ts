/**
 * bedrockKit.ts
 *
 * A library for navigating Minecraft Bedrock addon files programmatically.
 * Works in Deno, Node.js, and browsers.
 *
 * - Deno / Node.js: use `new AddOn(behaviorPackPath, resourcePackPath)`
 * - Browser: use `await AddOn.fromFileList(bpFiles, rpFiles)` with File[] from
 *   a folder picker (<input webkitdirectory> or showDirectoryPicker())
 *
 * Reads behavior pack and resource pack directories, parses their JSON files
 * (including Bedrock's comment-bearing JSON dialect), and exposes a typed API
 * for querying items, blocks, entities, recipes, loot tables, biomes, animations,
 * attachables, trading tables, and spawn rules — with automatic cross-referencing
 * between them.
 *
 * @example Deno / Node.js
 * ```ts
 * import { AddOn } from "./bedrockKit.ts";
 *
 * const addon = new AddOn("./behavior_pack", "./resource_pack");
 *
 * const spear = addon.getItem("minecraft:copper_spear");
 * console.log(spear?.getTexturePath());              // textures/items/spear/copper_spear
 * console.log(spear?.getRecipes()[0].resolveShape()); // 2D grid of Item | Tag | null
 *
 * const zombie = addon.getEntity("minecraft:zombie");
 * console.log(zombie?.getLootTables());  // LootTable[]
 * console.log(zombie?.getAnimations()); // [{ shortname, animation }]
 * ```
 *
 * @example Browser
 * ```ts
 * import { AddOn } from "bedrockKit";
 *
 * const bpInput  = document.getElementById("bp") as HTMLInputElement;
 * const rpInput  = document.getElementById("rp") as HTMLInputElement;
 *
 * const addon = await AddOn.fromFileList(
 *   Array.from(bpInput.files!),
 *   Array.from(rpInput.files!),
 * );
 * console.log(addon.getItem("minecraft:copper_spear")?.getTexturePath());
 * ```
 *
 * @module
 */

import { join, resolve, relative, posix } from "node:path";
import { readdirSync, statSync, readFileSync } from "node:fs";

// ─── Utility — disk (Deno + Node) ────────────────────────────────────────────

function walkDir(dir: string, filter?: (f: string) => boolean): string[] {
  try { statSync(dir); } catch { return []; }
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walkDir(full, filter));
    else if (!filter || filter(full)) results.push(full);
  }
  return results;
}

function readJSONFromDisk<T = Record<string, unknown>>(filePath: string): T | null {
  try {
    return JSON.parse(stripComments(readFileSync(filePath, "utf8"))) as T;
  } catch { return null; }
}

// ─── Utility — shared ────────────────────────────────────────────────────────

function stripComments(raw: string): string {
  let result = "";
  let i = 0;
  let inString = false;
  while (i < raw.length) {
    if (raw[i] === '"' && (i === 0 || raw[i - 1] !== "\\")) {
      inString = !inString;
      result += raw[i++];
      continue;
    }
    if (!inString) {
      if (raw[i] === "/" && raw[i + 1] === "/") {
        while (i < raw.length && raw[i] !== "\n") i++;
        continue;
      }
      if (raw[i] === "/" && raw[i + 1] === "*") {
        i += 2;
        while (i < raw.length && !(raw[i] === "*" && raw[i + 1] === "/")) i++;
        i += 2;
        continue;
      }
    }
    result += raw[i++];
  }
  return result;
}

function parseJSONString<T = Record<string, unknown>>(text: string): T | null {
  try {
    return JSON.parse(stripComments(text)) as T;
  } catch { return null; }
}

/**
 * Parse a raw ingredient value from a recipe key or ingredients array entry
 * into a prefixed identifier string.
 *   item  → "minecraft:stick"
 *   tag   → "tag:minecraft:planks"
 *   empty → ""
 */
function parseIngredient(raw: unknown): string {
  if (!raw) return "";
  if (typeof raw === "string") return raw;
  const r = raw as Record<string, unknown>;
  if (typeof r["tag"] === "string") return `tag:${r["tag"]}`;
  if (typeof r["item"] === "string") return r["item"] as string;
  return "";
}

// ─── Browser file loading ─────────────────────────────────────────────────────

/**
 * A parsed in-memory representation of a pack's files, keyed by their
 * slash-normalised path relative to the pack root.
 * e.g. `"textures/item_texture.json"` → `Record<string, unknown>`
 *
 * Used internally by `AddOn.fromFileList`.
 */
export type PackData = Map<string, Record<string, unknown>>;

/**
 * Read a `File[]` from a browser folder picker and return a `PackData` map.
 * The relative path is taken from `file.webkitRelativePath`, which browsers
 * set automatically when using `<input webkitdirectory>` or `showDirectoryPicker()`.
 * The first path segment (the folder name itself) is stripped so all keys are
 * relative to the pack root, matching what the disk loader produces.
 */
async function packDataFromFiles(files: File[]): Promise<PackData> {
  const map: PackData = new Map();
  await Promise.all(files.map(async (file) => {
    // webkitRelativePath: "behavior_pack/items/copper_spear.json"
    // → strip first segment → "items/copper_spear.json"
    const rel = file.webkitRelativePath
      ? file.webkitRelativePath.split("/").slice(1).join("/")
      : file.name;
    const text = await file.text();
    const data = parseJSONString(text);
    if (data) map.set(rel, data);
  }));
  return map;
}

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * The parsed structure of a resource pack's `textures/item_texture.json`.
 * Maps shortnames (e.g. `"iron_sword"`) to texture file paths.
 */
export interface ItemTextureMap {
  resource_pack_name: string;
  texture_name: string;
  /** Map of shortname → texture path(s). Used internally to resolve item icon paths. */
  texture_data: Record<string, { textures: string | string[] }>;
}

/**
 * The parsed structure of a resource pack's `textures/terrain_texture.json`.
 * Maps shortnames to block texture file paths.
 */
export interface TerrainTextureMap {
  resource_pack_name: string;
  texture_name: string;
  /** Map of shortname → texture path(s). Used internally to resolve block face texture paths. */
  texture_data: Record<string, { textures: string | string[] }>;
}

/**
 * The type of a recipe as determined by its root JSON key.
 * - `"shaped"` — crafting table recipe with a fixed pattern grid.
 * - `"shapeless"` — crafting table recipe with an unordered ingredient list.
 * - `"furnace"` — smelting recipe for a furnace or blast furnace.
 * - `"brewing_mix"` — potion brewing recipe (input potion + reagent → output potion).
 * - `"brewing_container"` — brewing recipe that modifies the container item.
 * - `"unknown"` — unrecognised recipe type.
 */
export type RecipeType =
  | "shaped" | "shapeless" | "furnace"
  | "brewing_mix" | "brewing_container" | "unknown";

// ─── Tag ─────────────────────────────────────────────────────────────────────

/**
 * Represents a Bedrock tag ingredient in a recipe (e.g. "minecraft:planks").
 * Use instanceof Tag to distinguish from Item in resolve results.
 */
export class Tag {
  /** The tag identifier without any prefix, e.g. "minecraft:planks". */
  readonly id: string;
  constructor(id: string) { this.id = id; }
}

/**
 * A single ingredient slot in a recipe.
 * - `Item` — a resolved item from the addon.
 * - `Tag` — a tag reference (e.g. `minecraft:planks`) that may match multiple items.
 * - `null` — an empty slot (shaped recipes only).
 *
 * Use `instanceof Item` or `instanceof Tag` to distinguish at runtime.
 */
export type Ingredient = Item | Tag | null;

/** A single ingredient in a shapeless recipe, with its required count. */
export interface ShapelessIngredient {
  /** The resolved ingredient — either a specific Item or a Tag. */
  ingredient: Item | Tag;
  /** How many of this ingredient are required. Defaults to 1 if not specified in the file. */
  count: number;
}

/** The resolved form of a furnace recipe. */
export interface FurnaceResolved {
  /** The item or tag to smelt. */
  input: Item | Tag;
  /** The item produced by smelting. */
  output: Item | Tag;
}

/** The resolved form of a brewing recipe. */
export interface BrewingResolved {
  /** The base potion being brewed. */
  input: Item | Tag;
  /** The ingredient added to the brewing stand. */
  reagent: Item | Tag;
  /** The resulting potion. */
  output: Item | Tag;
}

// ─── LootTable ───────────────────────────────────────────────────────────────

/** A single entry within a loot pool, representing one possible drop. */
export interface LootEntry {
  /** The entry type — typically `"item"`, `"loot_table"`, or `"empty"`. */
  type: string;
  /** The item or nested loot table identifier. Null for `"empty"` type entries. */
  name: string | null;
  /** Relative drop weight. Higher values are more likely. */
  weight: number;
  /** Optional function modifiers such as `set_count`, `enchant_randomly`, etc. */
  functions: Record<string, unknown>[];
}

/** A single roll group within a loot table. Each pool rolls independently. */
export interface LootPool {
  /** How many times this pool is rolled. Can be a fixed number or a min/max range. */
  rolls: number | { min: number; max: number };
  /** The possible entries for each roll. */
  entries: LootEntry[];
}

/**
 * Represents a loot table file from the behavior pack's `loot_tables/` directory.
 * Loot tables define what items drop from entities, blocks, or chests.
 *
 * @example
 * ```ts
 * const lt = addon.getLootTableByPath("loot_tables/entities/zombie.json");
 * console.log(lt?.getItemIdentifiers()); // ["minecraft:rotten_flesh", ...]
 * ```
 */
export class LootTable {
  /** The raw parsed JSON of the loot table file. */
  readonly data: Record<string, unknown>;
  /**
   * Absolute path to the loot table file on disk.
   * Empty string when loaded from browser `File[]`.
   */
  readonly filePath: string;
  /** Path relative to the behavior pack root, e.g. `"loot_tables/entities/zombie.json"`. */
  readonly relativePath: string;
  /** The parsed list of loot pools. Each pool rolls independently. */
  readonly pools: LootPool[];

  constructor(data: Record<string, unknown>, filePath: string, relativePath: string) {
    this.data = data;
    this.filePath = filePath;
    this.relativePath = relativePath;
    this.pools = this._parsePools(data);
  }

  /**
   * Returns a flat, deduplicated list of all item identifiers that can drop
   * from this loot table. Only includes entries of type `"item"`.
   *
   * @example
   * ```ts
   * lt.getItemIdentifiers(); // ["minecraft:rotten_flesh", "minecraft:iron_ingot"]
   * ```
   */
  getItemIdentifiers(): string[] {
    const ids: string[] = [];
    for (const pool of this.pools)
      for (const entry of pool.entries)
        if (entry.type === "item" && entry.name) ids.push(entry.name);
    return [...new Set(ids)];
  }

  private _parsePools(data: Record<string, unknown>): LootPool[] {
    const raw = data["pools"];
    if (!Array.isArray(raw)) return [];
    return raw.map((p: unknown) => {
      const pool = p as Record<string, unknown>;
      const entries: LootEntry[] = [];
      if (Array.isArray(pool["entries"])) {
        for (const e of pool["entries"] as Record<string, unknown>[]) {
          entries.push({
            type: (e["type"] as string) ?? "item",
            name: (e["name"] as string) ?? null,
            weight: (e["weight"] as number) ?? 1,
            functions: Array.isArray(e["functions"])
              ? (e["functions"] as Record<string, unknown>[]) : [],
          });
        }
      }
      return { rolls: pool["rolls"] as LootPool["rolls"], entries };
    });
  }
}

// ─── SpawnRule ────────────────────────────────────────────────────────────────

/**
 * Represents a spawn rule file from the behavior pack's `spawn_rules/` directory.
 * Spawn rules define when and where an entity can naturally spawn in the world.
 *
 * @example
 * ```ts
 * const rule = addon.getSpawnRule("minecraft:zombie");
 * console.log(rule?.populationControl); // "monster"
 * console.log(rule?.getBiomeTags());    // ["monster", "overworld"]
 * ```
 */
export class SpawnRule {
  /** The namespaced entity identifier this spawn rule applies to, e.g. `"minecraft:zombie"`. */
  readonly identifier: string;
  /** The raw parsed JSON of the spawn rule file. */
  readonly data: Record<string, unknown>;
  /**
   * Absolute path to the spawn rule file on disk.
   * Empty string when loaded from browser `File[]`.
   */
  readonly filePath: string;
  /**
   * The population control group that limits how many of this entity spawn together.
   * Common values: `"animal"`, `"monster"`, `"ambient"`, `"water_animal"`.
   * Null if not specified.
   */
  readonly populationControl: string | null;
  /** The raw condition objects from the spawn rule. Each condition defines spawn requirements. */
  readonly conditions: Record<string, unknown>[];

  constructor(identifier: string, data: Record<string, unknown>, filePath: string) {
    this.identifier = identifier;
    this.data = data;
    this.filePath = filePath;
    const inner = (data["minecraft:spawn_rules"] as Record<string, unknown>) ?? {};
    const desc = (inner["description"] as Record<string, unknown>) ?? {};
    this.populationControl = (desc["population_control"] as string) ?? null;
    this.conditions = Array.isArray(inner["conditions"])
      ? (inner["conditions"] as Record<string, unknown>[]) : [];
  }

  /**
   * Extracts all biome tag values referenced in this spawn rule's `minecraft:biome_filter`
   * conditions. Tags are used to match biomes — e.g. `"monster"`, `"savanna"`, `"mesa"`.
   *
   * @returns Deduplicated list of biome tag strings.
   *
   * @example
   * ```ts
   * addon.getSpawnRule("minecraft:armadillo")?.getBiomeTags(); // ["savanna", "mesa", "plateau"]
   * ```
   */
  getBiomeTags(): string[] {
    const tags: string[] = [];
    for (const cond of this.conditions) {
      const filter = cond["minecraft:biome_filter"];
      if (!filter) continue;
      const filters = Array.isArray(filter) ? filter : [filter];
      for (const f of filters as Record<string, unknown>[]) {
        if (f["test"] === "has_biome_tag" && typeof f["value"] === "string")
          tags.push(f["value"] as string);
        for (const key of ["all_of", "any_of"]) {
          if (Array.isArray(f[key])) {
            for (const sub of f[key] as Record<string, unknown>[]) {
              if (sub["test"] === "has_biome_tag" && typeof sub["value"] === "string")
                tags.push(sub["value"] as string);
            }
          }
        }
      }
    }
    return [...new Set(tags)];
  }
}

// ─── Biome ───────────────────────────────────────────────────────────────────

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
   * Internally reads the biome's `minecraft:tags` component and cross-references it
   * against the `getBiomeTags()` result of every entity's spawn rule.
   *
   * @returns Entities that can naturally spawn in this biome.
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
      const ruleTags = spawnRule.getBiomeTags();
      return ruleTags.some((tag) => biomeTags.includes(tag));
    });
  }

  /**
   * Returns the music definition for this biome from `sounds/music_definitions.json`.
   *
   * Looks up the biome's shortname (the part after the namespace, e.g.
   * `"minecraft:bamboo_jungle"` → `"bamboo_jungle"`) in `music_definitions.json`.
   * Returns null if no music definition exists for this biome.
   *
   * @example
   * ```ts
   * addon.getBiome("minecraft:bamboo_jungle")?.getMusicDefinition()?.eventName;
   * // "music.overworld.bamboo_jungle"
   * ```
   */
  getMusicDefinition(): MusicDefinition | null {
    const shortname = this.identifier.includes(":")
      ? this.identifier.split(":")[1]
      : this.identifier;
    return this._addon.getMusicDefinition(shortname);
  }

}

// ─── Animation ───────────────────────────────────────────────────────────────

/**
 * Represents a single animation definition loaded from a resource pack animation file.
 * Multiple animations are defined per file; each is keyed by its full ID.
 *
 * @example
 * ```ts
 * const anim = addon.getAnimation("animation.humanoid.move");
 * console.log(anim?.loop); // true
 * ```
 */
export class Animation {
  /** The full animation ID, e.g. `"animation.humanoid.move"`. */
  readonly id: string;
  /** The raw data for this animation definition. */
  readonly data: Record<string, unknown>;
  /**
   * Absolute path to the file this animation was loaded from.
   * Empty string when loaded from browser `File[]`.
   */
  readonly filePath: string;

  constructor(id: string, data: Record<string, unknown>, filePath: string) {
    this.id = id;
    this.data = data;
    this.filePath = filePath;
  }

  /** Whether this animation loops. Reads the `loop` property from the animation data. */
  get loop(): boolean { return this.data["loop"] === true; }
}

// ─── AnimationController ─────────────────────────────────────────────────────

/**
 * Represents a single animation controller loaded from a resource pack
 * `animation_controllers/` file. Animation controllers manage transitions
 * between animation states for an entity.
 *
 * @example
 * ```ts
 * const ctrl = addon.getAnimationController("controller.animation.zombie.move");
 * console.log(ctrl?.initialState); // "default"
 * console.log(ctrl?.states);       // ["default", "attacking"]
 * ```
 */
export class AnimationController {
  /** The full controller ID, e.g. `"controller.animation.zombie.move"`. */
  readonly id: string;
  /** The raw data for this controller definition. */
  readonly data: Record<string, unknown>;
  /**
   * Absolute path to the file this controller was loaded from.
   * Empty string when loaded from browser `File[]`.
   */
  readonly filePath: string;

  constructor(id: string, data: Record<string, unknown>, filePath: string) {
    this.id = id;
    this.data = data;
    this.filePath = filePath;
  }

  /** The names of all states defined in this controller. */
  get states(): string[] {
    return Object.keys((this.data["states"] as Record<string, unknown>) ?? {});
  }

  /** The name of the initial state this controller starts in. Null if not specified. */
  get initialState(): string | null {
    return (this.data["initial_state"] as string) ?? null;
  }
}

// ─── RenderController ────────────────────────────────────────────────────────

/**
 * Represents a single render controller loaded from a resource pack
 * `render_controllers/` file. Render controllers define which geometry,
 * materials, and textures are applied to an entity at runtime.
 *
 * @example
 * ```ts
 * const rc = addon.getRenderController("controller.render.zombie");
 * console.log(rc?.data); // { geometry: "...", materials: [...], textures: [...] }
 * ```
 */
export class RenderController {
  /** The full controller ID, e.g. `"controller.render.zombie"`. */
  readonly id: string;
  /** The raw data for this render controller definition. */
  readonly data: Record<string, unknown>;
  /**
   * Absolute path to the file this controller was loaded from.
   * Empty string when loaded from browser `File[]`.
   */
  readonly filePath: string;

  constructor(id: string, data: Record<string, unknown>, filePath: string) {
    this.id = id;
    this.data = data;
    this.filePath = filePath;
  }
}

// ─── Particle ────────────────────────────────────────────────────────────────

/**
 * Represents a particle effect definition from the resource pack's `particles/` directory.
 *
 * @example
 * ```ts
 * const particle = addon.getParticle("minecraft:stunned_emitter");
 * console.log(particle?.texturePath); // "textures/particle/particles"
 * ```
 */
export class Particle {
  /** The namespaced particle identifier, e.g. `"minecraft:stunned_emitter"`. */
  readonly identifier: string;
  /** The raw parsed JSON of the particle file. */
  readonly data: Record<string, unknown>;
  /**
   * Absolute path to the particle file on disk.
   * Empty string when loaded from browser `File[]`.
   */
  readonly filePath: string;

  constructor(identifier: string, data: Record<string, unknown>, filePath: string) {
    this.identifier = identifier;
    this.data = data;
    this.filePath = filePath;
  }

  private get _description(): Record<string, unknown> {
    const inner = (this.data["particle_effect"] as Record<string, unknown>) ?? {};
    return (inner["description"] as Record<string, unknown>) ?? {};
  }

  /**
   * The texture path used by this particle effect, as defined in `basic_render_parameters.texture`.
   * e.g. `"textures/particle/particles"`. Returns null if not specified.
   */
  get texturePath(): string | null {
    const params = this._description["basic_render_parameters"] as Record<string, unknown> | undefined;
    return (params?.["texture"] as string) ?? null;
  }

  /**
   * The material used by this particle effect, as defined in `basic_render_parameters.material`.
   * e.g. `"particles_alpha"`. Returns null if not specified.
   */
  get material(): string | null {
    const params = this._description["basic_render_parameters"] as Record<string, unknown> | undefined;
    return (params?.["material"] as string) ?? null;
  }

  /** The full components object for this particle effect. */
  get components(): Record<string, unknown> {
    const inner = (this.data["particle_effect"] as Record<string, unknown>) ?? {};
    return (inner["components"] as Record<string, unknown>) ?? {};
  }
}

// ─── Attachable ──────────────────────────────────────────────────────────────

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
export class Attachable {
  /** The namespaced item identifier this attachable is for, e.g. `"minecraft:bow"`. */
  readonly identifier: string;
  /** The raw parsed JSON of the attachable file. */
  readonly data: Record<string, unknown>;
  /**
   * Absolute path to the attachable file on disk.
   * Empty string when loaded from browser `File[]`.
   */
  readonly filePath: string;

  constructor(identifier: string, data: Record<string, unknown>, filePath: string) {
    this.identifier = identifier;
    this.data = data;
    this.filePath = filePath;
  }

  private get _description(): Record<string, unknown> {
    const inner = (this.data["minecraft:attachable"] as Record<string, unknown>) ?? {};
    return (inner["description"] as Record<string, unknown>) ?? {};
  }

  /** Map of shortname → texture path. e.g. `{ "default": "textures/items/bow_standby" }`. */
  get textures(): Record<string, string> {
    return (this._description["textures"] as Record<string, string>) ?? {};
  }
  /** Map of shortname → material name. e.g. `{ "default": "entity_alphatest" }`. */
  get materials(): Record<string, string> {
    return (this._description["materials"] as Record<string, string>) ?? {};
  }
  /** Map of shortname → geometry identifier. */
  get geometry(): Record<string, string> {
    return (this._description["geometry"] as Record<string, string>) ?? {};
  }
}

// ─── Trading ─────────────────────────────────────────────────────────────────

/** A single item entry in a villager trade — either wanted or given. */
export interface TradeItem {
  /** The namespaced item identifier, e.g. `"minecraft:emerald"`. */
  item: string;
  /** How many of this item are required or given. Can be a fixed number or a min/max range. */
  quantity: number | { min: number; max: number };
}

/** A single villager trade exchange. */
export interface Trade {
  /** Items the player must provide. */
  wants: TradeItem[];
  /** Items the villager gives in return. */
  gives: TradeItem[];
}

/** A single unlock tier in a villager trading table. */
export interface TradeTier {
  trades: Trade[];
}

/**
 * Represents a villager trading table from the behavior pack's `trading/` directory.
 *
 * @example
 * ```ts
 * const table = addon.getTradingTable("armorer_trades");
 * console.log(table?.tiers[0].trades[0]);
 * ```
 */
export class TradingTable {
  /** The raw parsed JSON of the trading table file. */
  readonly data: Record<string, unknown>;
  /**
   * Absolute path to the trading table file on disk.
   * Empty string when loaded from browser `File[]`.
   */
  readonly filePath: string;
  /** The file name without extension, used as the lookup key. e.g. `"armorer_trades"`. */
  readonly name: string;
  /** The ordered list of trade tiers. */
  readonly tiers: TradeTier[];

  constructor(data: Record<string, unknown>, filePath: string, name: string) {
    this.data = data;
    this.filePath = filePath;
    this.name = name;
    this.tiers = this._parseTiers(data);
  }

  /**
   * Returns a flat deduplicated list of every item identifier referenced
   * across all tiers and trades, including both wanted and given items.
   */
  getAllItemIdentifiers(): string[] {
    const ids: string[] = [];
    for (const tier of this.tiers)
      for (const trade of tier.trades) {
        for (const w of trade.wants) ids.push(w.item);
        for (const g of trade.gives) ids.push(g.item);
      }
    return [...new Set(ids)];
  }

  private _parseTiers(data: Record<string, unknown>): TradeTier[] {
    const raw = data["tiers"];
    if (!Array.isArray(raw)) return [];
    return raw.map((t: unknown) => {
      const tier = t as Record<string, unknown>;
      const tradeSource = Array.isArray(tier["trades"])
        ? (tier["trades"] as Record<string, unknown>[])
        : Array.isArray(tier["groups"])
          ? (tier["groups"] as Record<string, unknown>[]).flatMap((g) =>
              Array.isArray((g as Record<string, unknown>)["trades"])
                ? ((g as Record<string, unknown>)["trades"] as Record<string, unknown>[])
                : []
            )
          : [];
      const trades: Trade[] = tradeSource.map((tr) => ({
        wants: this._parseTradeItems(tr["wants"]),
        gives: this._parseTradeItems(tr["gives"]),
      }));
      return { trades };
    });
  }

  private _parseTradeItems(raw: unknown): TradeItem[] {
    if (!Array.isArray(raw)) return [];
    return (raw as Record<string, unknown>[]).map((r) => ({
      item: (r["item"] as string) ?? "",
      quantity: (r["quantity"] as TradeItem["quantity"]) ?? 1,
    }));
  }
}

// ─── ItemStack ───────────────────────────────────────────────────────────────

/**
 * Represents a recipe output — an item definition paired with the number of
 * items produced. Bedrock recipes can yield more than one of an item, e.g.
 * a shaped recipe for `minecraft:stick` produces 4.
 *
 * `item` is null when the result identifier exists in the recipe file but has
 * no corresponding item definition in the behavior pack.
 *
 * @example
 * ```ts
 * const stack = addon.getRecipesFor("minecraft:stick")[0]?.getResultStack();
 * console.log(stack?.item?.identifier); // "minecraft:stick"
 * console.log(stack?.count);            // 4
 * ```
 */
export class ItemStack {
  /** The resolved item definition, or null if not found in the addon. */
  readonly item: Item | null;
  /** The raw identifier string from the recipe file, e.g. `"minecraft:stick"`. */
  readonly identifier: string;
  /** How many items this recipe produces. Always at least 1. */
  readonly count: number;

  constructor(identifier: string, count: number, addon: AddOn) {
    this.identifier = identifier;
    this.count = count;
    this.item = addon.getItem(identifier);
  }
}

// ─── Recipe ──────────────────────────────────────────────────────────────────

/**
 * Represents a single recipe file from the behavior pack's `recipes/` directory.
 *
 * @example
 * ```ts
 * const recipes = addon.getRecipesFor("minecraft:copper_spear");
 * const shaped = recipes.find(r => r.type === "shaped");
 * const grid = shaped?.resolveShape();
 * // grid[0][2] instanceof Item -> true
 * ```
 */
export class Recipe {
  /** The raw parsed JSON of the recipe file. */
  readonly data: Record<string, unknown>;
  /** The recipe type as detected from the root JSON key. */
  readonly type: RecipeType;
  /**
   * Pattern rows for shaped recipes, e.g. `["X ", "X ", "X "]`.
   * Null for non-shaped recipes.
   */
  readonly shape: string[] | null;
  /**
   * Raw ingredient data extracted from the recipe file.
   * Prefer the typed resolve methods over reading this directly.
   */
  readonly ingredients: Record<string, string> | string[];
  private readonly _addon: AddOn;

  constructor(data: Record<string, unknown>, addon: AddOn) {
    this.data = data;
    this._addon = addon;
    const recipeKey = Object.keys(data).find((k) => k.startsWith("minecraft:recipe_"));
    const inner = recipeKey ? (data[recipeKey] as Record<string, unknown>) : {};
    this.type = this._detectType(recipeKey ?? "");
    this.shape = Array.isArray(inner["pattern"]) ? inner["pattern"] as string[] : null;
    this.ingredients = this._extractIngredients(inner);
  }

  private _detectType(key: string): RecipeType {
    if (key.includes("shaped")) return "shaped";
    if (key.includes("shapeless")) return "shapeless";
    if (key.includes("furnace")) return "furnace";
    if (key.includes("brewing_mix")) return "brewing_mix";
    if (key.includes("brewing_container")) return "brewing_container";
    return "unknown";
  }

  private _extractIngredients(inner: Record<string, unknown>): Record<string, string> | string[] {
    if (inner["key"] && typeof inner["key"] === "object" && !Array.isArray(inner["key"])) {
      const keyMap = inner["key"] as Record<string, unknown>;
      const result: Record<string, string> = {};
      for (const [symbol, value] of Object.entries(keyMap))
        result[symbol] = parseIngredient(value);
      return result;
    }
    if (Array.isArray(inner["ingredients"])) {
      return (inner["ingredients"] as unknown[]).map(parseIngredient);
    }
    return {};
  }

  private _parseResult(inner: Record<string, unknown>): { identifier: string; count: number } | null {
    if (!inner["result"]) return null;
    if (typeof inner["result"] === "string")
      return { identifier: inner["result"] as string, count: 1 };
    const r = inner["result"] as Record<string, unknown>;
    const identifier = (r["item"] as string) ?? (r["block"] as string) ?? null;
    if (!identifier) return null;
    const count = typeof r["count"] === "number" ? (r["count"] as number) : 1;
    return { identifier, count };
  }

  /**
   * Returns the output of this recipe as an `ItemStack`, or null if the recipe
   * has no result (e.g. some brewing recipes).
   *
   * `ItemStack.item` is null when the result identifier has no matching item
   * definition in the behavior pack. `ItemStack.count` reflects the exact
   * output quantity specified in the recipe file, defaulting to 1.
   *
   * @example
   * ```ts
   * const stack = addon.getRecipesFor("minecraft:stick")[0]?.getResultStack();
   * console.log(stack?.count);            // 4
   * console.log(stack?.item?.identifier); // "minecraft:stick"
   * ```
   */
  getResultStack(): ItemStack | null {
    const recipeKey = Object.keys(this.data).find((k) => k.startsWith("minecraft:recipe_"));
    const inner = recipeKey ? (this.data[recipeKey] as Record<string, unknown>) : {};
    const parsed = this._parseResult(inner);
    if (!parsed) return null;
    return new ItemStack(parsed.identifier, parsed.count, this._addon);
  }

  /** @deprecated Use `getResultStack()` instead. */
  getResultItem(): Item | null {
    return this.getResultStack()?.item ?? null;
  }

  /**
   * Shaped: returns a 2D grid matching the pattern.
   * Each cell is an Item, a Tag, or null for an empty slot.
   * Returns null if this recipe is not shaped.
   */
  resolveShape(): Ingredient[][] | null {
    if (this.type !== "shaped" || !this.shape) return null;
    const keyMap = this.ingredients as Record<string, string>;
    return this.shape.map((row) =>
      row.split("").map((char) => {
        if (char === " ") return null;
        const raw = keyMap[char] ?? "";
        return this._resolveIngredientStr(raw);
      })
    );
  }

  /**
   * Shapeless: returns each ingredient as an Item or Tag with its count.
   * Returns null if this recipe is not shapeless.
   */
  resolveShapeless(): ShapelessIngredient[] | null {
    if (this.type !== "shapeless") return null;
    const recipeKey = Object.keys(this.data).find((k) => k.startsWith("minecraft:recipe_"));
    const inner = recipeKey ? (this.data[recipeKey] as Record<string, unknown>) : {};
    const raw = inner["ingredients"];
    if (!Array.isArray(raw)) return [];
    return (raw as Record<string, unknown>[]).flatMap((entry) => {
      const ingredient = this._resolveIngredientStr(parseIngredient(entry));
      if (!ingredient) return [];
      return [{ ingredient, count: (entry["count"] as number) ?? 1 }];
    });
  }

  /**
   * Furnace: returns input and output as Item or Tag objects.
   * Returns null if this recipe is not a furnace recipe.
   */
  resolveFurnace(): FurnaceResolved | null {
    if (this.type !== "furnace") return null;
    const recipeKey = Object.keys(this.data).find((k) => k.startsWith("minecraft:recipe_"));
    const inner = recipeKey ? (this.data[recipeKey] as Record<string, unknown>) : {};
    const input = this._resolveIngredientStr(parseIngredient(inner["input"]));
    const output = this._resolveIngredientStr(parseIngredient(inner["output"]));
    if (!input || !output) return null;
    return { input, output };
  }

  /**
   * Brewing: returns input, reagent, and output as Item or Tag objects.
   * Returns null if this recipe is not a brewing recipe.
   */
  resolveBrewing(): BrewingResolved | null {
    if (this.type !== "brewing_mix" && this.type !== "brewing_container") return null;
    const recipeKey = Object.keys(this.data).find((k) => k.startsWith("minecraft:recipe_"));
    const inner = recipeKey ? (this.data[recipeKey] as Record<string, unknown>) : {};
    const input = this._resolveIngredientStr(parseIngredient(inner["input"]));
    const reagent = this._resolveIngredientStr(parseIngredient(inner["reagent"]));
    const output = this._resolveIngredientStr(parseIngredient(inner["output"]));
    if (!input || !reagent || !output) return null;
    return { input, reagent, output };
  }

  /**
   * Returns a flat array of all ingredients across the recipe as `Item | Tag` objects.
   * Empty slots are excluded.
   */
  getAllIngredients(): Array<Item | Tag> {
    const strs = this._allIngredientStrings();
    return strs.flatMap((s) => {
      const r = this._resolveIngredientStr(s);
      return r ? [r] : [];
    });
  }

  private _resolveIngredientStr(raw: string): Item | Tag | null {
    if (!raw) return null;
    if (raw.startsWith("tag:")) return new Tag(raw.slice(4));
    return this._addon.getItem(raw) ?? new Tag(raw);
  }

  private _allIngredientStrings(): string[] {
    const recipeKey = Object.keys(this.data).find((k) => k.startsWith("minecraft:recipe_"));
    const inner = recipeKey ? (this.data[recipeKey] as Record<string, unknown>) : {};
    const strs: string[] = [];
    if (inner["key"] && typeof inner["key"] === "object" && !Array.isArray(inner["key"])) {
      for (const v of Object.values(inner["key"] as Record<string, unknown>))
        strs.push(parseIngredient(v));
    }
    if (Array.isArray(inner["ingredients"])) {
      for (const v of inner["ingredients"] as unknown[])
        strs.push(parseIngredient(v));
    }
    for (const field of ["input", "reagent", "output"]) {
      if (inner[field]) strs.push(parseIngredient(inner[field]));
    }
    return strs.filter(Boolean);
  }
}

// ─── Item ─────────────────────────────────────────────────────────────────────

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

// ─── Block ───────────────────────────────────────────────────────────────────

/**
 * Represents a block definition file from the behavior pack's `blocks/` directory.
 *
 * @example
 * ```ts
 * const block = addon.getBlock("tsunami_dungeons:golem_heart");
 * console.log(block?.getTexturePath("*")); // "textures/blocks/golem_heart"
 * console.log(block?.getLootTable());      // LootTable | null
 * ```
 */
export class Block {
  /** The namespaced block identifier, e.g. `"minecraft:dirt"`. */
  readonly identifier: string;
  /** The raw parsed JSON of the block's behavior file. */
  readonly data: Record<string, unknown>;
  /**
   * Absolute path to the block's behavior file on disk.
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
   * Resolves the texture path for the given face of this block.
   * @param face - `"up"`, `"down"`, `"side"`, or `"*"` for the wildcard/default face.
   */
  getTexturePath(face: "up" | "down" | "side" | "*" = "*"): string | null {
    const textures = this._addon.terrainTextures;
    if (!textures) return null;
    const materialInstances = this._getComponents()["minecraft:material_instances"] as
      Record<string, unknown> | undefined;
    if (!materialInstances) return null;
    const instance =
      (materialInstances[face] as Record<string, unknown>) ??
      (materialInstances["*"] as Record<string, unknown>);
    const shortname = instance?.["texture"] as string | undefined;
    if (!shortname) return null;
    const entry = textures.texture_data[shortname];
    if (!entry) return null;
    const tex = entry.textures;
    return Array.isArray(tex) ? (tex[0] ?? null) : tex;
  }

  /**
   * Returns the loot table for this block by resolving the path in its
   * `minecraft:loot` component. Returns null if absent.
   */
  getLootTable(): LootTable | null {
    const lootPath = this._getComponents()["minecraft:loot"];
    if (typeof lootPath !== "string") return null;
    return this._addon.getLootTableByPath(lootPath);
  }


  /**
   * Returns the sound events for this block from `sounds/sounds.json`.
   *
   * Looks up the block's shortname (the part after the namespace, e.g.
   * `"minecraft:dirt"` → `"dirt"`) in `block_sounds`. Returns an empty array
   * if no sound events are defined for this block shortname.
   *
   * @example
   * ```ts
   * addon.getBlock("minecraft:amethyst_block")?.getSoundEvents()
   *   .find(e => e.event === "break")?.definitionId;
   * // "break.amethyst_block"
   * ```
   */
  getSoundEvents(): SoundEvent[] {
    const shortname = this.identifier.includes(":")
      ? this.identifier.split(":")[1]
      : this.identifier;
    return this._addon.getBlockSoundEvents(shortname);
  }

  private _getComponents(): Record<string, unknown> {
    const blockDef = (this.data["minecraft:block"] as Record<string, unknown>) ?? {};
    return (blockDef["components"] as Record<string, unknown>) ?? {};
  }
}

// ─── Entity ───────────────────────────────────────────────────────────────────

/**
 * Represents an entity that exists across both packs — a behavior (server-side)
 * definition and optionally a resource (client-side) definition.
 *
 * @example
 * ```ts
 * const zombie = addon.getEntity("minecraft:zombie");
 * zombie?.getLootTables();        // LootTable[]
 * zombie?.getSpawnRule();         // SpawnRule | null
 * zombie?.getAnimations();        // [{ shortname, animation }]
 * zombie?.getRenderControllers(); // RenderController[]
 * ```
 */
export class Entity {
  /** The namespaced entity identifier, e.g. `"minecraft:zombie"`. */
  readonly identifier: string;
  /** Raw parsed JSON of the behavior pack (server-side) entity file. */
  readonly behaviorData: Record<string, unknown>;
  /**
   * Absolute path to the behavior file on disk.
   * Empty string if no behavior file exists or when loaded from browser `File[]`.
   */
  readonly behaviorFilePath: string;
  /** Raw parsed JSON of the resource pack (client-side) entity file. Null if not present. */
  readonly resourceData: Record<string, unknown> | null;
  /**
   * Absolute path to the resource file on disk. Null if not present.
   * Empty string when loaded from browser `File[]`.
   */
  readonly resourceFilePath: string | null;

  private readonly _addon: AddOn;

  constructor(
    identifier: string,
    behaviorData: Record<string, unknown>,
    behaviorFilePath: string,
    resourceData: Record<string, unknown> | null,
    resourceFilePath: string | null,
    addon: AddOn
  ) {
    this.identifier = identifier;
    this.behaviorData = behaviorData;
    this.behaviorFilePath = behaviorFilePath;
    this.resourceData = resourceData;
    this.resourceFilePath = resourceFilePath;
    this._addon = addon;
  }

  private get _rpDescription(): Record<string, unknown> {
    const inner = (this.resourceData?.["minecraft:client_entity"] as Record<string, unknown>) ?? {};
    return (inner["description"] as Record<string, unknown>) ?? {};
  }

  /**
   * The shortname → full animation ID map declared in the resource entity file.
   * @example `{ "move": "animation.humanoid.move" }`
   */
  get animationShortnames(): Record<string, string> {
    return (this._rpDescription["animations"] as Record<string, string>) ?? {};
  }

  /**
   * The shortname → full particle identifier map declared in the resource entity file.
   * @example `{ "stun_particles": "minecraft:stunned_emitter" }`
   */
  get particleShortnames(): Record<string, string> {
    return (this._rpDescription["particle_effects"] as Record<string, string>) ?? {};
  }

  /**
   * The list of render controller IDs declared in the resource entity file.
   */
  get renderControllerIds(): string[] {
    const raw = this._rpDescription["render_controllers"];
    if (!Array.isArray(raw)) return [];
    return (raw as unknown[]).flatMap((entry) => {
      if (typeof entry === "string") return [entry];
      if (typeof entry === "object" && entry !== null)
        return Object.keys(entry as Record<string, unknown>);
      return [];
    });
  }

  /**
   * Returns all loot tables this entity can drop, by recursively searching
   * its behavior data for `minecraft:loot` component entries.
   */
  getLootTables(): LootTable[] {
    return this._collectLootPaths(this.behaviorData).flatMap((p) => {
      const lt = this._addon.getLootTableByPath(p);
      return lt ? [lt] : [];
    });
  }

  /** Returns this entity's spawn rule, or null if none exists. */
  getSpawnRule(): SpawnRule | null {
    return this._addon.getSpawnRule(this.identifier);
  }

  /**
   * Resolves this entity's animation shortnames into `Animation` instances.
   * Animation controller references are excluded — use `getAnimationControllers()` for those.
   */
  getAnimations(): Array<{ shortname: string; animation: Animation }> {
    return Object.entries(this.animationShortnames).flatMap(([shortname, fullId]) => {
      if (fullId.startsWith("controller.")) return [];
      const animation = this._addon.getAnimation(fullId);
      return animation ? [{ shortname, animation }] : [];
    });
  }

  /**
   * Resolves this entity's animation controller shortnames into `AnimationController` instances.
   */
  getAnimationControllers(): Array<{ shortname: string; controller: AnimationController }> {
    return Object.entries(this.animationShortnames).flatMap(([shortname, fullId]) => {
      if (!fullId.startsWith("controller.animation.")) return [];
      const controller = this._addon.getAnimationController(fullId);
      return controller ? [{ shortname, controller }] : [];
    });
  }

  /** Resolves this entity's render controller IDs into `RenderController` instances. */
  getRenderControllers(): RenderController[] {
    return this.renderControllerIds.flatMap((id) => {
      const rc = this._addon.getRenderController(id);
      return rc ? [rc] : [];
    });
  }

  /**
   * Resolves this entity's particle shortnames into `Particle` instances.
   */
  getParticles(): Array<{ shortname: string; particle: Particle }> {
    return Object.entries(this.particleShortnames).flatMap(([shortname, fullId]) => {
      const particle = this._addon.getParticle(fullId);
      return particle ? [{ shortname, particle }] : [];
    });
  }


  /**
   * Returns the sound events for this entity from `sounds/sounds.json`.
   *
   * The entity identifier is stripped to its shortname for the lookup
   * (e.g. `"minecraft:zombie"` → `"zombie"`), matching how `sounds.json` keys entities.
   * Returns an empty array if no sound events are defined for this entity.
   *
   * @example
   * ```ts
   * addon.getEntity("minecraft:zombie")?.getSoundEvents()
   *   .map(e => `${e.event} → ${e.definitionId}`);
   * // ["ambient → mob.zombie.say", "death → mob.zombie.death", ...]
   * ```
   */
  getSoundEvents(): SoundEvent[] {
    const shortname = this.identifier.includes(":")
      ? this.identifier.split(":")[1]
      : this.identifier;
    return this._addon.getEntitySoundEvents(shortname);
  }

  /**
   * The shortname → sound event ID map declared in the resource entity file's
   * `description.sounds`. These are additional sound bindings defined per-entity
   * in the resource pack, separate from the global `sounds.json` mappings.
   *
   * @example `{ "hurt": "mob.zombie.hurt", "step": "mob.zombie.step" }`
   */
  get soundShortnames(): Record<string, string> {
    return (this._rpDescription["sounds"] as Record<string, string>) ?? {};
  }

  private _collectLootPaths(obj: unknown): string[] {
    if (typeof obj !== "object" || obj === null) return [];
    const paths: string[] = [];
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (key === "minecraft:loot" && typeof value === "object" && value !== null) {
        const table = (value as Record<string, unknown>)["table"];
        if (typeof table === "string") paths.push(table);
      }
      paths.push(...this._collectLootPaths(value));
    }
    return [...new Set(paths)];
  }
}

// ─── Sound types ─────────────────────────────────────────────────────────────

/**
 * A single audio file entry within a sound definition.
 * Entries in `sound_definitions.json` can be plain path strings or full objects.
 */
export interface SoundFile {
  /** Path to the audio file relative to the resource pack root, no extension. */
  name: string;
  /** Relative playback volume. Absent means use the definition-level default. */
  volume?: number;
  /** Pitch multiplier. Absent means use the definition-level default. */
  pitch?: number;
  /** Relative selection weight. Higher = more likely to be chosen. */
  weight?: number;
  /** Whether this sound is positional (3D). */
  is3D?: boolean;
  /** Whether this sound streams from disk rather than loading into memory. */
  stream?: boolean;
  /** Whether this sound loads on low-memory devices. */
  loadOnLowMemory?: boolean;
}

// ─── SoundDefinition ─────────────────────────────────────────────────────────

/**
 * Represents a single entry from `sounds/sound_definitions.json`.
 * Each definition maps a sound event ID (e.g. `"mob.zombie.say"`) to a list of
 * audio files and their playback properties.
 *
 * @example
 * ```ts
 * const def = addon.getSoundDefinition("mob.zombie.say");
 * console.log(def?.category);       // "mob"
 * console.log(def?.files[0].name);  // "sounds/mob/zombie/say1"
 * ```
 */
export class SoundDefinition {
  /** The sound event identifier, e.g. `"mob.zombie.say"`. */
  readonly id: string;
  /** The raw data for this sound definition entry. */
  readonly data: Record<string, unknown>;
  /**
   * The audio category, e.g. `"ambient"`, `"block"`, `"mob"`, `"music"`, `"player"`, `"ui"`.
   * Null if not specified.
   */
  readonly category: string | null;
  /** The parsed list of audio files this definition can play. */
  readonly files: SoundFile[];

  constructor(id: string, data: Record<string, unknown>) {
    this.id = id;
    this.data = data;
    this.category = (data["category"] as string) ?? null;
    this.files = this._parseFiles(data["sounds"]);
  }

  private _parseFiles(raw: unknown): SoundFile[] {
    if (!Array.isArray(raw)) return [];
    return raw.map((entry) => {
      if (typeof entry === "string") return { name: entry };
      const e = entry as Record<string, unknown>;
      const result: SoundFile = { name: (e["name"] as string) ?? "" };
      if (typeof e["volume"] === "number") result.volume = e["volume"] as number;
      if (typeof e["pitch"] === "number") result.pitch = e["pitch"] as number;
      if (typeof e["weight"] === "number") result.weight = e["weight"] as number;
      if (typeof e["is3D"] === "boolean") result.is3D = e["is3D"] as boolean;
      if (typeof e["stream"] === "boolean") result.stream = e["stream"] as boolean;
      if (typeof e["load_on_low_memory"] === "boolean") result.loadOnLowMemory = e["load_on_low_memory"] as boolean;
      return result;
    });
  }
}

// ─── SoundEvent ───────────────────────────────────────────────────────────────

/**
 * A resolved sound event binding — the pairing of an event name with the
 * `SoundDefinition` it maps to. Returned by `Entity.getSoundEvents()` and
 * `Block.getSoundEvents()`.
 *
 * Event values in `sounds.json` can be plain strings (just a definition ID) or
 * inline objects with overriding `sound`, `pitch`, and `volume` fields.
 * Both forms are normalised into this shape.
 *
 * @example
 * ```ts
 * const events = addon.getEntity("minecraft:zombie")?.getSoundEvents() ?? [];
 * for (const { event, definition } of events) {
 *   console.log(event, "\u2192", definition?.files[0].name);
 * }
 * ```
 */
export interface SoundEvent {
  /** The event name, e.g. `"ambient"`, `"death"`, `"hurt"`. */
  event: string;
  /**
   * The sound definition ID this event resolves to, e.g. `"mob.zombie.say"`.
   * Empty string means the event is intentionally silent.
   */
  definitionId: string;
  /** The resolved `SoundDefinition`, or null if the ID is not in `sound_definitions.json`. */
  definition: SoundDefinition | null;
  /** Per-event volume override from `sounds.json`. Null if not specified. */
  volume: number | null;
  /** Per-event pitch override from `sounds.json`. Null if not specified. */
  pitch: number | [number, number] | null;
}

// ─── MusicDefinition ─────────────────────────────────────────────────────────

/**
 * Represents a single entry from `sounds/music_definitions.json`.
 * Maps a context key (biome shortname, `"game"`, `"menu"`, etc.) to the music
 * event that plays there and its delay range.
 *
 * @example
 * ```ts
 * const music = addon.getMusicDefinition("bamboo_jungle");
 * console.log(music?.eventName); // "music.overworld.bamboo_jungle"
 * console.log(music?.minDelay);  // 60
 * ```
 */
export class MusicDefinition {
  /** The context key, e.g. `"bamboo_jungle"`, `"game"`, `"menu"`. */
  readonly id: string;
  /** The sound event ID to play, e.g. `"music.overworld.bamboo_jungle"`. */
  readonly eventName: string;
  /** Minimum seconds before music starts. */
  readonly minDelay: number;
  /** Maximum seconds before music starts. */
  readonly maxDelay: number;

  constructor(id: string, data: Record<string, unknown>) {
    this.id = id;
    this.eventName = (data["event_name"] as string) ?? "";
    this.minDelay = (data["min_delay"] as number) ?? 0;
    this.maxDelay = (data["max_delay"] as number) ?? 0;
  }

  /**
   * Resolves the music event name to its `SoundDefinition` from `sound_definitions.json`.
   * Returns null if the definition doesn't exist in the addon.
   */
  resolve(addon: AddOn): SoundDefinition | null {
    return addon.getSoundDefinition(this.eventName);
  }
}

// ─── AddOn ────────────────────────────────────────────────────────────────────

/**
 * The main entry point for bedrockKit. Represents a Minecraft Bedrock addon
 * consisting of a behavior pack and a resource pack.
 *
 * **Deno / Node.js** — synchronous, reads from disk:
 * ```ts
 * const addon = new AddOn("./vanilla_behavior_pack", "./vanilla_resource_pack");
 * ```
 *
 * **Browser** — async, reads from `File[]` supplied by a folder picker:
 * ```ts
 * const addon = await AddOn.fromFileList(
 *   Array.from(bpInput.files!),
 *   Array.from(rpInput.files!),
 * );
 * ```
 *
 * All collections are lazy-loaded on first access and cached for subsequent calls.
 * Texture maps are loaded eagerly at construction time.
 */
export class AddOn {
  /**
   * Resolved absolute path to the behavior pack directory.
   * Empty string when constructed from browser `File[]`.
   */
  readonly behaviorPackPath: string;
  /**
   * Resolved absolute path to the resource pack directory.
   * Empty string when constructed from browser `File[]`.
   */
  readonly resourcePackPath: string;

  // Internal stores — all lazy
  private _items: Map<string, Item> | null = null;
  private _blocks: Map<string, Block> | null = null;
  private _entities: Map<string, Entity> | null = null;
  private _recipes: Recipe[] | null = null;
  private _lootTables: Map<string, LootTable> | null = null;
  private _spawnRules: Map<string, SpawnRule> | null = null;
  private _biomes: Map<string, Biome> | null = null;
  private _animations: Map<string, Animation> | null = null;
  private _animationControllers: Map<string, AnimationController> | null = null;
  private _renderControllers: Map<string, RenderController> | null = null;
  private _particles: Map<string, Particle> | null = null;
  private _attachables: Map<string, Attachable> | null = null;
  private _tradingTables: Map<string, TradingTable> | null = null;
  private _soundDefinitions: Map<string, SoundDefinition> | null = null;
  private _musicDefinitions: Map<string, MusicDefinition> | null = null;
  private _entitySoundEvents: Map<string, SoundEvent[]> | null = null;
  private _blockSoundEvents: Map<string, SoundEvent[]> | null = null;
  private _itemTextures: ItemTextureMap | null = null;
  private _terrainTextures: TerrainTextureMap | null = null;

  // Browser PackData — populated only by fromFileList
  private _bpData: PackData | null = null;
  private _rpData: PackData | null = null;

  // ── Constructors ─────────────────────────────────────────────────────────

  /**
   * Creates a new AddOn instance that reads from disk.
   * Works in Deno and Node.js. Paths are resolved to absolute on construction.
   * Texture maps are loaded immediately; everything else is lazy.
   *
   * @param behaviorPackPath - Path to the behavior pack root directory.
   * @param resourcePackPath - Path to the resource pack root directory.
   */
  constructor(behaviorPackPath: string, resourcePackPath: string) {
    this.behaviorPackPath = resolve(behaviorPackPath);
    this.resourcePackPath = resolve(resourcePackPath);
    this._itemTextures = readJSONFromDisk<ItemTextureMap>(
      join(this.resourcePackPath, "textures", "item_texture.json")
    );
    this._terrainTextures = readJSONFromDisk<TerrainTextureMap>(
      join(this.resourcePackPath, "textures", "terrain_texture.json")
    );
  }

  /**
   * Internal factory used by `fromFileList`. Bypasses disk I/O entirely.
   */
  private static _fromPackData(bpData: PackData, rpData: PackData): AddOn {
    // Use Object.create to skip the public constructor's disk calls
    const addon = Object.create(AddOn.prototype) as AddOn;
    (addon as unknown as Record<string, unknown>).behaviorPackPath = "";
    (addon as unknown as Record<string, unknown>).resourcePackPath = "";
    addon._bpData = bpData;
    addon._rpData = rpData;
    addon._itemTextures =
      (rpData.get("textures/item_texture.json") as unknown as ItemTextureMap | undefined) ?? null;
    addon._terrainTextures =
      (rpData.get("textures/terrain_texture.json") as unknown as TerrainTextureMap | undefined) ?? null;
    addon._items = null;
    addon._blocks = null;
    addon._entities = null;
    addon._recipes = null;
    addon._lootTables = null;
    addon._spawnRules = null;
    addon._biomes = null;
    addon._animations = null;
    addon._animationControllers = null;
    addon._renderControllers = null;
    addon._particles = null;
    addon._attachables = null;
    addon._tradingTables = null;
    addon._soundDefinitions = null;
    addon._musicDefinitions = null;
    addon._entitySoundEvents = null;
    addon._blockSoundEvents = null;
    return addon;
  }

  /**
   * Creates an AddOn from two `File[]` arrays — one for the behavior pack,
   * one for the resource pack. Designed for browser folder pickers.
   *
   * Files must have `webkitRelativePath` set (browsers set this automatically
   * for `<input webkitdirectory>` and `showDirectoryPicker()`).
   *
   * @example
   * ```ts
   * const bpInput = document.getElementById("bp") as HTMLInputElement;
   * const rpInput = document.getElementById("rp") as HTMLInputElement;
   *
   * const addon = await AddOn.fromFileList(
   *   Array.from(bpInput.files!),
   *   Array.from(rpInput.files!),
   * );
   * ```
   */
  static async fromFileList(bpFiles: File[], rpFiles: File[]): Promise<AddOn> {
    const [bpData, rpData] = await Promise.all([
      packDataFromFiles(bpFiles),
      packDataFromFiles(rpFiles),
    ]);
    return AddOn._fromPackData(bpData, rpData);
  }

  // ── Internal helpers — pick disk vs PackData ──────────────────────────────

  /** True when operating in browser mode (no filesystem). */
  private get _isBrowser(): boolean {
    return this._bpData !== null || this._rpData !== null;
  }

  private _bpEntries(subdir: string): Array<{ filePath: string; relativePath: string; data: Record<string, unknown> }> {
    if (this._isBrowser) {
      const prefix = subdir.endsWith("/") ? subdir : subdir + "/";
      const out: Array<{ filePath: string; relativePath: string; data: Record<string, unknown> }> = [];
      for (const [key, data] of this._bpData!) {
        if (key.startsWith(prefix) && key.endsWith(".json"))
          out.push({ filePath: "", relativePath: key, data });
      }
      return out;
    }
    return walkDir(join(this.behaviorPackPath, subdir), (f) => f.endsWith(".json")).flatMap((file) => {
      const data = readJSONFromDisk(file);
      if (!data) return [];
      const relativePath = relative(this.behaviorPackPath, file).replace(/\\/g, "/");
      return [{ filePath: file, relativePath, data }];
    });
  }

  private _rpEntries(subdir: string): Array<{ filePath: string; relativePath: string; data: Record<string, unknown> }> {
    if (this._isBrowser) {
      const prefix = subdir.endsWith("/") ? subdir : subdir + "/";
      const out: Array<{ filePath: string; relativePath: string; data: Record<string, unknown> }> = [];
      for (const [key, data] of this._rpData!) {
        if (key.startsWith(prefix) && key.endsWith(".json"))
          out.push({ filePath: "", relativePath: key, data });
      }
      return out;
    }
    return walkDir(join(this.resourcePackPath, subdir), (f) => f.endsWith(".json")).flatMap((file) => {
      const data = readJSONFromDisk(file);
      if (!data) return [];
      const relativePath = relative(this.resourcePackPath, file).replace(/\\/g, "/");
      return [{ filePath: file, relativePath, data }];
    });
  }

  // ── Texture maps ─────────────────────────────────────────────────────────

  /** The parsed `item_texture.json` from the resource pack. Null if missing. */
  get itemTextures(): ItemTextureMap | null { return this._itemTextures; }
  /** The parsed `terrain_texture.json` from the resource pack. Null if missing. */
  get terrainTextures(): TerrainTextureMap | null { return this._terrainTextures; }

  // ── Items ─────────────────────────────────────────────────────────────────

  /** Returns the item with the given namespaced identifier, or null if not found. */
  getItem(identifier: string): Item | null {
    return this._itemStore.get(identifier) ?? null;
  }
  /** Returns all items loaded from the behavior pack's `items/` directory. */
  getAllItems(): Item[] {
    return [...this._itemStore.values()];
  }
  private get _itemStore(): Map<string, Item> {
    if (!this._items) this._items = this._loadItems();
    return this._items;
  }

  // ── Blocks ────────────────────────────────────────────────────────────────

  /** Returns the block with the given namespaced identifier, or null if not found. */
  getBlock(identifier: string): Block | null {
    return this._blockStore.get(identifier) ?? null;
  }
  /** Returns all blocks loaded from the behavior pack's `blocks/` directory. */
  getAllBlocks(): Block[] {
    return [...this._blockStore.values()];
  }
  private get _blockStore(): Map<string, Block> {
    if (!this._blocks) this._blocks = this._loadBlocks();
    return this._blocks;
  }

  // ── Entities ──────────────────────────────────────────────────────────────

  /** Returns the entity with the given namespaced identifier, or null if not found. */
  getEntity(identifier: string): Entity | null {
    return this._entityStore.get(identifier) ?? null;
  }
  /** Returns all entities found across both packs, merged by identifier. */
  getAllEntities(): Entity[] {
    return [...this._entityStore.values()];
  }
  private get _entityStore(): Map<string, Entity> {
    if (!this._entities) this._entities = this._loadEntities();
    return this._entities;
  }

  // ── Recipes ───────────────────────────────────────────────────────────────

  /** Returns all recipes that produce the given item identifier. */
  getRecipesFor(identifier: string): Recipe[] {
    return this._recipeStore.filter((r) => r.getResultStack()?.identifier === identifier);
  }
  /** Returns all recipes that use the given item identifier as an ingredient. */
  getRecipesUsingItem(identifier: string): Recipe[] {
    return this._recipeStore.filter((r) =>
      r.getAllIngredients().some((ing) => ing instanceof Item && ing.identifier === identifier)
    );
  }
  /** Returns all recipes that use the given tag id as an ingredient. */
  getRecipesUsingTag(tagId: string): Recipe[] {
    return this._recipeStore.filter((r) =>
      r.getAllIngredients().some((ing) => ing instanceof Tag && ing.id === tagId)
    );
  }
  /** Returns all recipes loaded from the behavior pack's `recipes/` directory. */
  getAllRecipes(): Recipe[] {
    return [...this._recipeStore];
  }
  private get _recipeStore(): Recipe[] {
    if (!this._recipes) this._recipes = this._loadRecipes();
    return this._recipes;
  }

  // ── Loot Tables ───────────────────────────────────────────────────────────

  /**
   * Returns the loot table at the given path relative to the behavior pack root.
   * Normalises backslashes automatically.
   */
  getLootTableByPath(relativePath: string): LootTable | null {
    const key = relativePath.replace(/\\/g, "/");
    return this._lootStore.get(key) ?? null;
  }
  /** Returns all loot tables loaded from the behavior pack's `loot_tables/` directory. */
  getAllLootTables(): LootTable[] {
    return [...this._lootStore.values()];
  }
  private get _lootStore(): Map<string, LootTable> {
    if (!this._lootTables) this._lootTables = this._loadLootTables();
    return this._lootTables;
  }

  // ── Spawn Rules ───────────────────────────────────────────────────────────

  /** Returns the spawn rule for the given entity identifier, or null if none exists. */
  getSpawnRule(identifier: string): SpawnRule | null {
    return this._spawnStore.get(identifier) ?? null;
  }
  /** Returns all spawn rules loaded from the behavior pack's `spawn_rules/` directory. */
  getAllSpawnRules(): SpawnRule[] {
    return [...this._spawnStore.values()];
  }
  private get _spawnStore(): Map<string, SpawnRule> {
    if (!this._spawnRules) this._spawnRules = this._loadSpawnRules();
    return this._spawnRules;
  }

  // ── Biomes ────────────────────────────────────────────────────────────────

  /** Returns the biome with the given namespaced identifier, or null if not found. */
  getBiome(identifier: string): Biome | null {
    return this._biomeStore.get(identifier) ?? null;
  }
  /** Returns all biomes loaded from the behavior pack's `biomes/` directory. */
  getAllBiomes(): Biome[] {
    return [...this._biomeStore.values()];
  }
  private get _biomeStore(): Map<string, Biome> {
    if (!this._biomes) this._biomes = this._loadBiomes();
    return this._biomes;
  }

  // ── Animations ────────────────────────────────────────────────────────────

  /** Returns the animation with the given full ID, or null if not found. */
  getAnimation(id: string): Animation | null {
    return this._animStore.get(id) ?? null;
  }
  /** Returns all animations loaded from the resource pack's `animations/` directory. */
  getAllAnimations(): Animation[] {
    return [...this._animStore.values()];
  }
  private get _animStore(): Map<string, Animation> {
    if (!this._animations) this._animations = this._loadAnimations();
    return this._animations;
  }

  // ── Animation Controllers ─────────────────────────────────────────────────

  /** Returns the animation controller with the given full ID, or null if not found. */
  getAnimationController(id: string): AnimationController | null {
    return this._animCtrlStore.get(id) ?? null;
  }
  /** Returns all animation controllers from the resource pack's `animation_controllers/` directory. */
  getAllAnimationControllers(): AnimationController[] {
    return [...this._animCtrlStore.values()];
  }
  private get _animCtrlStore(): Map<string, AnimationController> {
    if (!this._animationControllers) this._animationControllers = this._loadAnimationControllers();
    return this._animationControllers;
  }

  // ── Render Controllers ────────────────────────────────────────────────────

  /** Returns the render controller with the given full ID, or null if not found. */
  getRenderController(id: string): RenderController | null {
    return this._renderCtrlStore.get(id) ?? null;
  }
  /** Returns all render controllers from the resource pack's `render_controllers/` directory. */
  getAllRenderControllers(): RenderController[] {
    return [...this._renderCtrlStore.values()];
  }
  private get _renderCtrlStore(): Map<string, RenderController> {
    if (!this._renderControllers) this._renderControllers = this._loadRenderControllers();
    return this._renderControllers;
  }

  // ── Particles ─────────────────────────────────────────────────────────────

  /** Returns the particle effect with the given namespaced identifier, or null if not found. */
  getParticle(identifier: string): Particle | null {
    return this._particleStore.get(identifier) ?? null;
  }
  /** Returns all particle effects loaded from the resource pack's `particles/` directory. */
  getAllParticles(): Particle[] {
    return [...this._particleStore.values()];
  }
  private get _particleStore(): Map<string, Particle> {
    if (!this._particles) this._particles = this._loadParticles();
    return this._particles;
  }

  // ── Attachables ───────────────────────────────────────────────────────────

  /** Returns the attachable for the given item identifier, or null if none exists. */
  getAttachable(identifier: string): Attachable | null {
    return this._attachableStore.get(identifier) ?? null;
  }
  /** Returns all attachables loaded from the resource pack's `attachables/` directory. */
  getAllAttachables(): Attachable[] {
    return [...this._attachableStore.values()];
  }
  private get _attachableStore(): Map<string, Attachable> {
    if (!this._attachables) this._attachables = this._loadAttachables();
    return this._attachables;
  }

  // ── Trading Tables ────────────────────────────────────────────────────────

  /** Returns the trading table with the given name (filename without extension), or null. */
  getTradingTable(name: string): TradingTable | null {
    return this._tradingStore.get(name) ?? null;
  }
  /** Returns all trading tables loaded from the behavior pack's `trading/` directory. */
  getAllTradingTables(): TradingTable[] {
    return [...this._tradingStore.values()];
  }
  private get _tradingStore(): Map<string, TradingTable> {
    if (!this._tradingTables) this._tradingTables = this._loadTradingTables();
    return this._tradingTables;
  }


  // ── Sound Definitions ─────────────────────────────────────────────────────

  /**
   * Returns the sound definition with the given event ID, or null if not found.
   * Event IDs come from `sounds/sound_definitions.json`, e.g. `"mob.zombie.say"`.
   */
  getSoundDefinition(id: string): SoundDefinition | null {
    return this._soundDefStore.get(id) ?? null;
  }
  /** Returns all sound definitions from the resource pack's `sounds/sound_definitions.json`. */
  getAllSoundDefinitions(): SoundDefinition[] {
    return [...this._soundDefStore.values()];
  }
  private get _soundDefStore(): Map<string, SoundDefinition> {
    if (!this._soundDefinitions) this._soundDefinitions = this._loadSoundDefinitions();
    return this._soundDefinitions;
  }

  // ── Music Definitions ─────────────────────────────────────────────────────

  /**
   * Returns the music definition for the given context key, or null if not found.
   * Context keys are biome shortnames or special keys like `"game"`, `"menu"`, `"credits"`.
   *
   * @example
   * ```ts
   * addon.getMusicDefinition("bamboo_jungle")?.eventName;
   * // "music.overworld.bamboo_jungle"
   * ```
   */
  getMusicDefinition(id: string): MusicDefinition | null {
    return this._musicDefStore.get(id) ?? null;
  }
  /** Returns all music definitions from the resource pack's `sounds/music_definitions.json`. */
  getAllMusicDefinitions(): MusicDefinition[] {
    return [...this._musicDefStore.values()];
  }
  private get _musicDefStore(): Map<string, MusicDefinition> {
    if (!this._musicDefinitions) this._musicDefinitions = this._loadMusicDefinitions();
    return this._musicDefinitions;
  }

  // ── Entity sound events ───────────────────────────────────────────────────

  /**
   * Returns the sound events for the given entity shortname as defined in
   * `sounds/sounds.json` → `entity_sounds.entities`.
   *
   * The shortname is the unnamespaced entity name used as the key in `sounds.json`,
   * e.g. `"zombie"` not `"minecraft:zombie"`. Use `Entity.getSoundEvents()` to
   * resolve automatically from a full entity identifier.
   *
   * @param shortname - e.g. `"zombie"`, `"allay"`, `"bat"`
   */
  getEntitySoundEvents(shortname: string): SoundEvent[] {
    return this._entitySoundStore.get(shortname) ?? [];
  }
  /** Returns all entity sound event mappings keyed by entity shortname. */
  getAllEntitySoundEvents(): Map<string, SoundEvent[]> {
    return new Map(this._entitySoundStore);
  }
  private get _entitySoundStore(): Map<string, SoundEvent[]> {
    if (!this._entitySoundEvents) this._entitySoundEvents = this._loadEntitySoundEvents();
    return this._entitySoundEvents;
  }

  // ── Block sound events ────────────────────────────────────────────────────

  /**
   * Returns the sound events for the given block shortname as defined in
   * `sounds/sounds.json` → `block_sounds`.
   *
   * The shortname is the key used in `sounds.json`, e.g. `"amethyst_block"`.
   * Use `Block.getSoundEvents()` to resolve automatically.
   *
   * @param shortname - e.g. `"amethyst_block"`, `"dirt"`, `"wood"`
   */
  getBlockSoundEvents(shortname: string): SoundEvent[] {
    return this._blockSoundStore.get(shortname) ?? [];
  }
  /** Returns all block sound event mappings keyed by block shortname. */
  getAllBlockSoundEvents(): Map<string, SoundEvent[]> {
    return new Map(this._blockSoundStore);
  }
  private get _blockSoundStore(): Map<string, SoundEvent[]> {
    if (!this._blockSoundEvents) this._blockSoundEvents = this._loadBlockSoundEvents();
    return this._blockSoundEvents;
  }

  // ── Loaders ──────────────────────────────────────────────────────────────

  private _loadItems(): Map<string, Item> {
    const map = new Map<string, Item>();
    for (const { filePath, data } of this._bpEntries("items")) {
      const id = this._extractIdentifier(data, "minecraft:item");
      if (!id) continue;
      map.set(id, new Item(id, data, filePath, this));
    }
    return map;
  }

  private _loadBlocks(): Map<string, Block> {
    const map = new Map<string, Block>();
    for (const { filePath, data } of this._bpEntries("blocks")) {
      const id = this._extractIdentifier(data, "minecraft:block");
      if (!id) continue;
      map.set(id, new Block(id, data, filePath, this));
    }
    return map;
  }

  private _loadEntities(): Map<string, Entity> {
    const behaviorMap = new Map<string, { data: Record<string, unknown>; filePath: string }>();
    for (const { filePath, data } of this._bpEntries("entities")) {
      const id =
        this._extractIdentifier(data, "minecraft:entity") ??
        this._extractIdentifier(data, "minecraft:npc");
      if (!id) continue;
      behaviorMap.set(id, { data, filePath });
    }

    const resourceMap = new Map<string, { data: Record<string, unknown>; filePath: string }>();
    for (const { filePath, data } of this._rpEntries("entity")) {
      const inner = data["minecraft:client_entity"] as Record<string, unknown> | undefined;
      const desc = inner?.["description"] as Record<string, unknown> | undefined;
      const id = desc?.["identifier"] as string | undefined;
      if (!id) continue;
      resourceMap.set(id, { data, filePath });
    }

    const map = new Map<string, Entity>();
    for (const [id, bp] of behaviorMap) {
      const rp = resourceMap.get(id);
      map.set(id, new Entity(id, bp.data, bp.filePath, rp?.data ?? null, rp?.filePath ?? null, this));
    }
    for (const [id, rp] of resourceMap) {
      if (!behaviorMap.has(id))
        map.set(id, new Entity(id, {}, "", rp.data, rp.filePath, this));
    }
    return map;
  }

  private _loadRecipes(): Recipe[] {
    return this._bpEntries("recipes").map(({ data }) => new Recipe(data, this));
  }

  private _loadLootTables(): Map<string, LootTable> {
    const map = new Map<string, LootTable>();
    for (const { filePath, relativePath, data } of this._bpEntries("loot_tables")) {
      const key = relativePath.replace(/\\/g, "/");
      map.set(key, new LootTable(data, filePath, key));
    }
    return map;
  }

  private _loadSpawnRules(): Map<string, SpawnRule> {
    const map = new Map<string, SpawnRule>();
    for (const { filePath, data } of this._bpEntries("spawn_rules")) {
      const inner = data["minecraft:spawn_rules"] as Record<string, unknown> | undefined;
      const desc = inner?.["description"] as Record<string, unknown> | undefined;
      const id = desc?.["identifier"] as string | undefined;
      if (!id) continue;
      map.set(id, new SpawnRule(id, data, filePath));
    }
    return map;
  }

  private _loadBiomes(): Map<string, Biome> {
    const map = new Map<string, Biome>();
    for (const { filePath, data } of this._bpEntries("biomes")) {
      const id = this._extractIdentifier(data, "minecraft:biome");
      if (!id) continue;
      map.set(id, new Biome(id, data, filePath, this));
    }
    return map;
  }

  private _loadAnimations(): Map<string, Animation> {
    const map = new Map<string, Animation>();
    for (const { filePath, data } of this._rpEntries("animations")) {
      const animMap = data["animations"] as Record<string, unknown> | undefined;
      if (!animMap) continue;
      for (const [id, animData] of Object.entries(animMap))
        map.set(id, new Animation(id, animData as Record<string, unknown>, filePath));
    }
    return map;
  }

  private _loadAnimationControllers(): Map<string, AnimationController> {
    const map = new Map<string, AnimationController>();
    for (const { filePath, data } of this._rpEntries("animation_controllers")) {
      const ctrlMap = data["animation_controllers"] as Record<string, unknown> | undefined;
      if (!ctrlMap) continue;
      for (const [id, ctrlData] of Object.entries(ctrlMap))
        map.set(id, new AnimationController(id, ctrlData as Record<string, unknown>, filePath));
    }
    return map;
  }

  private _loadRenderControllers(): Map<string, RenderController> {
    const map = new Map<string, RenderController>();
    for (const { filePath, data } of this._rpEntries("render_controllers")) {
      const rcMap = data["render_controllers"] as Record<string, unknown> | undefined;
      if (!rcMap) continue;
      for (const [id, rcData] of Object.entries(rcMap))
        map.set(id, new RenderController(id, rcData as Record<string, unknown>, filePath));
    }
    return map;
  }

  private _loadParticles(): Map<string, Particle> {
    const map = new Map<string, Particle>();
    for (const { filePath, data } of this._rpEntries("particles")) {
      const inner = data["particle_effect"] as Record<string, unknown> | undefined;
      const desc = inner?.["description"] as Record<string, unknown> | undefined;
      const id = desc?.["identifier"] as string | undefined;
      if (!id) continue;
      map.set(id, new Particle(id, data, filePath));
    }
    return map;
  }

  private _loadAttachables(): Map<string, Attachable> {
    const map = new Map<string, Attachable>();
    for (const { filePath, data } of this._rpEntries("attachables")) {
      const id = this._extractIdentifier(data, "minecraft:attachable");
      if (!id) continue;
      map.set(id, new Attachable(id, data, filePath));
    }
    return map;
  }

  private _loadTradingTables(): Map<string, TradingTable> {
    const map = new Map<string, TradingTable>();
    for (const { filePath, relativePath, data } of this._bpEntries("trading")) {
      const name = posix.basename(relativePath, ".json");
      map.set(name, new TradingTable(data, filePath, name));
    }
    return map;
  }


  private _loadSoundDefinitions(): Map<string, SoundDefinition> {
    const map = new Map<string, SoundDefinition>();
    const data = this._isBrowser
      ? this._rpData?.get("sounds/sound_definitions.json")
      : readJSONFromDisk(join(this.resourcePackPath, "sounds", "sound_definitions.json"));
    if (!data) return map;
    const defs = data["sound_definitions"] as Record<string, unknown> | undefined;
    if (!defs) return map;
    for (const [id, entry] of Object.entries(defs))
      map.set(id, new SoundDefinition(id, entry as Record<string, unknown>));
    return map;
  }

  private _loadMusicDefinitions(): Map<string, MusicDefinition> {
    const map = new Map<string, MusicDefinition>();
    const data = this._isBrowser
      ? this._rpData?.get("sounds/music_definitions.json")
      : readJSONFromDisk(join(this.resourcePackPath, "sounds", "music_definitions.json"));
    if (!data) return map;
    for (const [id, entry] of Object.entries(data))
      map.set(id, new MusicDefinition(id, entry as Record<string, unknown>));
    return map;
  }

  private _loadEntitySoundEvents(): Map<string, SoundEvent[]> {
    const map = new Map<string, SoundEvent[]>();
    const data = this._isBrowser
      ? this._rpData?.get("sounds/sounds.json")
      : readJSONFromDisk(join(this.resourcePackPath, "sounds", "sounds.json"));
    if (!data) return map;
    const entitySounds = data["entity_sounds"] as Record<string, unknown> | undefined;
    const entities = entitySounds?.["entities"] as Record<string, unknown> | undefined;
    if (!entities) return map;
    for (const [shortname, entry] of Object.entries(entities)) {
      const e = entry as Record<string, unknown>;
      const events = e["events"] as Record<string, unknown> | undefined;
      if (!events) continue;
      map.set(shortname, this._parseSoundEventMap(events));
    }
    return map;
  }

  private _loadBlockSoundEvents(): Map<string, SoundEvent[]> {
    const map = new Map<string, SoundEvent[]>();
    const data = this._isBrowser
      ? this._rpData?.get("sounds/sounds.json")
      : readJSONFromDisk(join(this.resourcePackPath, "sounds", "sounds.json"));
    if (!data) return map;
    const blockSounds = data["block_sounds"] as Record<string, unknown> | undefined;
    if (!blockSounds) return map;
    for (const [shortname, entry] of Object.entries(blockSounds)) {
      const e = entry as Record<string, unknown>;
      const events = e["events"] as Record<string, unknown> | undefined;
      if (!events) continue;
      map.set(shortname, this._parseSoundEventMap(events));
    }
    return map;
  }

  /**
   * Parses a `sounds.json` event map (event name → string ID or inline object)
   * into `SoundEvent[]`, resolving each definition ID against `sound_definitions.json`.
   */
  private _parseSoundEventMap(events: Record<string, unknown>): SoundEvent[] {
    const result: SoundEvent[] = [];
    for (const [event, value] of Object.entries(events)) {
      if (typeof value === "string") {
        result.push({
          event,
          definitionId: value,
          definition: value ? this.getSoundDefinition(value) : null,
          volume: null,
          pitch: null,
        });
      } else if (typeof value === "object" && value !== null) {
        const v = value as Record<string, unknown>;
        // Inline objects use "sound" for the def ID (block sounds sometimes use "sounds")
        const defId = (v["sound"] as string) ?? (v["sounds"] as string) ?? "";
        result.push({
          event,
          definitionId: defId,
          definition: defId ? this.getSoundDefinition(defId) : null,
          volume: typeof v["volume"] === "number" ? (v["volume"] as number) : null,
          pitch: Array.isArray(v["pitch"])
            ? (v["pitch"] as [number, number])
            : typeof v["pitch"] === "number"
              ? (v["pitch"] as number)
              : null,
        });
      }
    }
    return result;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private _extractIdentifier(data: Record<string, unknown>, rootKey: string): string | null {
    const root = data[rootKey] as Record<string, unknown> | undefined;
    if (!root) return null;
    const desc = root["description"] as Record<string, unknown> | undefined;
    return (desc?.["identifier"] as string) ?? (root["identifier"] as string) ?? null;
  }
}