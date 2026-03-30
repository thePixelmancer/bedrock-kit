# bedrock-kit — API Reference

`bedrock-kit` is a TypeScript library for reading and navigating Minecraft Bedrock Edition addon files. It works in both Node.js and browsers.

---

## Loading

```ts
import { AddOn } from "bedrock-kit";

// Node.js — reads BP and RP directories from disk
const addon = await AddOn.fromDisk("./behavior_pack", "./resource_pack");
const addon = await AddOn.fromDisk("./behavior_pack"); // RP is optional

// Browser — pass File[] arrays from folder pickers
const addon = await AddOn.fromFiles(bpFiles, rpFiles);
```

---

## Top-Level Collections

All collections on `addon` are `AssetCollection<T>` — a typed, iterable map wrapper.

| Property | Type | Contents |
|---|---|---|
| `addon.items` | `AssetCollection<Item>` | BP item definitions |
| `addon.blocks` | `AssetCollection<Block>` | BP block definitions |
| `addon.entities` | `AssetCollection<Entity>` | Unified BP+RP entity views |
| `addon.recipes` | `AssetCollection<Recipe>` | BP recipe files |
| `addon.lootTables` | `AssetCollection<LootTable>` | BP loot table files |
| `addon.trading` | `AssetCollection<TradingTable>` | BP villager trading tables |
| `addon.biomes` | `AssetCollection<Biome>` | BP biome definitions |
| `addon.animations` | `AssetCollection<Animation>` | RP animation definitions |
| `addon.animationControllers` | `AssetCollection<AnimationController>` | RP animation controllers |
| `addon.renderControllers` | `AssetCollection<RenderController>` | RP render controllers |
| `addon.particles` | `AssetCollection<Particle>` | RP particle effects |
| `addon.geometries` | `AssetCollection<GeometryModel>` | RP geometry models |
| `addon.attachables` | `AssetCollection<Attachable>` | RP attachable definitions |
| `addon.sounds` | `SoundDefinitionsFile \| undefined` | RP `sound_definitions.json` |
| `addon.music` | `MusicDefinitionsFile \| undefined` | RP `music_definitions.json` |
| `addon.bpManifest` | `ManifestFile \| undefined` | BP `manifest.json` |
| `addon.rpManifest` | `ManifestFile \| undefined` | RP `manifest.json` |
| `addon.languages` | `{ get(lang?): LangFile \| undefined }` | Localization files |

---

## AssetCollection\<T\>

All top-level collections share the same interface.

```ts
// Lookup
collection.get("minecraft:zombie")   // T | undefined
collection.has("minecraft:zombie")   // boolean
collection.size                      // number

// Iteration
collection.all()                     // T[]
collection.keys()                    // IterableIterator<string>
collection.values()                  // IterableIterator<T>
collection.entries()                 // IterableIterator<[string, T]>
for (const x of collection) { }
[...collection]

// Functional helpers — all return T[] or AssetCollection<T>
collection.filter(fn)
collection.map(fn)
collection.find(fn)
collection.some(fn)
collection.every(fn)
collection.reduce(fn, init)
collection.groupBy(fn)               // Record<K, T[]>
```

Collections are keyed by the asset's `id`:
- Most assets: namespaced identifier, e.g. `"minecraft:zombie"`
- Recipes: `description.identifier` from the JSON, e.g. `"minecraft:copper_spear"` (falls back to filename without extension)
- Loot tables: relative file path from BP root, e.g. `"loot_tables/entities/zombie.json"`
- Trading tables: filename, e.g. `"economy_trade_table.json"`

---

## Item

```ts
const item = addon.items.get("minecraft:copper_spear"); // Item | undefined

item.id           // "minecraft:copper_spear"
item.displayName  // "Copper Spear" — en_US lang lookup, falls back to id
item.texturePath  // "textures/items/copper_spear" | undefined
item.attachable   // Attachable | undefined
item.recipes      // Recipe[] — recipes whose result is this item
item.entities     // Entity[] — entities that can drop this item via loot tables
item.droppedByBlocks // Block[] — blocks that drop this item via loot table

// Raw JSON when needed
item.data         // Record<string, unknown>
item.filePath     // absolute path to the BP item file
```

