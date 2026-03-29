import { Asset } from "./asset.js";

/**
 * Represents a particle effect definition from the resource pack's `particles/` directory.
 *
 * @example
 * ```ts
 * const particle = addon.getParticle("minecraft:stunned_emitter");
 * console.log(particle?.texturePath); // "textures/particle/particles"
 * ```
 */
export class Particle extends Asset {
  /** The namespaced particle identifier, e.g. `"minecraft:stunned_emitter"`. */
  readonly identifier: string;

  constructor(identifier: string, filePath: string, data: Record<string, unknown>, rawText: string) {
    super(filePath, data, rawText);
    this.identifier = identifier;
  }

  private get _description(): Record<string, unknown> {
    const inner = (this.data["particle_effect"] as Record<string, unknown>) ?? {};
    return (inner["description"] as Record<string, unknown>) ?? {};
  }

  /**
   * The texture path used by this particle effect, as defined in `basic_render_parameters.texture`.
   * e.g. `"textures/particle/particles"`. Returns null if not specified.
   */
  get texturePath(): string | null {
    const params = this._description["basic_render_parameters"] as Record<string, unknown> | undefined;
    return (params?.["texture"] as string) ?? null;
  }

  /**
   * The material used by this particle effect, as defined in `basic_render_parameters.material`.
   * e.g. `"particles_alpha"`. Returns null if not specified.
   */
  get material(): string | null {
    const params = this._description["basic_render_parameters"] as Record<string, unknown> | undefined;
    return (params?.["material"] as string) ?? null;
  }

  /** The full components object for this particle effect. */
  get components(): Record<string, unknown> {
    const inner = (this.data["particle_effect"] as Record<string, unknown>) ?? {};
    return (inner["components"] as Record<string, unknown>) ?? {};
  }
}
