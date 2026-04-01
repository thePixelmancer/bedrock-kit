import { Asset } from "./asset.js";

/**
 * Represents a single render controller loaded from a resource pack
 * `render_controllers/` file.
 *
 * Access via `addon.renderControllers.get(id)` or through
 * `entity.resource.renderControllers`.
 */
export class RenderController extends Asset {
  /** The full controller identifier, e.g. `"controller.render.zombie"`. */
  readonly id: string;

  constructor(id: string, data: Record<string, unknown>, filePath: string, rawText: string) {
    super(filePath, data, rawText);
    this.id = id;
  }
}
