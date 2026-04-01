import { Asset } from "./asset.js";
import type { AddOn } from "./addon.js";
import type { Entity } from "./entity.js";

/**
 * Represents a spawn rule file from the behavior pack's `spawn_rules/` directory.
 * Spawn rules define when and where an entity can naturally spawn in the world.
 *
 * Access via `entity.spawnRule` on a unified {@link Entity}.
 *
 * @example
 * ```ts
 * const entity = addon.entities.get("minecraft:zombie");
 * console.log(entity?.spawnRule?.biomeTags);  // ["monster", "overworld"]
 * console.log(entity?.spawnRule?.entity?.id); // "minecraft:zombie"
 * ```
 */
export class SpawnRule extends Asset {
  /** The namespaced entity identifier this spawn rule applies to, e.g. `"minecraft:zombie"`. */
  readonly id: string;

  private readonly _addon: AddOn;

  constructor(id: string, filePath: string, data: Record<string, unknown>, rawText: string, addon: AddOn) {
    super(filePath, data, rawText);
    this.id = id;
    this._addon = addon;
  }

  /**
   * The unified entity this spawn rule belongs to.
   * `undefined` if the entity is not present in the addon.
   */
  get entity(): Entity | undefined {
    return this._addon.entities.get(this.id);
  }

  /**
   * All biome tag values referenced in this spawn rule's `minecraft:biome_filter`
   * conditions. Used to match biomes — e.g. `"monster"`, `"savanna"`, `"mesa"`.
   * Deduplicated.
   */
  get biomeTags(): string[] {
    const inner = (this.data["minecraft:spawn_rules"] as Record<string, unknown>) ?? {};
    const conditions = Array.isArray(inner["conditions"])
      ? (inner["conditions"] as Record<string, unknown>[]) : [];
    const tags: string[] = [];
    for (const cond of conditions) {
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
