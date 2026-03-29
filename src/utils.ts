/**
 * @deprecated Import directly from the specific modules instead:
 * - `walkDir`, `readJSONFromDisk`, `readRawFromDisk`, `stripComments`, `parseJSONString` from `./json.js`
 * - `packDataFromFiles`, `PackData` from `./browser.js`
 * - `parseIngredient`, `extractIdentifier`, `shortname` from `./identifiers.js`
 * - `diskEntries`, `browserEntries`, `PackEntry` from `./pack.js`
 *
 * This barrel will be removed in a future version.
 */
export { walkDir, readJSONFromDisk, readRawFromDisk, stripComments, parseJSONString } from "./json.js";
export { packDataFromFiles, type PackData } from "./browser.js";
export { parseIngredient, extractIdentifier, shortname } from "./identifiers.js";
export { diskEntries, browserEntries, type PackEntry } from "./pack.js";
