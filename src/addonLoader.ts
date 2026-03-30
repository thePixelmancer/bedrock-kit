/**
 * Internal module — not exported from bedrockKit.
 * Contains all disk and browser loading logic for AddOn, keeping addon.ts
 * focused on the public navigation API.
 */
import { join, posix } from "node:path";
import { diskEntries, browserEntries } from "./pack.js";
import { readJSONFromDisk, readRawFromDisk } from "./json.js";
import { packDataFromFiles } from "./browser.js";
import { extractIdentifier } from "./identifiers.js";
import { TextureAtlasFile } from "./textureAtlas.js";
import { ManifestFile } from "./manifest.js";
import { SoundDefinitionsFile } from "./soundDefinitions.js";
import { MusicDefinitionsFile } from "./musicDefinitions.js";
import { SoundsFile } from "./sounds.js";
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

import type { PackData } from "./browser.js";
import type { PackEntry } from "./pack.js";
import type { AddOn } from "./addon.js";

// ─── Internal state shape ─────────────────────────────────────────────────────

export interface AddonState {
  behaviorPackPath: string;
  resourcePackPath: string;
  bpData: PackData | null;
  rpData: PackData | null;

  // Eagerly loaded connective tissue (internal only)
  behaviorManifest: ManifestFile | null;
  resourceManifest: ManifestFile | null;
  itemTextures: TextureAtlasFile | null;
  terrainTextures: TextureAtlasFile | null;
  soundDefinitions: SoundDefinitionsFile | null;
  musicDefinitions: MusicDefinitionsFile | null;
  sounds: SoundsFile | null;

  // Lazy caches
  items: Map<string, Item> | null;
  blocks: Map<string, Block> | null;
  bpEntities: Map<string, BehaviorEntity> | null;
  rpEntities: Map<string, ResourceEntity> | null;
  entityStore: Map<string, Entity> | null;
  recipes: Recipe[] | null;
  lootTables: Map<string, LootTable> | null;
  spawnRules: Map<string, SpawnRule> | null;
  biomes: Map<string, Biome> | null;
  animations: Map<string, Animation> | null;
  animationControllers: Map<string, AnimationController> | null;
  renderControllers: Map<string, RenderController> | null;
  particles: Map<string, Particle> | null;
  attachables: Map<string, Attachable> | null;
  tradingTables: Map<string, TradingTable> | null;
  geometries: Map<string, GeometryModel> | null;
  langFiles: Map<string, LangFile>;
}

// ─── Loader ───────────────────────────────────────────────────────────────────

export class AddonLoader {
  static fromDisk(bpPath: string, rpPath: string, _addon: AddOn): AddonState {
    const state = AddonLoader._emptyState(bpPath, rpPath, null, null);
    state.behaviorManifest = AddonLoader._loadManifestFromDisk(bpPath);
    state.resourceManifest = rpPath ? AddonLoader._loadManifestFromDisk(rpPath) : null;
    state.itemTextures = rpPath ? AddonLoader._loadAtlasFromDisk(rpPath, "textures/item_texture.json") : null;
    state.terrainTextures = rpPath ? AddonLoader._loadAtlasFromDisk(rpPath, "textures/terrain_texture.json") : null;
    state.soundDefinitions = rpPath ? AddonLoader._loadSoundDefinitionsFromDisk(rpPath) : null;
    state.musicDefinitions = rpPath ? AddonLoader._loadMusicDefinitionsFromDisk(rpPath) : null;
    state.sounds = rpPath ? AddonLoader._loadSoundsFromDisk(rpPath) : null;
    return state;
  }

  static fromPackData(bpData: PackData, rpData: PackData, _addon: AddOn): AddonState {
    const state = AddonLoader._emptyState("", "", bpData, rpData);
    state.behaviorManifest = AddonLoader._loadManifestFromPackData(bpData);
    state.resourceManifest = AddonLoader._loadManifestFromPackData(rpData);
    state.itemTextures = AddonLoader._loadAtlasFromPackData(rpData, "textures/item_texture.json");
    state.terrainTextures = AddonLoader._loadAtlasFromPackData(rpData, "textures/terrain_texture.json");
    state.soundDefinitions = AddonLoader._loadSoundDefinitionsFromPackData(rpData);
    state.musicDefinitions = AddonLoader._loadMusicDefinitionsFromPackData(rpData);
    state.sounds = AddonLoader._loadSoundsFromPackData(rpData);
    return state;
  }

