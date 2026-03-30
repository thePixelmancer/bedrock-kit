import { Asset } from "./asset.js";
import type { AddOn } from "./addon.js";
import type { LootTable } from "./lootTable.js";
import type { SpawnRule } from "./spawnRule.js";
import type { Animation, AnimationController } from "./animation.js";
import type { RenderController } from "./renderController.js";
import type { Particle } from "./particle.js";
import type { SoundEventBinding } from "./sounds.js";
import { shortname } from "./identifiers.js";

// ─── BehaviorEntity ───────────────────────────────────────────────────────────

/**
 * Represents a behavior pack entity definition file (`entities/` directory).
 * Contains server-side logic: components, events, loot tables, spawn rules.
 *
 * Access via `entity.behavior` on a unified {@link Entity}.
 *
 * @example
 * ```ts
 * const entity = addon.entities.get("minecraft:zombie");
 * console.log(entity?.behavior?.lootTables.map(lt => lt.id));
 * console.log(entity?.behavior?.spawnRule?.populationControl);
 * ```
 */
export class BehaviorEntity extends Asset {
  /** The namespaced entity identifier, e.g. `"minecraft:zombie"`. */
  readonly id: string;
  private readonly _addon: AddOn;

  constructor(id: string, filePath: string, data: Record<string, unknown>, rawText: string, addon: AddOn) {
    super(filePath, data, rawText);
    this.id = id;
    this._addon = addon;
  }

  /** The linked resource pack entity, or `undefined` if none exists. */
  get resource(): ResourceEntity | undefined {
    return this._addon._rpEntityStore.get(this.id);
  }

  /** The display name for this entity from the `en_US` language file. Falls back to the identifier. */
  get displayName(): string {
    const lang = this._addon.getLangFile("en_US");
    if (!lang) return this.id;
    const [namespace, short] = this.id.includes(":")
      ? this.id.split(":") : ["minecraft", this.id];
    return lang.get(`entity.${namespace}.${short}.name`);
  }

  /** All loot tables referenced in this entity's behavior definition. */
  get lootTables(): LootTable[] {
    return this._collectLootPaths(this.data).flatMap(p => {
      const lt = this._addon.lootTables.get(p);
      return lt ? [lt] : [];
    });
  }

  /** The spawn rule for this entity, or `undefined` if none exists. */
  get spawnRule(): SpawnRule | undefined {
    return this._addon._spawnStore.get(this.id);
  }

