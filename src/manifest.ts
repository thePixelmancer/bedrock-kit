import { Asset } from "./asset.js";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Semantic version tuple as declared in `manifest.json`. */
export type ManifestVersion = [number, number, number];

/** A dependency declared in `manifest.json`. */
export interface ManifestDependency {
  /** The UUID of the required pack or module. */
  uuid: string;
  /** The minimum version required. */
  version: ManifestVersion;
}

/** A capability declared in `manifest.json`, e.g. `"chemistry"`, `"raytraced"`. */
export type ManifestCapability = string;

/** The pack type as declared in `manifest.json`. */
export type PackType = "data" | "resources" | "skin_pack" | "world_template";

// ─── ManifestFile ─────────────────────────────────────────────────────────────

/**
 * Wraps a pack's `manifest.json` file.
 * Exposes identity, versioning, dependencies, and capabilities.
 *
 * Accessed via `addon.behaviorManifest` and `addon.resourceManifest`.
 *
 * @example
 * ```ts
 * const bp = addon.behaviorManifest;
 * console.log(bp?.name);       // "My Pack BP"
 * console.log(bp?.version);    // [1, 0, 0]
 * console.log(bp?.uuid);       // "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
 *
 * // Check if the BP depends on the Scripting API
 * const hasScripting = bp?.dependencies.some(d => d.uuid === "b26a4d4c-afdf-4690-88f8-931846312678");
 * ```
 */
export class ManifestFile extends Asset {
  /** The pack display name. */
  readonly name: string;
  /** The pack description. */
  readonly description: string;
  /** The pack UUID (header.uuid). */
  readonly uuid: string;
  /** The pack version (header.version). */
  readonly version: ManifestVersion;
  /** The minimum engine version required (header.min_engine_version). */
  readonly minEngineVersion: ManifestVersion | null;
  /** The pack type as determined by the first module's type. */
  readonly type: PackType | null;
  /** All dependencies declared in the manifest. */
  readonly dependencies: ManifestDependency[];
  /** All capabilities declared in the manifest. */
  readonly capabilities: ManifestCapability[];

  constructor(filePath: string, data: Record<string, unknown>, rawText: string) {
    super(filePath, data, rawText);
    const header = (data["header"] as Record<string, unknown>) ?? {};
    this.name = (header["name"] as string) ?? "";
    this.description = (header["description"] as string) ?? "";
    this.uuid = (header["uuid"] as string) ?? "";
    this.version = this._parseVersion(header["version"]);
    this.minEngineVersion = Array.isArray(header["min_engine_version"])
      ? this._parseVersion(header["min_engine_version"])
      : null;

    const modules = Array.isArray(data["modules"])
      ? (data["modules"] as Record<string, unknown>[])
      : [];
    this.type = modules.length > 0 ? ((modules[0]["type"] as PackType) ?? null) : null;

    const deps = Array.isArray(data["dependencies"])
      ? (data["dependencies"] as Record<string, unknown>[])
      : [];
    this.dependencies = deps.map((d) => ({
      uuid: (d["uuid"] as string) ?? "",
      version: this._parseVersion(d["version"]),
    }));

    const caps = data["capabilities"];
    this.capabilities = Array.isArray(caps) ? (caps as string[]) : [];
  }

  private _parseVersion(raw: unknown): ManifestVersion {
    if (Array.isArray(raw) && raw.length >= 3) {
      return [Number(raw[0]) || 0, Number(raw[1]) || 0, Number(raw[2]) || 0];
    }
    return [0, 0, 0];
  }

  /**
   * Returns the version as a human-readable string, e.g. `"1.2.3"`.
   */
  get versionString(): string {
    return this.version.join(".");
  }

  /**
   * Returns `true` if this pack declares a dependency on the given UUID.
   *
   * @example
   * ```ts
   * // Check for Scripting API dependency
   * bp.dependsOn("b26a4d4c-afdf-4690-88f8-931846312678");
   * ```
   */
  dependsOn(uuid: string): boolean {
    return this.dependencies.some((d) => d.uuid === uuid);
  }

  /**
   * Returns `true` if this pack declares the given capability.
   *
   * @example
   * ```ts
   * rp.hasCapability("raytraced");
   * ```
   */
  hasCapability(capability: ManifestCapability): boolean {
    return this.capabilities.includes(capability);
  }
}