---

## Block

```ts
const block = addon.blocks.get("minecraft:coal_ore"); // Block | undefined

block.id          // "minecraft:coal_ore"
block.displayName // "Coal Ore"
block.texturePath // "textures/blocks/coal_ore" | undefined
block.lootTable   // LootTable | undefined
block.soundEvents // SoundEventBinding[]

block.data        // raw JSON
block.filePath    // absolute path
```

---

## Entity

`Entity` is a logical grouping — it is not itself file-backed. Raw data lives on `.behavior` and `.resource`.

```ts
const entity = addon.entities.get("minecraft:zombie"); // Entity | undefined

entity.id           // "minecraft:zombie"
entity.displayName  // "Zombie"
entity.behavior     // BehaviorEntity | undefined  (BP file)
entity.resource     // ResourceEntity | undefined  (RP file)
entity.spawnRule    // SpawnRule | undefined
entity.lootTables   // LootTable[]
entity.soundEvents  // SoundEventBinding[] — BP + RP merged, BP takes precedence
```

### BehaviorEntity

```ts
entity.behavior.id              // "minecraft:zombie"
entity.behavior.displayName     // "Zombie"
entity.behavior.lootTables      // LootTable[]
entity.behavior.spawnRule       // SpawnRule | undefined
entity.behavior.soundEvents     // SoundEventBinding[]
entity.behavior.resource        // ResourceEntity | undefined — cross-link
entity.behavior.data            // raw BP entity JSON
entity.behavior.filePath        // absolute path to BP entity file
entity.behavior.documentation   // CommentBlock[] — parsed JSDoc from file
```

### ResourceEntity

```ts
entity.resource.id                    // "minecraft:zombie"
entity.resource.displayName           // "Zombie"
entity.resource.animations            // Array<{ shortname: string; animation: Animation }>
entity.resource.animationControllers  // Array<{ shortname: string; controller: AnimationController }>
entity.resource.renderControllers     // RenderController[]
entity.resource.particles             // Array<{ shortname: string; particle: Particle }>
entity.resource.soundEvents           // SoundEventBinding[]
entity.resource.animationShortnames   // Record<string, string> — shortname → full id
entity.resource.particleShortnames    // Record<string, string>
entity.resource.soundShortnames       // Record<string, string>
entity.resource.renderControllerIds   // string[]
entity.resource.behavior              // BehaviorEntity | undefined — cross-link
entity.resource.data                  // raw RP entity JSON
entity.resource.filePath              // absolute path to RP entity file
```

---

## Recipe

Keyed by `description.identifier` from the recipe JSON (e.g. `"minecraft:copper_spear"`). Falls back to filename without extension if the field is absent.

```ts
const recipe = addon.recipes.get("minecraft:copper_spear"); // Recipe | undefined

recipe.id           // "minecraft:copper_spear"
recipe.type         // "shaped" | "shapeless" | "furnace" | "brewing_mix" | "brewing_container" | "unknown"
recipe.result       // ItemStack | undefined
recipe.ingredients  // (Item | Tag)[] — flat, empty slots excluded

recipe.resolveShape()      // Ingredient[][] | null  — shaped only, 2D grid with nulls for empty slots
recipe.resolveShapeless()  // ShapelessIngredient[] | null
recipe.resolveFurnace()    // FurnaceResolved | null
recipe.resolveBrewing()    // BrewingResolved | null
recipe.usesItem(id)        // boolean
recipe.getAllIngredients()  // (Item | Tag)[]

// Preferred access: item.recipes
const spearRecipes = addon.items.get("minecraft:copper_spear")?.recipes;
```

### ItemStack

```ts
const stack = recipe.result;
stack.id      // "minecraft:copper_spear"
stack.count   // number
stack.item    // Item | undefined  (undefined for vanilla/unknown items)
```

---

## LootTable

Keyed by relative path from BP root (e.g. `"loot_tables/entities/zombie.json"`).

```ts
const table = addon.lootTables.get("loot_tables/entities/zombie.json");

table.id              // "loot_tables/entities/zombie.json"
table.relativePath    // same as id
table.pools           // LootPool[]
table.itemIds         // string[] — all item ids that can drop
table.items           // Item[] — resolved addon items (vanilla excluded)
table.sourceEntities  // Entity[] — entities referencing this table
table.sourceBlocks    // Block[] — blocks referencing this table
```

