import { Asset } from "./asset.js";

/**
 * Wraps the `sounds/music_definitions.json` file.
 * Provides access to individual music definitions.
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
   * Returns a single music definition by its context key, or null if not found.
   * @example `get("bamboo_jungle")`
   */
  get(id: string): MusicDefinitionEntry | null {
    return this._definitions.get(id) ?? null;
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
