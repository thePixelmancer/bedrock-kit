import { Asset } from "./asset.js";
import type { AddOn } from "./addon.js";
import type { LootTable } from "./lootTable.js";
import type { SpawnRule } from "./spawnRule.js";
import type { Animation, AnimationController } from "./animation.js";
import type { RenderController } from "./renderController.js";
import type { Particle } from "./particle.js";
import type { SoundEventBinding } from "./sounds.js";
import { shortname } from "./identifiers.js";

/**
 * Represents a behavior pack entity definition file from the behavior pack's `entities/` directory.
 * Contains server-side logic like components, loot tables, and spawn rules.
 *
 * @example
 * ```ts
 * const zombie = addon.getBpEntity("minecraft:zombie");
 * zombie?.getLootTables();   // LootTable[]
 * zombie?.getSpawnRule();    // SpawnRule | null
 * zombie?.getRpEntity();     // RpEntity | null
 * ```
 */
export class BpEntity extends Asset {
  /** The namespaced entity identifier, e.g. `"minecraft:zombie"`. */
  readonly identifier: string;
  private readonly _addon: AddOn;

  constructor(identifier: string, filePath: string, data: Record<string, unknown>, rawText: string, addon: AddOn) {
    super(filePath, data, rawText);
    this.identifier = identifier;
    this._addon = addon;
  }

  /**
   * Returns the linked resource pack entity for this behavior entity, or null.
   */
  getRpEntity(): RpEntity | null {
    return this._addon.getRpEntity(this.identifier);
  }

  /**
   * Returns the display name for this entity from the language file.
   *
   * @param language - Language code, e.g. `"en_US"`, `"fr_CA"`. Defaults to `"en_US"`.
   */
  getDisplayName(language?: string): string {
    const lang = this._addon.getLangFile(language);
    if (!lang) return this.identifier;
    const [namespace, short] = this.identifier.includes(":")
      ? this.identifier.split(":") : ["minecraft", this.identifier];
    return lang.get(`entity.${namespace}.${short}.name`);
  }

  /**
   * Returns all loot tables this entity can drop, by recursively searching
   * its behavior data for `minecraft:loot` component entries.
   */
  getLootTables(): LootTable[] {
    return this._collectLootPaths(this.data).flatMap((p) => {
      const lt = this._addon.getLootTableByPath(p);
      return lt ? [lt] : [];
    });
  }

  /** Returns this entity's spawn rule, or null if none exists. */
  getSpawnRule(): SpawnRule | null {
    return this._addon.getSpawnRule(this.identifier);
  }

  /**
   * Returns the sound events for this entity from `sounds.json`.
   *
   * @example
   * ```ts
   * addon.getBpEntity("minecraft:zombie")?.getSoundEvents()
   *   .map(e => `${e.event} -> ${e.definitionId}`);
   * ```
   */
  getSoundEvents(): SoundEventBinding[] {
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

/**
 * Represents a resource pack entity definition file from the resource pack's `entity/` directory.
 * Contains client-side presentation data like animations, render controllers, and particles.
 *
 * @example
 * ```ts
 * const zombie = addon.getRpEntity("minecraft:zombie");
 * zombie?.getAnimations();         // [{ shortname, animation }]
 * zombie?.getRenderControllers();  // RenderController[]
 * zombie?.getBpEntity();           // BpEntity | null
 * ```
 */
export class RpEntity extends Asset {
  /** The namespaced entity identifier, e.g. `"minecraft:zombie"`. */
  readonly identifier: string;
  private readonly _addon: AddOn;

  constructor(identifier: string, filePath: string, data: Record<string, unknown>, rawText: string, addon: AddOn) {
    super(filePath, data, rawText);
    this.identifier = identifier;
    this._addon = addon;
  }

  private get _description(): Record<string, unknown> {
    const inner = (this.data["minecraft:client_entity"] as Record<string, unknown>) ?? {};
    return (inner["description"] as Record<string, unknown>) ?? {};
  }

  /**
   * The shortname → full animation ID map declared in the resource entity file.
   * @example `{ "move": "animation.humanoid.move" }`
   */
  get animationShortnames(): Record<string, string> {
    return (this._description["animations"] as Record<string, string>) ?? {};
  }

  /**
   * The shortname → full particle identifier map declared in the resource entity file.
   * @example `{ "stun_particles": "minecraft:stunned_emitter" }`
   */
  get particleShortnames(): Record<string, string> {
    return (this._description["particle_effects"] as Record<string, string>) ?? {};
  }

  /**
   * The list of render controller identifiers declared in the resource entity file.
   */
  get renderControllerIds(): string[] {
    const raw = this._description["render_controllers"];
    if (!Array.isArray(raw)) return [];
    return (raw as unknown[]).flatMap((entry) => {
      if (typeof entry === "string") return [entry];
      if (typeof entry === "object" && entry !== null)
        return Object.keys(entry as Record<string, unknown>);
      return [];
    });
  }

  /**
   * The shortname → sound event ID map from the entity's `description.sounds`.
   * @example `{ "hurt": "mob.zombie.hurt", "step": "mob.zombie.step" }`
   */
  get soundShortnames(): Record<string, string> {
    return (this._description["sounds"] as Record<string, string>) ?? {};
  }

  /**
   * Returns the linked behavior pack entity for this resource entity, or null.
   */
  getBpEntity(): BpEntity | null {
    return this._addon.getBpEntity(this.identifier);
  }

  /**
   * Returns the display name for this entity from the language file.
   *
   * @param language - Language code, e.g. `"en_US"`, `"fr_CA"`. Defaults to `"en_US"`.
   */
  getDisplayName(language?: string): string {
    const lang = this._addon.getLangFile(language);
    if (!lang) return this.identifier;
    const [namespace, short] = this.identifier.includes(":")
      ? this.identifier.split(":") : ["minecraft", this.identifier];
    return lang.get(`entity.${namespace}.${short}.name`);
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

  /** Resolves this entity's render controller identifiers into `RenderController` instances. */
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
   * Returns the sound events for this entity from `sounds.json`.
   *
   * @example
   * ```ts
   * addon.getRpEntity("minecraft:zombie")?.getSoundEvents()
   *   .map(e => `${e.event} -> ${e.definitionId}`);
   * ```
   */
  getSoundEvents(): SoundEventBinding[] {
    return this._addon.getEntitySoundEvents(shortname(this.identifier));
  }
}

/**
 * Alias for `BpEntity`. Prefer `BpEntity` in new code.
 * @alias BpEntity
 */
export type Entity = BpEntity;
