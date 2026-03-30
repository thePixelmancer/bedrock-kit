import { Asset } from "./asset.js";

// ─── Types ────────────────────────────────────────────────────────────────────

/** A single bone within a geometry model. */
export interface GeometryBone {
  /** The bone name, e.g. `"head"`, `"body"`, `"rightArm"`. */
  name: string;
  /** The parent bone name, or `undefined` for root bones. */
  parent: string | undefined;
  /** Pivot point `[x, y, z]` for rotation. `undefined` if not specified. */
  pivot: [number, number, number] | undefined;
  /** Rotation `[x, y, z]` in degrees. `undefined` if not specified. */
  rotation: [number, number, number] | undefined;
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
 *
 * Access via `addon.geometries.get(id)`.
 *
 * @example
 * ```ts
 * const geo = addon.geometries.get("geometry.humanoid");
 * console.log(geo?.textureWidth);  // 64
 * console.log(geo?.textureHeight); // 64
 * console.log(geo?.bones.map(b => b.name));
 * ```
 */
export class GeometryModel extends Asset {
  /** The full geometry identifier, e.g. `"geometry.humanoid.custom"`. */
  readonly id: string;
  /** The texture UV width declared in the model's description. */
  readonly textureWidth: number;
  /** The texture UV height declared in the model's description. */
  readonly textureHeight: number;
  /** The visible bounding box width, or `undefined` if unspecified. */
  readonly visibleBoundsWidth: number | undefined;
  /** The visible bounding box height, or `undefined` if unspecified. */
  readonly visibleBoundsHeight: number | undefined;
  /** The bones defined in this model. */
  readonly bones: GeometryBone[];

  constructor(id: string, modelData: Record<string, unknown>, filePath: string, rawText: string) {
    super(filePath, modelData, rawText);
    this.id = id;

    const desc = (modelData["description"] as Record<string, unknown>) ?? {};
    this.textureWidth = (desc["texture_width"] as number) ?? 64;
    this.textureHeight = (desc["texture_height"] as number) ?? 64;
    this.visibleBoundsWidth = typeof desc["visible_bounds_width"] === "number"
      ? (desc["visible_bounds_width"] as number) : undefined;
    this.visibleBoundsHeight = typeof desc["visible_bounds_height"] === "number"
      ? (desc["visible_bounds_height"] as number) : undefined;

    this.bones = this._parseBones(modelData);
  }

  private _parseBones(data: Record<string, unknown>): GeometryBone[] {
    const raw = data["bones"];
    if (!Array.isArray(raw)) return [];
    return raw.map((b: unknown) => {
      const bone = b as Record<string, unknown>;
      return {
        name: (bone["name"] as string) ?? "",
        parent: (bone["parent"] as string) ?? undefined,
        pivot: Array.isArray(bone["pivot"]) ? (bone["pivot"] as [number, number, number]) : undefined,
        rotation: Array.isArray(bone["rotation"]) ? (bone["rotation"] as [number, number, number]) : undefined,
        mirror: (bone["mirror"] as boolean) ?? false,
        neverRender: (bone["neverRender"] as boolean) ?? false,
        data: bone,
      };
    });
  }

  /** Returns the bone with the given name, or `undefined` if not found. */
  getBone(name: string): GeometryBone | undefined {
    return this.bones.find((b) => b.name === name);
  }

  /** Returns all bones that are direct children of the given parent bone name. */
  getChildBones(parentName: string): GeometryBone[] {
    return this.bones.filter((b) => b.parent === parentName);
  }

  /** The root bones — those with no parent declared. */
  get rootBones(): GeometryBone[] {
    return this.bones.filter((b) => b.parent === undefined);
  }
}