  static async fromFileList(bpFiles: File[], rpFiles: File[], addon: AddOn): Promise<AddonState> {
    const [bpData, rpData] = await Promise.all([packDataFromFiles(bpFiles), packDataFromFiles(rpFiles)]);
    return AddonLoader.fromPackData(bpData, rpData, addon);
  }

  private static _emptyState(
    bpPath: string, rpPath: string,
    bpData: PackData | null, rpData: PackData | null
  ): AddonState {
    return {
      behaviorPackPath: bpPath,
      resourcePackPath: rpPath,
      bpData,
      rpData,
      behaviorManifest: null,
      resourceManifest: null,
      itemTextures: null,
      terrainTextures: null,
      soundDefinitions: null,
      musicDefinitions: null,
      sounds: null,
      items: null,
      blocks: null,
      bpEntities: null,
      rpEntities: null,
      entityStore: null,
      recipes: null,
      lootTables: null,
      spawnRules: null,
      biomes: null,
      animations: null,
      animationControllers: null,
      renderControllers: null,
      particles: null,
      attachables: null,
      tradingTables: null,
      geometries: null,
      langFiles: new Map(),
    };
  }

  // ── Entry helpers ─────────────────────────────────────────────────────────

  static bpEntries(state: AddonState, subdir: string): PackEntry[] {
    return state.bpData
      ? browserEntries(state.bpData, subdir)
      : diskEntries(state.behaviorPackPath, subdir);
  }

  static rpEntries(state: AddonState, subdir: string): PackEntry[] {
    return state.rpData
      ? browserEntries(state.rpData, subdir)
      : diskEntries(state.resourcePackPath, subdir);
  }

  // ── Lazy loaders ──────────────────────────────────────────────────────────

  static loadItems(state: AddonState, addon: AddOn): Map<string, Item> {
    const map = new Map<string, Item>();
    for (const { filePath, data, rawText } of AddonLoader.bpEntries(state, "items")) {
      const id = extractIdentifier(data, "minecraft:item");
      if (!id) continue;
      map.set(id, new Item(id, filePath, data, rawText, addon));
    }
    return map;
  }

  static loadBlocks(state: AddonState, addon: AddOn): Map<string, Block> {
    const map = new Map<string, Block>();
    for (const { filePath, data, rawText } of AddonLoader.bpEntries(state, "blocks")) {
      const id = extractIdentifier(data, "minecraft:block");
      if (!id) continue;
      map.set(id, new Block(id, filePath, data, rawText, addon));
    }
    return map;
  }

  static loadBpEntities(state: AddonState, addon: AddOn): Map<string, BehaviorEntity> {
    const map = new Map<string, BehaviorEntity>();
    for (const { filePath, data, rawText } of AddonLoader.bpEntries(state, "entities")) {
      const id = extractIdentifier(data, "minecraft:entity") ?? extractIdentifier(data, "minecraft:npc");
      if (!id) continue;
      map.set(id, new BehaviorEntity(id, filePath, data, rawText, addon));
    }
    return map;
  }

  static loadRpEntities(state: AddonState, addon: AddOn): Map<string, ResourceEntity> {
    const map = new Map<string, ResourceEntity>();
    for (const { filePath, data, rawText } of AddonLoader.rpEntries(state, "entity")) {
      const inner = data["minecraft:client_entity"] as Record<string, unknown> | undefined;
      const desc = inner?.["description"] as Record<string, unknown> | undefined;
      const id = desc?.["identifier"] as string | undefined;
      if (!id) continue;
      map.set(id, new ResourceEntity(id, filePath, data, rawText, addon));
    }
    return map;
  }

  static loadRecipes(state: AddonState, addon: AddOn): Recipe[] {
    return AddonLoader.bpEntries(state, "recipes").map(({ filePath, relativePath, data, rawText }) => {
      const recipeKey = Object.keys(data).find(k => k.startsWith("minecraft:recipe_"));
      const inner = recipeKey ? (data[recipeKey] as Record<string, unknown>) : undefined;
      const desc = inner?.["description"] as Record<string, unknown> | undefined;
      const id = (desc?.["identifier"] as string | undefined) ?? posix.basename(relativePath, ".json");
      return new Recipe(id, filePath, data, rawText, addon);
    });
  }

  static loadLootTables(state: AddonState, addon: AddOn): Map<string, LootTable> {
    const map = new Map<string, LootTable>();
    for (const { filePath, relativePath, data, rawText } of AddonLoader.bpEntries(state, "loot_tables")) {
      const key = relativePath.replace(/\\/g, "/");
      map.set(key, new LootTable(key, filePath, data, rawText, addon));
    }
    return map;
  }

