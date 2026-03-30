import { Asset } from "./asset.js";
import type { AddOn } from "./addon.js";
import type { RecipeType } from "./types.js";
import { Tag } from "./tag.js";
import { ItemStack } from "./itemStack.js";
import { parseIngredient } from "./identifiers.js";
import type { Item } from "./item.js";
import type {
  Ingredient,
  ShapelessIngredient,
  FurnaceResolved,
  BrewingResolved,
} from "./tag.js";

export type { RecipeType };

/**
 * Represents a single recipe file from the behavior pack's `recipes/` directory.
 *
 * Access via `addon.recipes`, `addon.recipes.forItem(id)`, or `item.recipes`.
 *
 * @example
 * ```ts
 * const recipe = addon.recipes.forItem("minecraft:copper_spear")[0];
 * console.log(recipe?.type);           // "shaped"
 * console.log(recipe?.result?.id);     // "minecraft:copper_spear"
 * console.log(recipe?.ingredients);    // [Item, Item, ...]
 * ```
 */
export class Recipe extends Asset {
  /** The recipe identifier from `description.identifier`, e.g. `"minecraft:copper_spear"`. Falls back to the filename without extension if the field is absent. */
  readonly id: string;
  /** The recipe type. */
  readonly type: RecipeType;

  private readonly _addon: AddOn;

  constructor(id: string, filePath: string, data: Record<string, unknown>, rawText: string, addon: AddOn) {
    super(filePath, data, rawText);
    this.id = id;
    this._addon = addon;
    const recipeKey = Object.keys(data).find(k => k.startsWith("minecraft:recipe_"));
    this.type = this._detectType(recipeKey ?? "");
  }

  private _detectType(key: string): RecipeType {
    if (key.includes("shaped") && !key.includes("shapeless")) return "shaped";
    if (key.includes("shapeless")) return "shapeless";
    if (key.includes("furnace")) return "furnace";
    if (key.includes("brewing_mix")) return "brewing_mix";
    if (key.includes("brewing_container")) return "brewing_container";
    return "unknown";
  }

  private get _inner(): Record<string, unknown> {
    const recipeKey = Object.keys(this.data).find(k => k.startsWith("minecraft:recipe_"));
    return recipeKey ? (this.data[recipeKey] as Record<string, unknown>) : {};
  }

  /**
   * The output of this recipe as an {@link ItemStack}, or `undefined` if the
   * recipe has no result (e.g. some brewing recipes).
   */
  get result(): ItemStack | undefined {
    const parsed = this._parseResult(this._inner);
    if (!parsed) return undefined;
    return new ItemStack(parsed.id, parsed.count, this._addon);
  }

  /**
   * All resolved ingredients as a flat array of `Item` or `Tag` instances.
   * For shaped recipes the grid is flattened; empty slots are excluded.
   */
  get ingredients(): Array<Item | Tag> {
    return this.getAllIngredients();
  }

  /**
   * Shaped: resolves the pattern into a 2D grid of `Item | Tag | null`.
   * Returns `null` if this is not a shaped recipe.
   */
  resolveShape(): Ingredient[][] | null {
    if (this.type !== "shaped") return null;
    const inner = this._inner;
    const shape = Array.isArray(inner["pattern"]) ? (inner["pattern"] as string[]) : null;
    if (!shape) return null;
    const keyMap = inner["key"] && typeof inner["key"] === "object" && !Array.isArray(inner["key"])
      ? (inner["key"] as Record<string, unknown>)
      : {};
    const resolved: Record<string, string> = {};
    for (const [symbol, value] of Object.entries(keyMap)) resolved[symbol] = parseIngredient(value);
    return shape.map(row =>
      row.split("").map(char => {
        if (char === " ") return null;
        const raw = resolved[char] ?? "";
        return this._resolveIngredientStr(raw);
      })
    );
  }

  /**
   * Shapeless: returns each ingredient with its required count.
   * Returns `null` if this is not a shapeless recipe.
   */
  resolveShapeless(): ShapelessIngredient[] | null {
    if (this.type !== "shapeless") return null;
    const raw = this._inner["ingredients"];
    if (!Array.isArray(raw)) return [];
    return (raw as Record<string, unknown>[]).flatMap(entry => {
      const ingredient = this._resolveIngredientStr(parseIngredient(entry));
      if (!ingredient) return [];
      return [{ ingredient, count: (entry["count"] as number) ?? 1 }];
    });
  }

  /**
   * Furnace: returns the input and output.
   * Returns `null` if this is not a furnace recipe.
   */
  resolveFurnace(): FurnaceResolved | null {
    if (this.type !== "furnace") return null;
    const inner = this._inner;
    const input = this._resolveIngredientStr(parseIngredient(inner["input"]));
    const output = this._resolveIngredientStr(parseIngredient(inner["output"]));
    if (!input || !output) return null;
    return { input, output };
  }

  /**
   * Brewing: returns the input, reagent, and output.
   * Returns `null` if this is not a brewing recipe.
   */
  resolveBrewing(): BrewingResolved | null {
    if (this.type !== "brewing_mix" && this.type !== "brewing_container") return null;
    const inner = this._inner;
    const input = this._resolveIngredientStr(parseIngredient(inner["input"]));
    const reagent = this._resolveIngredientStr(parseIngredient(inner["reagent"]));
    const output = this._resolveIngredientStr(parseIngredient(inner["output"]));
    if (!input || !reagent || !output) return null;
    return { input, reagent, output };
  }

  /**
   * Returns a flat array of all resolved ingredients (`Item` or `Tag` instances).
   * Empty slots are excluded.
   */
  getAllIngredients(): Array<Item | Tag> {
    return this._allIngredientStrings().flatMap(s => {
      const r = this._resolveIngredientStr(s);
      return r ? [r] : [];
    });
  }

  /** Returns `true` if this recipe uses the given item identifier as an ingredient. */
  usesItem(id: string): boolean {
    return this._allIngredientStrings().some(s => s === id);
  }

  private _resolveIngredientStr(raw: string): Item | Tag | null {
    if (!raw) return null;
    if (raw.startsWith("tag:")) return new Tag(raw.slice(4));
    return this._addon.items.get(raw) ?? new Tag(raw);
  }

  private _parseResult(inner: Record<string, unknown>): { id: string; count: number } | null {
    if (!inner["result"]) return null;
    if (typeof inner["result"] === "string")
      return { id: inner["result"] as string, count: 1 };
    const r = inner["result"] as Record<string, unknown>;
    const id = (r["item"] as string) ?? (r["block"] as string) ?? null;
    if (!id) return null;
    const count = typeof r["count"] === "number" ? (r["count"] as number) : 1;
    return { id, count };
  }

  private _allIngredientStrings(): string[] {
    const inner = this._inner;
    const strs: string[] = [];
    if (inner["key"] && typeof inner["key"] === "object" && !Array.isArray(inner["key"])) {
      for (const v of Object.values(inner["key"] as Record<string, unknown>))
        strs.push(parseIngredient(v));
    }
    if (Array.isArray(inner["ingredients"])) {
      for (const v of inner["ingredients"] as unknown[])
        strs.push(parseIngredient(v));
    }
    for (const field of ["input", "reagent", "output"]) {
      if (inner[field]) strs.push(parseIngredient(inner[field]));
    }
    return strs.filter(Boolean);
  }
}
