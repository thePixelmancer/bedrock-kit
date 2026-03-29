import { resolve } from "node:path";
import { AddonLoader, type AddonState } from "./addonLoader.js";
import { AssetCollection } from "./asset.js";
import { TextureAtlasFile } from "./textureAtlas.js";
import { ManifestFile } from "./manifest.js";
import { SoundDefinitionEntry } from "./soundDefinitions.js";
import { MusicDefinitionEntry } from "./musicDefinitions.js";
import { SoundEventBinding } from "./sounds.js";
import { LangFile } from "./lang.js";
import { shortname } from "./identifiers.js";
import { Item } from "./item.js";
import { Block } from "./block.js";
import { BpEntity, RpEntity } from "./entity.js";
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
import { Tag } from "./tag.js";

export type { PackData } from "./browser.js";

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
 * Collections are lazy-loaded on first access and cached for subsequent calls.
 * Connective tissue files (manifests, texture atlases, sound definitions, sounds)
 * are loaded eagerly at construction time.
 */
export class AddOn {
  private readonly _s: AddonState;

  /**
   * Resolved absolute path to the behavior pack directory.
   * Empty string when constructed from browser `File[]`.
   */
  get behaviorPackPath(): string { return this._s.behaviorPackPath; }

  /**
   * Resolved absolute path to the resource pack directory.
   * Empty string when constructed from browser `File[]`.
   */
  get resourcePackPath(): string { return this._s.resourcePackPath; }

  // ── Eagerly loaded files ──────────────────────────────────────────────────

  /** The parsed `manifest.json` from the behavior pack. Null if missing. */
  get behaviorManifest(): ManifestFile | null { return this._s.behaviorManifest; }
  /** The parsed `manifest.json` from the resource pack. Null if missing. */
  get resourceManifest(): ManifestFile | null { return this._s.resourceManifest; }
  /** The parsed `item_texture.json` from the resource pack. Null if missing. */
  get itemTextures(): TextureAtlasFile | null { return this._s.itemTextures; }
  /** The parsed `terrain_texture.json` from the resource pack. Null if missing. */
  get terrainTextures(): TextureAtlasFile | null { return this._s.terrainTextures; }
  /** The parsed `sounds/sound_definitions.json` file. Null if missing. */
  get soundDefinitions() { return this._s.soundDefinitions; }
  /** The parsed `sounds/music_definitions.json` file. Null if missing. */
  get musicDefinitions() { return this._s.musicDefinitions; }
  /** The parsed `sounds.json` file. Null if missing. */
  get sounds() { return this._s.sounds; }

  // ── Constructors ─────────────────────────────────────────────────────────

  /**
   * Creates a new AddOn instance that reads from disk.
   * Works in Deno and Node.js. Paths are resolved to absolute on construction.
   */
  constructor(behaviorPackPath: string, resourcePackPath: string) {
    this._s = AddonLoader.fromDisk(resolve(behaviorPackPath), resolve(resourcePackPath), this);
  }

  /**
   * Creates an AddOn from two `File[]` arrays (browser folder pickers).
   *
   * @example
   * ```ts
   * const addon = await AddOn.fromFileList(
   *   Array.from(bpInput.files!),
   *   Array.from(rpInput.files!),
   * );
   * ```
   */
  static async fromFileList(bpFiles: File[], rpFiles: File[]): Promise<AddOn> {
    const instance = Object.create(AddOn.prototype) as AddOn;
    const state = await AddonLoader.fromFileList(bpFiles, rpFiles, instance);
    (instance as any)._s = state;
    return instance;
  }

  // ── Lazy store accessors ──────────────────────────────────────────────────

