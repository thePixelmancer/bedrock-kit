import { Asset } from "./asset.js";
import type { AddOn } from "./addon.js";
import type { FeatureRule } from "./featureRule.js";

/** The full JSON root key identifying the type of world generation feature. */
export type FeatureType =
  | "minecraft:single_block_feature"
  | "minecraft:tree_feature"
  | "minecraft:aggregate_feature"
  | "minecraft:scatter_feature"
  | "minecraft:sequence_feature"
  | "minecraft:search_feature"
  | "minecraft:snap_to_surface_feature"
  | "minecraft:growing_plant_feature"
  | "minecraft:multiface_feature"
  | "minecraft:nether_cave_carver_feature"
  | "minecraft:partially_exposed_blob_feature"
  | "minecraft:surface_relative_threshold_feature"
  | "minecraft:cave_carver_feature"
  | "minecraft:fossil_feature"
  | "minecraft:geode_feature"
  | "minecraft:hell_mountain_feature"
  | "minecraft:ore_feature"
  | "minecraft:rect_layout_feature"
  | "minecraft:scan_surface_feature"
  | "minecraft:structure_template_feature"
  | "minecraft:vegetation_patch_feature"
  | "minecraft:weighted_random_feature"
  | string;

/**
 * Represents a world generation feature definition from the behavior pack's `features/` directory.
 *
 * Feature files use various root keys (`minecraft:single_block_feature`,
 * `minecraft:tree_feature`, etc.) — all are parsed and exposed uniformly.
 *
 * Access via `addon.features.get(id)` or through `featureRule.placesFeature`.
 *
 * @example
 * ```ts
 * const feature = addon.features.get("tsu_nat:maple_tree");
 * console.log(feature?.featureType);             // "minecraft:tree_feature"
 * console.log(feature?.placedByFeatureRules.length); // number of rules that place it
 * ```
 */
export class Feature extends Asset {
  /** The namespaced feature identifier, e.g. `"tsu_nat:maple_tree"`. */
  readonly id: string;
  private readonly _addon: AddOn;

  /** The full JSON root key identifying the feature type, e.g. `"minecraft:tree_feature"`. */
  readonly featureType: FeatureType;

  constructor(id: string, filePath: string, data: Record<string, unknown>, rawText: string, addon: AddOn) {
    super(filePath, data, rawText);
    this.id = id;
    this._addon = addon;
    this.featureType = (Object.keys(data).find(k => k.startsWith("minecraft:") && k.endsWith("_feature")) ?? "unknown") as FeatureType;
  }

  /**
   * All feature rules that place this feature.
   */
  get placedByFeatureRules(): FeatureRule[] {
    return this._addon._reverseIndex.getRulesForFeature(this.id);
  }
}
