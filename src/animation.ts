import { Asset } from "./asset.js";

/**
 * Represents a single animation definition loaded from a resource pack animation file.
 * Multiple animations are defined per file; each is keyed by its full identifier.
 *
 * Access via `addon.animations.get(id)` or through `entity.resource.animations`.
 */
export class Animation extends Asset {
  /** The full animation identifier, e.g. `"animation.humanoid.move"`. */
  readonly id: string;

  constructor(id: string, data: Record<string, unknown>, filePath: string, rawText: string) {
    super(filePath, data, rawText);
    this.id = id;
  }
}

/**
 * Represents a single animation controller loaded from a resource pack
 * `animation_controllers/` file.
 *
 * Access via `addon.animationControllers.get(id)` or through
 * `entity.resource.animationControllers`.
 */
export class AnimationController extends Asset {
  /** The full controller identifier, e.g. `"controller.animation.zombie.move"`. */
  readonly id: string;

  constructor(id: string, data: Record<string, unknown>, filePath: string, rawText: string) {
    super(filePath, data, rawText);
    this.id = id;
  }
}
