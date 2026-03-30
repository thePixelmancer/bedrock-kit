import { Asset } from "./asset.js";
import type { SoundFile } from "./types.js";

// ─── SoundDefinitionsFile ───────────────────────────────────────────────────

/**
 * Wraps the `sounds/sound_definitions.json` file.
 *
 * Access via `addon.sounds`.
 *
 * @example
 * ```ts
 * const entry = addon.sounds?.get("mob.zombie.say");
 * console.log(entry?.category); // "mob"
 * console.log(entry?.files[0].name); // "sounds/mob/zombie/say1"
 * ```
 */
export class SoundDefinitionsFile extends Asset {
  private _definitions: Map<string, SoundDefinitionEntry>;

  constructor(filePath: string, data: Record<string, unknown>, rawText: string) {
    super(filePath, data, rawText);
    this._definitions = this._parseDefinitions(data);
  }

  private _parseDefinitions(data: Record<string, unknown>): Map<string, SoundDefinitionEntry> {
    const map = new Map<string, SoundDefinitionEntry>();
    const defs = data["sound_definitions"] as Record<string, unknown> | undefined;
    if (!defs) return map;
    for (const [id, entry] of Object.entries(defs)) {
      map.set(id, new SoundDefinitionEntry(id, entry as Record<string, unknown>, this));
    }
    return map;
  }

  /**
   * Returns a single sound definition by its event ID, or `undefined` if not found.
   * @example `addon.sounds?.get("mob.zombie.say")`
   */
  get(id: string): SoundDefinitionEntry | undefined {
    return this._definitions.get(id);
  }

  /** Returns all sound definitions as an array. */
  all(): SoundDefinitionEntry[] {
    return [...this._definitions.values()];
  }

  /** Returns all sound definition IDs in this file. */
  get ids(): string[] {
    return [...this._definitions.keys()];
  }

  /** Returns the number of sound definitions. */
  get size(): number {
    return this._definitions.size;
  }
}

/**
 * A single entry from `sound_definitions.json`.
 */
export class SoundDefinitionEntry {
  /** The sound event identifier, e.g. `"mob.zombie.say"`. */
  readonly id: string;
  /** The raw data for this sound definition entry. */
  readonly data: Record<string, unknown>;
  /** The audio category, e.g. `"ambient"`, `"block"`, `"mob"`, `"music"`, `"player"`, `"ui"`. `undefined` if not specified. */
  readonly category: string | undefined;
  /** The parsed list of audio files this definition can play. */
  readonly files: SoundFile[];
  private readonly _parentFile: SoundDefinitionsFile;

  constructor(id: string, data: Record<string, unknown>, parentFile: SoundDefinitionsFile) {
    this.id = id;
    this.data = data;
    this._parentFile = parentFile;
    this.category = (data["category"] as string) ?? undefined;
    this.files = this._parseFiles(data["sounds"]);
  }

  /** Returns the parent `SoundDefinitionsFile` that this entry belongs to. */
  get parentFile(): SoundDefinitionsFile {
    return this._parentFile;
  }

  private _parseFiles(raw: unknown): SoundFile[] {
    if (!Array.isArray(raw)) return [];
    return raw.map((entry) => {
      if (typeof entry === "string") return { name: entry };
      const e = entry as Record<string, unknown>;
      const result: SoundFile = { name: (e["name"] as string) ?? "" };
      if (typeof e["volume"] === "number") result.volume = e["volume"] as number;
      if (typeof e["pitch"] === "number") result.pitch = e["pitch"] as number;
      if (typeof e["weight"] === "number") result.weight = e["weight"] as number;
      if (typeof e["is3D"] === "boolean") result.is3D = e["is3D"] as boolean;
      if (typeof e["stream"] === "boolean") result.stream = e["stream"] as boolean;
      if (typeof e["load_on_low_memory"] === "boolean") result.loadOnLowMemory = e["load_on_low_memory"] as boolean;
      return result;
    });
  }
}
