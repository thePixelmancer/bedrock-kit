import { resolve } from "node:path";
import { AddonLoader, type AddonState } from "./addonLoader.js";
import { AssetCollection } from "./asset.js";
import { ManifestFile } from "./manifest.js";
import { SoundDefinitionsFile } from "./soundDefinitions.js";
import { MusicDefinitionsFile } from "./musicDefinitions.js";
import { LangFile } from "./lang.js";
import { Item } from "./item.js";
import { Block } from "./block.js";
import { BehaviorEntity, ResourceEntity, Entity } from "./entity.js";
import { Recipe } from "./recipe.js";
import { LootTable } from "./lootTable.js";
import { SpawnRule } from "./spawnRule.js";
import { Biome } from "./biome.js";
import { Animation, AnimationController } from "./animation.js";
import { RenderController } from "./renderController.js";
import { Particle } from "./particle.js";
import { Attachable } from "./attachable.js";
import { TradingTable } from "./tradingTable.js";
import { GeometryModel } from "./geometry.js";
import { Asset } from "./asset.js";

export type { PackData } from "./browser.js";

// ─── AddOn ────────────────────────────────────────────────────────────────────

/**
 * The main entry point for bedrockKit. Represents a Minecraft Bedrock addon
 * consisting of a behavior pack and an optional resource pack.
 *
 * Create instances using the static async factory methods:
 *
 * @example
 * ```ts
 * // Node.js
 * const addon = await AddOn.fromDisk("./behavior_pack", "./resource_pack");
 *
 * // Browser
 * const addon = await AddOn.fromFiles(bpFiles, rpFiles);
 *
 * // Navigate
 * const zombie = addon.entities.get("minecraft:zombie");
 * console.log(zombie?.displayName);           // "Zombie"
 * console.log(zombie?.spawnRule?.biomeTags);  // ["monster", "overworld"]
 *
 * const spear = addon.items.get("minecraft:copper_spear");
 * console.log(spear?.texturePath);            // "textures/items/copper_spear"
 * console.log(spear?.recipes.length);         // 1
 * ```
 */
export class AddOn {
  /** @internal */
  readonly _state: AddonState;

  // Cached public collections
  private _items?: AssetCollection<Item>;
  private _blocks?: AssetCollection<Block>;
  private _entities?: AssetCollection<Entity>;
  private _recipes?: AssetCollection<Recipe>;
  private _lootTables?: AssetCollection<LootTable>;
  private _trading?: AssetCollection<TradingTable>;
  private _biomes?: AssetCollection<Biome>;
  private _animations?: AssetCollection<Animation>;
  private _animationControllers?: AssetCollection<AnimationController>;
  private _renderControllers?: AssetCollection<RenderController>;
  private _particles?: AssetCollection<Particle>;
  private _geometries?: AssetCollection<GeometryModel>;
  private _attachables?: AssetCollection<Attachable>;

  private constructor(state: AddonState) {
    this._state = state;
  }

  // ── Static Factories ──────────────────────────────────────────────────────

  /**
   * Creates an `AddOn` by reading pack directories from disk (Node.js only).
   *
   * @param bpPath - Absolute or relative path to the behavior pack directory.
   * @param rpPath - Absolute or relative path to the resource pack directory.
   *                 Optional — omit if the addon has no resource pack.
   *
   * @example
   * ```ts
   * const addon = await AddOn.fromDisk("./behavior_pack", "./resource_pack");
   * ```
   */
  static async fromDisk(bpPath: string, rpPath?: string): Promise<AddOn> {
    const state = AddonLoader.fromDisk(
      resolve(bpPath),
      rpPath ? resolve(rpPath) : "",
      null as unknown as AddOn // placeholder, unused in fromDisk
    );
    const instance = new AddOn(state);
    return instance;
  }

  /**
   * Creates an `AddOn` from browser `File[]` arrays (browser only).
   *
   * @param bpFiles - Files from the behavior pack folder selection.
   * @param rpFiles - Files from the resource pack folder selection.
   *
   * @example
   * ```ts
   * const addon = await AddOn.fromFiles(bpFileList, rpFileList);
   * ```
   */
  static async fromFiles(bpFiles: File[], rpFiles: File[]): Promise<AddOn> {
    const state = await AddonLoader.fromFileList(bpFiles, rpFiles, null as unknown as AddOn);
    return new AddOn(state);
  }

  // ── Public Collections ────────────────────────────────────────────────────

  /** All item definitions from the behavior pack. */
  get items(): AssetCollection<Item> {
    return this._items ??= new AssetCollection(this._itemStore);
  }

