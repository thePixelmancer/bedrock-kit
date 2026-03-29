import { Asset } from "./asset.js";

// ─── Types ────────────────────────────────────────────────────────────────────

/** A single bone within a geometry model. */
export interface GeometryBone {
  /** The bone name, e.g. `"head"`, `"body"`, `"rightArm"`. */
  name: string;
  /** The parent bone name, or null for root bones. */
  parent: string | null;
  /** Pivot point [x, y, z] for rotation. */
  pivot: [number, number, number] | null;
  /** Rotation [x, y, z] in degrees. */
  rotation: [number, number, number] | null;
  /** Whether this bone is mirrored along the x axis. */
  mirror: boolean;
  /** Whether this bone is never rendered (used as an anchor). */
  neverRender: boolean;
  /** The raw bone data for accessing cubes, locators, etc. */
  data: Record<string, unknown>;
}

// ─── GeometryModel ────────────────────────────────────────────────────────────

/**
 * A single named model within a geometry file.
 * Geometry files can contain multiple models keyed by their identifier.
 *
 * @example
 * ```ts
 * const geo = addon.getGeometry("geometry.humanoid");
 * console.log(geo?.textureWidth);  // 64
 * console.log(geo?.textureHeight); // 64
 * console.log(geo?.bones.map(b => b.name));
 * // ["root", "body", "head", "rightArm", "leftArm", "rightLeg", "leftLeg"]
 * ```
 */
export class GeometryModel extends Asset {
  /** The full geometry identifier, e.g. `"geometry.humanoid.custom"`. */
  readonly identifier: string;
  /** The texture UV width declared in the model's description. */
  readonly textureWidth: number;
  /** The texture UV height declared in the model's description. */
  readonly textureHeight: number;
  /** The visible bounding box as `[width, height]`, or null if unspecified. */
  readonly visibleBoundsWidth: number | null;
  readonly visibleBoundsHeight: number | null;
  /** The bones defined in this model. */
  readonly bones: GeometryBone[];

  constructor(identifier: string, modelData: Record<string, unknown>, filePath: string, rawText: string) {
    super(filePath, modelData, rawText);
    this.identifier = identifier;

    const desc = (modelData["description"] as Record<string, unknown>) ?? {};
    this.textureWidth = (desc["texture_width"] as number) ?? 64;
    this.textureHeight = (desc["texture_height"] as number) ?? 64;
    this.visibleBoundsWidth = typeof desc["visible_bounds_width"] === "number"
      ? (desc["visible_bounds_width"] as number) : null;
    this.visibleBoundsHeight = typeof desc["visible_bounds_height"] === "number"
      ? (desc["visible_bounds_height"] as number) : null;

    this.bones = this._parseBones(modelData);
  }

  private _parseBones(data: Record<string, unknown>): GeometryBone[] {
    const raw = data["bones"];
    if (!Array.isArray(raw)) return [];
    return raw.map((b: unknown) => {
      const bone = b as Record<string, unknown>;
      return {
        name: (bone["name"] as string) ?? "",
        parent: (bone["parent"] as string) ?? null,
        pivot: Array.isArray(bone["pivot"]) ? (bone["pivot"] as [number, number, number]) : null,
        rotation: Array.isArray(bone["rotation"]) ? (bone["rotation"] as [number, number, number]) : null,
        mirror: (bone["mirror"] as boolean) ?? false,
        neverRender: (bone["neverRender"] as boolean) ?? false,
        data: bone,
      };
    });
  }

  /**
   * Returns the bone with the given name, or null if not found.
   *
   * @example
   * ```ts
   * const head = geo.getBone("head");
   * console.log(head?.pivot); // [0, 24, 0]
   * ```
   */
  getBone(name: string): GeometryBone | null {
    return this.bones.find((b) => b.name === name) ?? null;
  }

  /**
   * Returns all bones that are children of the given parent bone name.
   *
   * @example
   * ```ts
   * geo.getChildBones("body");
   * // [{ name: "rightArm", ... }, { name: "leftArm", ... }]
   * ```
   */
  getChildBones(parentName: string): GeometryBone[] {
    return this.bones.filter((b) => b.parent === parentName);
  }

  /**
   * Returns the root bones — those with no parent declared.
   */
  get rootBones(): GeometryBone[] {
    return this.bones.filter((b) => b.parent === null);
  }
}
