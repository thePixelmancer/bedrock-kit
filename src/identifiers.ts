// ─── Recipe ingredient parsing ────────────────────────────────────────────────

/**
 * Parse a raw ingredient value from a recipe key or ingredients array entry
 * into a prefixed identifier string.
 *   item  → "minecraft:stick"
 *   tag   → "tag:minecraft:planks"
 *   empty → ""
 */
export function parseIngredient(raw: unknown): string {
  if (!raw) return "";
  if (typeof raw === "string") return raw;
  const r = raw as Record<string, unknown>;
  if (typeof r["tag"] === "string") return `tag:${r["tag"]}`;
  if (typeof r["item"] === "string") return r["item"] as string;
  return "";
}

// ─── Shared identifier extraction ────────────────────────────────────────────

export function extractIdentifier(data: Record<string, unknown>, rootKey: string): string | null {
  const root = data[rootKey] as Record<string, unknown> | undefined;
  if (!root) return null;
  const desc = root["description"] as Record<string, unknown> | undefined;
  return (desc?.["identifier"] as string) ?? (root["identifier"] as string) ?? null;
}

// ─── Namespace stripping ──────────────────────────────────────────────────────

/** Strips the namespace from an identifier, e.g. "minecraft:zombie" -> "zombie". */
export function shortname(identifier: string): string {
  return identifier.includes(":") ? identifier.split(":")[1] : identifier;
}
