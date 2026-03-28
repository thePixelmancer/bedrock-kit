import { Asset } from "./asset";
import type { LootEntry, LootPool } from "./types";

export type { LootEntry, LootPool };

/**
 * Represents a loot table file from the behavior pack's `loot_tables/` directory.
 * Loot tables define what items drop from entities, blocks, or chests.
 *
 * @example
 * ```ts
 * const lt = addon.getLootTableByPath("loot_tables/entities/zombie.json");
 * console.log(lt?.getItemIdentifiers()); // ["minecraft:rotten_flesh", ...]
 * ```
 */
export class LootTable extends Asset {
  /** The raw parsed JSON of the loot table file. */
  readonly data: Record<string, unknown>;
  /**
   * Absolute path to the loot table file on disk.
   * Empty string when loaded from browser `File[]`.
   */
  readonly filePath: string;
  /** Path relative to the behavior pack root, e.g. `"loot_tables/entities/zombie.json"`. */
  readonly relativePath: string;
  /** The parsed list of loot pools. Each pool rolls independently. */
  readonly pools: LootPool[];

  constructor(data: Record<string, unknown>, filePath: string, relativePath: string, rawText: string) {
    super(rawText);
    this.data = data;
    this.filePath = filePath;
    this.relativePath = relativePath;
    this.pools = this._parsePools(data);
  }

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
