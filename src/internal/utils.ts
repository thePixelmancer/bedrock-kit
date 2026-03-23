import { join, relative } from "node:path";
import { readdirSync, statSync, readFileSync } from "node:fs";

// ─── Disk I/O ─────────────────────────────────────────────────────────────────

export function walkDir(dir: string, filter?: (f: string) => boolean): string[] {
  try { statSync(dir); } catch { return []; }
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walkDir(full, filter));
    else if (!filter || filter(full)) results.push(full);
  }
  return results;
}

export function readJSONFromDisk<T = Record<string, unknown>>(filePath: string): T | null {
  try {
    return JSON.parse(stripComments(readFileSync(filePath, "utf8"))) as T;
  } catch { return null; }
}

// ─── JSON parsing ─────────────────────────────────────────────────────────────

export function stripComments(raw: string): string {
  let result = "";
  let i = 0;
  let inString = false;
  while (i < raw.length) {
    if (raw[i] === '"' && (i === 0 || raw[i - 1] !== "\\")) {
      inString = !inString;
      result += raw[i++];
      continue;
    }
    if (!inString) {
      if (raw[i] === "/" && raw[i + 1] === "/") {
        while (i < raw.length && raw[i] !== "\n") i++;
        continue;
      }
      if (raw[i] === "/" && raw[i + 1] === "*") {
        i += 2;
        while (i < raw.length && !(raw[i] === "*" && raw[i + 1] === "/")) i++;
        i += 2;
        continue;
      }
    }
    result += raw[i++];
  }
  return result;
}

export function parseJSONString<T = Record<string, unknown>>(text: string): T | null {
  try {
    return JSON.parse(stripComments(text)) as T;
  } catch { return null; }
}

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

// ─── Browser file loading ─────────────────────────────────────────────────────

/**
 * A parsed in-memory representation of a pack's files, keyed by their
 * slash-normalised path relative to the pack root.
 * e.g. `"textures/item_texture.json"` → `Record<string, unknown>`
 *
 * Used internally by `AddOn.fromFileList`.
 */
export type PackData = Map<string, Record<string, unknown>>;

/**
 * Read a `File[]` from a browser folder picker and return a `PackData` map.
 * The relative path is taken from `file.webkitRelativePath`, which browsers
 * set automatically when using `<input webkitdirectory>` or `showDirectoryPicker()`.
 * The first path segment (the folder name itself) is stripped so all keys are
 * relative to the pack root, matching what the disk loader produces.
 */
export async function packDataFromFiles(files: File[]): Promise<PackData> {
  const map: PackData = new Map();
  await Promise.all(files.map(async (file) => {
    const rel = file.webkitRelativePath
      ? file.webkitRelativePath.split("/").slice(1).join("/")
      : file.name;
    const text = await file.text();
    const data = parseJSONString(text);
    if (data) map.set(rel, data);
  }));
  return map;
}

// ─── Pack entry helpers ───────────────────────────────────────────────────────

export type PackEntry = { filePath: string; relativePath: string; data: Record<string, unknown> };

export function diskEntries(packRoot: string, subdir: string): PackEntry[] {
  return walkDir(join(packRoot, subdir), (f) => f.endsWith(".json")).flatMap((file) => {
    const data = readJSONFromDisk(file);
    if (!data) return [];
    const relativePath = relative(packRoot, file).replace(/\\/g, "/");
    return [{ filePath: file, relativePath, data }];
  });
}

export function browserEntries(packData: PackData, subdir: string): PackEntry[] {
  const prefix = subdir.endsWith("/") ? subdir : subdir + "/";
  const out: PackEntry[] = [];
  for (const [key, data] of packData) {
    if (key.startsWith(prefix) && key.endsWith(".json"))
      out.push({ filePath: "", relativePath: key, data });
  }
  return out;
}

// ─── Shared identifier extraction ────────────────────────────────────────────

export function extractIdentifier(data: Record<string, unknown>, rootKey: string): string | null {
  const root = data[rootKey] as Record<string, unknown> | undefined;
  if (!root) return null;
  const desc = root["description"] as Record<string, unknown> | undefined;
  return (desc?.["identifier"] as string) ?? (root["identifier"] as string) ?? null;
}

// ─── Namespace stripping ──────────────────────────────────────────────────────

/** Strips the namespace from an identifier, e.g. `"minecraft:zombie"` → `"zombie"`. */
export function shortname(identifier: string): string {
  return identifier.includes(":") ? identifier.split(":")[1] : identifier;
}
