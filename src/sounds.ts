import { Asset } from "./asset.js";
import type { AddOn } from "./addon.js";
import type { SoundDefinitionEntry } from "./soundDefinitions.js";

// ─── SoundsFile ───────────────────────────────────────────────────────────────

/**
 * Wraps the `sounds.json` or `sounds/sounds.json` file.
 * Provides access to entity sound events and block sound events.
 */
export class SoundsFile extends Asset {
  private _entitySounds: Map<string, EntitySoundEvents>;
  private _blockSounds: Map<string, BlockSoundEvents>;
  private _addon: AddOn | null = null;

  constructor(filePath: string, data: Record<string, unknown>, rawText: string) {
    super(filePath, data, rawText);
    this._entitySounds = this._parseEntitySounds(data);
    this._blockSounds = this._parseBlockSounds(data);
  }

  /** @internal Called by AddOn after construction to enable definition resolution. */
  _linkAddon(addon: AddOn): void {
    this._addon = addon;
    for (const e of this._entitySounds.values()) e._linkAddon(addon);
    for (const b of this._blockSounds.values()) b._linkAddon(addon);
  }

  private _parseEntitySounds(data: Record<string, unknown>): Map<string, EntitySoundEvents> {
    const map = new Map<string, EntitySoundEvents>();
    const entitySounds = data["entity_sounds"] as Record<string, unknown> | undefined;
    const entities = entitySounds?.["entities"] as Record<string, unknown> | undefined;
    if (!entities) return map;
    for (const [shortname, entry] of Object.entries(entities)) {
      map.set(shortname, new EntitySoundEvents(shortname, entry as Record<string, unknown>, this));
    }
    return map;
  }

  private _parseBlockSounds(data: Record<string, unknown>): Map<string, BlockSoundEvents> {
    const map = new Map<string, BlockSoundEvents>();
    const blockSounds = data["block_sounds"] as Record<string, unknown> | undefined;
    if (!blockSounds) return map;
    for (const [shortname, entry] of Object.entries(blockSounds)) {
      map.set(shortname, new BlockSoundEvents(shortname, entry as Record<string, unknown>, this));
    }
    return map;
  }

  /**
   * Returns the sound events for an entity shortname, or null if not defined.
   * @example `getEntitySoundEvents("zombie")`
   */
  getEntitySoundEvents(shortname: string): EntitySoundEvents | null {
    return this._entitySounds.get(shortname) ?? null;
  }

  /**
   * Returns the sound events for a block shortname, or null if not defined.
   * @example `getBlockSoundEvents("stone")`
   */
  getBlockSoundEvents(shortname: string): BlockSoundEvents | null {
    return this._blockSounds.get(shortname) ?? null;
  }

  /** Returns all entity shortnames with sound events. */
  get entityShortnames(): string[] {
    return [...this._entitySounds.keys()];
  }

  /** Returns all block shortnames with sound events. */
  get blockShortnames(): string[] {
    return [...this._blockSounds.keys()];
  }
}

// ─── EntitySoundEvents ────────────────────────────────────────────────────────

/**
 * Sound events for a single entity type from `sounds.json`.
 */
export class EntitySoundEvents {
  /** The entity shortname, e.g. `"zombie"`. */
  readonly shortname: string;
  /** The raw entity sound data. */
  readonly data: Record<string, unknown>;
  private _events: Map<string, SoundEventBinding>;
  private readonly _parentFile: SoundsFile;

  constructor(shortname: string, data: Record<string, unknown>, parentFile: SoundsFile) {
    this.shortname = shortname;
    this.data = data;
    this._parentFile = parentFile;
    this._events = this._parseEvents(data["events"] as Record<string, unknown> | undefined);
  }

  /** @internal */
  _linkAddon(addon: AddOn): void {
    for (const b of this._events.values()) b._linkAddon(addon);
  }

  /** Returns the parent `SoundsFile` that this entry belongs to. */
  get parentFile(): SoundsFile { return this._parentFile; }

  private _parseEvents(events: Record<string, unknown> | undefined): Map<string, SoundEventBinding> {
    const map = new Map<string, SoundEventBinding>();
    if (!events) return map;
    for (const [event, value] of Object.entries(events)) {
      map.set(event, new SoundEventBinding(event, value, this._parentFile));
    }
    return map;
  }

  /**
   * Returns a specific sound event binding, or null if not defined.
   * @example `get("ambient")`, `get("death")`, `get("hurt")`
   */
  get(event: string): SoundEventBinding | null {
    return this._events.get(event) ?? null;
  }

