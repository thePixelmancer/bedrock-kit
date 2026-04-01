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

// ─── Display name resolution ──────────────────────────────────────────────────

/**
 * Resolves a display name from the `en_US` language file.
 *
 * Tries each prefix in order, generating three candidate keys per prefix:
 *   1. `{prefix}.{namespace}.{short}.name`   — e.g. `item.minecraft.stick.name`
 *   2. `{prefix}.{namespace}:{short}.name`   — e.g. `entity.minecraft:zombie.name`
 *   3. `{prefix}.{short}.name`               — e.g. `tile.dirt.name` (legacy/unnamespaced)
 *
 * Falls back to the full identifier if no key resolves.
 *
 * @param lang - The lang file to query. If `null`, falls back to `id` immediately.
 * @param id   - The namespaced identifier, e.g. `"minecraft:stick"`.
 * @param prefixes - Ordered list of lang key prefixes to try, e.g. `["item"]`, `["tile", "block"]`.
 */
export function resolveDisplayName(
  lang: { getOrNull(key: string): string | null } | null,
  id: string,
  prefixes: string[],
): string {
  if (!lang) return id;
  const colonIdx = id.indexOf(":");
  const ns = colonIdx !== -1 ? id.slice(0, colonIdx) : "minecraft";
  const short = colonIdx !== -1 ? id.slice(colonIdx + 1) : id;
  for (const prefix of prefixes) {
    const v =
      lang.getOrNull(`${prefix}.${ns}.${short}.name`) ??
      lang.getOrNull(`${prefix}.${ns}:${short}.name`) ??
      lang.getOrNull(`${prefix}.${short}.name`);
    if (v) return v;
  }
  return id;
}
