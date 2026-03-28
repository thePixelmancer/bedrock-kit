import { Asset } from "./asset";
import type { AddOn } from "./addon";
import type { RecipeType } from "./types";
import { Tag } from "./tag";
import { ItemStack } from "./itemStack";
import { parseIngredient } from "./utils";
import type { Item } from "./item";
import type {
  Ingredient,
  ShapelessIngredient,
  FurnaceResolved,
  BrewingResolved,
} from "./tag";

export type { RecipeType };

/**
 * Represents a single recipe file from the behavior pack's `recipes/` directory.
 * Supports shaped, shapeless, furnace, and brewing recipe types.
 *
 * @example
 * ```ts
 * const recipes = addon.getRecipesFor("minecraft:copper_spear");
 * const shaped = recipes.find(r => r.type === "shaped");
 * const grid = shaped?.resolveShape();
 * // grid[0][2] instanceof Item -> true
 * ```
 */
export class Recipe extends Asset {
  /** The raw parsed JSON of the recipe file. */
  readonly data: Record<string, unknown>;
  /** The recipe type as detected from the root JSON key. */
  readonly type: RecipeType;
  /**
   * Pattern rows for shaped recipes, e.g. `["X ", "X ", "X "]`.
   * Null for non-shaped recipes.
   */
  readonly shape: string[] | null;
  /**
   * Raw ingredient data extracted from the recipe file.
   * Prefer the typed resolve methods over reading this directly.
   */
  readonly ingredients: Record<string, string> | string[];

  private readonly _addon: AddOn;

  constructor(data: Record<string, unknown>, addon: AddOn, rawText: string) {
    super(rawText);
    this.data = data;
    this._addon = addon;
    const recipeKey = Object.keys(data).find((k) => k.startsWith("minecraft:recipe_"));
    const inner = recipeKey ? (data[recipeKey] as Record<string, unknown>) : {};
    this.type = this._detectType(recipeKey ?? "");
    this.shape = Array.isArray(inner["pattern"]) ? inner["pattern"] as string[] : null;
    this.ingredients = this._extractIngredients(inner);
  }

  private _detectType(key: string): RecipeType {
    if (key.includes("shaped")) return "shaped";
    if (key.includes("shapeless")) return "shapeless";
    if (key.includes("furnace")) return "furnace";
    if (key.includes("brewing_mix")) return "brewing_mix";
    if (key.includes("brewing_container")) return "brewing_container";
    return "unknown";
  }

  private _extractIngredients(inner: Record<string, unknown>): Record<string, string> | string[] {
    if (inner["key"] && typeof inner["key"] === "object" && !Array.isArray(inner["key"])) {
      const keyMap = inner["key"] as Record<string, unknown>;
      const result: Record<string, string> = {};
      for (const [symbol, value] of Object.entries(keyMap))
        result[symbol] = parseIngredient(value);
      return result;
    }
    if (Array.isArray(inner["ingredients"])) {
      return (inner["ingredients"] as unknown[]).map(parseIngredient);
    }
    return {};
  }

  private _parseResult(inner: Record<string, unknown>): { identifier: string; count: number } | null {
    if (!inner["result"]) return null;
    if (typeof inner["result"] === "string")
      return { identifier: inner["result"] as string, count: 1 };
    const r = inner["result"] as Record<string, unknown>;
    const identifier = (r["item"] as string) ?? (r["block"] as string) ?? null;
    if (!identifier) return null;
    const count = typeof r["count"] === "number" ? (r["count"] as number) : 1;
    return { identifier, count };
  }

  /**
   * Returns the output of this recipe as an `ItemStack`, or null if the recipe
   * has no result (e.g. some brewing recipes).
   */
  getResultStack(): ItemStack | null {
    const recipeKey = Object.keys(this.data).find((k) => k.startsWith("minecraft:recipe_"));
    const inner = recipeKey ? (this.data[recipeKey] as Record<string, unknown>) : {};
    const parsed = this._parseResult(inner);
    if (!parsed) return null;
    return new ItemStack(parsed.identifier, parsed.count, this._addon);
  }

