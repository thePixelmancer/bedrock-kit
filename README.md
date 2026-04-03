# bedrock-kit

> ⚠️ **Experimental:** Version 0.x.x is under active development. APIs may change between patch releases. Pin your version if stability matters.
> Latest version: 0.0.7
A TypeScript library for reading and navigating Minecraft Bedrock Edition addon files programmatically. Works in Node.js and browsers.

## Documentation

Full API documentation is available at [https://thepixelmancer.github.io/bedrock-kit/](https://thepixelmancer.github.io/bedrock-kit/).

## Installation

```bash
npm install bedrock-kit
```

## Quick Start

```ts
import { AddOn } from "bedrock-kit";

// Node.js
const addon = await AddOn.fromDisk("./behavior_pack", "./resource_pack");

// Browser (from folder picker File[] arrays)
const addon = await AddOn.fromFiles(bpFiles, rpFiles);
```

## Features

- **Unified entity and biome views** — `addon.entities.get("minecraft:zombie")` bridges BP and RP files into a single object
- **Reverse lookups** — `item.recipes`, `item.entities`, `lootTable.sourceEntities`, `texture.usedByBlocks` — all O(1) via lazy reverse-index cache
- **Texture objects** — textures returned from items, blocks, particles, attachables, and entities are full `Texture` objects with `normal`, `heightmap`, and `mer` PBR companion textures
- **Cross-links** — `entity.behavior.entity`, `entity.resource.entity`, `biome.behavior.biome`, `biome.resource.biome`, `spawnRule.entity`
- **JSDoc parsing** — `asset.docstrings` exposes structured comment blocks written inside your JSON files
- **Fog, Feature, FeatureRule, Geometry, Particle, Attachable** — full coverage of RP and BP asset types
- **`AssetCollection<T>`** — typed iterable map with `filter`, `map`, `find`, `groupBy`, and more

## Examples

```ts
// Items
const spear = addon.items.get("mypack:copper_spear");
console.log(spear?.displayName);         // "Copper Spear"
console.log(spear?.texture?.id);         // "textures/items/copper_spear"
console.log(spear?.recipes.length);      // number of crafting recipes
console.log(spear?.entities.length);     // entities that drop it

// Entities
const zombie = addon.entities.get("minecraft:zombie");
console.log(zombie?.behavior?.lootTables.map(lt => lt.id));
console.log(zombie?.resource?.textures); // Record<string, Texture>
console.log(zombie?.resource?.entity);   // back-link to unified Entity

// Biomes
const biome = addon.biomes.get("mypack:maple_forest");
console.log(biome?.fog?.id);             // "mypack:maple_forest_fog"
console.log(biome?.resource?.biome);     // back-link to unified Biome
console.log(biome?.resource?.data);      // raw data — access skyColor, foliageColor etc.

// Textures (Node.js)
const tex = addon.textures.get("textures/blocks/cobblestone");
console.log(tex?.mer?.id);               // metalness/emissive/roughness companion
console.log(tex?.usedByBlocks.length);   // reverse lookup

// Fogs
const fog = addon.fogs.get("mypack:maple_forest_fog");
console.log(fog?.data);

// Collections
const customItems = addon.items.filter(i => !i.id.startsWith("minecraft:"));
const byNamespace = addon.entities.groupBy(e => e.id.split(":")[0]);
```

## License

MIT
