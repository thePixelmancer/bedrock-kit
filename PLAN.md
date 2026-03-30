# bedrock-kit Architecture Plan

## Current State Summary

The library works, tests pass, and the core concepts are solid. The main issues are:
- Inconsistency between namespace objects vs collections at the top level
- Sync constructor vs async browser loader (mixed patterns)
- Method-heavy API (`getTexturePath()`) when getters are more idiomatic for TypeScript libraries
- Internal jargon (`BpEntity`, `RpEntity`) leaking into the public API
- Some awkward access paths (e.g. `addon.world.spawnRules` vs `addon.entities.get().spawnRule`)

---

## Goals for the New API

1. **Consistent loading** — everything is async, both disk and browser
2. **Flat, predictable top-level access** — `addon.items`, `addon.blocks`, `addon.entities`, not namespaces-within-namespaces
3. **Getter-based properties** — no `getXxx()` methods on assets; use plain getters
4. **Friendlier naming** — drop `BpEntity`/`RpEntity`; use `BehaviorEntity`/`ResourceEntity`
5. **Uniform null handling** — always `T | undefined`, never `T | null`
6. **All types exported** — TypeScript consumers can reference every class and interface
7. **Scripting API feel** — usage should feel similar to the Bedrock Scripting API: clean, flat, no surprises
8. **Cross-connections only** — assets only expose properties that link to *other* assets or systems (textures, lang, other asset classes). Internal JSON specifics are accessed via `.data`.

---

## Architecture Decisions

### Entity is a logical view node, not an Asset

`Entity` is a lightweight object that logically groups `BehaviorEntity` and `ResourceEntity`. It is **not** a subclass of `Asset` — it has no single backing file.

- `BehaviorEntity extends Asset` — `filePath`, `data`, `documentation` come from the BP entity file
- `ResourceEntity extends Asset` — `filePath`, `data`, `documentation` come from the RP entity file
- `Entity` holds `id`, `displayName`, and the cross-connections; raw file data is accessed through `entity.behavior.data` or `entity.resource.data`

This keeps the `Asset` hierarchy honest and makes it unambiguous which file's data you're reading.

### Connective tissue files are internal

Files like `sounds.json`, `blocks.json`, `item_texture.json`, `terrain_texture.json` are **implementation details** that power cross-connection resolution. They do not appear on the `addon` surface. Users access their content through the connected assets (`entity.soundEvents`, `block.texturePath`, etc.).

---

## Proposed End-User API

### Loading

```ts
// Disk (Node.js)
const addon = await AddOn.fromDisk("./behavior_pack", "./resource_pack");
const addon = await AddOn.fromDisk("./behavior_pack");           // RP optional
const addon = await AddOn.fromDisk({ bp: "./bp", rp: "./rp" });  // named options

// Browser
const addon = await AddOn.fromFiles(fileList);
```

### Items

```ts
const item = addon.items.get("my_mod:my_sword");  // Item | undefined
item.id           // "my_mod:my_sword"
item.displayName  // string — lang lookup, falls back to lang key "item.namespace:identifier.name"
item.texturePath  // string | undefined
item.attachable   // Attachable | undefined
item.recipes      // Recipe[] — recipes that OUTPUT this item

// item.data → raw JSON for anything not exposed above

addon.items.all()
addon.items.filter(i => i.id.includes("sword"))
for (const item of addon.items) { ... }
[...addon.items]
```

### Blocks

```ts
const block = addon.blocks.get("my_mod:ore");
block.id
block.displayName
block.texturePath   // string | undefined
block.lootTable     // LootTable | undefined
block.soundEvents   // SoundEventBinding[]
```

### Entities

```ts
// Unified view — Entity is a logical node, not an Asset itself
const entity = addon.entities.get("my_mod:boss");  // Entity | undefined
entity.id
entity.displayName
entity.behavior     // BehaviorEntity | undefined  (extends Asset — BP file)
entity.resource     // ResourceEntity | undefined  (extends Asset — RP file)
entity.spawnRule    // SpawnRule | undefined
entity.lootTables   // LootTable[]
entity.soundEvents  // SoundEventBinding[]

// Navigating between sides
entity.behavior.resource   // → ResourceEntity | undefined
entity.resource.behavior   // → BehaviorEntity | undefined

// Raw file data when needed
entity.behavior.data        // BP entity JSON
entity.resource.data        // RP entity JSON
entity.behavior.filePath    // path to BP file
```

### Recipes

```ts
const recipe = addon.recipes.get("namespaced:recipe_id");
addon.recipes.forItem("my_mod:my_sword")            // Recipe[] producing this item
addon.recipes.filter(r => r.usesItem("minecraft:stick"))

recipe.type          // "shaped" | "shapeless" | "furnace" | "brewing_mix" | "brewing_container"
recipe.result        // ItemStack | undefined
recipe.ingredients   // (Item | Tag | null)[]
recipe.usesItem(id)  // boolean

const stack = recipe.result;
stack.item    // Item | undefined  (undefined = vanilla/unknown item)
stack.count   // number
```

### Loot Tables

```ts
const table = addon.lootTables.get(filePath);
table.itemIds        // string[]
table.items          // Item[]  — resolved Item instances
table.sourceEntities // string[]
table.sourceBlocks   // string[]
```