---

## SpawnRule

```ts
entity.spawnRule.id                // "minecraft:zombie"
entity.spawnRule.biomeTags         // string[]
entity.spawnRule.populationControl // string | undefined
entity.spawnRule.data              // raw JSON
```

---

## Biome

```ts
const biome = addon.biomes.get("minecraft:desert");

biome.id                // "minecraft:desert"
biome.entities          // Entity[] — entities with spawn rules for this biome
biome.musicDefinition   // MusicDefinitionEntry | undefined
biome.data              // raw JSON
```

---

## Sounds

```ts
// sound_definitions.json
const entry = addon.sounds?.get("mob.zombie.say"); // SoundDefinitionEntry | undefined
entry.id        // "mob.zombie.say"
entry.category  // string | undefined
entry.sounds    // string[]
addon.sounds?.all()   // SoundDefinitionEntry[]
addon.sounds?.size    // number

// music_definitions.json
const music = addon.music?.get("music.game");
music.id          // "music.game"
music.eventName   // string
addon.music?.all()
```

### SoundEventBinding

Returned by `entity.soundEvents`, `block.soundEvents`.

```ts
binding.event       // string — e.g. "step", "hurt"
binding.soundId     // string — maps to a sound_definitions.json key
```

---

## Visuals

All visual assets extend `Asset` and expose `id`, `data`, `filePath`, `documentation`.

```ts
addon.animations.get("animation.zombie.walk")
// animation.id, animation.data

addon.animationControllers.get("controller.animation.zombie.general")
addon.renderControllers.get("controller.render.zombie")
addon.particles.get("minecraft:smoke_particle")
addon.geometries.get("geometry.zombie")
addon.attachables.get("minecraft:copper_spear")
```

---

## Languages

```ts
const en = addon.languages.get("en_US"); // LangFile | undefined
en?.get("item.minecraft.stick.name")     // "Stick" | the key if not found
```

---

## Manifests

```ts
addon.bpManifest?.data   // raw manifest JSON
addon.rpManifest?.data
```

---

## File Path Lookup

Resolve any file path to its addon object. Accepts an absolute path or any suffix that uniquely identifies the file (e.g. a relative path or just the filename).

```ts
// Untyped — returns Asset | undefined
const asset = addon.getAssetByPath("entities/zombie.json");

// Typed — pass the class constructor, get back that type or undefined
// Returns undefined if the file is found but is not an instance of the requested class
const entity = addon.getAssetByPath("entities/zombie.json", BehaviorEntity);
//    ^? BehaviorEntity | undefined
const recipe = addon.getAssetByPath("recipes/acacia_chest_boat.json", Recipe);
//    ^? Recipe | undefined
const item   = addon.getAssetByPath("items/copper_spear.json", Item);
//    ^? Item | undefined
```

Matching is case-insensitive. For BP entity files, the linked `ResourceEntity` is also reachable via the same call.

---

## Asset Base Class

All file-backed classes (`Item`, `Block`, `BehaviorEntity`, `ResourceEntity`, `Recipe`, `LootTable`, `Biome`, `SpawnRule`, `Animation`, `AnimationController`, `RenderController`, `Particle`, `Attachable`, `GeometryModel`, `TradingTable`) extend `Asset`:

```ts
asset.filePath       // absolute path to the file (empty string in browser mode)
asset.data           // Record<string, unknown> — raw parsed JSON
asset.documentation  // CommentBlock[] — JSDoc blocks parsed from the source file
```

`Entity` does **not** extend `Asset` — it is a logical view node with no backing file.

---

## TradingTable

```ts
const table = addon.trading.get("economy_trade_table.json");
table.id      // filename
table.tiers   // TradeTier[]
// tier.trades → Trade[]
// trade.gives → TradeItem[], trade.wants → TradeItem[]
```

---

## Tag

Used in recipe ingredients when the ingredient is a tag rather than a specific item.

```ts
ingredient instanceof Tag   // true
ingredient.id               // "minecraft:planks"
```
