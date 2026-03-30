import type { AddOn } from "./addon.js";
import type { Item } from "./item.js";

/**
 * Represents a reference to an item with an optional stack count,
 * as used in recipe results and trade outputs.
 */
export class ItemStack {
  /**
   * The resolved `Item` definition from the addon, or `undefined` if the
   * identifier refers to a vanilla item not present in the pack.
   */
  readonly item: Item | undefined;
  /** The namespaced item identifier, e.g. `"minecraft:copper_spear"`. */
  readonly id: string;
  /** The number of items in the stack. Defaults to `1`. */
  readonly count: number;

  constructor(id: string, count: number, addon: AddOn) {
    this.id = id;
    this.count = count;
    this.item = addon.items.get(id);
  }
}
