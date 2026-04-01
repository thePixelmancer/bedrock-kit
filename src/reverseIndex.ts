/**
 * Lazy reverse-lookup indexes built once per addon, stored in AddonState.
 * Each map is computed on first access and cached — never recomputed.
 *
 * Without this, properties like `item.entities` or `lootTable.sourceEntities`
 * would scan entire collections on every call, resulting in O(n) work per access.
 */
import type { AddOn } from "./addon.js";
import type { Recipe } from "./recipe.js";
import type { Entity } from "./entity.js";
import type { Block } from "./block.js";
import type { Item } from "./item.js";
import type { FeatureRule } from "./featureRule.js";

export class ReverseIndex {
  private readonly _addon: AddOn;

  private _itemToRecipes?: Map<string, Recipe[]>;
  private _itemToEntities?: Map<string, Entity[]>;
  private _itemToBlocks?: Map<string, Block[]>;
  private _lootTableToEntities?: Map<string, Entity[]>;
  private _lootTableToBlocks?: Map<string, Block[]>;
  private _featureToRules?: Map<string, FeatureRule[]>;
  private _textureToBlocks?: Map<string, Block[]>;
  private _textureToItems?: Map<string, Item[]>;
  private _textureToEntities?: Map<string, Entity[]>;

  constructor(addon: AddOn) {
    this._addon = addon;
  }

  /** All recipes whose result is the given item ID. */
  getRecipesForItem(itemId: string): Recipe[] {
    return (this._itemToRecipes ??= this._buildItemToRecipes()).get(itemId) ?? [];
  }

  /** All entities that can drop the given item ID via their loot tables. */
  getEntitiesForItem(itemId: string): Entity[] {
    return (this._itemToEntities ??= this._buildItemToEntities()).get(itemId) ?? [];
  }

  /** All blocks that drop the given item ID via their loot table. */
  getBlocksForItem(itemId: string): Block[] {
    return (this._itemToBlocks ??= this._buildItemToBlocks()).get(itemId) ?? [];
  }

  /** All entities that reference the given loot table ID. */
  getEntitiesForLootTable(lootTableId: string): Entity[] {
    return (this._lootTableToEntities ??= this._buildLootTableToEntities()).get(lootTableId) ?? [];
  }

  /** All blocks that reference the given loot table ID. */
  getBlocksForLootTable(lootTableId: string): Block[] {
    return (this._lootTableToBlocks ??= this._buildLootTableToBlocks()).get(lootTableId) ?? [];
  }

  /** All feature rules that place the given feature ID. */
  getRulesForFeature(featureId: string): FeatureRule[] {
    return (this._featureToRules ??= this._buildFeatureToRules()).get(featureId) ?? [];
  }

  /** All blocks that use the given texture path. */
  getBlocksForTexture(textureId: string): Block[] {
    return (this._textureToBlocks ??= this._buildTextureToBlocks()).get(textureId) ?? [];
  }

  /** All items that use the given texture path. */
  getItemsForTexture(textureId: string): Item[] {
    return (this._textureToItems ??= this._buildTextureToItems()).get(textureId) ?? [];
  }

  /** All entities whose RP texture definitions include the given texture path. */
  getEntitiesForTexture(textureId: string): Entity[] {
    return (this._textureToEntities ??= this._buildTextureToEntities()).get(textureId) ?? [];
  }

  // ── Builders ──────────────────────────────────────────────────────────────

  private _buildItemToRecipes(): Map<string, Recipe[]> {
    const map = new Map<string, Recipe[]>();
    for (const recipe of this._addon._recipeStore) {
      const id = recipe.result?.id;
      if (!id) continue;
      _push(map, id, recipe);
    }
    return map;
  }

  private _buildItemToEntities(): Map<string, Entity[]> {
    const map = new Map<string, Entity[]>();
    for (const entity of this._addon._entityStore.values()) {
      for (const lt of entity.lootTables) {
        for (const itemId of lt.itemIds) {
          _push(map, itemId, entity);
        }
      }
    }
    return map;
  }

  private _buildItemToBlocks(): Map<string, Block[]> {
    const map = new Map<string, Block[]>();
    for (const block of this._addon._blockStore.values()) {
      const lt = block.lootTable;
      if (!lt) continue;
      for (const itemId of lt.itemIds) {
        _push(map, itemId, block);
      }
    }
    return map;
  }

  private _buildLootTableToEntities(): Map<string, Entity[]> {
    const map = new Map<string, Entity[]>();
    for (const entity of this._addon._entityStore.values()) {
      for (const lt of entity.lootTables) {
        _push(map, lt.id, entity);
      }
    }
    return map;
  }

  private _buildLootTableToBlocks(): Map<string, Block[]> {
    const map = new Map<string, Block[]>();
    for (const block of this._addon._blockStore.values()) {
      const lt = block.lootTable;
      if (!lt) continue;
      _push(map, lt.id, block);
    }
    return map;
  }

  private _buildFeatureToRules(): Map<string, FeatureRule[]> {
    const map = new Map<string, FeatureRule[]>();
    for (const rule of this._addon._featureRuleStore.values()) {
      const id = rule.placesFeatureId;
      if (!id) continue;
      _push(map, id, rule);
    }
    return map;
  }

  private _buildTextureToBlocks(): Map<string, Block[]> {
    const map = new Map<string, Block[]>();
    for (const block of this._addon._blockStore.values()) {
      const id = block.texture?.id;
      if (id) _push(map, id, block);
    }
    return map;
  }

  private _buildTextureToItems(): Map<string, Item[]> {
    const map = new Map<string, Item[]>();
    for (const item of this._addon._itemStore.values()) {
      const id = item.texture?.id;
      if (id) _push(map, id, item);
    }
    return map;
  }

  private _buildTextureToEntities(): Map<string, Entity[]> {
    const map = new Map<string, Entity[]>();
    for (const entity of this._addon._entityStore.values()) {
      const resource = entity.resource;
      if (!resource) continue;
      const desc = (resource.data["minecraft:client_entity"] as Record<string, unknown> | undefined)
        ?.["description"] as Record<string, unknown> | undefined;
      const textureMap = desc?.["textures"] as Record<string, string> | undefined;
      if (textureMap) {
        for (const path of Object.values(textureMap)) {
          _push(map, path, entity);
        }
      }
      const spawnEgg = desc?.["spawn_egg"] as Record<string, unknown> | undefined;
      const spawnEggTexture = spawnEgg?.["texture"] as string | undefined;
      if (spawnEggTexture) _push(map, spawnEggTexture, entity);
    }
    return map;
  }
}

function _push<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const arr = map.get(key);
  if (arr) arr.push(value);
  else map.set(key, [value]);
}
