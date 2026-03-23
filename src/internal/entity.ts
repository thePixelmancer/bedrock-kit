import type { AddOn } from "./addon.js";
import type { LootTable } from "./lootTable.js";
import type { SpawnRule } from "./spawnRule.js";
import type { Animation, AnimationController } from "./animation.js";
import type { RenderController } from "./renderController.js";
import type { Particle } from "./particle.js";
import type { SoundEvent } from "./sound.js";
import { shortname } from "./utils.js";

/**
 * Represents an entity that exists across both packs — a behavior (server-side)
 * definition and optionally a resource (client-side) definition.
 *
 * @example
 * ```ts
 * const zombie = addon.getEntity("minecraft:zombie");
 * zombie?.getLootTables();        // LootTable[]
 * zombie?.getSpawnRule();         // SpawnRule | null
 * zombie?.getAnimations();        // [{ shortname, animation }]
 * zombie?.getRenderControllers(); // RenderController[]
 * ```
 */
export class Entity {
  /** The namespaced entity identifier, e.g. `"minecraft:zombie"`. */
  readonly identifier: string;
  /** Raw parsed JSON of the behavior pack (server-side) entity file. */
  readonly behaviorData: Record<string, unknown>;
  /**
   * Absolute path to the behavior file on disk.
   * Empty string if no behavior file exists or when loaded from browser `File[]`.
   */
  readonly behaviorFilePath: string;
  /** Raw parsed JSON of the resource pack (client-side) entity file. Null if not present. */
  readonly resourceData: Record<string, unknown> | null;
  /**
   * Absolute path to the resource file on disk. Null if not present.
   * Empty string when loaded from browser `File[]`.
   */
  readonly resourceFilePath: string | null;

  private readonly _addon: AddOn;

  constructor(
    identifier: string,
    behaviorData: Record<string, unknown>,
    behaviorFilePath: string,
    resourceData: Record<string, unknown> | null,
    resourceFilePath: string | null,
    addon: AddOn,
  ) {
    this.identifier = identifier;
    this.behaviorData = behaviorData;
    this.behaviorFilePath = behaviorFilePath;
    this.resourceData = resourceData;
    this.resourceFilePath = resourceFilePath;
    this._addon = addon;
  }

  private get _rpDescription(): Record<string, unknown> {
    const inner = (this.resourceData?.["minecraft:client_entity"] as Record<string, unknown>) ?? {};
    return (inner["description"] as Record<string, unknown>) ?? {};
  }

  /**
   * The shortname → full animation ID map declared in the resource entity file.
   * @example `{ "move": "animation.humanoid.move" }`
   */
  get animationShortnames(): Record<string, string> {
    return (this._rpDescription["animations"] as Record<string, string>) ?? {};
  }

  /**
   * The shortname → full particle identifier map declared in the resource entity file.
   * @example `{ "stun_particles": "minecraft:stunned_emitter" }`
   */
  get particleShortnames(): Record<string, string> {
    return (this._rpDescription["particle_effects"] as Record<string, string>) ?? {};
  }

  /**
   * The list of render controller IDs declared in the resource entity file.
   */
  get renderControllerIds(): string[] {
    const raw = this._rpDescription["render_controllers"];
    if (!Array.isArray(raw)) return [];
    return (raw as unknown[]).flatMap((entry) => {
      if (typeof entry === "string") return [entry];
      if (typeof entry === "object" && entry !== null)
        return Object.keys(entry as Record<string, unknown>);
      return [];
    });
  }

  /**
   * The shortname → sound event ID map declared in the resource entity file's
   * `description.sounds`. These are per-entity sound bindings separate from
   * the global `sounds.json` mappings.
   *
   * @example `{ "hurt": "mob.zombie.hurt", "step": "mob.zombie.step" }`
   */
  get soundShortnames(): Record<string, string> {
    return (this._rpDescription["sounds"] as Record<string, string>) ?? {};
  }

  /**
   * Returns all loot tables this entity can drop, by recursively searching
   * its behavior data for `minecraft:loot` component entries.
   */
  getLootTables(): LootTable[] {
    return this._collectLootPaths(this.behaviorData).flatMap((p) => {
      const lt = this._addon.getLootTableByPath(p);
      return lt ? [lt] : [];
    });
  }

  /** Returns this entity's spawn rule, or null if none exists. */
  getSpawnRule(): SpawnRule | null {
    return this._addon.getSpawnRule(this.identifier);
  }

  /**
   * Resolves this entity's animation shortnames into `Animation` instances.
   * Animation controller references are excluded — use `getAnimationControllers()` for those.
   */
  getAnimations(): Array<{ shortname: string; animation: Animation }> {
    return Object.entries(this.animationShortnames).flatMap(([sn, fullId]) => {
      if (fullId.startsWith("controller.")) return [];
      const animation = this._addon.getAnimation(fullId);
      return animation ? [{ shortname: sn, animation }] : [];
    });
  }

  /**
   * Resolves this entity's animation controller shortnames into `AnimationController` instances.
   */
  getAnimationControllers(): Array<{ shortname: string; controller: AnimationController }> {
    return Object.entries(this.animationShortnames).flatMap(([sn, fullId]) => {
      if (!fullId.startsWith("controller.animation.")) return [];
      const controller = this._addon.getAnimationController(fullId);
      return controller ? [{ shortname: sn, controller }] : [];
    });
  }

  /** Resolves this entity's render controller IDs into `RenderController` instances. */
  getRenderControllers(): RenderController[] {
    return this.renderControllerIds.flatMap((id) => {
      const rc = this._addon.getRenderController(id);
      return rc ? [rc] : [];
    });
  }

  /** Resolves this entity's particle shortnames into `Particle` instances. */
  getParticles(): Array<{ shortname: string; particle: Particle }> {
    return Object.entries(this.particleShortnames).flatMap(([sn, fullId]) => {
      const particle = this._addon.getParticle(fullId);
      return particle ? [{ shortname: sn, particle }] : [];
    });
  }

  /**
   * Returns the sound events for this entity from `sounds/sounds.json`.
   *
   * The entity identifier is stripped to its shortname for the lookup
   * (e.g. `"minecraft:zombie"` → `"zombie"`).
   *
   * @example
   * ```ts
   * addon.getEntity("minecraft:zombie")?.getSoundEvents()
   *   .map(e => `${e.event} → ${e.definitionId}`);
   * ```
   */
  getSoundEvents(): SoundEvent[] {
    return this._addon.getEntitySoundEvents(shortname(this.identifier));
  }

  private _collectLootPaths(obj: unknown): string[] {
    if (typeof obj !== "object" || obj === null) return [];
    const paths: string[] = [];
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (key === "minecraft:loot" && typeof value === "object" && value !== null) {
        const table = (value as Record<string, unknown>)["table"];
        if (typeof table === "string") paths.push(table);
      }
      paths.push(...this._collectLootPaths(value));
    }
    return [...new Set(paths)];
  }
}
