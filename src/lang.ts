import { Asset } from "./asset.js";

// ─── LangFile ───────────────────────────────────────────────────────────────

/**
 * Wraps a language `.lang` file from the resource pack's `texts/` directory.
 * Provides access to translations for items, blocks, entities, and other keys.
 *
 * @example
 * ```ts
 * const lang = addon.langFile; // defaults to en_US
 * const swordName = lang.get("item.iron_sword.name"); // "Iron Sword"
 * const missing = lang.get("item.doesnt_exist.name"); // "item.doesnt_exist.name" (fallback to key)
 * ```
 */
export class LangFile extends Asset {
  private _translations: Map<string, string>;
  /** The language code, e.g. `"en_US"`, `"fr_CA"`. */
  readonly language: string;

  constructor(filePath: string, language: string, rawText: string) {
    // Lang files don't have JSON data, so we pass empty object
    super(filePath, {}, rawText);
    this.language = language;
    this._translations = this._parse(rawText);
  }

  private _parse(rawText: string): Map<string, string> {
    const map = new Map<string, string>();
    for (const line of rawText.split(/\r?\n/)) {
      const trimmed = line.trim();
      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim();
      if (key) map.set(key, value);
    }
    return map;
  }

  /**
   * Returns the translation for a key, or the key itself if not found.
   * This matches Minecraft's behavior where missing translations show the raw key.
   *
   * @param key - The translation key, e.g. `"item.iron_sword.name"`
   * @returns The translated string, or the key if not found
   */
  get(key: string): string {
    return this._translations.get(key) ?? key;
  }

  /**
   * Returns the translation for a key, or null if not found.
   * Use this when you need to distinguish between missing translations and empty strings.
   *
   * @param key - The translation key
   * @returns The translated string, or null if not found
   */
  getOrNull(key: string): string | null {
    return this._translations.get(key) ?? null;
  }

  /** Returns all translation keys in this file. */
  get keys(): string[] {
    return [...this._translations.keys()];
  }

  /** Returns all translated values in this file. */
  get values(): string[] {
    return [...this._translations.values()];
  }

  /** Returns the number of translations. */
  get size(): number {
    return this._translations.size;
  }

  /**
   * Returns all translations as an object.
   * Useful for serialization or bulk operations.
   */
  toObject(): Record<string, string> {
    return Object.fromEntries(this._translations);
  }
}
