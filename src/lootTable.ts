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
  /** The parsed list of loot pools. */
  readonly pools: LootPool[];

  private readonly _addon: AddOn;

  constructor(id: string, filePath: string, data: Record<string, unknown>, rawText: string, addon: AddOn) {
    super(filePath, data, rawText);
    this.id = id;
    this._addon = addon;
    this.pools = this._parsePools(data);
  }

  /** Alias for `id` — the relative path from the BP root. */
  get relativePath(): string { return this.id; }

  /**
   * A flat, deduplicated list of all item identifiers that can drop
   * from this loot table.
   */
  get itemIds(): string[] {
    const ids: string[] = [];
    for (const pool of this.pools)
      for (const entry of pool.entries)
        if (entry.type === "item" && entry.name) ids.push(entry.name);
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
    return this._addon.entities.all().filter(entity =>
      entity.lootTables.some(lt => lt.id === this.id)
    );
  }

  /**
   * All blocks that reference this loot table.
   */
  get sourceBlocks(): Block[] {
    return this._addon.blocks.all().filter(block =>
      block.lootTable?.id === this.id
    );
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
