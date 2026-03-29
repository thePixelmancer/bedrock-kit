import { Asset } from "./asset.js";

/**
 * Represents a spawn rule file from the behavior pack's `spawn_rules/` directory.
 * Spawn rules define when and where an entity can naturally spawn in the world.
 *
 * @example
 * ```ts
 * const rule = addon.getSpawnRule("minecraft:zombie");
 * console.log(rule?.populationControl); // "monster"
 * console.log(rule?.getBiomeTags());    // ["monster", "overworld"]
 * ```
 */
export class SpawnRule extends Asset {
  /** The namespaced entity identifier this spawn rule applies to, e.g. `"minecraft:zombie"`. */
  readonly identifier: string;
  /**
   * The population control group that limits how many of this entity spawn together.
   * Common values: `"animal"`, `"monster"`, `"ambient"`, `"water_animal"`.
   * Null if not specified.
   */
  readonly populationControl: string | null;
  /** The raw condition objects from the spawn rule. Each condition defines spawn requirements. */
  readonly conditions: Record<string, unknown>[];

  constructor(identifier: string, filePath: string, data: Record<string, unknown>, rawText: string) {
    super(filePath, data, rawText);
    this.identifier = identifier;
    const inner = (data["minecraft:spawn_rules"] as Record<string, unknown>) ?? {};
    const desc = (inner["description"] as Record<string, unknown>) ?? {};
    this.populationControl = (desc["population_control"] as string) ?? null;
    this.conditions = Array.isArray(inner["conditions"])
      ? (inner["conditions"] as Record<string, unknown>[]) : [];
  }

  /**
   * Extracts all biome tag values referenced in this spawn rule's `minecraft:biome_filter`
   * conditions. Tags are used to match biomes — e.g. `"monster"`, `"savanna"`, `"mesa"`.
   *
   * @returns Deduplicated list of biome tag strings.
   *
   * @example
   * ```ts
   * addon.getSpawnRule("minecraft:armadillo")?.getBiomeTags(); // ["savanna", "mesa", "plateau"]
   * ```
   */
  getBiomeTags(): string[] {
    const tags: string[] = [];
    for (const cond of this.conditions) {
      const filter = cond["minecraft:biome_filter"];
      if (!filter) continue;
      const filters = Array.isArray(filter) ? filter : [filter];
      for (const f of filters as Record<string, unknown>[]) {
        if (f["test"] === "has_biome_tag" && typeof f["value"] === "string")
          tags.push(f["value"] as string);
        for (const key of ["all_of", "any_of"]) {
          if (Array.isArray(f[key])) {
            for (const sub of f[key] as Record<string, unknown>[]) {
              if (sub["test"] === "has_biome_tag" && typeof sub["value"] === "string")
                tags.push(sub["value"] as string);
            }
          }
        }
      }
    }
    return [...new Set(tags)];
  }
}