  /** Sound events for this entity from `sounds.json`. */
  get soundEvents(): SoundEventBinding[] {
    return this._addon._state.sounds?.getEntitySoundEvents(shortname(this.id))?.all ?? [];
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

// ─── ResourceEntity ───────────────────────────────────────────────────────────

/**
 * Represents a resource pack entity definition file (`entity/` directory).
 * Contains client-side rendering data: animations, textures, materials.
 *
 * Access via `entity.resource` on a unified {@link Entity}.
 *
 * @example
 * ```ts
 * const entity = addon.entities.get("minecraft:zombie");
 * console.log(entity?.resource?.animations.map(a => a.animation.id));
 * console.log(entity?.resource?.renderControllers.map(rc => rc.id));
 * ```
 */
export class ResourceEntity extends Asset {
  /** The namespaced entity identifier, e.g. `"minecraft:zombie"`. */
  readonly id: string;
  private readonly _addon: AddOn;

  constructor(id: string, filePath: string, data: Record<string, unknown>, rawText: string, addon: AddOn) {
    super(filePath, data, rawText);
    this.id = id;
    this._addon = addon;
  }

  private get _description(): Record<string, unknown> {
    const inner = (this.data["minecraft:client_entity"] as Record<string, unknown>) ?? {};
    return (inner["description"] as Record<string, unknown>) ?? {};
  }

  /** Map of animation shortname → full animation or controller ID. */
  get animationShortnames(): Record<string, string> {
    return (this._description["animations"] as Record<string, string>) ?? {};
  }

  /** Map of particle shortname → full particle ID. */
  get particleShortnames(): Record<string, string> {
    return (this._description["particle_effects"] as Record<string, string>) ?? {};
  }

  /** The list of render controller IDs used by this entity. */
  get renderControllerIds(): string[] {
    const raw = this._description["render_controllers"];
    if (!Array.isArray(raw)) return [];
    return (raw as unknown[]).flatMap(entry => {
      if (typeof entry === "string") return [entry];
      if (typeof entry === "object" && entry !== null)
        return Object.keys(entry as Record<string, unknown>);
      return [];
    });
  }

  /** Map of sound shortname → sound definition ID. */
  get soundShortnames(): Record<string, string> {
    return (this._description["sounds"] as Record<string, string>) ?? {};
  }

  /** The linked behavior pack entity, or `undefined` if none exists. */
  get behavior(): BehaviorEntity | undefined {
    return this._addon._bpEntityStore.get(this.id);
  }

  /** The display name for this entity from the `en_US` language file. Falls back to the identifier. */
  get displayName(): string {
    const lang = this._addon.getLangFile("en_US");
    if (!lang) return this.id;
    const [namespace, short] = this.id.includes(":")
      ? this.id.split(":") : ["minecraft", this.id];
    return lang.get(`entity.${namespace}.${short}.name`);
  }

  /** Resolved animation definitions referenced by this entity (excludes controllers). */
  get animations(): Array<{ shortname: string; animation: Animation }> {
    return Object.entries(this.animationShortnames).flatMap(([sn, fullId]) => {
      if (fullId.startsWith("controller.")) return [];
      const animation = this._addon.animations.get(fullId);
      return animation ? [{ shortname: sn, animation }] : [];
    });
  }

  /** Resolved animation controller definitions referenced by this entity. */
  get animationControllers(): Array<{ shortname: string; controller: AnimationController }> {
    return Object.entries(this.animationShortnames).flatMap(([sn, fullId]) => {
      if (!fullId.startsWith("controller.animation.")) return [];
      const controller = this._addon.animationControllers.get(fullId);
      return controller ? [{ shortname: sn, controller }] : [];
    });
  }

  /** Resolved render controller definitions used by this entity. */
  get renderControllers(): RenderController[] {
    return this.renderControllerIds.flatMap(id => {
      const rc = this._addon.renderControllers.get(id);
      return rc ? [rc] : [];
    });
  }

  /** Resolved particle definitions referenced by this entity. */
  get particles(): Array<{ shortname: string; particle: Particle }> {
    return Object.entries(this.particleShortnames).flatMap(([sn, fullId]) => {
      const particle = this._addon.particles.get(fullId);
      return particle ? [{ shortname: sn, particle }] : [];
    });
  }

  /** Sound events for this entity from `sounds.json`. */
  get soundEvents(): SoundEventBinding[] {
    return this._addon._state.sounds?.getEntitySoundEvents(shortname(this.id))?.all ?? [];
  }
}

// ─── Entity ───────────────────────────────────────────────────────────────────

/**
 * A unified view of an entity that bridges {@link BehaviorEntity} (server-side),
 * {@link ResourceEntity} (client-side), and {@link SpawnRule} into a single object.
 *
 * `Entity` is not itself a file-backed asset — it is a logical grouping. Raw file
 * data is accessible through `entity.behavior.data` and `entity.resource.data`.
 *
 * Access via `addon.entities.get(id)`.
 *
 * @example
 * ```ts
 * const zombie = addon.entities.get("minecraft:zombie");
 * console.log(zombie?.displayName);                   // "Zombie"
 * console.log(zombie?.behavior?.filePath);            // ".../entities/zombie.json"
 * console.log(zombie?.lootTables.map(lt => lt.id));
 * console.log(zombie?.spawnRule?.populationControl);  // "monster"
 * ```
 */
export class Entity {
  /** The namespaced entity identifier, e.g. `"minecraft:zombie"`. */
  readonly id: string;
  /** The behavior pack (server-side) definition for this entity. `undefined` if not present. */
  readonly behavior: BehaviorEntity | undefined;
  /** The resource pack (client-side) definition for this entity. `undefined` if not present. */
  readonly resource: ResourceEntity | undefined;
  /** The spawn rule for this entity. `undefined` if no spawn rule exists. */
  readonly spawnRule: SpawnRule | undefined;

  constructor(
    id: string,
    behavior: BehaviorEntity | undefined,
    resource: ResourceEntity | undefined,
    spawnRule: SpawnRule | undefined
  ) {
    this.id = id;
    this.behavior = behavior;
    this.resource = resource;
    this.spawnRule = spawnRule;
  }

  /** The display name from the `en_US` language file. Falls back to the identifier. */
  get displayName(): string {
    return this.behavior?.displayName ?? this.resource?.displayName ?? this.id;
  }

  /** All loot tables referenced in this entity's behavior definition. */
  get lootTables(): LootTable[] {
    return this.behavior?.lootTables ?? [];
  }

  /**
   * Sound events for this entity. Behavior-pack events take precedence;
   * resource-pack events fill in any gaps.
   */
  get soundEvents(): SoundEventBinding[] {
    const events = new Map<string, SoundEventBinding>();
    for (const e of this.behavior?.soundEvents ?? []) events.set(e.event, e);
    for (const e of this.resource?.soundEvents ?? []) if (!events.has(e.event)) events.set(e.event, e);
    return [...events.values()];
  }
}
