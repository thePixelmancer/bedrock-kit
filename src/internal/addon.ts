import { join, resolve, posix } from "node:path";
import { PackData, PackEntry, diskEntries, browserEntries, packDataFromFiles, readJSONFromDisk, readRawFromDisk, extractIdentifier } from "./utils.js";
import type { ItemTextureMap, TerrainTextureMap } from "./types.js";
import { Tag } from "./tag.js";
import { Item } from "./item.js";
import { ItemStack } from "./itemStack.js";
import { Block } from "./block.js";
import { Entity } from "./entity.js";
import { Recipe } from "./recipe.js";
import { LootTable } from "./lootTable.js";
import { SpawnRule } from "./spawnRule.js";
import { Biome } from "./biome.js";
import { Animation, AnimationController } from "./animation.js";
import { RenderController } from "./renderController.js";
import { Particle } from "./particle.js";
import { Attachable } from "./attachable.js";
import { TradingTable } from "./tradingTable.js";
import { SoundDefinition, SoundEvent, MusicDefinition } from "./sound.js";
import { AssetCollection } from "./asset.js";

export type { PackData };

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
 * Connective tissue files (texture maps, sound definitions, music definitions, sound events)
 * are loaded eagerly at construction time.
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

  /** The parsed `item_texture.json` from the resource pack. Null if missing. */
  readonly itemTextures: ItemTextureMap | null;
  /** The parsed `terrain_texture.json` from the resource pack. Null if missing. */
  readonly terrainTextures: TerrainTextureMap | null;
  /** All sound definitions from `sounds/sound_definitions.json`, keyed by event ID. */
  readonly soundDefinitions: Map<string, SoundDefinition>;
  /** All music definitions from `sounds/music_definitions.json`, keyed by context key. */
  readonly musicDefinitions: Map<string, MusicDefinition>;
  /** All entity sound event mappings from `sounds.json`, keyed by entity shortname. */
  readonly entitySoundEvents: Map<string, SoundEvent[]>;
  /** All block sound event mappings from `sounds.json`, keyed by block shortname. */
  readonly blockSoundEvents: Map<string, SoundEvent[]>;

  // Browser PackData — populated only by fromFileList
  private _bpData: PackData | null = null;
  private _rpData: PackData | null = null;

  // ── Constructors ─────────────────────────────────────────────────────────

  /**
   * Creates a new AddOn instance that reads from disk.
   * Works in Deno and Node.js. Paths are resolved to absolute on construction.
   * Connective tissue files are loaded immediately; everything else is lazy.
   */
  constructor(behaviorPackPath: string, resourcePackPath: string) {
    this.behaviorPackPath = resolve(behaviorPackPath);
    this.resourcePackPath = resolve(resourcePackPath);
    this.itemTextures = readJSONFromDisk<ItemTextureMap>(join(this.resourcePackPath, "textures", "item_texture.json"));
    this.terrainTextures = readJSONFromDisk<TerrainTextureMap>(join(this.resourcePackPath, "textures", "terrain_texture.json"));
    this.soundDefinitions = this._loadSoundDefinitions();
    this.musicDefinitions = this._loadMusicDefinitions();
    this.entitySoundEvents = this._loadEntitySoundEvents();
    this.blockSoundEvents = this._loadBlockSoundEvents();
  }

  /** Internal factory used by `fromFileList`. Bypasses disk I/O entirely. */
  private static _fromPackData(bpData: PackData, rpData: PackData): AddOn {
    const addon = Object.create(AddOn.prototype) as AddOn;
    (addon as unknown as Record<string, unknown>).behaviorPackPath = "";
    (addon as unknown as Record<string, unknown>).resourcePackPath = "";
    addon._bpData = bpData;
    addon._rpData = rpData;
    (addon as any).itemTextures = (rpData.get("textures/item_texture.json")?.data as unknown as ItemTextureMap | undefined) ?? null;
    (addon as any).terrainTextures = (rpData.get("textures/terrain_texture.json")?.data as unknown as TerrainTextureMap | undefined) ?? null;
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
    (addon as any).soundDefinitions = addon._loadSoundDefinitions();
    (addon as any).musicDefinitions = addon._loadMusicDefinitions();
    (addon as any).entitySoundEvents = addon._loadEntitySoundEvents();
    (addon as any).blockSoundEvents = addon._loadBlockSoundEvents();
    return addon;
  }

  /**
   * Creates an AddOn from two `File[]` arrays for browser folder pickers.
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
    const [bpData, rpData] = await Promise.all([packDataFromFiles(bpFiles), packDataFromFiles(rpFiles)]);
    return AddOn._fromPackData(bpData, rpData);
  }

  // ── Internal helpers ─────────────────────────────────────────────────────

  private get _isBrowser(): boolean {
    return this._bpData !== null || this._rpData !== null;
  }

  private _bpEntries(subdir: string): PackEntry[] {
    return this._isBrowser ? browserEntries(this._bpData!, subdir) : diskEntries(this.behaviorPackPath, subdir);
  }

  private _rpEntries(subdir: string): PackEntry[] {
    return this._isBrowser ? browserEntries(this._rpData!, subdir) : diskEntries(this.resourcePackPath, subdir);
  }

  // ── Items ─────────────────────────────────────────────────────────────────

  /** Returns the item with the given namespaced identifier, or null if not found. */
  getItem(identifier: string): Item | null {
    return this._itemStore.get(identifier) ?? null;
  }
  /** Returns all items loaded from the behavior pack's `items/` directory. */
  getAllItems(): AssetCollection<Item> {
    return new AssetCollection(this._itemStore);
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
  getAllBlocks(): AssetCollection<Block> {
    return new AssetCollection(this._blockStore);
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
  getAllEntities(): AssetCollection<Entity> {
    return new AssetCollection(this._entityStore);
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
    return this._recipeStore.filter((r) => r.usesItem(identifier));
  }
  /** Returns all recipes that use the given tag id as an ingredient. */
  getRecipesUsingTag(tagId: string): Recipe[] {
    return this._recipeStore.filter((r) => r.getAllIngredients().some((ing) => ing instanceof Tag && ing.id === tagId));
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
    return this._lootStore.get(relativePath.replace(/\\/g, "/")) ?? null;
  }
  /** Returns all loot tables loaded from the behavior pack's `loot_tables/` directory. */
  getAllLootTables(): AssetCollection<LootTable> {
    return new AssetCollection(this._lootStore);
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
  getAllSpawnRules(): AssetCollection<SpawnRule> {
    return new AssetCollection(this._spawnStore);
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
  getAllBiomes(): AssetCollection<Biome> {
    return new AssetCollection(this._biomeStore);
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
  getAllAnimations(): AssetCollection<Animation> {
    return new AssetCollection(this._animStore);
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
  getAllAnimationControllers(): AssetCollection<AnimationController> {
    return new AssetCollection(this._animCtrlStore);
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
  getAllRenderControllers(): AssetCollection<RenderController> {
    return new AssetCollection(this._renderCtrlStore);
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
  getAllParticles(): AssetCollection<Particle> {
    return new AssetCollection(this._particleStore);
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
  getAllAttachables(): AssetCollection<Attachable> {
    return new AssetCollection(this._attachableStore);
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
  getAllTradingTables(): AssetCollection<TradingTable> {
    return new AssetCollection(this._tradingStore);
  }
  private get _tradingStore(): Map<string, TradingTable> {
    if (!this._tradingTables) this._tradingTables = this._loadTradingTables();
    return this._tradingTables;
  }

  // ── Sound convenience lookups ─────────────────────────────────────────────

  /** Returns the sound definition with the given event ID, or null if not found. */
  getSoundDefinition(id: string): SoundDefinition | null {
    return this.soundDefinitions.get(id) ?? null;
  }

  /** Returns the music definition for the given context key, or null if not found. */
  getMusicDefinition(id: string): MusicDefinition | null {
    return this.musicDefinitions.get(id) ?? null;
  }

  /** Returns the sound events for the given entity shortname, or an empty array. */
  getEntitySoundEvents(shortname: string): SoundEvent[] {
    return this.entitySoundEvents.get(shortname) ?? [];
  }

  /** Returns the sound events for the given block shortname, or an empty array. */
  getBlockSoundEvents(shortname: string): SoundEvent[] {
    return this.blockSoundEvents.get(shortname) ?? [];
  }

  // ── Loaders ──────────────────────────────────────────────────────────────

  private _loadItems(): Map<string, Item> {
    const map = new Map<string, Item>();
    for (const { filePath, data, rawText } of this._bpEntries("items")) {
      const id = extractIdentifier(data, "minecraft:item");
      if (!id) continue;
      map.set(id, new Item(id, data, filePath, this, rawText));
    }
    return map;
  }

  private _loadBlocks(): Map<string, Block> {
    const map = new Map<string, Block>();
    for (const { filePath, data, rawText } of this._bpEntries("blocks")) {
      const id = extractIdentifier(data, "minecraft:block");
      if (!id) continue;
      map.set(id, new Block(id, data, filePath, this, rawText));
    }
    return map;
  }

  private _loadEntities(): Map<string, Entity> {
    const behaviorMap = new Map<string, { data: Record<string, unknown>; filePath: string; rawText: string }>();
    for (const { filePath, data, rawText } of this._bpEntries("entities")) {
      const id = extractIdentifier(data, "minecraft:entity") ?? extractIdentifier(data, "minecraft:npc");
      if (!id) continue;
      behaviorMap.set(id, { data, filePath, rawText });
    }

    const resourceMap = new Map<string, { data: Record<string, unknown>; filePath: string; rawText: string }>();
    for (const { filePath, data, rawText } of this._rpEntries("entity")) {
      const inner = data["minecraft:client_entity"] as Record<string, unknown> | undefined;
      const desc = inner?.["description"] as Record<string, unknown> | undefined;
      const id = desc?.["identifier"] as string | undefined;
      if (!id) continue;
      resourceMap.set(id, { data, filePath, rawText });
    }

    const map = new Map<string, Entity>();
    for (const [id, bp] of behaviorMap) {
      const rp = resourceMap.get(id);
      map.set(id, new Entity(id, bp.data, bp.filePath, rp?.data ?? null, rp?.filePath ?? null, this, bp.rawText));
    }
    for (const [id, rp] of resourceMap) {
      if (!behaviorMap.has(id)) map.set(id, new Entity(id, {}, "", rp.data, rp.filePath, this, rp.rawText));
    }
    return map;
  }

  private _loadRecipes(): Recipe[] {
    return this._bpEntries("recipes").map(({ data, rawText }) => new Recipe(data, this, rawText));
  }

  private _loadLootTables(): Map<string, LootTable> {
    const map = new Map<string, LootTable>();
    for (const { filePath, relativePath, data, rawText } of this._bpEntries("loot_tables")) {
      const key = relativePath.replace(/\\/g, "/");
      map.set(key, new LootTable(data, filePath, key, rawText));
    }
    return map;
  }

  private _loadSpawnRules(): Map<string, SpawnRule> {
    const map = new Map<string, SpawnRule>();
    for (const { filePath, data, rawText } of this._bpEntries("spawn_rules")) {
      const inner = data["minecraft:spawn_rules"] as Record<string, unknown> | undefined;
      const desc = inner?.["description"] as Record<string, unknown> | undefined;
      const id = desc?.["identifier"] as string | undefined;
      if (!id) continue;
      map.set(id, new SpawnRule(id, data, filePath, rawText));
    }
    return map;
  }

  private _loadBiomes(): Map<string, Biome> {
    const map = new Map<string, Biome>();
    for (const { filePath, data, rawText } of this._bpEntries("biomes")) {
      const id = extractIdentifier(data, "minecraft:biome");
      if (!id) continue;
      map.set(id, new Biome(id, data, filePath, this, rawText));
    }
    return map;
  }

  private _loadAnimations(): Map<string, Animation> {
    const map = new Map<string, Animation>();
    for (const { filePath, data, rawText } of this._rpEntries("animations")) {
      const animMap = data["animations"] as Record<string, unknown> | undefined;
      if (!animMap) continue;
      for (const [id, animData] of Object.entries(animMap)) map.set(id, new Animation(id, animData as Record<string, unknown>, filePath, rawText));
    }
    return map;
  }

  private _loadAnimationControllers(): Map<string, AnimationController> {
    const map = new Map<string, AnimationController>();
    for (const { filePath, data, rawText } of this._rpEntries("animation_controllers")) {
      const ctrlMap = data["animation_controllers"] as Record<string, unknown> | undefined;
      if (!ctrlMap) continue;
      for (const [id, ctrlData] of Object.entries(ctrlMap))
        map.set(id, new AnimationController(id, ctrlData as Record<string, unknown>, filePath, rawText));
    }
    return map;
  }

  private _loadRenderControllers(): Map<string, RenderController> {
    const map = new Map<string, RenderController>();
    for (const { filePath, data, rawText } of this._rpEntries("render_controllers")) {
      const rcMap = data["render_controllers"] as Record<string, unknown> | undefined;
      if (!rcMap) continue;
      for (const [id, rcData] of Object.entries(rcMap)) map.set(id, new RenderController(id, rcData as Record<string, unknown>, filePath, rawText));
    }
    return map;
  }

  private _loadParticles(): Map<string, Particle> {
    const map = new Map<string, Particle>();
    for (const { filePath, data, rawText } of this._rpEntries("particles")) {
      const inner = data["particle_effect"] as Record<string, unknown> | undefined;
      const desc = inner?.["description"] as Record<string, unknown> | undefined;
      const id = desc?.["identifier"] as string | undefined;
      if (!id) continue;
      map.set(id, new Particle(id, data, filePath, rawText));
    }
    return map;
  }

  private _loadAttachables(): Map<string, Attachable> {
    const map = new Map<string, Attachable>();
    for (const { filePath, data, rawText } of this._rpEntries("attachables")) {
      const id = extractIdentifier(data, "minecraft:attachable");
      if (!id) continue;
      map.set(id, new Attachable(id, data, filePath, rawText));
    }
    return map;
  }

  private _loadTradingTables(): Map<string, TradingTable> {
    const map = new Map<string, TradingTable>();
    for (const { filePath, relativePath, data, rawText } of this._bpEntries("trading")) {
      const name = posix.basename(relativePath, ".json");
      map.set(name, new TradingTable(data, filePath, name, rawText));
    }
    return map;
  }

  private _loadSoundDefinitions(): Map<string, SoundDefinition> {
    const map = new Map<string, SoundDefinition>();
    const data =
      this._isBrowser ?
        this._rpData?.get("sounds/sound_definitions.json")?.data
      : readJSONFromDisk(join(this.resourcePackPath, "sounds", "sound_definitions.json"));
    if (!data) return map;
    const defs = data["sound_definitions"] as Record<string, unknown> | undefined;
    if (!defs) return map;
    for (const [id, entry] of Object.entries(defs)) map.set(id, new SoundDefinition(id, entry as Record<string, unknown>));
    return map;
  }

  private _loadMusicDefinitions(): Map<string, MusicDefinition> {
    const map = new Map<string, MusicDefinition>();
    const data =
      this._isBrowser ?
        this._rpData?.get("sounds/music_definitions.json")?.data
      : readJSONFromDisk(join(this.resourcePackPath, "sounds", "music_definitions.json"));
    if (!data) return map;
    for (const [id, entry] of Object.entries(data)) map.set(id, new MusicDefinition(id, entry as Record<string, unknown>));
    return map;
  }

  private _loadEntitySoundEvents(): Map<string, SoundEvent[]> {
    const map = new Map<string, SoundEvent[]>();
    const data =
      this._isBrowser ?
        (this._rpData?.get("sounds.json")?.data ?? this._rpData?.get("sounds/sounds.json")?.data)
      : (readJSONFromDisk(join(this.resourcePackPath, "sounds.json")) ?? readJSONFromDisk(join(this.resourcePackPath, "sounds", "sounds.json")));
    if (!data) return map;
    const entitySounds = data["entity_sounds"] as Record<string, unknown> | undefined;
    const entities = entitySounds?.["entities"] as Record<string, unknown> | undefined;
    if (!entities) return map;
    for (const [sn, entry] of Object.entries(entities)) {
      const e = entry as Record<string, unknown>;
      const events = e["events"] as Record<string, unknown> | undefined;
      if (!events) continue;
      map.set(sn, this._parseSoundEventMap(events));
    }
    return map;
  }

  private _loadBlockSoundEvents(): Map<string, SoundEvent[]> {
    const map = new Map<string, SoundEvent[]>();
    const data =
      this._isBrowser ?
        (this._rpData?.get("sounds.json")?.data ?? this._rpData?.get("sounds/sounds.json")?.data)
      : (readJSONFromDisk(join(this.resourcePackPath, "sounds.json")) ?? readJSONFromDisk(join(this.resourcePackPath, "sounds", "sounds.json")));
    if (!data) return map;
    const blockSounds = data["block_sounds"] as Record<string, unknown> | undefined;
    if (!blockSounds) return map;
    for (const [sn, entry] of Object.entries(blockSounds)) {
      const e = entry as Record<string, unknown>;
      const events = e["events"] as Record<string, unknown> | undefined;
      if (!events) continue;
      map.set(sn, this._parseSoundEventMap(events));
    }
    return map;
  }

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
        const defId = (v["sound"] as string) ?? (v["sounds"] as string) ?? "";
        result.push({
          event,
          definitionId: defId,
          definition: defId ? this.getSoundDefinition(defId) : null,
          volume: typeof v["volume"] === "number" ? (v["volume"] as number) : null,
          pitch:
            Array.isArray(v["pitch"]) ? (v["pitch"] as [number, number])
            : typeof v["pitch"] === "number" ? (v["pitch"] as number)
            : null,
        });
      }
    }
    return result;
  }
}
