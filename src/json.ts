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

/** Reads a file as raw text from disk. Returns null if the file cannot be read. */
export function readRawFromDisk(filePath: string): string | null {
  try { return readFileSync(filePath, "utf8"); } catch { return null; }
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
