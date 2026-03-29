import { join, relative } from "node:path";
import { walkDir, readRawFromDisk, readJSONFromDisk } from "./json.js";
import type { PackData } from "./browser.js";

export type PackEntry = {
  filePath: string;
  relativePath: string;
  data: Record<string, unknown>;
  rawText: string;
};

export function diskEntries(packRoot: string, subdir: string): PackEntry[] {
  return walkDir(join(packRoot, subdir), (f) => f.endsWith(".json")).flatMap((file) => {
    const rawText = readRawFromDisk(file);
    if (!rawText) return [];
    const data = readJSONFromDisk(file);
    if (!data) return [];
    const relativePath = relative(packRoot, file).replace(/\\/g, "/");
    return [{ filePath: file, relativePath, data, rawText }];
  });
}

export function browserEntries(packData: PackData, subdir: string): PackEntry[] {
  const prefix = subdir.endsWith("/") ? subdir : subdir + "/";
  const out: PackEntry[] = [];
  for (const [key, { data, rawText }] of packData) {
    if (key.startsWith(prefix) && key.endsWith(".json"))
      out.push({ filePath: "", relativePath: key, data, rawText });
  }
  return out;
}
