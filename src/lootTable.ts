import { Asset } from "./asset.js";
import type { LootEntry, LootPool } from "./types.js";
import type { AddOn } from "./addon.js";
import type { Item } from "./item.js";
import type { Entity } from "./entity.js";
import type { Block } from "./block.js";

export type { LootEntry, LootPool };

/**
 * Represents a loot table file from the behavior pack's `loot_tables/` directory.
 *
 * Access via `addon.lootTables.get(relativePath)`, `entity.lootTables`, or `block.lootTable`.
 *
 * @example
 * ```ts
 * const table = addon.lootTables.get("loot_tables/entities/zombie.json");
 * console.log(table?.itemIds);      // ["minecraft:rotten_flesh", ...]
 * console.log(table?.sourceEntities.map(e => e.id));
 * ```
 */
export class LootTable extends Asset {
  /**
   * The relative path from the behavior pack root, used as the unique key.
   * e.g. `"loot_tables/entities/zombie.json"`.
   */
  readonly id: string;

  private readonly _addon: AddOn;

  constructor(id: string, filePath: string, data: Record<string, unknown>, rawText: string, addon: AddOn) {
    super(filePath, data, rawText);
    this.id = id;
    this._addon = addon;
  }

  /**
   * A flat, deduplicated list of all item identifiers that can drop
   * from this loot table.
   */
  get itemIds(): string[] {
    const raw = this.data["pools"];
    if (!Array.isArray(raw)) return [];
    const ids: string[] = [];
    for (const pool of raw as Record<string, unknown>[]) {
      if (!Array.isArray(pool["entries"])) continue;
      for (const e of pool["entries"] as Record<string, unknown>[]) {
        if ((e["type"] === "item" || e["type"] === undefined) && typeof e["name"] === "string") {
          ids.push(e["name"] as string);
        }
      }
    }
    return [...new Set(ids)];
  }

  /**
   * All custom items (defined in this addon) that can drop from this loot table.
   * Vanilla items are excluded since they are not loaded into the addon.
   */
  get items(): Item[] {
    return this.itemIds.flatMap(id => {
      const item = this._addon.items.get(id);
      return item ? [item] : [];
    });
  }

  /**
   * All unified entities whose behavior definition references this loot table.
   */
  get sourceEntities(): Entity[] {
    return this._addon._reverseIndex.getEntitiesForLootTable(this.id);
  }

  /**
   * All blocks that reference this loot table.
   */
  get sourceBlocks(): Block[] {
    return this._addon._reverseIndex.getBlocksForLootTable(this.id);
  }
}
