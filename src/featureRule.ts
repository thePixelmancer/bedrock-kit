import { Asset } from "./asset.js";
import type { AddOn } from "./addon.js";
import type { Feature } from "./feature.js";

/**
 * Represents a feature rule definition from the behavior pack's `feature_rules/` directory.
 *
 * Feature rules control where and when world generation features are placed in biomes.
 *
 * Access via `addon.featureRules.get(id)` or through `feature.placedByFeatureRules`.
 *
 * @example
 * ```ts
 * const rule = addon.featureRules.get("tsu_nat:maple_tree_rule");
 * console.log(rule?.placesFeature?.id);  // "tsu_nat:maple_tree"
 * console.log(rule?.placementPass);      // "surface_pass"
 * ```
 */
export class FeatureRule extends Asset {
  /** The namespaced feature rule identifier, e.g. `"tsu_nat:maple_tree_rule"`. */
  readonly id: string;
  private readonly _addon: AddOn;

  constructor(id: string, filePath: string, data: Record<string, unknown>, rawText: string, addon: AddOn) {
    super(filePath, data, rawText);
    this.id = id;
    this._addon = addon;
  }

  private get _inner(): Record<string, unknown> {
    return (this.data["minecraft:feature_rules"] as Record<string, unknown>) ?? {};
  }

  private get _description(): Record<string, unknown> {
    return (this._inner["description"] as Record<string, unknown>) ?? {};
  }

  private get _conditions(): Record<string, unknown> {
    return (this._inner["conditions"] as Record<string, unknown>) ?? {};
  }

  /**
   * The ID of the feature this rule places, from `description.places_feature`.
   * Use {@link placesFeature} for the resolved object.
   */
  get placesFeatureId(): string | undefined {
    return this._description["places_feature"] as string | undefined;
  }

  /**
   * The resolved feature that this rule places.
   * `undefined` if the feature ID is not found in the addon.
   */
  get placesFeature(): Feature | undefined {
    const id = this.placesFeatureId;
    return id ? this._addon.features.get(id) : undefined;
  }

  /**
   * The terrain generation pass in which this feature is placed,
   * e.g. `"after_surface_pass"`, `"pre_surface_pass"`, `"pregeneration_pass"`.
   */
  get placementPass(): string | undefined {
    return this._conditions["placement_pass"] as string | undefined;
  }
}