### Biomes

```ts
const biome = addon.biomes.get("minecraft:desert");
biome.id
biome.entities         // Entity[]  — entities with spawn rules for this biome
biome.musicDefinition  // MusicDefinitionEntry | undefined
```

### Sounds

```ts
addon.sounds.get("mob.zombie.hurt")  // SoundDefinitionEntry | undefined
addon.sounds.all()
addon.sounds.size

addon.music.get("music.game")        // MusicDefinitionEntry | undefined
```

### Visuals (advanced)

```ts
addon.animations.get("animation.zombie.walk")
addon.animationControllers.get("controller.animation.zombie.general")
addon.renderControllers.get("controller.render.zombie")
addon.particles.get("minecraft:smoke_particle")
addon.geometries.get("geometry.zombie")
addon.attachables.get("my_mod:my_sword")
```

### Meta

```ts
addon.bpManifest              // ManifestFile | undefined
addon.rpManifest              // ManifestFile | undefined
addon.languages.get("en_US")  // LangFile | undefined
```

### Collections (unchanged — already solid)

```ts
collection.get(id)
collection.has(id)
collection.size
collection.all()        // T[]
collection.keys()
collection.values()
collection.entries()
collection.filter(fn)
collection.map(fn)
collection.find(fn)
collection.some(fn)
collection.every(fn)
collection.reduce(fn, init)
collection.groupBy(fn)
for (const x of collection) { ... }
[...collection]
```

---

## Changes from Current API

| Current | Proposed | Notes |
|---|---|---|
| `new AddOn(bp, rp)` | `await AddOn.fromDisk(bp, rp)` | Always async |
| `AddOn.fromFileList(files)` | `await AddOn.fromFiles(files)` | Rename |
| `addon.entities` (EntityNamespace) | `addon.entities` (AssetCollection\<Entity\>) | Flatten |
| `addon.sounds` (SoundNamespace) | `addon.sounds` + `addon.music` | Split & flatten |
| `addon.visuals.*` | `addon.animations`, `addon.particles`, etc. | Flatten |
| `addon.world.biomes` | `addon.biomes` | Flatten |
| `addon.world.spawnRules` | accessed via `entity.spawnRule` | Removed from surface |
| `addon.meta.manifests.*` | `addon.bpManifest`, `addon.rpManifest` | Flatten |
| `addon.meta.languages` | `addon.languages` | Flatten |
| `addon.loot` | `addon.lootTables` | Rename |
| `item.getTexturePath()` | `item.texturePath` | Getter |
| `item.getDisplayName()` | `item.displayName` | Getter |
| `item.getAttachable()` | `item.attachable` | Getter |
| `item.getRecipes()` | `item.recipes` | Getter |
| `block.getTexturePath()` | `block.texturePath` | Getter |
| `block.getLootTable()` | `block.lootTable` | Getter |
| `block.getSoundEvents()` | `block.soundEvents` | Getter |
| `entity.server` / `.client` | `entity.behavior` / `entity.resource` | Rename |
| `BpEntity` | `BehaviorEntity` | Rename |
| `RpEntity` | `ResourceEntity` | Rename |
| `entity.getLootTables()` | `entity.lootTables` | Getter |
| `entity.getSoundEvents()` | `entity.soundEvents` | Getter |
| `T | null` returns | `T | undefined` | Consistency |
| Connective tissue files on `addon` | Internal only | sounds.json, blocks.json, atlases not exposed |

---

## Implementation Plan

### Phase 1 — Foundation ✅
- [x] Make `AddOn` constructor private; add `AddOn.fromDisk()` and `AddOn.fromFiles()` static async factories
- [x] Rename `BpEntity` → `BehaviorEntity`, `RpEntity` → `ResourceEntity`
- [x] Convert all `getXxx()` methods to getters across `Item`, `Block`, `BehaviorEntity`, `ResourceEntity`, `LootTable`, `SpawnRule`
- [x] Standardize `null` → `undefined` throughout public API

### Phase 2 — Namespace Flattening ✅
- [x] Remove `EntityNamespace`; `addon.entities` becomes `AssetCollection<Entity>` directly
- [x] Remove `SoundNamespace`; expose `addon.sounds` and `addon.music` as flat collections
- [x] Remove `VisualNamespace`; expose `addon.animations`, `addon.animationControllers`, `addon.renderControllers`, `addon.particles`, `addon.geometries`, `addon.attachables` at top level
- [x] Remove `WorldNamespace`; expose `addon.biomes` at top level
- [x] Remove `MetaNamespace`; expose `addon.bpManifest`, `addon.rpManifest`, `addon.languages`
- [x] Rename `addon.loot` → `addon.lootTables`

### Phase 3 — Recipe & Loot Improvements ✅
- [x] Add `addon.recipes.forItem(id)` shorthand
- [x] Resolve `lootTable.items` to actual `Item` instances (not just IDs)

### Phase 4 — Exports & Types ✅
- [x] Audit `bedrockKit.ts` exports — ensure every class and interface is exported
- [x] Add a barrel of type-only exports for TypeScript consumers
- [x] Update JSDoc on all public API surface

### Phase 5 — Docs & Tests ✅
- [x] Update all tests to use new API
- [x] Regenerate TypeDoc docs
