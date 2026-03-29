import { Asset } from "./asset.js";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * A material binding in a render controller.
 * Bedrock render controllers map material shortnames to Molang expressions.
 *
 * @example `{ bone: "*", material: "Material.default" }`
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
 * materials, and textures are applied to an entity at runtime, typically
 * driven by Molang expressions.
 *
 * @example
 * ```ts
 * const rc = addon.getRenderController("controller.render.zombie");
 * console.log(rc?.geometryExpression);
 * // "Geometry.default"
 * console.log(rc?.textureExpressions);
 * // ["Texture.default"]
 * console.log(rc?.materials);
 * // [{ bone: "*", material: "Material.default" }]
 * ```
 */
export class RenderController extends Asset {
  /** The full controller identifier, e.g. `"controller.render.zombie"`. */
  readonly identifier: string;

  constructor(identifier: string, data: Record<string, unknown>, filePath: string, rawText: string) {
    super(filePath, data, rawText);
    this.identifier = identifier;
  }

  /**
   * The geometry Molang expression declared in this render controller.
   * Typically a string like `"Geometry.default"` but can be a conditional
   * Molang expression for variant-based models.
   * Returns null if not declared.
   */
  get geometryExpression(): string | null {
    return (this.data["geometry"] as string) ?? null;
  }

  /**
   * The list of texture Molang expressions declared in this render controller.
   * Bedrock supports multiple texture layers per controller.
   *
   * @example `["Texture.default", "Texture.overlay"]`
   */
  get textureExpressions(): string[] {
    const raw = this.data["textures"];
    if (!Array.isArray(raw)) return [];
    return raw.filter((t): t is string => typeof t === "string");
  }

  /**
   * The material bindings declared in this render controller.
   * Each entry maps a bone pattern to a material expression.
   *
   * @example
   * ```ts
   * rc.materials;
   * // [{ bone: "*", material: "Material.default" }]
   * // [{ bone: "head", material: "Material.translucent" }, { bone: "*", material: "Material.default" }]
   * ```
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

  /**
   * Returns `true` if this render controller uses array-based texture selection
   * (e.g. `Array.skins[query.variant]`). Useful for detecting variant-driven entities.
   */
  get usesTextureArrays(): boolean {
    return this.textureExpressions.some((t) => t.startsWith("Array."));
  }

  /**
   * Returns `true` if this render controller uses array-based geometry selection.
   */
  get usesGeometryArrays(): boolean {
    const geo = this.geometryExpression;
    return geo !== null && geo.startsWith("Array.");
  }
}
