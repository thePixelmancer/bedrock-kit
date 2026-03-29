import { Asset } from "./asset.js";
import type { LootEntry, LootPool } from "./types.js";
import type { AddOn } from "./addon.js";
import type { BpEntity } from "./entity.js";
import type { Block } from "./block.js";

export type { LootEntry, LootPool };

/**
 * Represents a loot table file from the behavior pack's `loot_tables/` directory.
 * Loot tables define what items drop from entities, blocks, or chests.
 *
 * @example
 * ```ts
 * const lt = addon.getLootTableByPath("loot_tables/entities/zombie.json");
 * console.log(lt?.getItemIdentifiers()); // ["minecraft:rotten_flesh", ...]
 * console.log(lt?.getSourceEntities());   // BpEntity[]
 * console.log(lt?.getSourceBlocks());      // Block[]
 * ```
 */
export class LootTable extends Asset {
  /** The loot table path identifier, e.g. `"loot_tables/entities/zombie.json"`. */
  readonly identifier: string;
  /** The parsed list of loot pools. Each pool rolls independently. */
  readonly pools: LootPool[];

  private readonly _addon: AddOn;

  constructor(identifier: string, filePath: string, data: Record<string, unknown>, rawText: string, addon: AddOn) {
    super(filePath, data, rawText);
    this.identifier = identifier;
    this._addon = addon;
    this.pools = this._parsePools(data);
  }

  /** Path relative to the behavior pack root. Alias for `identifier`. */
  get relativePath(): string { return this.identifier; }

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

  /**
   * Returns all entities that reference this loot table in their `minecraft:loot` component.
   */
  getSourceEntities(): BpEntity[] {
    return this._addon.getAllBpEntities().toArray().filter((entity) =>
      entity.getLootTables().some((lt) => lt.relativePath === this.relativePath)
    );
  }

  /**
   * Returns all blocks that reference this loot table in their `minecraft:loot` component.
   */
  getSourceBlocks(): Block[] {
    return this._addon.getAllBlocks().toArray().filter((block) => {
      const lootPath = block.getLootTable()?.relativePath;
      return lootPath === this.relativePath;
    });
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
