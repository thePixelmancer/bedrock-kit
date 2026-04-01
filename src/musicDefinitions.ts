import { Asset } from "./asset.js";
import type { DefinitionFile } from "./soundDefinitions.js";

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
export class MusicDefinitionsFile extends Asset implements DefinitionFile<MusicDefinitionEntry> {
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
  /** The raw data for this music definition entry. */
  readonly data: Record<string, unknown>;
  /** The sound event ID to play, e.g. `"music.overworld.bamboo_jungle"`. */
  readonly eventName: string;

  constructor(id: string, data: Record<string, unknown>, _parentFile: MusicDefinitionsFile) {
    this.id = id;
    this.data = data;
    this.eventName = (data["event_name"] as string) ?? "";
  }
}
