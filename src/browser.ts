/**
 * A parsed in-memory representation of a pack's files, keyed by their
 * slash-normalised path relative to the pack root.
 * e.g. "textures/item_texture.json" -> { data, rawText }
 *
 * Stores both the parsed JSON object and the original raw file text so that
 * comment-parser can extract any JSDoc blocks written in the file.
 *
 * Used internally by AddOn.fromFileList.
 */
export type PackData = Map<string, { data: Record<string, unknown>; rawText: string }>;

/**
 * Read a File[] from a browser folder picker and return a PackData map.
 * The relative path is taken from file.webkitRelativePath, which browsers
 * set automatically when using <input webkitdirectory> or showDirectoryPicker().
 * The first path segment (the folder name itself) is stripped so all keys are
 * relative to the pack root, matching what the disk loader produces.
 */
export async function packDataFromFiles(files: File[]): Promise<PackData> {
  const map: PackData = new Map();
  await Promise.all(files.map(async (file) => {
    const rel = file.webkitRelativePath
      ? file.webkitRelativePath.split("/").slice(1).join("/")
      : file.name;
    const rawText = await file.text();
    const data = parseJSONString(rawText);
    if (data) map.set(rel, { data, rawText });
  }));
  return map;
}

// Import from json.ts to avoid circular dependency
import { parseJSONString } from "./json.js";
