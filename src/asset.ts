import { parse } from "comment-parser";
import type { Block as CommentBlock } from "comment-parser";

export type { CommentBlock };

// ─── Asset ────────────────────────────────────────────────────────────────────

/**
 * Base class for every game-object wrapper in bedrockKit that corresponds to
 * a file on disk (items, blocks, entities, loot tables, animations, etc.).
 *
 * JSDoc-style comment blocks written inside the backing JSON file are parsed
 * eagerly at construction time and exposed as `documentation`. This lets you
 * attach structured docs directly inside your addon JSON files:
 *
 * ```jsonc
 * {
 *   /**
 *    * The ancient guardian. Spawns in deep ocean ruins.
 *    * @author YourName
 *    * @version 2.1.0
 *    *\/
 *   "minecraft:entity": { ... }
 * }
 * ```
 *
 * ```ts
 * const entity = addon.getBpEntity("mypack:guardian");
 * console.log(entity?.documentation[0]?.description);
 * // "The ancient guardian. Spawns in deep ocean ruins."
 * console.log(entity?.documentation[0]?.tags.find(t => t.tag === "version")?.name);
 * // "2.1.0"
 * ```
 */
export abstract class Asset {
  /** Absolute path to the asset's file on disk. Empty string in browser mode. */
  readonly filePath: string;
  /** The raw parsed JSON data of the asset file. */
  readonly data: Record<string, unknown>;
  /**
   * All JSDoc-style comment blocks parsed from this asset's source file,
   * in document order. Empty array when no `/** … *\/` blocks are present.
   */
  readonly documentation: CommentBlock[];

  protected constructor(filePath: string, data: Record<string, unknown>, rawText: string) {
    this.filePath = filePath;
    this.data = data;
    this.documentation = rawText ? parse(rawText) : [];
  }
}

// ─── AssetCollection ──────────────────────────────────────────────────────────

/**
 * A typed, iterable collection of `Asset` instances keyed by a string
 * (typically a namespaced identifier or a relative path).
 *
 * Returned by all `getAll*()` methods on `AddOn`. Provides both map-style
 * lookups and array-style iteration so you can use whichever is convenient
 * without converting between the two.
 *
 * @example
 * ```ts
 * const items = addon.getAllItems();
 *
 * // Map-style lookup — O(1)
 * const spear = items.get("mypack:copper_spear");
 *
 * // Array-style helpers
 * const withTexture = items.filter(i => i.getTexturePath() !== null);
 * const ids = items.map(i => i.identifier);
 *
 * // Grouping by namespace
 * const byNs = items.groupBy(i => i.identifier.split(":")[0]);
 * // { "minecraft": [...], "mypack": [...] }
 *
 * // Iterable
 * for (const item of items) { … }
 * const arr = [...items];
 * ```
 */
export class AssetCollection<T extends Asset> implements Iterable<T> {
  private readonly _map: ReadonlyMap<string, T>;

  /** @internal */
  constructor(map: Map<string, T> | ReadonlyMap<string, T>) {
    this._map = map;
  }

  // ── Map-style ────────────────────────────────────────────────────────────

  /** Returns the asset with the given key, or `undefined` if not present. */
  get(key: string): T | undefined { return this._map.get(key); }

  /** Returns `true` if an asset with the given key exists in this collection. */
  has(key: string): boolean { return this._map.has(key); }

  /** The number of assets in this collection. */
  get size(): number { return this._map.size; }

  /** All keys in insertion order. */
  keys(): IterableIterator<string> { return this._map.keys(); }

  /** All assets in insertion order. */
  values(): IterableIterator<T> { return this._map.values(); }

  /** All `[key, asset]` pairs in insertion order. */
  entries(): IterableIterator<[string, T]> { return this._map.entries(); }

  // ── Array-style ──────────────────────────────────────────────────────────

  /** Returns a plain array of all assets in insertion order. */
  toArray(): T[] { return [...this._map.values()]; }

  /**
   * Returns a new `AssetCollection` containing only assets for which
   * `predicate` returns `true`.
   */
  filter(predicate: (asset: T, key: string) => boolean): AssetCollection<T> {
    const out = new Map<string, T>();
    for (const [k, v] of this._map) if (predicate(v, k)) out.set(k, v);
    return new AssetCollection(out);
  }

  /**
   * Maps each asset to a value and returns the results as a plain array.
   * Use `filter()` when you want to keep the result as an `AssetCollection`.
   */
  map<U>(fn: (asset: T, key: string) => U): U[] {
    const out: U[] = [];
    for (const [k, v] of this._map) out.push(fn(v, k));
    return out;
  }

  /** Returns the first asset satisfying `predicate`, or `undefined`. */
  find(predicate: (asset: T, key: string) => boolean): T | undefined {
    for (const [k, v] of this._map) if (predicate(v, k)) return v;
    return undefined;
  }

  /** Returns `true` if at least one asset satisfies `predicate`. */
  some(predicate: (asset: T, key: string) => boolean): boolean {
    for (const [k, v] of this._map) if (predicate(v, k)) return true;
    return false;
  }

  /** Returns `true` if every asset satisfies `predicate`. */
  every(predicate: (asset: T, key: string) => boolean): boolean {
    for (const [k, v] of this._map) if (!predicate(v, k)) return false;
    return true;
  }

  /**
   * Reduces all assets to a single accumulated value.
   *
   * @example
   * ```ts
   * const totalTiers = addon.getAllTradingTables()
   *   .reduce((sum, t) => sum + t.tiers.length, 0);
   * ```
   */
  reduce<U>(fn: (acc: U, asset: T, key: string) => U, initial: U): U {
    let acc = initial;
    for (const [k, v] of this._map) acc = fn(acc, v, k);
    return acc;
  }

  /**
   * Groups all assets by a derived key. Returns a plain `Record` where each
   * value is an array of assets sharing that group key.
   *
   * @example
   * ```ts
   * // Group items by namespace
   * const byNamespace = addon.getAllItems()
   *   .groupBy(item => item.identifier.split(":")[0]);
   * // { "minecraft": [...], "mypack": [...] }
   *
   * // Group entities by population control group
   * const byPop = addon.getAllBpEntities()
   *   .groupBy(e => e.getSpawnRule()?.populationControl ?? "none");
   * ```
   */
  groupBy<K extends string>(keyFn: (asset: T, key: string) => K): Record<K, T[]> {
    const out = {} as Record<K, T[]>;
    for (const [k, v] of this._map) {
      const group = keyFn(v, k);
      if (!out[group]) out[group] = [];
      out[group].push(v);
    }
    return out;
  }

  // ── Iterable ─────────────────────────────────────────────────────────────

  [Symbol.iterator](): Iterator<T> { return this._map.values(); }
}
