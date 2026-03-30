import { Asset } from "./asset.js";

/**
 * Represents a particle effect definition from the resource pack's `particles/` directory.
 *
 * Access via `addon.particles.get(id)` or through `entity.resource.particles`.
 *
 * @example
 * ```ts
 * const particle = addon.particles.get("minecraft:stunned_emitter");
 * console.log(particle?.texturePath); // "textures/particle/particles"
 * ```
 */
export class Particle extends Asset {
  /** The namespaced particle identifier, e.g. `"minecraft:stunned_emitter"`. */
  readonly id: string;

  constructor(id: string, filePath: string, data: Record<string, unknown>, rawText: string) {
    super(filePath, data, rawText);
    this.id = id;
  }

  private get _description(): Record<string, unknown> {
    const inner = (this.data["particle_effect"] as Record<string, unknown>) ?? {};
    return (inner["description"] as Record<string, unknown>) ?? {};
  }

  /**
   * The texture path used by this particle effect, as defined in
   * `basic_render_parameters.texture`. `undefined` if not specified.
   */
  get texturePath(): string | undefined {
    const params = this._description["basic_render_parameters"] as Record<string, unknown> | undefined;
    return (params?.["texture"] as string) ?? undefined;
  }

  /**
   * The material used by this particle effect, as defined in
   * `basic_render_parameters.material`. `undefined` if not specified.
   */
  get material(): string | undefined {
    const params = this._description["basic_render_parameters"] as Record<string, unknown> | undefined;
    return (params?.["material"] as string) ?? undefined;
  }

  /** The full components object for this particle effect. */
  get components(): Record<string, unknown> {
    const inner = (this.data["particle_effect"] as Record<string, unknown>) ?? {};
    return (inner["components"] as Record<string, unknown>) ?? {};
  }
}