  /** All block definitions from the behavior pack. */
  get blocks(): AssetCollection<Block> {
    return this._blocks ??= new AssetCollection(this._blockStore);
  }

  /**
   * All entities as unified views merging behavior, resource, and spawn rule data.
   * Returns `undefined` from `.get()` for unknown identifiers.
   */
  get entities(): AssetCollection<Entity> {
    return this._entities ??= new AssetCollection(this._entityStore);
  }

  /** All crafting recipes from the behavior pack. */
  get recipes(): AssetCollection<Recipe> {
    return this._recipes ??= new AssetCollection(new Map(this._recipeStore.map(r => [r.id, r])));
  }

  /** All loot table files, keyed by their relative path from the BP root. */
  get lootTables(): AssetCollection<LootTable> {
    return this._lootTables ??= new AssetCollection(this._lootStore);
  }

  /** All villager trading table files. */
  get trading(): AssetCollection<TradingTable> {
    return this._trading ??= new AssetCollection(this._tradingStore);
  }

  /** All biome definitions from the behavior pack. */
  get biomes(): AssetCollection<Biome> {
    return this._biomes ??= new AssetCollection(this._biomeStore);
  }

  /** All animation definitions from the resource pack. */
  get animations(): AssetCollection<Animation> {
    return this._animations ??= new AssetCollection(this._animStore);
  }

  /** All animation controller definitions from the resource pack. */
  get animationControllers(): AssetCollection<AnimationController> {
    return this._animationControllers ??= new AssetCollection(this._animCtrlStore);
  }

  /** All render controller definitions from the resource pack. */
  get renderControllers(): AssetCollection<RenderController> {
    return this._renderControllers ??= new AssetCollection(this._renderCtrlStore);
  }

  /** All particle effect definitions from the resource pack. */
  get particles(): AssetCollection<Particle> {
    return this._particles ??= new AssetCollection(this._particleStore);
  }

  /** All geometry model definitions from the resource pack. */
  get geometries(): AssetCollection<GeometryModel> {
    return this._geometries ??= new AssetCollection(this._geoStore);
  }

  /** All attachable definitions from the resource pack. */
  get attachables(): AssetCollection<Attachable> {
    return this._attachables ??= new AssetCollection(this._attachableStore);
  }

  // ── Sound & Music ─────────────────────────────────────────────────────────

  /**
   * The parsed `sound_definitions.json` file, or `undefined` if the resource
   * pack does not contain one.
   *
   * @example
   * ```ts
   * const entry = addon.sounds?.get("mob.zombie.say");
   * ```
   */
  get sounds(): SoundDefinitionsFile | undefined {
    return this._state.soundDefinitions ?? undefined;
  }

  /**
   * The parsed `music_definitions.json` file, or `undefined` if the resource
   * pack does not contain one.
   *
   * @example
   * ```ts
   * const entry = addon.music?.get("bamboo_jungle");
   * ```
   */
  get music(): MusicDefinitionsFile | undefined {
    return this._state.musicDefinitions ?? undefined;
  }

  // ── Manifests ─────────────────────────────────────────────────────────────

  /** The behavior pack manifest (`manifest.json`), or `undefined` if not found. */
  get bpManifest(): ManifestFile | undefined {
    return this._state.behaviorManifest ?? undefined;
  }

  /** The resource pack manifest (`manifest.json`), or `undefined` if not found. */
  get rpManifest(): ManifestFile | undefined {
    return this._state.resourceManifest ?? undefined;
  }

  // ── Languages ─────────────────────────────────────────────────────────────

  /**
   * Access to localization files. Call `.get(langCode)` to retrieve a
   * {@link LangFile} for the given language code.
   *
   * @example
   * ```ts
   * const en = addon.languages.get("en_US");
   * console.log(en?.get("item.minecraft.stick.name")); // "Stick"
   * ```
   */
  get languages(): { get(lang?: string): LangFile | undefined } {
    return { get: (lang = "en_US") => this.getLangFile(lang) ?? undefined };
  }

  // ── Pack Paths ────────────────────────────────────────────────────────────

  /** Resolved absolute path to the behavior pack directory. */
  get behaviorPackPath(): string { return this._state.behaviorPackPath; }

  /** Resolved absolute path to the resource pack directory. */
  get resourcePackPath(): string { return this._state.resourcePackPath; }

  // ── Internal Helpers ──────────────────────────────────────────────────────

  /** @internal */
  getLangFile(language: string = "en_US"): LangFile | null {
    if (this._state.langFiles.has(language)) return this._state.langFiles.get(language)!;
    const langFile = AddonLoader.loadLangFile(this._state, language);
    if (langFile) this._state.langFiles.set(language, langFile);
    return langFile;
  }

