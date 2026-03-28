import { parse } from "comment-parser";
import type { Block as CommentBlock } from "comment-parser";

export type { CommentBlock };

// ─── Asset ────────────────────────────────────────────────────────────────────

/**
 * Base class for every game-object wrapper in bedrockKit that corresponds to
 * a file on disk (items, blocks, entities, loot tables, animations, etc.).
 *
 * Provides `docData` — all JSDoc-style comment blocks parsed from the raw
 * source text of the backing JSON file. This lets you attach structured
 * documentation directly inside your addon JSON files and read it back
 * programmatically:
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
 * const entity = addon.getEntity("mypack:guardian");
 * console.log(entity?.docData[0].description);
 * // "The ancient guardian. Spawns in deep ocean ruins."
 * console.log(entity?.docData[0].tags.find(t => t.tag === "version")?.name);
 * // "2.1.0"
 * ```
 */
export abstract class Asset {
  /**
   * All JSDoc-style comment blocks found in this asset's source JSON file,
   * as returned by `comment-parser`. Empty array when no `/** … *\/` blocks
   * are present in the file.
   *
   * Files can contain multiple comment blocks — for example one at the top of
   * the file and one before each major component section. All are preserved
   * in document order.
   */
  readonly docData: CommentBlock[];

  protected constructor(rawText: string) {
    this.docData = rawText ? parse(rawText) : [];
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
 * const spear = items.get("minecraft:copper_spear");
 *
 * // Array-style helpers
 * const withTexture = items.filter(i => i.getTexturePath() !== null);
 * const ids = items.map(i => i.identifier);
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

  // ── Iterable ─────────────────────────────────────────────────────────────

  [Symbol.iterator](): Iterator<T> { return this._map.values(); }
}