  /** @deprecated Use `getResultStack()` instead. */
  getResultItem(): Item | null {
    return this.getResultStack()?.item ?? null;
  }

  /**
   * Shaped: returns a 2D grid matching the pattern.
   * Each cell is an Item, a Tag, or null for an empty slot.
   * Returns null if this recipe is not shaped.
   */
  resolveShape(): Ingredient[][] | null {
    if (this.type !== "shaped" || !this.shape) return null;
    const keyMap = this.ingredients as Record<string, string>;
    return this.shape.map((row) =>
      row.split("").map((char) => {
        if (char === " ") return null;
        const raw = keyMap[char] ?? "";
        return this._resolveIngredientStr(raw);
      })
    );
  }

  /**
   * Shapeless: returns each ingredient as an Item or Tag with its count.
   * Returns null if this recipe is not shapeless.
   */
  resolveShapeless(): ShapelessIngredient[] | null {
    if (this.type !== "shapeless") return null;
    const recipeKey = Object.keys(this.data).find((k) => k.startsWith("minecraft:recipe_"));
    const inner = recipeKey ? (this.data[recipeKey] as Record<string, unknown>) : {};
    const raw = inner["ingredients"];
    if (!Array.isArray(raw)) return [];
    return (raw as Record<string, unknown>[]).flatMap((entry) => {
      const ingredient = this._resolveIngredientStr(parseIngredient(entry));
      if (!ingredient) return [];
      return [{ ingredient, count: (entry["count"] as number) ?? 1 }];
    });
  }

  /**
   * Furnace: returns input and output as Item or Tag objects.
   * Returns null if this recipe is not a furnace recipe.
   */
  resolveFurnace(): FurnaceResolved | null {
    if (this.type !== "furnace") return null;
    const recipeKey = Object.keys(this.data).find((k) => k.startsWith("minecraft:recipe_"));
    const inner = recipeKey ? (this.data[recipeKey] as Record<string, unknown>) : {};
    const input = this._resolveIngredientStr(parseIngredient(inner["input"]));
    const output = this._resolveIngredientStr(parseIngredient(inner["output"]));
    if (!input || !output) return null;
    return { input, output };
  }

  /**
   * Brewing: returns input, reagent, and output as Item or Tag objects.
   * Returns null if this recipe is not a brewing recipe.
   */
  resolveBrewing(): BrewingResolved | null {
    if (this.type !== "brewing_mix" && this.type !== "brewing_container") return null;
    const recipeKey = Object.keys(this.data).find((k) => k.startsWith("minecraft:recipe_"));
    const inner = recipeKey ? (this.data[recipeKey] as Record<string, unknown>) : {};
    const input = this._resolveIngredientStr(parseIngredient(inner["input"]));
    const reagent = this._resolveIngredientStr(parseIngredient(inner["reagent"]));
    const output = this._resolveIngredientStr(parseIngredient(inner["output"]));
    if (!input || !reagent || !output) return null;
    return { input, reagent, output };
  }

  /**
   * Returns a flat array of all ingredients across the recipe as `Item | Tag` objects.
   * Empty slots are excluded.
   */
  getAllIngredients(): Array<Item | Tag> {
    const strs = this._allIngredientStrings();
    return strs.flatMap((s) => {
      const r = this._resolveIngredientStr(s);
      return r ? [r] : [];
    });
  }

  private _resolveIngredientStr(raw: string): Item | Tag | null {
    if (!raw) return null;
    if (raw.startsWith("tag:")) return new Tag(raw.slice(4));
    return this._addon.getItem(raw) ?? new Tag(raw);
  }

  /** Returns true if this recipe uses the given item identifier as an ingredient. */
  usesItem(identifier: string): boolean {
    return this._allIngredientStrings().some((s) => s === identifier);
  }

  private _allIngredientStrings(): string[] {
    const recipeKey = Object.keys(this.data).find((k) => k.startsWith("minecraft:recipe_"));
    const inner = recipeKey ? (this.data[recipeKey] as Record<string, unknown>) : {};
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