  static loadSpawnRules(state: AddonState): Map<string, SpawnRule> {
    const map = new Map<string, SpawnRule>();
    for (const { filePath, data, rawText } of AddonLoader.bpEntries(state, "spawn_rules")) {
      const inner = data["minecraft:spawn_rules"] as Record<string, unknown> | undefined;
      const desc = inner?.["description"] as Record<string, unknown> | undefined;
      const id = desc?.["identifier"] as string | undefined;
      if (!id) continue;
      map.set(id, new SpawnRule(id, filePath, data, rawText));
    }
    return map;
  }

  static loadBiomes(state: AddonState, addon: AddOn): Map<string, Biome> {
    const map = new Map<string, Biome>();
    for (const { filePath, data, rawText } of AddonLoader.bpEntries(state, "biomes")) {
      const id = extractIdentifier(data, "minecraft:biome");
      if (!id) continue;
      map.set(id, new Biome(id, filePath, data, rawText, addon));
    }
    return map;
  }

  static loadAnimations(state: AddonState): Map<string, Animation> {
    const map = new Map<string, Animation>();
    for (const { filePath, data, rawText } of AddonLoader.rpEntries(state, "animations")) {
      const animMap = data["animations"] as Record<string, unknown> | undefined;
      if (!animMap) continue;
      for (const [id, animData] of Object.entries(animMap))
        map.set(id, new Animation(id, animData as Record<string, unknown>, filePath, rawText));
    }
    return map;
  }

  static loadAnimationControllers(state: AddonState): Map<string, AnimationController> {
    const map = new Map<string, AnimationController>();
    for (const { filePath, data, rawText } of AddonLoader.rpEntries(state, "animation_controllers")) {
      const ctrlMap = data["animation_controllers"] as Record<string, unknown> | undefined;
      if (!ctrlMap) continue;
      for (const [id, ctrlData] of Object.entries(ctrlMap))
        map.set(id, new AnimationController(id, ctrlData as Record<string, unknown>, filePath, rawText));
    }
    return map;
  }

  static loadRenderControllers(state: AddonState): Map<string, RenderController> {
    const map = new Map<string, RenderController>();
    for (const { filePath, data, rawText } of AddonLoader.rpEntries(state, "render_controllers")) {
      const rcMap = data["render_controllers"] as Record<string, unknown> | undefined;
      if (!rcMap) continue;
      for (const [id, rcData] of Object.entries(rcMap))
        map.set(id, new RenderController(id, rcData as Record<string, unknown>, filePath, rawText));
    }
    return map;
  }

  static loadParticles(state: AddonState): Map<string, Particle> {
    const map = new Map<string, Particle>();
    for (const { filePath, data, rawText } of AddonLoader.rpEntries(state, "particles")) {
      const inner = data["particle_effect"] as Record<string, unknown> | undefined;
      const desc = inner?.["description"] as Record<string, unknown> | undefined;
      const id = desc?.["identifier"] as string | undefined;
      if (!id) continue;
      map.set(id, new Particle(id, filePath, data, rawText));
    }
    return map;
  }

  static loadAttachables(state: AddonState): Map<string, Attachable> {
    const map = new Map<string, Attachable>();
    for (const { filePath, data, rawText } of AddonLoader.rpEntries(state, "attachables")) {
      const id = extractIdentifier(data, "minecraft:attachable");
      if (!id) continue;
      map.set(id, new Attachable(id, filePath, data, rawText));
    }
    return map;
  }

  static loadTradingTables(state: AddonState): Map<string, TradingTable> {
    const map = new Map<string, TradingTable>();
    for (const { filePath, relativePath, data, rawText } of AddonLoader.bpEntries(state, "trading")) {
      const name = posix.basename(relativePath, ".json");
      map.set(name, new TradingTable(name, filePath, data, rawText));
    }
    return map;
  }

  static loadGeometries(state: AddonState): Map<string, GeometryModel> {
    const map = new Map<string, GeometryModel>();
    for (const { filePath, data, rawText } of AddonLoader.rpEntries(state, "models")) {
      const geoArray = data["minecraft:geometry"];
      if (Array.isArray(geoArray)) {
        for (const modelData of geoArray as Record<string, unknown>[]) {
          const desc = modelData["description"] as Record<string, unknown> | undefined;
          const id = desc?.["identifier"] as string | undefined;
          if (!id) continue;
          map.set(id, new GeometryModel(id, modelData, filePath, rawText));
        }
        continue;
      }
      for (const [key, value] of Object.entries(data)) {
        if (!key.startsWith("geometry.")) continue;
        map.set(key, new GeometryModel(key, value as Record<string, unknown>, filePath, rawText));
      }
    }
    return map;
  }