  private get _itemStore(): Map<string, Item> {
    if (!this._s.items) this._s.items = AddonLoader.loadItems(this._s, this);
    return this._s.items;
  }
  private get _blockStore(): Map<string, Block> {
    if (!this._s.blocks) this._s.blocks = AddonLoader.loadBlocks(this._s, this);
    return this._s.blocks;
  }
  private get _bpEntityStore(): Map<string, BpEntity> {
    if (!this._s.bpEntities) this._s.bpEntities = AddonLoader.loadBpEntities(this._s, this);
    return this._s.bpEntities;
  }
  private get _rpEntityStore(): Map<string, RpEntity> {
    if (!this._s.rpEntities) this._s.rpEntities = AddonLoader.loadRpEntities(this._s, this);
    return this._s.rpEntities;
  }
  private get _recipeStore(): Recipe[] {
    if (!this._s.recipes) this._s.recipes = AddonLoader.loadRecipes(this._s, this);
    return this._s.recipes;
  }
  private get _lootStore(): Map<string, LootTable> {
    if (!this._s.lootTables) this._s.lootTables = AddonLoader.loadLootTables(this._s, this);
    return this._s.lootTables;
  }
  private get _spawnStore(): Map<string, SpawnRule> {
    if (!this._s.spawnRules) this._s.spawnRules = AddonLoader.loadSpawnRules(this._s);
    return this._s.spawnRules;
  }
  private get _biomeStore(): Map<string, Biome> {
    if (!this._s.biomes) this._s.biomes = AddonLoader.loadBiomes(this._s, this);
    return this._s.biomes;
  }
  private get _animStore(): Map<string, Animation> {
    if (!this._s.animations) this._s.animations = AddonLoader.loadAnimations(this._s);
    return this._s.animations;
  }
  private get _animCtrlStore(): Map<string, AnimationController> {
    if (!this._s.animationControllers) this._s.animationControllers = AddonLoader.loadAnimationControllers(this._s);
    return this._s.animationControllers;
  }
  private get _renderCtrlStore(): Map<string, RenderController> {
    if (!this._s.renderControllers) this._s.renderControllers = AddonLoader.loadRenderControllers(this._s);
    return this._s.renderControllers;
  }
  private get _particleStore(): Map<string, Particle> {
    if (!this._s.particles) this._s.particles = AddonLoader.loadParticles(this._s);
    return this._s.particles;
  }
  private get _attachableStore(): Map<string, Attachable> {
    if (!this._s.attachables) this._s.attachables = AddonLoader.loadAttachables(this._s);
    return this._s.attachables;
  }
  private get _tradingStore(): Map<string, TradingTable> {
    if (!this._s.tradingTables) this._s.tradingTables = AddonLoader.loadTradingTables(this._s);
    return this._s.tradingTables;
  }
  private get _geoStore(): Map<string, GeometryModel> {
    if (!this._s.geometries) this._s.geometries = AddonLoader.loadGeometries(this._s);
    return this._s.geometries;
  }

  // ── Items ─────────────────────────────────────────────────────────────────

  /** Returns the item with the given namespaced identifier, or null if not found. */
  getItem(identifier: string): Item | null { return this._itemStore.get(identifier) ?? null; }
  /** Returns all items loaded from the behavior pack's `items/` directory. */
  getAllItems(): AssetCollection<Item> { return new AssetCollection(this._itemStore); }

  // ── Blocks ────────────────────────────────────────────────────────────────

  /** Returns the block with the given namespaced identifier, or null if not found. */
  getBlock(identifier: string): Block | null { return this._blockStore.get(identifier) ?? null; }
  /** Returns all blocks loaded from the behavior pack's `blocks/` directory. */
  getAllBlocks(): AssetCollection<Block> { return new AssetCollection(this._blockStore); }

  // ── Entities ──────────────────────────────────────────────────────────────

  /** Returns the behavior pack entity with the given identifier, or null if not found. */
  getBpEntity(identifier: string): BpEntity | null { return this._bpEntityStore.get(identifier) ?? null; }
  /** Returns the resource pack entity with the given identifier, or null if not found. */
  getRpEntity(identifier: string): RpEntity | null { return this._rpEntityStore.get(identifier) ?? null; }
  /** Returns all behavior pack entities. */
  getAllBpEntities(): AssetCollection<BpEntity> { return new AssetCollection(this._bpEntityStore); }
  /** Returns all resource pack entities. */
  getAllRpEntities(): AssetCollection<RpEntity> { return new AssetCollection(this._rpEntityStore); }

  /**
   * Returns the behavior pack entity with the given identifier, or null if not found.
   * @alias getBpEntity
   */
  getEntity(identifier: string): BpEntity | null { return this.getBpEntity(identifier); }
  /**
   * Returns all behavior pack entities.
   * @alias getAllBpEntities
   */
  getAllEntities(): AssetCollection<BpEntity> { return this.getAllBpEntities(); }

