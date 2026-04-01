import { Asset } from "./asset.js";

/**
 * A single named model within a geometry file.
 *
 * Access via `addon.geometries.get(id)`.
 */
export class GeometryModel extends Asset {
  /** The full geometry identifier, e.g. `"geometry.humanoid.custom"`. */
  readonly id: string;

  constructor(id: string, modelData: Record<string, unknown>, filePath: string, rawText: string) {
    super(filePath, modelData, rawText);
    this.id = id;
  }
}
