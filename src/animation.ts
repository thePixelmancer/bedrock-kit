import { Asset } from "./asset.js";

/**
 * Represents a single animation definition loaded from a resource pack animation file.
 * Multiple animations are defined per file; each is keyed by its full identifier.
 *
 * @example
 * ```ts
 * const anim = addon.getAnimation("animation.humanoid.move");
 * console.log(anim?.loop); // true
 * ```
 */
export class Animation extends Asset {
  /** The full animation identifier, e.g. `"animation.humanoid.move"`. */
  readonly identifier: string;

  constructor(identifier: string, data: Record<string, unknown>, filePath: string, rawText: string) {
    super(filePath, data, rawText);
    this.identifier = identifier;
  }

  /** Whether this animation loops. */
  get loop(): boolean { return this.data["loop"] === true; }
}

/**
 * Represents a single animation controller loaded from a resource pack
 * `animation_controllers/` file. Animation controllers manage transitions
 * between animation states for an entity.
 *
 * @example
 * ```ts
 * const ctrl = addon.getAnimationController("controller.animation.zombie.move");
 * console.log(ctrl?.initialState); // "default"
 * console.log(ctrl?.states);       // ["default", "attacking"]
 * ```
 */
export class AnimationController extends Asset {
  /** The full controller identifier, e.g. `"controller.animation.zombie.move"`. */
  readonly identifier: string;

  constructor(identifier: string, data: Record<string, unknown>, filePath: string, rawText: string) {
    super(filePath, data, rawText);
    this.identifier = identifier;
  }

  /** The names of all states defined in this controller. */
  get states(): string[] {
    return Object.keys((this.data["states"] as Record<string, unknown>) ?? {});
  }

  /** The name of the initial state this controller starts in. Null if not specified. */
  get initialState(): string | null {
    return (this.data["initial_state"] as string) ?? null;
  }
}