  // ── Recipes ───────────────────────────────────────────────────────────────

  /** Returns all recipes that produce the given item identifier. */
  getRecipesFor(identifier: string): Recipe[] {
    return this._recipeStore.filter((r) => r.getResultStack()?.identifier === identifier);
  }
  /** Returns all recipes that use the given item identifier as an ingredient. */
  getRecipesUsingItem(identifier: string): Recipe[] {
    return this._recipeStore.filter((r) => r.usesItem(identifier));
  }
  /** Returns all recipes that use the given tag id as an ingredient. */
  getRecipesUsingTag(tagId: string): Recipe[] {
    return this._recipeStore.filter((r) => r.getAllIngredients().some((ing) => ing instanceof Tag && ing.id === tagId));
  }
  /** Returns all recipes loaded from the behavior pack's `recipes/` directory. */
  getAllRecipes(): Recipe[] { return [...this._recipeStore]; }

  // ── Loot Tables ───────────────────────────────────────────────────────────

  /**
   * Returns the loot table at the given path relative to the behavior pack root.
   * Normalises backslashes automatically.
   */
  getLootTableByPath(relativePath: string): LootTable | null {
    return this._lootStore.get(relativePath.replace(/\\/g, "/")) ?? null;
  }
  /** Returns all loot tables loaded from the behavior pack's `loot_tables/` directory. */
  getAllLootTables(): AssetCollection<LootTable> { return new AssetCollection(this._lootStore); }

  // ── Spawn Rules ───────────────────────────────────────────────────────────

  /** Returns the spawn rule for the given entity identifier, or null if none exists. */
  getSpawnRule(identifier: string): SpawnRule | null { return this._spawnStore.get(identifier) ?? null; }
  /** Returns all spawn rules loaded from the behavior pack's `spawn_rules/` directory. */
  getAllSpawnRules(): AssetCollection<SpawnRule> { return new AssetCollection(this._spawnStore); }

  // ── Biomes ────────────────────────────────────────────────────────────────

  /** Returns the biome with the given namespaced identifier, or null if not found. */
  getBiome(identifier: string): Biome | null { return this._biomeStore.get(identifier) ?? null; }
  /** Returns all biomes loaded from the behavior pack's `biomes/` directory. */
  getAllBiomes(): AssetCollection<Biome> { return new AssetCollection(this._biomeStore); }

  // ── Animations ────────────────────────────────────────────────────────────

  /** Returns the animation with the given full identifier, or null if not found. */
  getAnimation(identifier: string): Animation | null { return this._animStore.get(identifier) ?? null; }
  /** Returns all animations loaded from the resource pack's `animations/` directory. */
  getAllAnimations(): AssetCollection<Animation> { return new AssetCollection(this._animStore); }

  // ── Animation Controllers ─────────────────────────────────────────────────

  /** Returns the animation controller with the given full identifier, or null if not found. */
  getAnimationController(identifier: string): AnimationController | null { return this._animCtrlStore.get(identifier) ?? null; }
  /** Returns all animation controllers from the resource pack's `animation_controllers/` directory. */
  getAllAnimationControllers(): AssetCollection<AnimationController> { return new AssetCollection(this._animCtrlStore); }

  // ── Render Controllers ────────────────────────────────────────────────────

  /** Returns the render controller with the given full identifier, or null if not found. */
  getRenderController(identifier: string): RenderController | null { return this._renderCtrlStore.get(identifier) ?? null; }
  /** Returns all render controllers from the resource pack's `render_controllers/` directory. */
  getAllRenderControllers(): AssetCollection<RenderController> { return new AssetCollection(this._renderCtrlStore); }

  // ── Particles ─────────────────────────────────────────────────────────────

  /** Returns the particle effect with the given namespaced identifier, or null if not found. */
  getParticle(identifier: string): Particle | null { return this._particleStore.get(identifier) ?? null; }
  /** Returns all particle effects loaded from the resource pack's `particles/` directory. */
  getAllParticles(): AssetCollection<Particle> { return new AssetCollection(this._particleStore); }

  // ── Attachables ───────────────────────────────────────────────────────────

