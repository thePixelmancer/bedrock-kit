/**
 * bedrockKit.test.js
 * Run with: npm test  (requires npm run build first)
 */

import { AddOn, Item, Tag, ItemStack } from "../dist/bedrockKit.js";

const addon = await AddOn.fromDisk("./test/vanilla_behavior_pack", "./test/vanilla_resource_pack");

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
ok("music loaded", (addon.music?.size ?? 0) > 0);
ok("bpManifest loaded", addon.bpManifest !== undefined);
ok("rpManifest loaded", addon.rpManifest !== undefined);

// ─── Items ────────────────────────────────────────────────────────────────────

section("Items");
ok("items.all() non-empty", addon.items.all().length > 0);
ok("all have ids", addon.items.all().every(i => i.id.length > 0));
eq("items.get() undefined for unknown", addon.items.get("bedrockkit:nope"), undefined);
ok("items.get() finds copper_spear", addon.items.get("minecraft:copper_spear")?.id === "minecraft:copper_spear");
ok("data has minecraft:item key", "minecraft:item" in (addon.items.get("minecraft:copper_spear")?.data ?? {}));
ok("texturePath resolves", typeof addon.items.get("minecraft:copper_spear")?.texturePath === "string");
ok("displayName resolves", typeof addon.items.get("minecraft:copper_spear")?.displayName === "string");
ok("recipes returns recipes", (addon.items.get("minecraft:copper_spear")?.recipes.length ?? 0) > 0);
ok("attachable returns Attachable or undefined", (() => {
  const a = addon.items.get("minecraft:copper_spear")?.attachable;
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
const spear = addon.items.get("minecraft:copper_spear");
ok("item.recipes finds copper_spear", spear?.recipes.length > 0);

const shapedSpear = spear?.recipes.find(r => r.type === "shaped");
const grid = shapedSpear?.resolveShape();
ok("resolveShape() returns 2D grid",
  Array.isArray(grid) && grid.length > 0 && grid.every(row => Array.isArray(row))
);
ok("grid cells are Item/Tag/null",
  grid?.every(row => row.every(c => c === null || c instanceof Item || c instanceof Tag)) ?? false
);
eq("resolveShape() null for non-shaped",
  addon.recipes.all().find(r => r.type === "furnace")?.resolveShape(),
  null
);
eq("resolveShapeless() null for non-shapeless", shapedSpear?.resolveShapeless(), null);
eq("resolveFurnace() null for non-furnace", shapedSpear?.resolveFurnace(), null);
eq("resolveBrewing() null for non-brewing", shapedSpear?.resolveBrewing(), null);

const stack = spear?.recipes[0]?.result;
ok("result returns ItemStack", stack instanceof ItemStack);
eq("result.id", stack?.id, "minecraft:copper_spear");
ok("result.count is number", typeof stack?.count === "number");

// ─── Loot Tables ─────────────────────────────────────────────────────────────

section("Loot Tables");
ok("lootTables.all() non-empty", addon.lootTables.all().length > 0);
const zombieLoot = addon.lootTables.get("loot_tables/entities/zombie.json");
ok("lootTables.get() finds zombie", zombieLoot !== undefined);
ok("zombie loot has pools", (zombieLoot?.pools.length ?? 0) > 0);
ok("itemIds returns ids", (zombieLoot?.itemIds.length ?? 0) > 0);
ok("entity.lootTables finds zombie tables",
  (addon.entities.get("minecraft:zombie")?.lootTables.length ?? 0) > 0
);
ok("items resolves addon items", Array.isArray(zombieLoot?.items));

// ─── Spawn Rules ──────────────────────────────────────────────────────────────

section("Spawn Rules");
const armadillo = addon.entities.get("minecraft:armadillo");
ok("entities.get() finds armadillo", armadillo?.id === "minecraft:armadillo");
ok("spawnRule exists on armadillo", armadillo?.spawnRule !== undefined);
ok("spawnRule.biomeTags non-empty", (armadillo?.spawnRule?.biomeTags.length ?? 0) > 0);
ok("spawnRule.conditions non-empty", (armadillo?.spawnRule?.conditions.length ?? 0) > 0);
ok("zombie spawnRule links", addon.entities.get("minecraft:zombie")?.spawnRule !== undefined);

// ─── Biomes ───────────────────────────────────────────────────────────────────

section("Biomes");
ok("biomes.all() non-empty", addon.biomes.all().length > 0);
const bambooJungle = addon.biomes.get("minecraft:bamboo_jungle");
ok("biomes.get() finds bamboo_jungle", bambooJungle?.id === "minecraft:bamboo_jungle");
ok("musicDefinition resolves or is undefined",
  bambooJungle?.musicDefinition === undefined || typeof bambooJungle.musicDefinition === "object"
);

// ─── Animations ───────────────────────────────────────────────────────────────

section("Animations");
ok("animations.all() non-empty", addon.animations.all().length > 0);
ok("animations.get() callable",
  (() => { addon.animations.get("animation.humanoid.move"); return true; })()
);
ok("entity resource.animations resolves",
  (addon.entities.get("minecraft:zombie")?.resource?.animations.length ?? 0) > 0
);

// ─── Animation Controllers ────────────────────────────────────────────────────

section("Animation Controllers");
ok("animationControllers.all() non-empty", addon.animationControllers.all().length > 0);
const ctrl = addon.animationControllers.all()[0];
ok("has states", ctrl.states.length > 0);
ok("has initialState", ctrl.initialState === undefined || typeof ctrl.initialState === "string");

// ─── Render Controllers ───────────────────────────────────────────────────────

section("Render Controllers");
ok("renderControllers.all() non-empty", addon.renderControllers.all().length > 0);
ok("renderControllers.get() finds agent",
  addon.renderControllers.get("controller.render.agent") !== undefined
);

// ─── Attachables ─────────────────────────────────────────────────────────────

section("Attachables");
ok("attachables.all() non-empty", addon.attachables.all().length > 0);
const bow = addon.attachables.get("minecraft:bow");
ok("attachables.get() finds bow", bow?.id === "minecraft:bow");
ok("textures non-empty", Object.keys(bow?.textures ?? {}).length > 0);
ok("materials non-empty", Object.keys(bow?.materials ?? {}).length > 0);

// ─── Geometries ──────────────────────────────────────────────────────────────

section("Geometries");
ok("geometries.all() non-empty", addon.geometries.all().length > 0);
const geo = addon.geometries.get("geometry.humanoid");
ok("geometries.get() finds humanoid", geo?.id === "geometry.humanoid");
ok("textureWidth is number", typeof geo?.textureWidth === "number");
ok("textureHeight is number", typeof geo?.textureHeight === "number");
ok("bones non-empty", (geo?.bones.length ?? 0) > 0);
ok("getBone() finds body", geo?.getBone("body") !== undefined);
ok("rootBones returns array", Array.isArray(geo?.rootBones));
ok("getChildBones() returns array", Array.isArray(geo?.getChildBones("body")));

// ─── Trading Tables ───────────────────────────────────────────────────────────

section("Trading Tables");
ok("trading.all() non-empty", addon.trading.all().length > 0);
const armorerTrades = addon.trading.get("armorer_trades");
ok("trading.get() finds armorer_trades", armorerTrades?.id === "armorer_trades");
const firstTrade = armorerTrades?.tiers[0]?.trades[0];
ok("first trade exists", firstTrade !== undefined);
ok("wants non-empty", (firstTrade?.wants.length ?? 0) > 0);
ok("gives non-empty", (firstTrade?.gives.length ?? 0) > 0);
ok("getAllItemIdentifiers() returns ids", (armorerTrades?.getAllItemIdentifiers().length ?? 0) > 0);

// ─── Particles ───────────────────────────────────────────────────────────────

section("Particles");
ok("particles.all() non-empty", addon.particles.all().length > 0);
ok("all have ids", addon.particles.all().every(p => p.id.length > 0));
eq("particles.get() undefined for unknown", addon.particles.get("bedrockkit:nope"), undefined);
const arrowSpell = addon.particles.get("minecraft:arrow_spell_emitter");
ok("particles.get() finds arrow_spell_emitter", arrowSpell?.id === "minecraft:arrow_spell_emitter");
ok("texturePath is string or undefined",
  arrowSpell?.texturePath === undefined || typeof arrowSpell.texturePath === "string"
);
ok("material is string or undefined",
  arrowSpell?.material === undefined || typeof arrowSpell.material === "string"
);
ok("components non-empty", Object.keys(arrowSpell?.components ?? {}).length > 0);

// ─── Sound Definitions ────────────────────────────────────────────────────────

section("Sound Definitions");
ok("sounds non-empty", (addon.sounds?.size ?? 0) > 0);
ok("all have ids", addon.sounds?.all().every(e => e.id.length > 0) ?? true);
eq("sounds.get() undefined for unknown", addon.sounds?.get("bedrockkit:nope"), undefined);
const zombieSay = addon.sounds?.get("mob.zombie.say");
ok("sounds.get() finds mob.zombie.say", zombieSay?.id === "mob.zombie.say");
ok("has category", zombieSay?.category === undefined || typeof zombieSay.category === "string");
ok("has files", (zombieSay?.files.length ?? 0) > 0);
ok("files have name",
  zombieSay?.files.every(f => typeof f.name === "string" && f.name.length > 0) ?? false
);

// ─── Music Definitions ────────────────────────────────────────────────────────

section("Music Definitions");
ok("music non-empty", (addon.music?.size ?? 0) > 0);
eq("music.get() undefined for unknown", addon.music?.get("bedrockkit:nope"), undefined);
const bambooMusic = addon.music?.get("bamboo_jungle");
ok("music.get() finds bamboo_jungle", bambooMusic?.id === "bamboo_jungle");
ok("has eventName", (bambooMusic?.eventName.length ?? 0) > 0);
ok("minDelay is number", typeof bambooMusic?.minDelay === "number");
ok("maxDelay is number", typeof bambooMusic?.maxDelay === "number");
ok("eventName resolves in sounds", addon.sounds?.get(bambooMusic?.eventName ?? "") !== undefined);

// ─── Sound Events ─────────────────────────────────────────────────────────────

section("Sound Events");
const zombieEntity = addon.entities.get("minecraft:zombie");
ok("entity.soundEvents resolves", Array.isArray(zombieEntity?.soundEvents));
ok("soundEvents have event and definitionId",
  (zombieEntity?.soundEvents ?? []).every(
    e => typeof e.event === "string" && typeof e.definitionId === "string"
  )
);
ok("entity.behavior.soundEvents resolves",
  (zombieEntity?.behavior?.soundEvents.length ?? 0) > 0
);
ok("block.soundEvents resolves",
  Array.isArray(addon.blocks.get("tsunami_dungeons:golem_heart")?.soundEvents)
);

// ─── Entities ────────────────────────────────────────────────────────────────

section("Entities");
ok("entities.all() non-empty", addon.entities.all().length > 0);
const zombie = addon.entities.get("minecraft:zombie");
ok("entities.get() finds zombie", zombie !== undefined);
ok("zombie.id correct", zombie?.id === "minecraft:zombie");
ok("zombie has behavior", zombie?.behavior !== undefined);
ok("zombie behavior data has minecraft:entity key",
  "minecraft:entity" in (zombie?.behavior?.data ?? {})
);
ok("zombie behavior has filePath", (zombie?.behavior?.filePath.length ?? 0) > 0);
ok("zombie has resource", zombie?.resource !== undefined);
ok("zombie resource data has client_entity key",
  "minecraft:client_entity" in (zombie?.resource?.data ?? {})
);
ok("zombie resource has filePath", (zombie?.resource?.filePath.length ?? 0) > 0);
ok("zombie animationShortnames is object",
  typeof zombie?.resource?.animationShortnames === "object"
);
ok("zombie renderControllerIds is array",
  Array.isArray(zombie?.resource?.renderControllerIds)
);
ok("entity animationControllers resolves",
  Array.isArray(zombie?.resource?.animationControllers)
);
ok("entity renderControllers resolves",
  (zombie?.resource?.renderControllers.length ?? 0) > 0
);
ok("entity displayName is string", typeof zombie?.displayName === "string");
ok("entity lootTables is array", Array.isArray(zombie?.lootTables));
eq("entities.get() undefined for unknown",
  addon.entities.get("unknown:nonexistent"),
  undefined
);

// ─── Blocks ───────────────────────────────────────────────────────────────────

section("Blocks");
ok("blocks.all() non-empty", addon.blocks.all().length > 0);
const golemHeart = addon.blocks.get("tsunami_dungeons:golem_heart");
ok("blocks.get() finds golem_heart", golemHeart?.id === "tsunami_dungeons:golem_heart");
ok("data has minecraft:block key", "minecraft:block" in (golemHeart?.data ?? {}));
ok("JSON comment stripping works", golemHeart !== undefined);
ok("lootTable does not throw",
  (() => { golemHeart?.lootTable; return true; })()
);
ok("displayName is string", typeof golemHeart?.displayName === "string");
ok("soundEvents is array", Array.isArray(golemHeart?.soundEvents));

// ─── Asset & AssetCollection ─────────────────────────────────────────────────

section("Asset & AssetCollection");
const items = addon.items;
ok("items is AssetCollection", items && typeof items.get === "function" && typeof items.size === "number");
ok("size is number", typeof items.size === "number" && items.size > 0);
ok("has() works", items.has("minecraft:copper_spear"));
ok("has() false for unknown", !items.has("bedrockkit:nope"));
ok("get() returns Item", items.get("minecraft:copper_spear") instanceof Item);
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

const filtered = items.filter(i => i.id.includes("spear"));
ok("filter() returns AssetCollection",
  filtered && typeof filtered.get === "function" && typeof filtered.size === "number"
);
ok("filter() reduces size", filtered.size < items.size && filtered.size > 0);
ok("filter() items pass predicate", filtered.every(i => i.id.includes("spear")));

const mapped = items.map(i => i.id);
ok("map() returns array", Array.isArray(mapped) && mapped.length === items.size);
ok("map() applies function", mapped.every(id => typeof id === "string"));

const found = items.find(i => i.id === "minecraft:copper_spear");
ok("find() returns match", found instanceof Item && found.id === "minecraft:copper_spear");
ok("find() undefined when not found", items.find(i => i.id === "bedrockkit:nope") === undefined);

ok("some() true when match", items.some(i => i.id === "minecraft:copper_spear"));
ok("some() false when no match", !items.some(i => i.id === "bedrockkit:nope"));
ok("every() true when all match", items.every(i => typeof i.id === "string"));
ok("every() false when some don't", !items.every(i => i.id === "minecraft:copper_spear"));

const spearItem = addon.items.get("minecraft:copper_spear");
ok("Asset has documentation array", Array.isArray(spearItem?.documentation));

// ─── Tags ─────────────────────────────────────────────────────────────────────

section("Tags");
ok("Tag has id property", (() => {
  const tag = new Tag("minecraft:planks");
  return tag.id === "minecraft:planks";
})());
const shapedRecipe = addon.recipes.all().find(r => r.type === "shaped");
const shapeGrid = shapedRecipe?.resolveShape();
ok("resolveShape returns grid or null", shapeGrid === null || Array.isArray(shapeGrid));

// ─── Cross-connections ────────────────────────────────────────────────────────

section("Cross-connections");
const copperSpear = addon.items.get("minecraft:copper_spear");
ok("item.droppedByBlocks() callable",
  (() => { copperSpear?.droppedByBlocks; return true; })()
);
ok("item.droppedByBlocks returns array", Array.isArray(copperSpear?.droppedByBlocks));
ok("item.entities returns array", Array.isArray(copperSpear?.entities));
ok("lootTable.sourceEntities returns array",
  Array.isArray(addon.lootTables.get("loot_tables/entities/zombie.json")?.sourceEntities)
);
ok("lootTable.sourceBlocks returns array",
  Array.isArray(addon.lootTables.get("loot_tables/entities/zombie.json")?.sourceBlocks)
);
ok("behavior.resource cross-link works",
  zombie?.behavior?.resource === zombie?.resource
);
ok("resource.behavior cross-link works",
  zombie?.resource?.behavior === zombie?.behavior
);

// ─── Languages ───────────────────────────────────────────────────────────────

section("Languages");
const lang = addon.languages.get("en_US");
ok("languages.get() returns LangFile", lang !== undefined);
ok("LangFile.get() returns string", typeof lang?.get("item.minecraft.copper_spear.name") === "string");

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
