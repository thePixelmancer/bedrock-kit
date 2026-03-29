export { AddOn } from "./addon.js";
export type { PackData } from "./browser.js";

export { Asset, AssetCollection } from "./asset.js";
export type { CommentBlock } from "./asset.js";

export type { RecipeType, LootEntry, LootPool, TradeItem, Trade, TradeTier, SoundFile } from "./types.js";

export { Tag } from "./tag.js";
export type { Ingredient, ShapelessIngredient, FurnaceResolved, BrewingResolved } from "./tag.js";

export { LootTable } from "./lootTable.js";
export { SpawnRule } from "./spawnRule.js";
export { TradingTable } from "./tradingTable.js";

export { Item } from "./item.js";
export { ItemStack } from "./itemStack.js";
export { Block } from "./block.js";
export { Biome } from "./biome.js";
export { BpEntity, RpEntity } from "./entity.js";
export type { Entity } from "./entity.js";
export { Recipe } from "./recipe.js";

export { Animation, AnimationController } from "./animation.js";
export { RenderController } from "./renderController.js";
export type { RenderControllerMaterial } from "./renderController.js";
export { Particle } from "./particle.js";
export { Attachable } from "./attachable.js";

export { GeometryModel } from "./geometry.js";
export type { GeometryBone } from "./geometry.js";

export { ManifestFile } from "./manifest.js";
export type { ManifestVersion, ManifestDependency, ManifestCapability, PackType } from "./manifest.js";

// Sound definitions (sound_definitions.json)
export { SoundDefinitionsFile, SoundDefinitionEntry } from "./soundDefinitions.js";

// Music definitions (music_definitions.json)
export { MusicDefinitionsFile, MusicDefinitionEntry } from "./musicDefinitions.js";

// Sounds (sounds.json)
export { SoundsFile, EntitySoundEvents, BlockSoundEvents, SoundEventBinding } from "./sounds.js";

// Texture atlas (item_texture.json + terrain_texture.json)
export { TextureAtlasFile } from "./textureAtlas.js";

// Language files
export { LangFile } from "./lang.js";