  /** Returns the attachable for the given item identifier, or null if none exists. */
  getAttachable(identifier: string): Attachable | null { return this._attachableStore.get(identifier) ?? null; }
  /** Returns all attachables loaded from the resource pack's `attachables/` directory. */
  getAllAttachables(): AssetCollection<Attachable> { return new AssetCollection(this._attachableStore); }

  // ── Trading Tables ────────────────────────────────────────────────────────

  /** Returns the trading table with the given name (filename without extension), or null. */
  getTradingTable(name: string): TradingTable | null { return this._tradingStore.get(name) ?? null; }
  /** Returns all trading tables loaded from the behavior pack's `trading/` directory. */
  getAllTradingTables(): AssetCollection<TradingTable> { return new AssetCollection(this._tradingStore); }

  // ── Geometries ────────────────────────────────────────────────────────────

  /**
   * Returns the geometry model with the given full identifier, or null if not found.
   *
   * @example
   * ```ts
   * const geo = addon.getGeometry("geometry.humanoid.custom");
   * console.log(geo?.bones.map(b => b.name));
   * ```
   */
  getGeometry(identifier: string): GeometryModel | null { return this._geoStore.get(identifier) ?? null; }
  /** Returns all geometry models loaded from the resource pack's `models/` directory. */
  getAllGeometries(): AssetCollection<GeometryModel> { return new AssetCollection(this._geoStore); }

  // ── Sound convenience lookups ─────────────────────────────────────────────

  /** Returns the sound definition with the given event ID, or null if not found. */
  getSoundDefinition(id: string): SoundDefinitionEntry | null {
    return this._s.soundDefinitions?.get(id) ?? null;
  }

  /** Returns the music definition for the given context key, or null if not found. */
  getMusicDefinition(id: string): MusicDefinitionEntry | null {
    return this._s.musicDefinitions?.get(id) ?? null;
  }

  /** Returns the sound events for the given entity shortname, or an empty array. */
  getEntitySoundEvents(sn: string): SoundEventBinding[] {
    return this._s.sounds?.getEntitySoundEvents(sn)?.all ?? [];
  }

  /** Returns the sound events for the given block shortname, or an empty array. */
  getBlockSoundEvents(sn: string): SoundEventBinding[] {
    return this._s.sounds?.getBlockSoundEvents(sn)?.all ?? [];
  }

  // ── Language files ─────────────────────────────────────────────────────────

  /**
   * Returns the default language file (en_US). Null if missing.
   */
  get langFile(): LangFile | null { return this.getLangFile("en_US"); }

  /**
   * Returns the language file for the given language code, or null if not found.
   * Works in both disk and browser mode.
   *
   * @param language - The language code, e.g. `"en_US"`, `"fr_CA"`. Defaults to `"en_US"`.
   *
   * @example
   * ```ts
   * const lang = addon.getLangFile();          // en_US
   * const french = addon.getLangFile("fr_CA");
   * const name = french?.get("item.mypack.spear.name");
   * ```
   */
  getLangFile(language: string = "en_US"): LangFile | null {
    if (this._s.langFiles.has(language)) return this._s.langFiles.get(language)!;
    const langFile = AddonLoader.loadLangFile(this._s, language);
    if (langFile) this._s.langFiles.set(language, langFile);
    return langFile;
  }

  // ── Asset by path lookup ─────────────────────────────────────────────────

  /**
   * Returns any asset by its file path. Searches across all loaded asset types.
   * Partial path matching is supported.
   *
   * @example
   * ```ts
   * const asset = addon.getAssetByPath("items/custom_spear.json");
   * ```
   */
  getAssetByPath(filePath: string): Asset | null {
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
        // Cross-link for BP/RP entities
        if (asset instanceof BpEntity) {
          const rp = asset.getRpEntity();
          if (rp) {
            const rpp = rp.filePath.replace(/\\/g, "/").toLowerCase();
            if (rpp === norm || rpp.endsWith(norm)) return rp;
          }
        }
      }
    }

    for (const recipe of this._recipeStore) {
      const p = recipe.filePath.replace(/\\/g, "/").toLowerCase();
      if (p === norm || p.endsWith(norm)) return recipe;
    }

    return null;
  }
}
