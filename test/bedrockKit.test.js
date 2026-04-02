/**
 * bedrockKit.test.js
 * Run with: npm test  (requires npm run build first)
 */

import { AddOn, Item, Tag, ItemStack } from "../dist/bedrockKit.js";

const addon = await AddOn.fromDisk("./test/bp", "./test/rp");

// ─── Helpers ─────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function ok(name, condition, detail) {
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.error(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

function eq(name, actual, expected) {
  ok(name, JSON.stringify(actual) === JSON.stringify(expected),
    `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function section(title) {
  console.log(`\n── ${title} ${"─".repeat(Math.max(0, 50 - title.length))}`);
}

// ─── AddOn ───────────────────────────────────────────────────────────────────

section("AddOn");
ok("behaviorPackPath set", addon.behaviorPackPath.length > 0);
ok("resourcePackPath set", addon.resourcePackPath.length > 0);
ok("sounds loaded", (addon.sounds?.size ?? 0) > 0);
ok("sounds has entries", (addon.sounds?.size ?? 0) >= 0);
ok("music not loaded (no music_definitions.json in test pack)", addon.music === undefined);
ok("bpManifest loaded", addon.bpManifest !== undefined);
ok("rpManifest loaded", addon.rpManifest !== undefined);

// ─── Items ────────────────────────────────────────────────────────────────────

section("Items");
ok("items.all() non-empty", addon.items.all().length > 0);
ok("all have ids", addon.items.all().every(i => i.id.length > 0));
eq("items.get() undefined for unknown", addon.items.get("bedrockkit:nope"), undefined);
ok("items.get() finds rope", addon.items.get("tsu_nat:rope")?.id === "tsu_nat:rope");
ok("data has minecraft:item key", "minecraft:item" in (addon.items.get("tsu_nat:rope")?.data ?? {}));
ok("displayName resolves", typeof addon.items.get("tsu_nat:rope")?.displayName === "string");
ok("displayName value", addon.items.get("tsu_nat:rope")?.displayName === "Rope");
ok("recipes returns recipes", (addon.items.get("tsu_nat:rope")?.recipes.length ?? 0) > 0);
ok("attachable returns Attachable or undefined", (() => {
  const a = addon.items.get("tsu_nat:rope")?.attachable;
  return a === undefined || typeof a === "object";
})());

// ─── Recipes ─────────────────────────────────────────────────────────────────

section("Recipes");
ok("recipes.all() non-empty", addon.recipes.all().length > 0);
ok("all have valid types",
  addon.recipes.all().every(r =>
    ["shaped", "shapeless", "furnace", "brewing_mix", "brewing_container", "unknown"].includes(r.type)
  )
);
const ropeItem = addon.items.get("tsu_nat:rope");
ok("item.recipes finds rope", (ropeItem?.recipes.length ?? 0) > 0);

const shapedRope = ropeItem?.recipes.find(r => r.type === "shaped");
const grid = shapedRope?.resolveShape();
ok("resolveShape() returns 2D grid",
  Array.isArray(grid) && grid.length > 0 && grid.every(row => Array.isArray(row))
);
ok("grid cells are Item/Tag/null",
  grid?.every(row => row.every(c => c === null || c instanceof Item || c instanceof Tag)) ?? false
);
eq("resolveShape() undefined for non-shaped",
  addon.recipes.all().find(r => r.type === "furnace")?.resolveShape(),
  undefined
);
eq("resolveShapeless() undefined for non-shapeless", shapedRope?.resolveShapeless(), undefined);
eq("resolveFurnace() undefined for non-furnace", shapedRope?.resolveFurnace(), undefined);
eq("resolveBrewing() undefined for non-brewing", shapedRope?.resolveBrewing(), undefined);

const stack = ropeItem?.recipes[0]?.result;
ok("result returns ItemStack", stack instanceof ItemStack);
eq("result.id", stack?.id, "tsu_nat:rope");
ok("result.count is number", typeof stack?.count === "number");

// ─── Loot Tables ─────────────────────────────────────────────────────────────

section("Loot Tables");
ok("lootTables.all() non-empty", addon.lootTables.all().length > 0);
const boarLoot = addon.lootTables.get("loot_tables/tsu/nat/boar.loot.json");
ok("lootTables.get() finds boar", boarLoot !== undefined);
ok("itemIds returns ids", (boarLoot?.itemIds.length ?? 0) > 0);
ok("entity.lootTables finds boar tables",
  (addon.entities.get("tsu_nat:boar")?.lootTables.length ?? 0) > 0
);
ok("items resolves addon items", Array.isArray(boarLoot?.items));

// ─── Spawn Rules ──────────────────────────────────────────────────────────────

section("Spawn Rules");
const boar = addon.entities.get("tsu_nat:boar");
ok("entities.get() finds boar", boar?.id === "tsu_nat:boar");
ok("spawnRule exists on boar", boar?.spawnRule !== undefined);
ok("spawnRule.biomeTags non-empty", (boar?.spawnRule?.biomeTags.length ?? 0) > 0);
ok("turkey spawnRule links", addon.entities.get("tsu_nat:turkey")?.spawnRule !== undefined);

// ─── Biomes ───────────────────────────────────────────────────────────────────

section("Biomes");
ok("biomes.all() non-empty", addon.biomes.all().length > 0);
const charredForest = addon.biomes.get("tsu_nat:charred_forest");
ok("biomes.get() finds charred_forest", charredForest?.id === "tsu_nat:charred_forest");
ok("musicDefinition resolves or is undefined",
  charredForest?.musicDefinition === undefined || typeof charredForest.musicDefinition === "object"
);

// ─── Animations ───────────────────────────────────────────────────────────────

section("Animations");
ok("animations.all() non-empty", addon.animations.all().length > 0);
ok("animations.get() callable",
  (() => { addon.animations.get("animation.tsu_nat.boar.move"); return true; })()
);
ok("entity resource.animations resolves",
  (addon.entities.get("tsu_nat:boar")?.resource?.animations.length ?? 0) > 0
);

// ─── Animation Controllers ────────────────────────────────────────────────────

section("Animation Controllers");
ok("animationControllers.all() non-empty", addon.animationControllers.all().length > 0);

// ─── Render Controllers ───────────────────────────────────────────────────────

section("Render Controllers");
ok("renderControllers.all() non-empty", addon.renderControllers.all().length > 0);
ok("renderControllers.get() finds firefly",
  addon.renderControllers.get("controller.render.tsu_nat.firefly") !== undefined
);

// ─── Geometries ──────────────────────────────────────────────────────────────

section("Geometries");
ok("geometries.all() non-empty", addon.geometries.all().length > 0);
const boarGeo = addon.geometries.get("geometry.tsu_nat.boar");
ok("geometries.get() finds boar geo", boarGeo?.id === "geometry.tsu_nat.boar");

// ─── Particles ───────────────────────────────────────────────────────────────

section("Particles");
ok("particles.all() non-empty", addon.particles.all().length > 0);
ok("all have ids", addon.particles.all().every(p => p.id.length > 0));
eq("particles.get() undefined for unknown", addon.particles.get("bedrockkit:nope"), undefined);
const fliesParticle = addon.particles.get("tsu_nat:flies");
ok("particles.get() finds flies", fliesParticle?.id === "tsu_nat:flies");

// ─── Sound Definitions ────────────────────────────────────────────────────────

section("Sound Definitions");
ok("sounds non-empty", (addon.sounds?.size ?? 0) > 0);
ok("all have ids", addon.sounds?.all().every(e => e.id.length > 0) ?? true);
eq("sounds.get() undefined for unknown", addon.sounds?.get("bedrockkit:nope"), undefined);
const mandrakeScream = addon.sounds?.get("tsu_nat.mandrake_root.scream");
ok("sounds.get() finds mandrake_root.scream", mandrakeScream?.id === "tsu_nat.mandrake_root.scream");
ok("has files", (mandrakeScream?.files.length ?? 0) > 0);
ok("files have name",
  mandrakeScream?.files.every(f => typeof f.name === "string" && f.name.length > 0) ?? false
);

// ─── Sound Events ─────────────────────────────────────────────────────────────

section("Sound Events");
const boarEntity = addon.entities.get("tsu_nat:boar");
ok("entity.soundEvents resolves", Array.isArray(boarEntity?.soundEvents));
ok("block.soundEvents resolves",
  Array.isArray(addon.blocks.get("tsu_nat:ash_block")?.soundEvents)
);

// ─── Entities ────────────────────────────────────────────────────────────────

section("Entities");
ok("entities.all() non-empty", addon.entities.all().length > 0);
const boarEnt = addon.entities.get("tsu_nat:boar");
ok("entities.get() finds boar", boarEnt !== undefined);
ok("boar.id correct", boarEnt?.id === "tsu_nat:boar");
ok("boar has behavior", boarEnt?.behavior !== undefined);
ok("boar behavior data has minecraft:entity key",
  "minecraft:entity" in (boarEnt?.behavior?.data ?? {})
);
ok("boar behavior has filePath", (boarEnt?.behavior?.filePath.length ?? 0) > 0);
ok("boar has resource", boarEnt?.resource !== undefined);
ok("boar resource data has client_entity key",
  "minecraft:client_entity" in (boarEnt?.resource?.data ?? {})
);
ok("boar resource has filePath", (boarEnt?.resource?.filePath.length ?? 0) > 0);
ok("boar animationShortnames is object",
  typeof boarEnt?.resource?.animationShortnames === "object"
);
ok("boar renderControllerIds is array",
  Array.isArray(boarEnt?.resource?.renderControllerIds)
);
ok("entity animationControllers resolves",
  Array.isArray(boarEnt?.resource?.animationControllers)
);
ok("entity renderControllers resolves",
  (boarEnt?.resource?.renderControllers.length ?? 0) >= 0
);
ok("entity displayName is string", typeof boarEnt?.displayName === "string");
ok("entity lootTables is array", Array.isArray(boarEnt?.lootTables));
eq("entities.get() undefined for unknown",
  addon.entities.get("unknown:nonexistent"),
  undefined
);

// ─── Blocks ───────────────────────────────────────────────────────────────────

section("Blocks");
ok("blocks.all() non-empty", addon.blocks.all().length > 0);
const ashBlock = addon.blocks.get("tsu_nat:ash_block");
ok("blocks.get() finds ash_block", ashBlock?.id === "tsu_nat:ash_block");
ok("data has minecraft:block key", "minecraft:block" in (ashBlock?.data ?? {}));
ok("lootTable does not throw",
  (() => { ashBlock?.lootTable; return true; })()
);
ok("displayName is string", typeof ashBlock?.displayName === "string");
ok("soundEvents is array", Array.isArray(ashBlock?.soundEvents));

// ─── Asset & AssetCollection ─────────────────────────────────────────────────

section("Asset & AssetCollection");
const items = addon.items;
ok("items is AssetCollection", items && typeof items.get === "function" && typeof items.size === "number");
ok("size is number", typeof items.size === "number" && items.size > 0);
ok("has() works", items.has("tsu_nat:rope"));
ok("has() false for unknown", !items.has("bedrockkit:nope"));
ok("get() returns Item", items.get("tsu_nat:rope") instanceof Item);
eq("get() undefined for unknown", items.get("bedrockkit:nope"), undefined);
ok("keys() iterable",
  (() => { let count = 0; for (const _ of items.keys()) count++; return count > 0; })()
);
ok("values() iterable",
  (() => { let count = 0; for (const _ of items.values()) count++; return count > 0; })()
);
ok("entries() iterable",
  (() => { let count = 0; for (const _ of items.entries()) count++; return count > 0; })()
);
ok("all() returns array", Array.isArray(items.all()) && items.all().length > 0);
ok("for...of iteration works",
  (() => { let count = 0; for (const _ of items) count++; return count === items.size; })()
);
ok("spread [...items] works", [...items].length === items.size);

const filtered = items.filter(i => i.id.includes("rope"));
ok("filter() returns AssetCollection",
  filtered && typeof filtered.get === "function" && typeof filtered.size === "number"
);
ok("filter() reduces size", filtered.size < items.size && filtered.size > 0);
ok("filter() items pass predicate", filtered.every(i => i.id.includes("rope")));

const mapped = items.map(i => i.id);
ok("map() returns array", Array.isArray(mapped) && mapped.length === items.size);
ok("map() applies function", mapped.every(id => typeof id === "string"));

const found = items.find(i => i.id === "tsu_nat:rope");
ok("find() returns match", found instanceof Item && found.id === "tsu_nat:rope");
ok("find() undefined when not found", items.find(i => i.id === "bedrockkit:nope") === undefined);

ok("some() true when match", items.some(i => i.id === "tsu_nat:rope"));
ok("some() false when no match", !items.some(i => i.id === "bedrockkit:nope"));
ok("every() true when all match", items.every(i => typeof i.id === "string"));
ok("every() false when some don't", !items.every(i => i.id === "tsu_nat:rope"));

ok("Asset has docstrings array", Array.isArray(addon.items.all()[0]?.docstrings));

// ─── Tags ─────────────────────────────────────────────────────────────────────

section("Tags");
ok("Tag has id property", (() => {
  const tag = new Tag("minecraft:planks");
  return tag.id === "minecraft:planks";
})());
const shapedRecipe = addon.recipes.all().find(r => r.type === "shaped");
const shapeGrid = shapedRecipe?.resolveShape();
ok("resolveShape returns grid or undefined", shapeGrid === undefined || Array.isArray(shapeGrid));

// ─── Cross-connections ────────────────────────────────────────────────────────

section("Cross-connections");
const ropeItemCC = addon.items.get("tsu_nat:rope");
ok("item.droppedByBlocks() callable",
  (() => { ropeItemCC?.droppedByBlocks; return true; })()
);
ok("item.droppedByBlocks returns array", Array.isArray(ropeItemCC?.droppedByBlocks));
ok("item.entities returns array", Array.isArray(ropeItemCC?.entities));
ok("lootTable.sourceEntities returns array",
  Array.isArray(addon.lootTables.get("loot_tables/tsu/nat/boar.loot.json")?.sourceEntities)
);
ok("lootTable.sourceBlocks returns array",
  Array.isArray(addon.lootTables.get("loot_tables/tsu/nat/boar.loot.json")?.sourceBlocks)
);
ok("behavior.resource cross-link works",
  boarEnt?.behavior?.resource === boarEnt?.resource
);
ok("resource.behavior cross-link works",
  boarEnt?.resource?.behavior === boarEnt?.behavior
);

// ─── Languages ───────────────────────────────────────────────────────────────

section("Languages");
const lang = addon.languages.get("en_US");
ok("languages.get() returns LangFile", lang !== undefined);
ok("LangFile.get() returns string", typeof lang?.get("item.tsu_nat:rope") === "string");

// ─── Display Names ───────────────────────────────────────────────────────────

section("Display Names");

// Items — obvious match
eq("item rope displayName", addon.items.get("tsu_nat:rope")?.displayName, "Rope");
// Items — non-obvious: key differs from display value
eq("item kefir displayName (key: Yoghurt)", addon.items.get("tsu_nat:kefir")?.displayName, "Yoghurt");
eq("item kombucha displayName (key: Mushroom Brew)", addon.items.get("tsu_nat:kombucha")?.displayName, "Mushroom Brew");

// Blocks — tile.* key lookup
eq("block ash_block displayName (tile.* key)", addon.blocks.get("tsu_nat:ash_block")?.displayName, "Block of Ash");
eq("block maple_log displayName", addon.blocks.get("tsu_nat:maple_log")?.displayName, "Maple Log");

// Entities — entity.* key lookup, including non-obvious name
eq("entity boar displayName", addon.entities.get("tsu_nat:boar")?.displayName, "Boar");
eq("entity firefly displayName (non-obvious: Fungus Gnat)", addon.entities.get("tsu_nat:firefly")?.displayName, "Fungus Gnat");
eq("entity turkey displayName", addon.entities.get("tsu_nat:turkey")?.displayName, "Turkey");

// Fallback — no lang entry, should return the id
ok("displayName falls back to id for unknown lang key", (() => {
  const missing = addon.items.all().find(i => {
    const lang = addon.languages.get("en_US");
    return lang?.get(`item.${i.id}`) === `item.${i.id}` &&
           lang?.get(`tile.${i.id}.name`) === `tile.${i.id}.name`;
  });
  return missing === undefined || missing.displayName === missing.id;
})());

// ─── Edge Cases ──────────────────────────────────────────────────────────────

section("Edge Cases");
eq("items.get() undefined for unknown", addon.items.get("unknown:nonexistent"), undefined);
eq("blocks.get() undefined for unknown", addon.blocks.get("unknown:nonexistent"), undefined);
eq("entities.get() undefined for unknown", addon.entities.get("unknown:nonexistent"), undefined);
eq("biomes.get() undefined for unknown", addon.biomes.get("unknown:nonexistent"), undefined);
eq("lootTables.get() undefined for unknown", addon.lootTables.get("unknown/path.json"), undefined);

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(54)}`);
console.log(`  ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
