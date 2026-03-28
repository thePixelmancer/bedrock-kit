import { Asset } from "./asset";

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
  /** The raw parsed JSON of the particle file. */
  readonly data: Record<string, unknown>;
  /**
   * Absolute path to the particle file on disk.
   * Empty string when loaded from browser `File[]`.
   */
  readonly filePath: string;

  constructor(identifier: string, data: Record<string, unknown>, filePath: string, rawText: string) {
    super(rawText);
    this.identifier = identifier;
    this.data = data;
    this.filePath = filePath;
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
