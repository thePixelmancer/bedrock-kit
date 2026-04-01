import { Asset } from "./asset.js";
import type { AddOn } from "./addon.js";
import type { Texture } from "./texture.js";

/**
 * Represents a particle effect definition from the resource pack's `particles/` directory.
 *
 * Access via `addon.particles.get(id)` or through `entity.resource.particles`.
 *
 * @example
 * ```ts
 * const particle = addon.particles.get("minecraft:stunned_emitter");
 * console.log(particle?.texture?.id);  // "textures/particle/particles"
 * ```
 */
export class Particle extends Asset {
  /** The namespaced particle identifier, e.g. `"minecraft:stunned_emitter"`. */
  readonly id: string;
  private readonly _addon: AddOn;

  constructor(id: string, filePath: string, data: Record<string, unknown>, rawText: string, addon: AddOn) {
    super(filePath, data, rawText);
    this.id = id;
    this._addon = addon;
  }

  private get _description(): Record<string, unknown> {
    const inner = (this.data["particle_effect"] as Record<string, unknown>) ?? {};
    return (inner["description"] as Record<string, unknown>) ?? {};
  }

  /**
   * The texture used by this particle effect, resolved from
   * `basic_render_parameters.texture`. `undefined` if not specified or not found.
   */
  get texture(): Texture | undefined {
    const params = this._description["basic_render_parameters"] as Record<string, unknown> | undefined;
    const path = params?.["texture"] as string | undefined;
    return path ? this._addon.textures.get(path) : undefined;
  }
}
