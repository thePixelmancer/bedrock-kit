import { Asset } from "./asset.js";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * A material binding in a render controller.
 * Bedrock render controllers map material shortnames to Molang expressions.
 */
export interface RenderControllerMaterial {
  /** The bone pattern this material applies to (supports `*` wildcard). */
  bone: string;
  /** The material expression, e.g. `"Material.default"`. */
  material: string;
}

// ─── RenderController ─────────────────────────────────────────────────────────

/**
 * Represents a single render controller loaded from a resource pack
 * `render_controllers/` file. Render controllers define which geometry,
 * materials, and textures are applied to an entity at runtime.
 *
 * Access via `addon.renderControllers.get(id)` or through
 * `entity.resource.renderControllers`.
 *
 * @example
 * ```ts
 * const rc = addon.renderControllers.get("controller.render.zombie");
 * console.log(rc?.geometryExpression); // "Geometry.default"
 * console.log(rc?.textureExpressions); // ["Texture.default"]
 * ```
 */
export class RenderController extends Asset {
  /** The full controller identifier, e.g. `"controller.render.zombie"`. */
  readonly id: string;

  constructor(id: string, data: Record<string, unknown>, filePath: string, rawText: string) {
    super(filePath, data, rawText);
    this.id = id;
  }

  /**
   * The geometry Molang expression declared in this render controller.
   * `undefined` if not declared.
   */
  get geometryExpression(): string | undefined {
    return (this.data["geometry"] as string) ?? undefined;
  }

  /**
   * The list of texture Molang expressions declared in this render controller.
   * Bedrock supports multiple texture layers per controller.
   */
  get textureExpressions(): string[] {
    const raw = this.data["textures"];
    if (!Array.isArray(raw)) return [];
    return raw.filter((t): t is string => typeof t === "string");
  }

  /**
   * The material bindings declared in this render controller.
   * Each entry maps a bone pattern to a material expression.
   */
  get materials(): RenderControllerMaterial[] {
    const raw = this.data["materials"];
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((entry: unknown) => {
      if (typeof entry !== "object" || entry === null) return [];
      const obj = entry as Record<string, string>;
      return Object.entries(obj).map(([bone, material]) => ({ bone, material }));
    });
  }

  /** `true` if this render controller uses array-based texture selection. */
  get usesTextureArrays(): boolean {
    return this.textureExpressions.some((t) => t.startsWith("Array."));
  }

  /** `true` if this render controller uses array-based geometry selection. */
  get usesGeometryArrays(): boolean {
    const geo = this.geometryExpression;
    return geo !== undefined && geo.startsWith("Array.");
  }
}