  static loadLangFile(state: AddonState, language: string): LangFile | null {
    if (state.rpData) {
      const entry = state.rpData.get(`texts/${language}.lang`);
      if (!entry) return null;
      return new LangFile(`texts/${language}.lang`, language, entry.rawText);
    }
    const filePath = join(state.resourcePackPath, "texts", `${language}.lang`);
    const rawText = readRawFromDisk(filePath);
    if (!rawText) return null;
    return new LangFile(filePath, language, rawText);
  }

  // ── Connective tissue loaders (disk) ──────────────────────────────────────

  private static _loadManifestFromDisk(packPath: string): ManifestFile | null {
    const filePath = join(packPath, "manifest.json");
    const rawText = readRawFromDisk(filePath);
    const data = readJSONFromDisk<Record<string, unknown>>(filePath);
    if (!data) return null;
    return new ManifestFile(filePath, data, rawText ?? "");
  }

  private static _loadAtlasFromDisk(rpPath: string, relativePath: string): TextureAtlasFile | null {
    const filePath = join(rpPath, relativePath);
    const rawText = readRawFromDisk(filePath);
    const data = readJSONFromDisk<Record<string, unknown>>(filePath);
    if (!data) return null;
    return new TextureAtlasFile(filePath, data, rawText ?? "");
  }

  private static _loadSoundDefinitionsFromDisk(rpPath: string): SoundDefinitionsFile | null {
    const filePath = join(rpPath, "sounds", "sound_definitions.json");
    const rawText = readRawFromDisk(filePath);
    const data = readJSONFromDisk<Record<string, unknown>>(filePath);
    if (!data) return null;
    return new SoundDefinitionsFile(filePath, data, rawText ?? "");
  }

  private static _loadMusicDefinitionsFromDisk(rpPath: string): MusicDefinitionsFile | null {
    const filePath = join(rpPath, "sounds", "music_definitions.json");
    const rawText = readRawFromDisk(filePath);
    const data = readJSONFromDisk<Record<string, unknown>>(filePath);
    if (!data) return null;
    return new MusicDefinitionsFile(filePath, data, rawText ?? "");
  }

  private static _loadSoundsFromDisk(rpPath: string): SoundsFile | null {
    for (const rel of ["sounds.json", "sounds/sounds.json"]) {
      const filePath = join(rpPath, rel);
      const rawText = readRawFromDisk(filePath);
      const data = readJSONFromDisk<Record<string, unknown>>(filePath);
      if (data) return new SoundsFile(filePath, data, rawText ?? "");
    }
    return null;
  }

  // ── Connective tissue loaders (browser) ───────────────────────────────────

  private static _loadManifestFromPackData(packData: PackData): ManifestFile | null {
    const entry = packData.get("manifest.json");
    if (!entry) return null;
    return new ManifestFile("manifest.json", entry.data, entry.rawText);
  }

  private static _loadAtlasFromPackData(rpData: PackData, key: string): TextureAtlasFile | null {
    const entry = rpData.get(key);
    if (!entry) return null;
    return new TextureAtlasFile(key, entry.data, entry.rawText);
  }

  private static _loadSoundDefinitionsFromPackData(rpData: PackData): SoundDefinitionsFile | null {
    const entry = rpData.get("sounds/sound_definitions.json");
    if (!entry) return null;
    return new SoundDefinitionsFile("sounds/sound_definitions.json", entry.data, entry.rawText);
  }

  private static _loadMusicDefinitionsFromPackData(rpData: PackData): MusicDefinitionsFile | null {
    const entry = rpData.get("sounds/music_definitions.json");
    if (!entry) return null;
    return new MusicDefinitionsFile("sounds/music_definitions.json", entry.data, entry.rawText);
  }

  private static _loadSoundsFromPackData(rpData: PackData): SoundsFile | null {
    const entry = rpData.get("sounds.json") ?? rpData.get("sounds/sounds.json");
    if (!entry) return null;
    const key = rpData.has("sounds.json") ? "sounds.json" : "sounds/sounds.json";
    return new SoundsFile(key, entry.data, entry.rawText);
  }
}
