// ─── Main entry point ─────────────────────────────────────────────────────────
export { AddOn } from "./addon.js";
export type { PackData } from "./browser.js";

// ─── Base ─────────────────────────────────────────────────────────────────────
export { Asset, AssetCollection } from "./asset.js";
export type { CommentBlock } from "./asset.js";

// ─── Collection type aliases ──────────────────────────────────────────────────
// Named instantiations so TypeDoc links them as children of AssetCollection
// and consumers can reference them without writing out the generic form.
import type { AssetCollection } from "./asset.js";
import type { Item } from "./item.js";
import type { Block } from "./block.js";
import type { Entity, BehaviorEntity, ResourceEntity } from "./entity.js";
import type { LootTable } from "./lootTable.js";
import type { TradingTable } from "./tradingTable.js";
import type { Biome } from "./biome.js";
import type { Animation, AnimationController } from "./animation.js";
import type { RenderController } from "./renderController.js";
import type { Particle } from "./particle.js";
import type { Attachable } from "./attachable.js";
import type { GeometryModel } from "./geometry.js";

/** All item definitions from the behavior pack. Access via `addon.items`. */
export type ItemCollection             = AssetCollection<Item>;
/** All block definitions from the behavior pack. Access via `addon.blocks`. */
export type BlockCollection            = AssetCollection<Block>;
/** All unified entity views (BP + RP merged). Access via `addon.entities`. */
export type EntityCollection           = AssetCollection<Entity>;
/** All behavior-pack entity files. Accessed through `entity.behavior`. */
export type BehaviorEntityCollection   = AssetCollection<BehaviorEntity>;
/** All resource-pack entity files. Accessed through `entity.resource`. */
export type ResourceEntityCollection   = AssetCollection<ResourceEntity>;
/** All loot table files, keyed by relative path. Access via `addon.lootTables`. */
export type LootTableCollection        = AssetCollection<LootTable>;
/** All villager trading tables. Access via `addon.trading`. */
export type TradingTableCollection     = AssetCollection<TradingTable>;
/** All biome definitions from the behavior pack. Access via `addon.biomes`. */
export type BiomeCollection            = AssetCollection<Biome>;
/** All animation definitions from the resource pack. Access via `addon.animations`. */
export type AnimationCollection        = AssetCollection<Animation>;
/** All animation controller definitions. Access via `addon.animationControllers`. */
export type AnimationControllerCollection = AssetCollection<AnimationController>;
/** All render controller definitions. Access via `addon.renderControllers`. */
export type RenderControllerCollection = AssetCollection<RenderController>;
/** All particle effect definitions. Access via `addon.particles`. */
export type ParticleCollection         = AssetCollection<Particle>;
/** All attachable definitions. Access via `addon.attachables`. */
export type AttachableCollection       = AssetCollection<Attachable>;
/** All geometry model definitions. Access via `addon.geometries`. */
export type GeometryCollection         = AssetCollection<GeometryModel>;

// ─── Entities ─────────────────────────────────────────────────────────────────
export { Entity, BehaviorEntity, ResourceEntity } from "./entity.js";

// ─── Items & Blocks ───────────────────────────────────────────────────────────
export { Item } from "./item.js";
export { ItemStack } from "./itemStack.js";
export { Block } from "./block.js";

// ─── Recipes ──────────────────────────────────────────────────────────────────
export { Recipe } from "./recipe.js";
export type { RecipeType } from "./types.js";
export { Tag } from "./tag.js";
export type { Ingredient, ShapelessIngredient, FurnaceResolved, BrewingResolved } from "./tag.js";

// ─── World ────────────────────────────────────────────────────────────────────
export { Biome } from "./biome.js";
export { SpawnRule } from "./spawnRule.js";

// ─── Loot & Trading ───────────────────────────────────────────────────────────
export { LootTable } from "./lootTable.js";
export type { LootEntry, LootPool } from "./lootTable.js";
export { TradingTable } from "./tradingTable.js";
export type { Trade, TradeTier, TradeItem } from "./tradingTable.js";

// ─── Visuals ──────────────────────────────────────────────────────────────────
export { Animation, AnimationController } from "./animation.js";
export { RenderController } from "./renderController.js";
export type { RenderControllerMaterial } from "./renderController.js";
export { Particle } from "./particle.js";
export { Attachable } from "./attachable.js";
export { GeometryModel } from "./geometry.js";
export type { GeometryBone } from "./geometry.js";

// ─── Sounds ───────────────────────────────────────────────────────────────────
export { SoundDefinitionsFile, SoundDefinitionEntry } from "./soundDefinitions.js";
export { MusicDefinitionsFile, MusicDefinitionEntry } from "./musicDefinitions.js";
export { SoundsFile, ObjectSoundEvents } from "./sounds.js";
export type { SoundEventBinding } from "./sounds.js";

// ─── Metadata ─────────────────────────────────────────────────────────────────
export { ManifestFile } from "./manifest.js";
export type { ManifestVersion, ManifestDependency, ManifestCapability, PackType } from "./manifest.js";
export { TextureAtlasFile } from "./textureAtlas.js";
export { LangFile } from "./lang.js";

// ─── Internal types (for advanced users) ─────────────────────────────────────
export { AddonLoader } from "./addonLoader.js";
export type { AddonState } from "./addonLoader.js";
export type { SoundFile } from "./types.js";
