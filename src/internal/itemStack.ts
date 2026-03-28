import type { Item } from "./item";
import type { AddOn } from "./addon";

/**
 * Represents a recipe output — an item definition paired with the number of
 * items produced. Bedrock recipes can yield more than one of an item, e.g.
 * a shaped recipe for `minecraft:stick` produces 4.
 *
 * `item` is null when the result identifier exists in the recipe file but has
 * no corresponding item definition in the behavior pack.
 *
 * @example
 * ```ts
 * const stack = addon.getRecipesFor("minecraft:stick")[0]?.getResultStack();
 * console.log(stack?.item?.identifier); // "minecraft:stick"
 * console.log(stack?.count);            // 4
 * ```
 */
export class ItemStack {
  /** The resolved item definition, or null if not found in the addon. */
  readonly item: Item | null;
  /** The raw identifier string from the recipe file, e.g. `"minecraft:stick"`. */
  readonly identifier: string;
  /** How many items this recipe produces. Always at least 1. */
  readonly count: number;

  constructor(identifier: string, count: number, addon: AddOn) {
    this.identifier = identifier;
    this.count = count;
    this.item = addon.getItem(identifier);
  }
}