  /**
   * Returns any asset by its file path. Searches across all loaded asset types.
   * @internal
   */
  getAssetByPath(filePath: string): Asset | undefined {
    const norm = filePath.replace(/\\/g, "/").toLowerCase();
    const stores: Iterable<Asset>[] = [
      this._itemStore.values(),
      this._blockStore.values(),
      this._bpEntityStore.values(),
      this._rpEntityStore.values(),
      this._lootStore.values(),
      this._spawnStore.values(),
      this._biomeStore.values(),
      this._animStore.values(),
      this._animCtrlStore.values(),
      this._renderCtrlStore.values(),
      this._particleStore.values(),
      this._attachableStore.values(),
      this._tradingStore.values(),
      this._geoStore.values(),
    ];

    for (const store of stores) {
      for (const asset of store) {
        const p = asset.filePath.replace(/\\/g, "/").toLowerCase();
        if (p === norm || p.endsWith(norm)) return asset;
        if (asset instanceof BehaviorEntity) {
          const rp = asset.resource;
          if (rp && rp.filePath.replace(/\\/g, "/").toLowerCase().endsWith(norm)) return rp;
        }
      }
    }
    return this._recipeStore.find(r => r.filePath.replace(/\\/g, "/").toLowerCase().endsWith(norm));
  }

  // ── Internal Lazy Stores ──────────────────────────────────────────────────

  /** @internal */
  get _itemStore(): Map<string, Item> {
    return this._state.items ??= AddonLoader.loadItems(this._state, this);
  }
  /** @internal */
  get _blockStore(): Map<string, Block> {
    return this._state.blocks ??= AddonLoader.loadBlocks(this._state, this);
  }
  /** @internal */
  get _bpEntityStore(): Map<string, BehaviorEntity> {
    return this._state.bpEntities ??= AddonLoader.loadBpEntities(this._state, this);
  }
  /** @internal */
  get _rpEntityStore(): Map<string, ResourceEntity> {
    return this._state.rpEntities ??= AddonLoader.loadRpEntities(this._state, this);
  }
  /** @internal */
  get _entityStore(): Map<string, Entity> {
    return this._state.entityStore ??= this._buildEntityStore();
  }
  /** @internal */
  get _recipeStore(): Recipe[] {
    return this._state.recipes ??= AddonLoader.loadRecipes(this._state, this);
  }
  /** @internal */
  get _lootStore(): Map<string, LootTable> {
    return this._state.lootTables ??= AddonLoader.loadLootTables(this._state, this);
  }
  /** @internal */
  get _spawnStore(): Map<string, SpawnRule> {
    return this._state.spawnRules ??= AddonLoader.loadSpawnRules(this._state);
  }
  /** @internal */
  get _biomeStore(): Map<string, Biome> {
    return this._state.biomes ??= AddonLoader.loadBiomes(this._state, this);
  }
  /** @internal */
  get _animStore(): Map<string, Animation> {
    return this._state.animations ??= AddonLoader.loadAnimations(this._state);
  }
  /** @internal */
  get _animCtrlStore(): Map<string, AnimationController> {
    return this._state.animationControllers ??= AddonLoader.loadAnimationControllers(this._state);
  }
  /** @internal */
  get _renderCtrlStore(): Map<string, RenderController> {
    return this._state.renderControllers ??= AddonLoader.loadRenderControllers(this._state);
  }
  /** @internal */
  get _particleStore(): Map<string, Particle> {
    return this._state.particles ??= AddonLoader.loadParticles(this._state);
  }
  /** @internal */
  get _attachableStore(): Map<string, Attachable> {
    return this._state.attachables ??= AddonLoader.loadAttachables(this._state);
  }
  /** @internal */
  get _tradingStore(): Map<string, TradingTable> {
    return this._state.tradingTables ??= AddonLoader.loadTradingTables(this._state);
  }
  /** @internal */
  get _geoStore(): Map<string, GeometryModel> {
    return this._state.geometries ??= AddonLoader.loadGeometries(this._state);
  }

  private _buildEntityStore(): Map<string, Entity> {
    const map = new Map<string, Entity>();
    const ids = new Set([...this._bpEntityStore.keys(), ...this._rpEntityStore.keys()]);
    for (const id of ids) {
      const behavior = this._bpEntityStore.get(id);
      const resource = this._rpEntityStore.get(id);
      const spawnRule = this._spawnStore.get(id);
      map.set(id, new Entity(id, behavior, resource, spawnRule));
    }
    return map;
  }
}
