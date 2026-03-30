import { Asset } from "./asset.js";

/**
 * Wraps the `sounds/music_definitions.json` file.
 *
 * Access via `addon.music`.
 *
 * @example
 * ```ts
 * const entry = addon.music?.get("bamboo_jungle");
 * console.log(entry?.eventName); // "music.overworld.bamboo_jungle"
 * ```
 */
export class MusicDefinitionsFile extends Asset {
  private _definitions: Map<string, MusicDefinitionEntry>;

  constructor(filePath: string, data: Record<string, unknown>, rawText: string) {
    super(filePath, data, rawText);
    this._definitions = this._parseDefinitions(data);
  }

  private _parseDefinitions(data: Record<string, unknown>): Map<string, MusicDefinitionEntry> {
    const map = new Map<string, MusicDefinitionEntry>();
    for (const [id, entry] of Object.entries(data)) {
      map.set(id, new MusicDefinitionEntry(id, entry as Record<string, unknown>, this));
    }
    return map;
  }

  /**
   * Returns a single music definition by its context key, or `undefined` if not found.
   * @example `addon.music?.get("bamboo_jungle")`
   */
  get(id: string): MusicDefinitionEntry | undefined {
    return this._definitions.get(id);
  }

  /** Returns all music definitions as an array. */
  all(): MusicDefinitionEntry[] {
    return [...this._definitions.values()];
  }

  /** Returns all music definition IDs (context keys) in this file. */
  get ids(): string[] {
    return [...this._definitions.keys()];
  }

  /** Returns the number of music definitions. */
  get size(): number {
    return this._definitions.size;
  }
}

/**
 * A single entry from `music_definitions.json`.
 */
export class MusicDefinitionEntry {
  /** The context key, e.g. `"bamboo_jungle"`, `"game"`, `"menu"`. */
  readonly id: string;
  /** The sound event ID to play, e.g. `"music.overworld.bamboo_jungle"`. */
  readonly eventName: string;
  /** Minimum seconds before music starts. */
  readonly minDelay: number;
  /** Maximum seconds before music starts. */
  readonly maxDelay: number;
  private readonly _parentFile: MusicDefinitionsFile;

  constructor(id: string, data: Record<string, unknown>, parentFile: MusicDefinitionsFile) {
    this.id = id;
    this._parentFile = parentFile;
    this.eventName = (data["event_name"] as string) ?? "";
    this.minDelay = (data["min_delay"] as number) ?? 0;
    this.maxDelay = (data["max_delay"] as number) ?? 0;
  }

  /** Returns the parent `MusicDefinitionsFile` that this entry belongs to. */
  get parentFile(): MusicDefinitionsFile {
    return this._parentFile;
  }
}
