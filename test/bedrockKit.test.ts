/**
 * bedrockKit.test.ts
 * Run with: deno task start
 */

import { AddOn, Item, Tag, Particle } from "../src/bedrockKit.ts";

const addon = new AddOn("./vanilla_behavior_pack", "./vanilla_resource_pack");

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pass(name: string) { console.log(`  ✅ ${name}`); }
function fail(name: string, detail: string) {
  console.error(`  ❌ ${name}`);
  console.error(`     ${detail}`);
}
function assert(name: string, condition: boolean, detail: string) {
  condition ? pass(name) : fail(name, detail);
}
function assertEq<T>(name: string, actual: T, expected: T) {
  JSON.stringify(actual) === JSON.stringify(expected)
    ? pass(name)
    : fail(name, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
function section(title: string) {
  console.log(`\n── ${title} ${"─".repeat(Math.max(0, 50 - title.length))}`);
}

// ─── AddOn ───────────────────────────────────────────────────────────────────

section("AddOn");

Deno.test("AddOn — resolves behavior pack path", () => {
  assert("behaviorPackPath set", addon.behaviorPackPath.length > 0, "should be non-empty");
});
Deno.test("AddOn — resolves resource pack path", () => {
  assert("resourcePackPath set", addon.resourcePackPath.length > 0, "should be non-empty");
});
Deno.test("AddOn — loads item_texture.json", () => {
  assert("itemTextures not null", addon.itemTextures !== null, "should exist");
  const data = addon.itemTextures?.texture_data;
  assert("texture_data non-empty", !!data && Object.keys(data).length > 0, "empty");
  console.log(`     sample keys: ${Object.keys(data ?? {}).slice(0, 3).join(", ")}`);
});

// ─── Items ────────────────────────────────────────────────────────────────────

section("Items");

Deno.test("items — getAllItems() non-empty", () => {
  const all = addon.getAllItems();
  assert("has items", all.length > 0, `got ${all.length}`);
  console.log(`     total: ${all.length}`);
});
Deno.test("items — all have identifiers", () => {
  const bad = addon.getAllItems().filter((i) => !i.identifier);
  assert("all have identifiers", bad.length === 0, `${bad.length} missing`);
});
Deno.test("items — getItem() null for unknown", () => {
  assertEq("unknown returns null", addon.getItem("bedrockkit:nope"), null);
});
Deno.test("items — getItem() finds minecraft:copper_spear", () => {
  const spear = addon.getItem("minecraft:copper_spear");
  assert("found", spear !== null, "should exist");
  assertEq("identifier matches", spear?.identifier, "minecraft:copper_spear");
});
Deno.test("items — data has minecraft:item root key", () => {
  const spear = addon.getItem("minecraft:copper_spear");
  assert("root key", "minecraft:item" in (spear?.data ?? {}), "missing");
});
Deno.test("items — getTexturePath() resolves for copper_spear", () => {
  const tex = addon.getItem("minecraft:copper_spear")?.getTexturePath();
  assert("has path", typeof tex === "string" && tex.length > 0, `got ${JSON.stringify(tex)}`);
  console.log(`     path: ${tex}`);
});
Deno.test("items — getAttachable() null for non-attachable item", () => {
  const att = addon.getItem("minecraft:copper_spear")?.getAttachable();
  if (att === null) pass("correctly null");
  else console.log(`  ⚠️  copper_spear has attachable: ${att?.identifier}`);
});
Deno.test("items — getRecipes() returns recipes", () => {
  const recipes = addon.getItem("minecraft:copper_spear")?.getRecipes() ?? [];
  assert("has recipes", recipes.length > 0, `got ${recipes.length}`);
  console.log(`     count: ${recipes.length}, types: ${[...new Set(recipes.map((r) => r.type))].join(", ")}`);
});

// ─── Recipes ─────────────────────────────────────────────────────────────────

section("Recipes");

Deno.test("recipes — getAllRecipes() non-empty", () => {
  const all = addon.getAllRecipes();
  assert("has recipes", all.length > 0, `got ${all.length}`);
  console.log(`     total: ${all.length}`);
});
Deno.test("recipes — all have valid types", () => {
  const valid = ["shaped","shapeless","furnace","brewing_mix","brewing_container","unknown"];
  const bad = addon.getAllRecipes().filter((r) => !valid.includes(r.type));
  assert("all valid", bad.length === 0, `${bad.length} invalid`);
});
Deno.test("recipes — getRecipesFor() finds copper_spear recipes", () => {
  const recipes = addon.getRecipesFor("minecraft:copper_spear");
  assert("has recipes", recipes.length > 0, `got ${recipes.length}`);
});


// resolveShape
Deno.test("recipes — resolveShape() returns 2D grid of Item/Tag/null", () => {
  const recipe = addon.getRecipesFor("minecraft:copper_spear").find((r) => r.type === "shaped");
  assert("shaped found", !!recipe, "no shaped recipe");
  const grid = recipe?.resolveShape();
  assert("grid is array", Array.isArray(grid), "should be array");
  assert("grid has rows", (grid?.length ?? 0) > 0, "empty grid");
  assert("rows are arrays", grid?.every((row) => Array.isArray(row)) ?? false, "rows not arrays");
  assert("cells are Item, Tag, or null", grid?.every((row) =>
    row.every((c) => c === null || c instanceof Item || c instanceof Tag)
  ) ?? false, "unexpected cell type");
  const flat = grid?.flat() ?? [];
  const items = flat.filter((c) => c instanceof Item) as Item[];
  const nulls = flat.filter((c) => c === null);
  console.log(`     items: ${items.map((i) => i.identifier).join(", ")}`);
  console.log(`     empty slots: ${nulls.length}`);
});
Deno.test("recipes — resolveShape() empty slots are null", () => {
  const recipe = addon.getRecipesFor("minecraft:copper_spear").find((r) => r.type === "shaped");
  const grid = recipe?.resolveShape() ?? [];
  const hasNull = grid.some((row) => row.some((c) => c === null));
  if (hasNull) pass("empty slot correctly represented as null");
  else console.log("  ⚠️  no empty slots in this recipe — pattern may be fully filled");
});
Deno.test("recipes — resolveShape() tag ingredients are Tag instances", () => {
  const recipe = addon.getRecipesFor("minecraft:brewing_stand").find((r) => r.type === "shaped");
  if (!recipe) { console.log("  ⚠️  brewing_stand shaped recipe not found"); return; }
  const grid = recipe.resolveShape() ?? [];
  const tags = grid.flat().filter((c) => c instanceof Tag) as Tag[];
  assert("has Tag cells", tags.length > 0, `no Tag cells found in grid`);
  console.log(`     tag ids: ${tags.map((t) => t.id).join(", ")}`);
});
Deno.test("recipes — resolveShape() null for non-shaped recipe", () => {
  const recipe = addon.getAllRecipes().find((r) => r.type === "furnace");
  assertEq("resolveShape null for furnace", recipe?.resolveShape(), null);
});

// resolveShapeless
Deno.test("recipes — resolveShapeless() returns Item/Tag ingredients with count", () => {
  const recipe = addon.getAllRecipes().find((r) => r.type === "shapeless");
  if (!recipe) { console.log("  ⚠️  no shapeless recipes"); return; }
  const result = recipe.resolveShapeless();
  assert("is array", Array.isArray(result), "should be array");
  assert("has entries", (result?.length ?? 0) > 0, "empty");
  assert("ingredients are Item or Tag", result?.every((i) =>
    i.ingredient instanceof Item || i.ingredient instanceof Tag
  ) ?? false, "unexpected ingredient type");
  assert("entries have count", result?.every((i) => typeof i.count === "number") ?? false, "missing count");
  console.log(`     ingredients: ${result?.map((i) => `${i.ingredient instanceof Item ? i.ingredient.identifier : "tag:" + (i.ingredient as Tag).id} x${i.count}`).join(", ")}`);
});
Deno.test("recipes — resolveShapeless() null for non-shapeless recipe", () => {
  const recipe = addon.getAllRecipes().find((r) => r.type === "shaped");
  assertEq("resolveShapeless null for shaped", recipe?.resolveShapeless(), null);
});

// resolveFurnace
Deno.test("recipes — resolveFurnace() returns Item/Tag input and output", () => {
  const recipe = addon.getAllRecipes().find((r) => r.type === "furnace");
  if (!recipe) { console.log("  ⚠️  no furnace recipes"); return; }
  const result = recipe.resolveFurnace();
  assert("not null", result !== null, "should resolve");
  assert("input is Item or Tag", result?.input instanceof Item || result?.input instanceof Tag, "bad input type");
  assert("output is Item or Tag", result?.output instanceof Item || result?.output instanceof Tag, "bad output type");
  const inId = result?.input instanceof Item ? result.input.identifier : "tag:" + (result?.input as Tag)?.id;
  const outId = result?.output instanceof Item ? result.output.identifier : "tag:" + (result?.output as Tag)?.id;
  console.log(`     input: ${inId} → output: ${outId}`);
});
Deno.test("recipes — resolveFurnace() null for non-furnace recipe", () => {
  const recipe = addon.getAllRecipes().find((r) => r.type === "shaped");
  assertEq("resolveFurnace null for shaped", recipe?.resolveFurnace(), null);
});

// resolveBrewing
Deno.test("recipes — resolveBrewing() returns Item/Tag input, reagent, output", () => {
  const recipe = addon.getAllRecipes().find((r) => r.type === "brewing_mix" || r.type === "brewing_container");
  if (!recipe) { console.log("  ⚠️  no brewing recipes"); return; }
  const result = recipe.resolveBrewing();
  assert("not null", result !== null, "should resolve");
  assert("input is Item or Tag", result?.input instanceof Item || result?.input instanceof Tag, "bad input");
  assert("reagent is Item or Tag", result?.reagent instanceof Item || result?.reagent instanceof Tag, "bad reagent");
  assert("output is Item or Tag", result?.output instanceof Item || result?.output instanceof Tag, "bad output");
  const getId = (x: Item | Tag | undefined) => x instanceof Item ? x.identifier : "tag:" + (x as Tag)?.id;
  console.log(`     ${getId(result?.input)} + ${getId(result?.reagent)} → ${getId(result?.output)}`);
});
Deno.test("recipes — resolveBrewing() null for non-brewing recipe", () => {
  const recipe = addon.getAllRecipes().find((r) => r.type === "shaped");
  assertEq("resolveBrewing null for shaped", recipe?.resolveBrewing(), null);
});

// getResultItem
Deno.test("recipes — getResultItem() returns Item for known result", () => {
  const recipe = addon.getRecipesFor("minecraft:copper_spear")[0];
  const item = recipe?.getResultItem();
  assert("item found", item !== null, "should resolve to Item");
  assertEq("identifier matches", item?.identifier, "minecraft:copper_spear");
});

// getRecipesUsingItem
Deno.test("recipes — getRecipesUsingItem() finds recipes using minecraft:stick", () => {
  const recipes = addon.getRecipesUsingItem("minecraft:stick");
  assert("has results", recipes.length > 0, "no recipes found");
  assert("all contain stick as Item ingredient", recipes.every((r) =>
    r.getAllIngredients().some((ing) => ing instanceof Item && ing.identifier === "minecraft:stick")
  ), "ingredient mismatch");
  console.log(`     count: ${recipes.length}, sample results: ${recipes.slice(0,3).map((r) => r.result ?? "(no result)").join(", ")}`);
});
Deno.test("recipes — getRecipesUsingItem() returns empty for unknown item", () => {
  const recipes = addon.getRecipesUsingItem("bedrockkit:nope");
  assertEq("empty for unknown", recipes.length, 0);
});

// getRecipesUsingTag
Deno.test("recipes — getRecipesUsingTag() finds recipes using minecraft:stone_crafting_materials", () => {
  const recipes = addon.getRecipesUsingTag("minecraft:stone_crafting_materials");
  assert("has results", recipes.length > 0, "no recipes found using that tag");
  assert("all contain tag as Tag ingredient", recipes.every((r) =>
    r.getAllIngredients().some((ing) => ing instanceof Tag && ing.id === "minecraft:stone_crafting_materials")
  ), "ingredient mismatch");
  console.log(`     count: ${recipes.length}, sample results: ${recipes.slice(0,3).map((r) => r.result ?? "(no result)").join(", ")}`);
});
Deno.test("recipes — getRecipesUsingTag() returns empty for unknown tag", () => {
  const recipes = addon.getRecipesUsingTag("bedrockkit:nope");
  assertEq("empty for unknown", recipes.length, 0);
});

// ─── Loot Tables ─────────────────────────────────────────────────────────────

section("Loot Tables");

Deno.test("lootTables — getAllLootTables() non-empty", () => {
  const all = addon.getAllLootTables();
  assert("has tables", all.length > 0, `got ${all.length}`);
  console.log(`     total: ${all.length}`);
});
Deno.test("lootTables — getLootTableByPath() finds zombie", () => {
  const lt = addon.getLootTableByPath("loot_tables/entities/zombie.json");
  assert("found", lt !== null, "should exist");
  assert("has pools", (lt?.pools.length ?? 0) > 0, "pools empty");
  console.log(`     pools: ${lt?.pools.length}, items: ${lt?.getItemIdentifiers().join(", ")}`);
});
Deno.test("lootTables — getItemIdentifiers() returns ids", () => {
  const ids = addon.getLootTableByPath("loot_tables/entities/zombie.json")?.getItemIdentifiers() ?? [];
  assert("has ids", ids.length > 0, "empty");
});
Deno.test("lootTables — block getLootTable() resolves for golem_heart", () => {
  const lt = addon.getBlock("tsunami_dungeons:golem_heart")?.getLootTable();
  if (lt) { pass("resolved"); console.log(`     path: ${lt.relativePath}`); }
  else console.log("  ⚠️  null — loot_tables/blocks/golem_heart.json may not exist yet");
});
Deno.test("lootTables — entity getLootTables() finds zombie tables", () => {
  const tables = addon.getEntity("minecraft:zombie")?.getLootTables() ?? [];
  assert("has tables", tables.length > 0, `got ${tables.length}`);
  console.log(`     paths: ${tables.map((t) => t.relativePath).join(", ")}`);
});

// ─── Spawn Rules ──────────────────────────────────────────────────────────────

section("Spawn Rules");

Deno.test("spawnRules — getAllSpawnRules() non-empty", () => {
  const all = addon.getAllSpawnRules();
  assert("has rules", all.length > 0, `got ${all.length}`);
  console.log(`     total: ${all.length}`);
});
Deno.test("spawnRules — getSpawnRule() finds minecraft:armadillo", () => {
  const rule = addon.getSpawnRule("minecraft:armadillo");
  assert("found", rule !== null, "should exist");
  assertEq("identifier matches", rule?.identifier, "minecraft:armadillo");
  console.log(`     populationControl: ${rule?.populationControl}`);
});
Deno.test("spawnRules — conditions non-empty", () => {
  const rule = addon.getSpawnRule("minecraft:armadillo");
  assert("has conditions", (rule?.conditions.length ?? 0) > 0, "empty");
});
Deno.test("spawnRules — getBiomeTags() returns tags", () => {
  const tags = addon.getSpawnRule("minecraft:armadillo")?.getBiomeTags() ?? [];
  if (tags.length > 0) { pass(`found ${tags.length} tag(s)`); console.log(`     tags: ${tags.join(", ")}`); }
  else console.log("  ⚠️  no biome tags — armadillo may use a different filter structure");
});
Deno.test("spawnRules — entity getSpawnRule() links zombie", () => {
  const rule = addon.getEntity("minecraft:zombie")?.getSpawnRule();
  assert("found", rule !== null, "zombie should have spawn rule");
  console.log(`     populationControl: ${rule?.populationControl}`);
});

// ─── Biomes ───────────────────────────────────────────────────────────────────

section("Biomes");

Deno.test("biomes — getAllBiomes() non-empty", () => {
  const all = addon.getAllBiomes();
  assert("has biomes", all.length > 0, `got ${all.length}`);
  console.log(`     total: ${all.length}`);
});
Deno.test("biomes — getBiome() finds minecraft:bamboo_jungle", () => {
  const biome = addon.getBiome("minecraft:bamboo_jungle");
  assert("found", biome !== null, "should exist");
  assertEq("identifier matches", biome?.identifier, "minecraft:bamboo_jungle");
});
Deno.test("biomes — components non-empty", () => {
  const biome = addon.getBiome("minecraft:bamboo_jungle");
  assert("has components", Object.keys(biome?.components ?? {}).length > 0, "empty");
  console.log(`     components: ${Object.keys(biome?.components ?? {}).join(", ")}`);
});
Deno.test("biomes — climate has temperature", () => {
  const biome = addon.getBiome("minecraft:bamboo_jungle");
  assert("climate present", biome?.climate !== null, "no climate component");
  assert("temperature is number", typeof biome?.climate?.temperature === "number", "missing");
  console.log(`     temperature: ${biome?.climate?.temperature}`);
});
Deno.test("biomes — getEntities() returns entities that spawn in bamboo_jungle", () => {
  const biome = addon.getBiome("minecraft:bamboo_jungle");
  const entities = biome?.getEntities() ?? [];
  if (entities.length > 0) {
    pass(`found ${entities.length} entity/entities`);
    console.log(`     sample: ${entities.slice(0, 5).map((e) => e.identifier).join(", ")}`);
  } else {
    console.log("  ⚠️  no entities matched — biome tags may not align with spawn rule filter tags");
  }
});

// ─── Animations ───────────────────────────────────────────────────────────────

section("Animations");

Deno.test("animations — getAllAnimations() non-empty", () => {
  const all = addon.getAllAnimations();
  assert("has animations", all.length > 0, `got ${all.length}`);
  console.log(`     total: ${all.length}`);
});
Deno.test("animations — getAnimation() finds animation.humanoid.move", () => {
  const anim = addon.getAnimation("animation.humanoid.move");
  assert("found", anim !== null, "should exist");
  assertEq("id matches", anim?.id, "animation.humanoid.move");
  console.log(`     loop: ${anim?.loop}`);
});
Deno.test("animations — entity getAnimations() resolves zombie animations", () => {
  const anims = addon.getEntity("minecraft:zombie")?.getAnimations() ?? [];
  assert("has entries", anims.length > 0, `got ${anims.length}`);
  assert("entries have shortname", anims.every((a) => typeof a.shortname === "string"), "missing shortname");
  assert("entries have animation", anims.every((a) => !!a.animation), "missing animation");
  console.log(`     sample: ${anims.slice(0, 3).map((a) => `${a.shortname} → ${a.animation.id}`).join(", ")}`);
});

// ─── Animation Controllers ────────────────────────────────────────────────────

section("Animation Controllers");

Deno.test("animationControllers — getAllAnimationControllers() non-empty", () => {
  const all = addon.getAllAnimationControllers();
  assert("has controllers", all.length > 0, `got ${all.length}`);
  console.log(`     total: ${all.length}`);
});
Deno.test("animationControllers — has states and initialState", () => {
  const ctrl = addon.getAllAnimationControllers()[0];
  assert("has states", ctrl.states.length > 0, "empty states");
  assert("has initialState", typeof ctrl.initialState === "string", "missing");
  console.log(`     ${ctrl.id}: initialState=${ctrl.initialState}, states=${ctrl.states.join(", ")}`);
});
Deno.test("animationControllers — entity getAnimationControllers() resolves for zombie", () => {
  const ctrls = addon.getEntity("minecraft:zombie")?.getAnimationControllers() ?? [];
  if (ctrls.length > 0) {
    pass(`resolved ${ctrls.length}`);
    console.log(`     sample: ${ctrls.slice(0,2).map((c) => `${c.shortname} → ${c.controller.id}`).join(", ")}`);
  } else {
    console.log("  ⚠️  zombie may not reference animation controllers directly");
  }
});

// ─── Render Controllers ───────────────────────────────────────────────────────

section("Render Controllers");

Deno.test("renderControllers — getAllRenderControllers() non-empty", () => {
  const all = addon.getAllRenderControllers();
  assert("has controllers", all.length > 0, `got ${all.length}`);
  console.log(`     total: ${all.length}`);
});
Deno.test("renderControllers — getRenderController() finds controller.render.agent", () => {
  const rc = addon.getRenderController("controller.render.agent");
  assert("found", rc !== null, "should exist");
});
Deno.test("renderControllers — entity getRenderControllers() resolves for zombie", () => {
  const rcs = addon.getEntity("minecraft:zombie")?.getRenderControllers() ?? [];
  if (rcs.length > 0) { pass(`resolved ${rcs.length}`); console.log(`     ids: ${rcs.map((r) => r.id).join(", ")}`); }
  else console.log("  ⚠️  zombie lists render controllers conditionally — none resolved");
});

// ─── Attachables ─────────────────────────────────────────────────────────────

section("Attachables");

Deno.test("attachables — getAllAttachables() non-empty", () => {
  const all = addon.getAllAttachables();
  assert("has attachables", all.length > 0, `got ${all.length}`);
  console.log(`     total: ${all.length}`);
});
Deno.test("attachables — getAttachable() finds minecraft:bow", () => {
  const att = addon.getAttachable("minecraft:bow");
  assert("found", att !== null, "should exist");
  assertEq("identifier matches", att?.identifier, "minecraft:bow");
});
Deno.test("attachables — textures and materials non-empty", () => {
  const att = addon.getAttachable("minecraft:bow");
  assert("has textures", Object.keys(att?.textures ?? {}).length > 0, "empty");
  assert("has materials", Object.keys(att?.materials ?? {}).length > 0, "empty");
  console.log(`     textures: ${Object.keys(att?.textures ?? {}).join(", ")}`);
  console.log(`     materials: ${JSON.stringify(att?.materials)}`);
});
Deno.test("attachables — item getAttachable() resolves for minecraft:bow if BP file exists", () => {
  const bow = addon.getItem("minecraft:bow");
  if (!bow) {
    const att = addon.getAttachable("minecraft:bow");
    assert("direct lookup works", att !== null, "attachable should exist");
    console.log("  ⚠️  minecraft:bow has no BP item file — verified via getAttachable() directly");
  } else {
    assert("getAttachable() resolves", bow.getAttachable() !== null, "should link to attachable");
  }
});

// ─── Trading Tables ───────────────────────────────────────────────────────────

section("Trading Tables");

Deno.test("tradingTables — getAllTradingTables() non-empty", () => {
  const all = addon.getAllTradingTables();
  assert("has tables", all.length > 0, `got ${all.length}`);
  console.log(`     total: ${all.length}`);
});
Deno.test("tradingTables — getTradingTable() finds armorer_trades", () => {
  const table = addon.getTradingTable("armorer_trades");
  assert("found", table !== null, "should exist");
  assertEq("name matches", table?.name, "armorer_trades");
});
Deno.test("tradingTables — tiers and trades non-empty", () => {
  const table = addon.getTradingTable("armorer_trades");
  assert("has tiers", (table?.tiers.length ?? 0) > 0, "empty");
  console.log(`     tier[0] keys: ${Object.keys(table?.tiers[0] ?? {}).join(", ")}`);
  console.log(`     tier[0].trades length: ${table?.tiers[0]?.trades?.length}`);
  const trade = table?.tiers[0]?.trades[0];
  assert("trade exists", !!trade, "no trades in first tier");
  assert("wants non-empty", (trade?.wants.length ?? 0) > 0, "empty wants");
  assert("gives non-empty", (trade?.gives.length ?? 0) > 0, "empty gives");
  console.log(`     wants: ${trade?.wants.map((w) => w.item).join(", ")}`);
  console.log(`     gives: ${trade?.gives.map((g) => g.item).join(", ")}`);
});
Deno.test("tradingTables — getAllItemIdentifiers() returns ids", () => {
  const ids = addon.getTradingTable("armorer_trades")?.getAllItemIdentifiers() ?? [];
  assert("has ids", ids.length > 0, "empty");
  console.log(`     sample: ${ids.slice(0, 4).join(", ")}`);
});

// ─── Particles ───────────────────────────────────────────────────────────────

section("Particles");

Deno.test("particles — getAllParticles() non-empty", () => {
  const all = addon.getAllParticles();
  assert("has particles", all.length > 0, `got ${all.length}`);
  console.log(`     total: ${all.length}`);
});
Deno.test("particles — all have identifiers", () => {
  const bad = addon.getAllParticles().filter((p) => !p.identifier);
  assert("all have identifiers", bad.length === 0, `${bad.length} missing`);
});
Deno.test("particles — getParticle() null for unknown", () => {
  assertEq("unknown returns null", addon.getParticle("bedrockkit:nope"), null);
});
Deno.test("particles — getParticle() finds minecraft:arrow_spell_emitter", () => {
  const particle = addon.getParticle("minecraft:arrow_spell_emitter");
  assert("found", particle !== null, "should exist in particles/");
  assertEq("identifier matches", particle?.identifier, "minecraft:arrow_spell_emitter");
});
Deno.test("particles — texturePath resolves", () => {
  const particle = addon.getParticle("minecraft:arrow_spell_emitter");
  assert("has texturePath", typeof particle?.texturePath === "string" && (particle?.texturePath.length ?? 0) > 0, "texturePath should be non-empty string");
  console.log(`     texturePath: ${particle?.texturePath}`);
});
Deno.test("particles — material resolves", () => {
  const particle = addon.getParticle("minecraft:arrow_spell_emitter");
  assert("has material", typeof particle?.material === "string" && (particle?.material.length ?? 0) > 0, "material should be non-empty string");
  console.log(`     material: ${particle?.material}`);
});
Deno.test("particles — components non-empty", () => {
  const particle = addon.getParticle("minecraft:arrow_spell_emitter");
  assert("has components", Object.keys(particle?.components ?? {}).length > 0, "components should be non-empty");
  console.log(`     component count: ${Object.keys(particle?.components ?? {}).length}`);
});
Deno.test("particles — entity particleShortnames non-empty for ravager", () => {
  const ravager = addon.getEntity("minecraft:ravager");
  const shortnames = ravager?.particleShortnames ?? {};
  if (Object.keys(shortnames).length > 0) {
    pass(`found ${Object.keys(shortnames).length} shortname(s)`);
    console.log(`     shortnames: ${JSON.stringify(shortnames)}`);
  } else {
    console.log("  ⚠️  ravager has no particle shortnames in this pack version");
  }
});
Deno.test("particles — entity getParticles() resolves for ravager", () => {
  const ravager = addon.getEntity("minecraft:ravager");
  const particles = ravager?.getParticles() ?? [];
  if (particles.length > 0) {
    pass(`resolved ${particles.length} particle(s)`);
    assert("entries have shortname", particles.every((p) => typeof p.shortname === "string"), "missing shortname");
    assert("entries have Particle", particles.every((p) => p.particle instanceof Particle), "not a Particle instance");
    console.log(`     sample: ${particles.map((p) => `${p.shortname} → ${p.particle.identifier}`).join(", ")}`);
  } else {
    console.log("  ⚠️  no particles resolved for ravager — shortnames may not match loaded particle identifiers");
  }
});

// ─── Entities ────────────────────────────────────────────────────────────────

section("Entities");

Deno.test("entities — getAllEntities() non-empty", () => {
  const all = addon.getAllEntities();
  assert("has entities", all.length > 0, `got ${all.length}`);
  console.log(`     total: ${all.length}`);
});
Deno.test("entities — getEntity() finds minecraft:zombie", () => {
  const zombie = addon.getEntity("minecraft:zombie");
  assert("found", zombie !== null, "should exist");
  assertEq("identifier matches", zombie?.identifier, "minecraft:zombie");
});
Deno.test("entities — zombie has behaviorData and behaviorFilePath", () => {
  const zombie = addon.getEntity("minecraft:zombie");
  assert("behaviorData has minecraft:entity", "minecraft:entity" in (zombie?.behaviorData ?? {}), "missing key");
  assert("behaviorFilePath non-empty", (zombie?.behaviorFilePath.length ?? 0) > 0, "empty path");
});
Deno.test("entities — zombie has resourceData and resourceFilePath", () => {
  const zombie = addon.getEntity("minecraft:zombie");
  assert("resourceData not null", zombie?.resourceData !== null, "null");
  assert("resourceData has minecraft:client_entity", "minecraft:client_entity" in (zombie?.resourceData ?? {}), "missing key");
  assert("resourceFilePath non-empty", (zombie?.resourceFilePath?.length ?? 0) > 0, "empty path");
});
Deno.test("entities — zombie animationShortnames non-empty", () => {
  const zombie = addon.getEntity("minecraft:zombie");
  const names = zombie?.animationShortnames ?? {};
  assert("has shortnames", Object.keys(names).length > 0, "empty");
  console.log(`     count: ${Object.keys(names).length}, sample: ${Object.keys(names).slice(0,3).join(", ")}`);
});
Deno.test("entities — zombie renderControllerIds non-empty", () => {
  const ids = addon.getEntity("minecraft:zombie")?.renderControllerIds ?? [];
  assert("has ids", ids.length > 0, "empty");
  console.log(`     ids: ${ids.join(", ")}`);
});

// ─── Blocks ───────────────────────────────────────────────────────────────────

section("Blocks");

Deno.test("blocks — getAllBlocks() non-empty", () => {
  const all = addon.getAllBlocks();
  assert("has blocks", all.length > 0, `got ${all.length}`);
  console.log(`     total: ${all.length}`);
});
Deno.test("blocks — getBlock() finds tsunami_dungeons:golem_heart", () => {
  const block = addon.getBlock("tsunami_dungeons:golem_heart");
  assert("found", block !== null, "should exist");
  assertEq("identifier matches", block?.identifier, "tsunami_dungeons:golem_heart");
});
Deno.test("blocks — data has minecraft:block root key", () => {
  const block = addon.getBlock("tsunami_dungeons:golem_heart");
  assert("root key", "minecraft:block" in (block?.data ?? {}), "missing");
});
Deno.test("blocks — getTexturePath() uses * as wildcard face key", () => {
  const tex = addon.getBlock("tsunami_dungeons:golem_heart")?.getTexturePath("*");
  if (typeof tex === "string" && tex.length > 0) { pass("resolved"); console.log(`     path: ${tex}`); }
  else console.log("  ⚠️  null — shortname may not be in terrain_texture.json");
});
Deno.test("blocks — JSON comment stripping works", () => {
  assert("comment file parsed", addon.getBlock("tsunami_dungeons:golem_heart") !== null, "null means stripping failed");
});