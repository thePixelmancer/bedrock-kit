import { Asset } from "./asset.js";
import type { AddOn } from "./addon.js";
import type { SoundFile } from "./types.js";
import type { SoundDefinitionEntry } from "./soundDefinitions.js";

/**
 * A sound event binding for a specific entity or block, parsed from `sounds.json`.
 */
export interface SoundEventBinding {
  /** The internal event identifier, e.g. `"hurt"`, `"step"`. */
  event: string;
  /** The sound definition ID to play for this event, e.g. `"mob.zombie.hurt"`. */
  definitionId: string;
  /** The volume modifier (usually 0.0–1.0). */
  volume: number;
  /** The pitch modifier (usually 0.0–1.0). */
  pitch: number;
}

/**
 * A collection of sound events for a specific game object.
 */
export class ObjectSoundEvents {
  private readonly _events = new Map<string, SoundEventBinding>();

  constructor(public readonly id: string) {}

  /** @internal */
  _add(binding: SoundEventBinding) {
    this._events.set(binding.event, binding);
  }

  /** Returns the binding for the given event name, or `undefined`. */
  get(event: string): SoundEventBinding | undefined {
    return this._events.get(event);
  }

  /** All event bindings for this object. */
  get all(): SoundEventBinding[] {
    return Array.from(this._events.values());
  }
}

/**
 * Represents the parsed `sounds.json` file.
 * Used internally to resolve sound events for entities and blocks.
 * Not exposed directly on the addon surface — access events via
 * `entity.soundEvents` or `block.soundEvents`.
 */
export class SoundsFile extends Asset {
  private readonly _entitySounds = new Map<string, ObjectSoundEvents>();
  private readonly _blockSounds = new Map<string, ObjectSoundEvents>();

  constructor(filePath: string, data: Record<string, unknown>, rawText: string) {
    super(filePath, data, rawText);
    this._parse();
  }

  /** @internal */
  _linkAddon(_addon: AddOn) { /* kept for compatibility, no longer needed */ }

  /** Returns sound events for the given entity shortname. */
  getEntitySoundEvents(sn: string): ObjectSoundEvents | undefined {
    return this._entitySounds.get(sn);
  }

  /** Returns sound events for the given block shortname. */
  getBlockSoundEvents(sn: string): ObjectSoundEvents | undefined {
    return this._blockSounds.get(sn);
  }

  /** All entity shortnames that have sound events defined. */
  get entityShortnames(): string[] {
    return Array.from(this._entitySounds.keys());
  }

  /** All block shortnames that have sound events defined. */
  get blockShortnames(): string[] {
    return Array.from(this._blockSounds.keys());
  }

  private _parse() {
    this._parseEntitySounds(this.data["entities"] as Record<string, unknown> | undefined);
    const entitySoundsAlt = this.data["entity_sounds"] as Record<string, unknown> | undefined;
    if (entitySoundsAlt) {
      this._parseEntitySounds(entitySoundsAlt["entities"] as Record<string, unknown> | undefined);
    }
    this._parseBlockSounds(this.data["block_sounds"] as Record<string, unknown> | undefined);
  }

  private _parseEntitySounds(raw: Record<string, unknown> | undefined) {
    if (!raw) return;
    for (const [id, value] of Object.entries(raw)) {
      const events = new ObjectSoundEvents(id);
      const data = value as Record<string, unknown>;
      if (data["events"]) {
        for (const [event, binding] of Object.entries(data["events"] as Record<string, unknown>)) {
          events._add(this._parseBinding(event, binding));
        }
      }
      this._entitySounds.set(id, events);
    }
  }

  private _parseBlockSounds(raw: Record<string, unknown> | undefined) {
    if (!raw) return;
    for (const [id, value] of Object.entries(raw)) {
      const events = new ObjectSoundEvents(id);
      const data = value as Record<string, unknown>;
      for (const [event, binding] of Object.entries(data)) {
        events._add(this._parseBinding(event, binding));
      }
      this._blockSounds.set(id, events);
    }
  }

  private _parseBinding(event: string, binding: unknown): SoundEventBinding {
    if (typeof binding === "string") {
      return { event, definitionId: binding, volume: 1.0, pitch: 1.0 };
    }
    const b = binding as Record<string, unknown>;
    return {
      event,
      definitionId: (b["sound"] as string) ?? "",
      volume: (b["volume"] as number) ?? 1.0,
      pitch: (b["pitch"] as number) ?? 1.0,
    };
  }
}