  /** Returns all event names for this entity. */
  get eventNames(): string[] { return [...this._events.keys()]; }

  /** Returns all sound event bindings for this entity. */
  get all(): SoundEventBinding[] { return [...this._events.values()]; }
}

// ─── BlockSoundEvents ─────────────────────────────────────────────────────────

/**
 * Sound events for a single block type from `sounds.json`.
 */
export class BlockSoundEvents {
  /** The block shortname, e.g. `"stone"`. */
  readonly shortname: string;
  /** The raw block sound data. */
  readonly data: Record<string, unknown>;
  private _events: Map<string, SoundEventBinding>;
  private readonly _parentFile: SoundsFile;

  constructor(shortname: string, data: Record<string, unknown>, parentFile: SoundsFile) {
    this.shortname = shortname;
    this.data = data;
    this._parentFile = parentFile;
    this._events = this._parseEvents(data["events"] as Record<string, unknown> | undefined);
  }

  /** @internal */
  _linkAddon(addon: AddOn): void {
    for (const b of this._events.values()) b._linkAddon(addon);
  }

  /** Returns the parent `SoundsFile` that this entry belongs to. */
  get parentFile(): SoundsFile { return this._parentFile; }

  private _parseEvents(events: Record<string, unknown> | undefined): Map<string, SoundEventBinding> {
    const map = new Map<string, SoundEventBinding>();
    if (!events) return map;
    for (const [event, value] of Object.entries(events)) {
      map.set(event, new SoundEventBinding(event, value, this._parentFile));
    }
    return map;
  }

  /**
   * Returns a specific sound event binding, or null if not defined.
   * @example `get("break")`, `get("place")`, `get("hit")`
   */
  get(event: string): SoundEventBinding | null {
    return this._events.get(event) ?? null;
  }

  /** Returns all event names for this block. */
  get eventNames(): string[] { return [...this._events.keys()]; }

  /** Returns all sound event bindings for this block. */
  get all(): SoundEventBinding[] { return [...this._events.values()]; }
}

// ─── SoundEventBinding ────────────────────────────────────────────────────────

/**
 * A single sound event binding from `sounds.json`.
 * Can be a plain string definition ID or an object with volume/pitch overrides.
 */
export class SoundEventBinding {
  /** The event name, e.g. `"ambient"`, `"death"`, `"break"`. */
  readonly event: string;
  /**
   * The sound definition ID this event resolves to.
   * Empty string means the event is intentionally silent.
   */
  readonly definitionId: string;
  /** Per-event volume override from `sounds.json`. Null if not specified. */
  readonly volume: number | null;
  /** Per-event pitch override from `sounds.json`. Null if not specified. */
  readonly pitch: number | [number, number] | null;
  private readonly _parentFile: SoundsFile;
  private _addon: AddOn | null = null;

  constructor(event: string, value: unknown, parentFile: SoundsFile) {
    this.event = event;
    this._parentFile = parentFile;
    if (typeof value === "string") {
      this.definitionId = value;
      this.volume = null;
      this.pitch = null;
    } else if (typeof value === "object" && value !== null) {
      const v = value as Record<string, unknown>;
      this.definitionId = (v["sound"] as string) ?? (v["sounds"] as string) ?? "";
      this.volume = typeof v["volume"] === "number" ? (v["volume"] as number) : null;
      this.pitch = Array.isArray(v["pitch"])
        ? (v["pitch"] as [number, number])
        : typeof v["pitch"] === "number" ? (v["pitch"] as number) : null;
    } else {
      this.definitionId = "";
      this.volume = null;
      this.pitch = null;
    }
  }

  /** @internal */
  _linkAddon(addon: AddOn): void {
    this._addon = addon;
  }

  /** Returns the parent `SoundsFile` that this entry belongs to. */
  get parentFile(): SoundsFile { return this._parentFile; }

  /**
   * Resolves the `SoundDefinitionEntry` for this event from `sound_definitions.json`.
   * Returns null if the definition ID is empty or not found.
   *
   * @example
   * ```ts
   * const binding = addon.getBpEntity("minecraft:zombie")
   *   ?.getSoundEvents().find(e => e.event === "ambient");
   * const def = binding?.resolveDefinition();
   * console.log(def?.files[0].name); // "sounds/mob/zombie/say1"
   * ```
   */
  resolveDefinition(): SoundDefinitionEntry | null {
    if (!this.definitionId || !this._addon) return null;
    return this._addon.getSoundDefinition(this.definitionId);
  }
}
