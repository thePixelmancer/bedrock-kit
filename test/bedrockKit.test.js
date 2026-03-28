/**
 * bedrockKit.test.js
 * Run with: npm test  (requires npm run build first)
 */

import { AddOn, Item, Tag, ItemStack } from "../dist/bedrockKit.js";

const addon = new AddOn("./test/vanilla_behavior_pack", "./test/vanilla_resource_pack");

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
  ok(name, JSON.stringify(actual) === JSON.stringify(expected), `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function section(title) {
  console.log(`\n── ${title} ${"─".repeat(Math.max(0, 50 - title.length))}`);
}

// ─── AddOn ───────────────────────────────────────────────────────────────────

section("AddOn");
ok("behaviorPackPath set", addon.behaviorPackPath.length > 0);
ok("resourcePackPath set", addon.resourcePackPath.length > 0);
ok("itemTextures loaded", addon.itemTextures !== null);
ok("itemTextures texture_data non-empty", Object.keys(addon.itemTextures?.texture_data ?? {}).length > 0);
ok("terrainTextures loaded", addon.terrainTextures !== null);
ok("soundDefinitions loaded", addon.soundDefinitions.size > 0);
ok("musicDefinitions loaded", addon.musicDefinitions.size > 0);
ok("entitySoundEvents loaded", addon.entitySoundEvents.size > 0);
ok("blockSoundEvents loaded", addon.blockSoundEvents.size > 0);

// ─── Items ────────────────────────────────────────────────────────────────────

section("Items");
ok("getAllItems() non-empty", addon.getAllItems().length > 0);
ok(
  "all have identifiers",
  addon.getAllItems().every((i) => i.identifier.length > 0),
);
eq("getItem() null for unknown", addon.getItem("bedrockkit:nope"), null);
ok("getItem() finds copper_spear", addon.getItem("minecraft:copper_spear")?.identifier === "minecraft:copper_spear");
ok("data has minecraft:item key", "minecraft:item" in (addon.getItem("minecraft:copper_spear")?.data ?? {}));
ok("getTexturePath() resolves", typeof addon.getItem("minecraft:copper_spear")?.getTexturePath() === "string");
ok("getRecipes() returns recipes", (addon.getItem("minecraft:copper_spear")?.getRecipes().length ?? 0) > 0);

// ─── Recipes ─────────────────────────────────────────────────────────────────

section("Recipes");
ok("getAllRecipes() non-empty", addon.getAllRecipes().length > 0);
ok(
  "all have valid types",
  addon.getAllRecipes().every((r) => ["shaped", "shapeless", "furnace", "brewing_mix", "brewing_container", "unknown"].includes(r.type)),
);
ok("getRecipesFor() finds copper_spear", addon.getRecipesFor("minecraft:copper_spear").length > 0);

const shapedSpear = addon.getRecipesFor("minecraft:copper_spear").find((r) => r.type === "shaped");
const grid = shapedSpear?.resolveShape();
ok("resolveShape() returns 2D grid", Array.isArray(grid) && grid.length > 0 && grid.every((row) => Array.isArray(row)));
ok("grid cells are Item/Tag/null", grid?.every((row) => row.every((c) => c === null || c instanceof Item || c instanceof Tag)) ?? false);
eq(
  "resolveShape() null for non-shaped",
  addon
    .getAllRecipes()
    .find((r) => r.type === "furnace")
    ?.resolveShape(),
  null,
);
eq("resolveShapeless() null for non-shapeless", shapedSpear?.resolveShapeless(), null);
eq("resolveFurnace() null for non-furnace", shapedSpear?.resolveFurnace(), null);
eq("resolveBrewing() null for non-brewing", shapedSpear?.resolveBrewing(), null);

const stack = addon.getRecipesFor("minecraft:copper_spear")[0]?.getResultStack();
ok("getResultStack() returns ItemStack", stack instanceof ItemStack);
eq("getResultStack() identifier", stack?.identifier, "minecraft:copper_spear");
ok("getResultStack() count is number", typeof stack?.count === "number");

ok("getRecipesUsingItem() finds stick", addon.getRecipesUsingItem("minecraft:stick").length > 0);
eq("getRecipesUsingItem() empty for unknown", addon.getRecipesUsingItem("bedrockkit:nope").length, 0);
ok("getRecipesUsingTag() finds stone_crafting_materials", addon.getRecipesUsingTag("minecraft:stone_crafting_materials").length > 0);
eq("getRecipesUsingTag() empty for unknown", addon.getRecipesUsingTag("bedrockkit:nope").length, 0);

// ─── Loot Tables ─────────────────────────────────────────────────────────────

section("Loot Tables");
ok("getAllLootTables() non-empty", addon.getAllLootTables().length > 0);
const zombieLoot = addon.getLootTableByPath("loot_tables/entities/zombie.json");
ok("getLootTableByPath() finds zombie", zombieLoot !== null);
ok("zombie loot has pools", (zombieLoot?.pools.length ?? 0) > 0);
ok("getItemIdentifiers() returns ids", (zombieLoot?.getItemIdentifiers().length ?? 0) > 0);
ok("entity getLootTables() finds zombie tables", (addon.getEntity("minecraft:zombie")?.getLootTables().length ?? 0) > 0);

// ─── Spawn Rules ──────────────────────────────────────────────────────────────

section("Spawn Rules");
ok("getAllSpawnRules() non-empty", addon.getAllSpawnRules().length > 0);
const armadillo = addon.getSpawnRule("minecraft:armadillo");
ok("getSpawnRule() finds armadillo", armadillo?.identifier === "minecraft:armadillo");
ok("conditions non-empty", (armadillo?.conditions.length ?? 0) > 0);
ok("entity getSpawnRule() links zombie", addon.getEntity("minecraft:zombie")?.getSpawnRule() !== null);

// ─── Biomes ───────────────────────────────────────────────────────────────────

section("Biomes");
ok("getAllBiomes() non-empty", addon.getAllBiomes().length > 0);
const bambooJungle = addon.getBiome("minecraft:bamboo_jungle");
ok("getBiome() finds bamboo_jungle", bambooJungle?.identifier === "minecraft:bamboo_jungle");
ok("components non-empty", Object.keys(bambooJungle?.components ?? {}).length > 0);
ok("climate has temperature", typeof bambooJungle?.climate?.temperature === "number");
ok("getMusicDefinition() resolves eventName", (bambooJungle?.getMusicDefinition()?.eventName.length ?? 0) > 0);

// ─── Animations ───────────────────────────────────────────────────────────────

section("Animations");
ok("getAllAnimations() non-empty", addon.getAllAnimations().length > 0);
ok("getAnimation() finds animation.humanoid.move", addon.getAnimation("animation.humanoid.move")?.id === "animation.humanoid.move");
ok("entity getAnimations() resolves", (addon.getEntity("minecraft:zombie")?.getAnimations().length ?? 0) > 0);

// ─── Animation Controllers ────────────────────────────────────────────────────

section("Animation Controllers");
ok("getAllAnimationControllers() non-empty", addon.getAllAnimationControllers().length > 0);
const ctrl = addon.getAllAnimationControllers()[0];
ok("has states", ctrl.states.length > 0);
ok("has initialState", typeof ctrl.initialState === "string");

// ─── Render Controllers ───────────────────────────────────────────────────────

section("Render Controllers");
ok("getAllRenderControllers() non-empty", addon.getAllRenderControllers().length > 0);
ok("getRenderController() finds agent", addon.getRenderController("controller.render.agent") !== null);

// ─── Attachables ─────────────────────────────────────────────────────────────

section("Attachables");
ok("getAllAttachables() non-empty", addon.getAllAttachables().length > 0);
const bow = addon.getAttachable("minecraft:bow");
ok("getAttachable() finds bow", bow?.identifier === "minecraft:bow");
ok("textures non-empty", Object.keys(bow?.textures ?? {}).length > 0);
ok("materials non-empty", Object.keys(bow?.materials ?? {}).length > 0);

// ─── Trading Tables ───────────────────────────────────────────────────────────

section("Trading Tables");
ok("getAllTradingTables() non-empty", addon.getAllTradingTables().length > 0);
const armorerTrades = addon.getTradingTable("armorer_trades");
ok("getTradingTable() finds armorer_trades", armorerTrades?.name === "armorer_trades");
const firstTrade = armorerTrades?.tiers[0]?.trades[0];
ok("first trade exists", firstTrade !== undefined);
ok("wants non-empty", (firstTrade?.wants.length ?? 0) > 0);
ok("gives non-empty", (firstTrade?.gives.length ?? 0) > 0);
ok("getAllItemIdentifiers() returns ids", (armorerTrades?.getAllItemIdentifiers().length ?? 0) > 0);

// ─── Particles ───────────────────────────────────────────────────────────────

section("Particles");
ok("getAllParticles() non-empty", addon.getAllParticles().length > 0);
ok(
  "all have identifiers",
  addon.getAllParticles().every((p) => p.identifier.length > 0),
);
eq("getParticle() null for unknown", addon.getParticle("bedrockkit:nope"), null);
const arrowSpell = addon.getParticle("minecraft:arrow_spell_emitter");
ok("getParticle() finds arrow_spell_emitter", arrowSpell?.identifier === "minecraft:arrow_spell_emitter");
ok("texturePath is string", typeof arrowSpell?.texturePath === "string");
ok("material is string", typeof arrowSpell?.material === "string");
ok("components non-empty", Object.keys(arrowSpell?.components ?? {}).length > 0);

// ─── Sound Definitions ────────────────────────────────────────────────────────

section("Sound Definitions");
ok("soundDefinitions non-empty", addon.soundDefinitions.size > 0);
ok(
  "all have ids",
  [...addon.soundDefinitions.values()].every((d) => d.id.length > 0),
);
eq("getSoundDefinition() null for unknown", addon.getSoundDefinition("bedrockkit:nope"), null);
const zombieSay = addon.getSoundDefinition("mob.zombie.say");
ok("getSoundDefinition() finds mob.zombie.say", zombieSay?.id === "mob.zombie.say");
ok("has category", typeof zombieSay?.category === "string");
ok("has files", (zombieSay?.files.length ?? 0) > 0);
ok("files have name", zombieSay?.files.every((f) => typeof f.name === "string" && f.name.length > 0) ?? false);

// ─── Music Definitions ────────────────────────────────────────────────────────

section("Music Definitions");
ok("musicDefinitions non-empty", addon.musicDefinitions.size > 0);
eq("getMusicDefinition() null for unknown", addon.getMusicDefinition("bedrockkit:nope"), null);
const bambooMusic = addon.getMusicDefinition("bamboo_jungle");
ok("getMusicDefinition() finds bamboo_jungle", bambooMusic?.id === "bamboo_jungle");
ok("has eventName", (bambooMusic?.eventName.length ?? 0) > 0);
ok("minDelay is number", typeof bambooMusic?.minDelay === "number");
ok("maxDelay is number", typeof bambooMusic?.maxDelay === "number");
ok("eventName resolves in soundDefinitions", addon.soundDefinitions.has(bambooMusic?.eventName ?? ""));

// ─── Entity Sound Events ──────────────────────────────────────────────────────

section("Entity Sound Events");
ok("entitySoundEvents non-empty", addon.entitySoundEvents.size > 0);
const zombieSounds = addon.getEntitySoundEvents("zombie");
ok("getEntitySoundEvents() finds zombie", zombieSounds.length > 0);
ok(
  "events have name and definitionId",
  zombieSounds.every((e) => typeof e.event === "string" && e.event.length > 0 && typeof e.definitionId === "string"),
);
ok("entity getSoundEvents() resolves from identifier", (addon.getEntity("minecraft:zombie")?.getSoundEvents().length ?? 0) > 0);

// ─── Block Sound Events ───────────────────────────────────────────────────────

section("Block Sound Events");
ok("blockSoundEvents non-empty", addon.blockSoundEvents.size > 0);
ok("getBlockSoundEvents() finds amethyst_block", addon.getBlockSoundEvents("amethyst_block").length > 0);
ok("block getSoundEvents() resolves from identifier", (addon.getBlock("tsunami_dungeons:golem_heart")?.getSoundEvents().length ?? 0) >= 0);

// ─── Entities ────────────────────────────────────────────────────────────────

section("Entities");
ok("getAllEntities() non-empty", addon.getAllEntities().length > 0);
const zombie = addon.getEntity("minecraft:zombie");
ok("getEntity() finds zombie", zombie?.identifier === "minecraft:zombie");
ok("zombie has behaviorData", "minecraft:entity" in (zombie?.behaviorData ?? {}));
ok("zombie has behaviorFilePath", (zombie?.behaviorFilePath.length ?? 0) > 0);
ok("zombie has resourceData", "minecraft:client_entity" in (zombie?.resourceData ?? {}));
ok("zombie has resourceFilePath", (zombie?.resourceFilePath?.length ?? 0) > 0);
ok("zombie animationShortnames non-empty", Object.keys(zombie?.animationShortnames ?? {}).length > 0);
ok("zombie renderControllerIds non-empty", (zombie?.renderControllerIds.length ?? 0) > 0);

// ─── Blocks ───────────────────────────────────────────────────────────────────

section("Blocks");
ok("getAllBlocks() non-empty", addon.getAllBlocks().length > 0);
const golemHeart = addon.getBlock("tsunami_dungeons:golem_heart");
ok("getBlock() finds golem_heart", golemHeart?.identifier === "tsunami_dungeons:golem_heart");
ok("data has minecraft:block key", "minecraft:block" in (golemHeart?.data ?? {}));
ok("JSON comment stripping works", golemHeart !== null);
ok(
  "getLootTable() does not throw",
  (() => {
    golemHeart?.getLootTable();
    return true;
  })(),
);

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(54)}`);
console.log(`  ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
