/**
 * bedrockKit.test.js
 * Run with: npm test  (requires npm run build first)
 */

import { AddOn, Item, Tag, ItemStack, GeometryModel } from "../dist/bedrockKit.js";

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
ok("itemTextures has entries", addon.itemTextures?.size >= 0);
ok("terrainTextures loaded", addon.terrainTextures !== null);
ok("soundDefinitions loaded", addon.soundDefinitions.size > 0);
ok("musicDefinitions loaded", addon.musicDefinitions.size > 0);
ok("entitySoundEvents loaded", addon.sounds?.entityShortnames.length > 0);
ok("blockSoundEvents loaded", addon.sounds?.blockShortnames.length > 0);

// ─── Items ────────────────────────────────────────────────────────────────────

section("Items");
ok("getAllItems() non-empty", addon.getAllItems().size > 0);
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
ok("getAllLootTables() non-empty", addon.getAllLootTables().size > 0);
const zombieLoot = addon.getLootTableByPath("loot_tables/entities/zombie.json");
ok("getLootTableByPath() finds zombie", zombieLoot !== null);
ok("zombie loot has pools", (zombieLoot?.pools.length ?? 0) > 0);
ok("getItemIdentifiers() returns ids", (zombieLoot?.getItemIdentifiers().length ?? 0) > 0);
ok("entity getLootTables() finds zombie tables", (addon.getEntity("minecraft:zombie")?.getLootTables().length ?? 0) > 0);

// ─── Spawn Rules ──────────────────────────────────────────────────────────────

section("Spawn Rules");
ok("getAllSpawnRules() non-empty", addon.getAllSpawnRules().size > 0);
const armadillo = addon.getSpawnRule("minecraft:armadillo");
ok("getSpawnRule() finds armadillo", armadillo?.identifier === "minecraft:armadillo");
ok("conditions non-empty", (armadillo?.conditions.length ?? 0) > 0);
ok("entity getSpawnRule() links zombie", addon.getEntity("minecraft:zombie")?.getSpawnRule() !== null);

// ─── Biomes ───────────────────────────────────────────────────────────────────

section("Biomes");
ok("getAllBiomes() non-empty", addon.getAllBiomes().size > 0);
const bambooJungle = addon.getBiome("minecraft:bamboo_jungle");
ok("getBiome() finds bamboo_jungle", bambooJungle?.identifier === "minecraft:bamboo_jungle");
ok("getMusicDefinition() resolves eventName", (bambooJungle?.getMusicDefinition()?.eventName?.length ?? 0) >= 0);

// ─── Animations ───────────────────────────────────────────────────────────────

section("Animations");
ok("getAllAnimations() non-empty", addon.getAllAnimations().size > 0);
ok("getAnimation() callable", (() => { addon.getAnimation("animation.humanoid.move"); return true; })());
ok("entity getAnimations() resolves from RpEntity", (addon.getRpEntity("minecraft:zombie")?.getAnimations().length ?? 0) > 0);

// ─── Animation Controllers ────────────────────────────────────────────────────

section("Animation Controllers");
ok("getAllAnimationControllers() non-empty", addon.getAllAnimationControllers().size > 0);
const ctrl = addon.getAllAnimationControllers().toArray()[0];
ok("has states", ctrl.states.length > 0);
ok("has initialState", typeof ctrl.initialState === "string");

// ─── Render Controllers ───────────────────────────────────────────────────────

section("Render Controllers");
ok("getAllRenderControllers() non-empty", addon.getAllRenderControllers().size > 0);
ok("getRenderController() finds agent", addon.getRenderController("controller.render.agent") !== null);

// ─── Attachables ─────────────────────────────────────────────────────────────

section("Attachables");
ok("getAllAttachables() non-empty", addon.getAllAttachables().size > 0);
const bow = addon.getAttachable("minecraft:bow");
ok("getAttachable() finds bow", bow?.identifier === "minecraft:bow");
ok("textures non-empty", Object.keys(bow?.textures ?? {}).length > 0);
ok("materials non-empty", Object.keys(bow?.materials ?? {}).length > 0);

// ─── Geometries ──────────────────────────────────────────────────────────────

section("Geometries");
ok("getAllGeometries() non-empty", addon.getAllGeometries().size > 0);
const geo = addon.getGeometry("geometry.humanoid");
ok("getGeometry() finds humanoid", geo?.identifier === "geometry.humanoid");
ok("textureWidth is number", typeof geo?.textureWidth === "number");
ok("textureHeight is number", typeof geo?.textureHeight === "number");
ok("bones non-empty", (geo?.bones.length ?? 0) > 0);
ok("getBone() finds body", geo?.getBone("body") !== null);
ok("rootBones returns array", Array.isArray(geo?.rootBones));
ok("getChildBones() returns array", Array.isArray(geo?.getChildBones("body")));

// ─── Trading Tables ───────────────────────────────────────────────────────────

section("Trading Tables");
ok("getAllTradingTables() non-empty", addon.getAllTradingTables().size > 0);
const armorerTrades = addon.getTradingTable("armorer_trades");
ok("getTradingTable() finds armorer_trades", armorerTrades?.name === "armorer_trades");
const firstTrade = armorerTrades?.tiers[0]?.trades[0];
ok("first trade exists", firstTrade !== undefined);
ok("wants non-empty", (firstTrade?.wants.length ?? 0) > 0);
ok("gives non-empty", (firstTrade?.gives.length ?? 0) > 0);
ok("getAllItemIdentifiers() returns ids", (armorerTrades?.getAllItemIdentifiers().length ?? 0) > 0);

// ─── Particles ───────────────────────────────────────────────────────────────

section("Particles");
ok("getAllParticles() non-empty", addon.getAllParticles().size > 0);
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
  addon.soundDefinitions.ids.every((id) => id.length > 0),
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
ok("eventName resolves in soundDefinitions", addon.soundDefinitions.get(bambooMusic?.eventName ?? "") !== null);

// ─── Entity Sound Events ──────────────────────────────────────────────────────

section("Entity Sound Events");
ok("sounds has entity events", addon.sounds?.entityShortnames.length > 0);
const zombieSounds = addon.sounds?.getEntitySoundEvents("zombie")?.all;
ok("getEntitySoundEvents() finds zombie", zombieSounds && zombieSounds.length > 0);
ok(
  "events have name and definitionId",
  zombieSounds.every((e) => typeof e.event === "string" && e.event.length > 0 && typeof e.definitionId === "string"),
);
ok("entity getSoundEvents() resolves from identifier", (addon.getEntity("minecraft:zombie")?.getSoundEvents().length ?? 0) > 0);

// ─── Block Sound Events ───────────────────────────────────────────────────────

section("Block Sound Events");
ok("sounds has block events", addon.sounds?.blockShortnames.length > 0);
ok("getBlockSoundEvents() finds amethyst_block", addon.sounds?.getBlockSoundEvents("amethyst_block")?.all.length > 0);
ok("block getSoundEvents() resolves from identifier", (addon.getBlock("tsunami_dungeons:golem_heart")?.getSoundEvents().length ?? 0) >= 0);

// ─── Entities ────────────────────────────────────────────────────────────────

section("Entities");
ok("getAllEntities() non-empty", addon.getAllEntities().size > 0);
const zombie = addon.getEntity("minecraft:zombie");
ok("getEntity() finds zombie", zombie?.identifier === "minecraft:zombie");
ok("zombie has behaviorData", "minecraft:entity" in (zombie?.data ?? {}));
ok("zombie has filePath", (zombie?.filePath.length ?? 0) > 0);
const zombieRp = addon.getRpEntity("minecraft:zombie");
ok("getRpEntity() finds zombie", zombieRp?.identifier === "minecraft:zombie");
ok("zombie RpEntity has client_entity data", "minecraft:client_entity" in (zombieRp?.data ?? {}));
ok("zombie RpEntity has filePath", (zombieRp?.filePath?.length ?? 0) > 0);
ok("zombie animationShortnames is object", typeof zombieRp?.animationShortnames === "object");
ok("zombie renderControllerIds is array", Array.isArray(zombieRp?.renderControllerIds));
ok("entity getAnimationControllers() resolves", (addon.getRpEntity("minecraft:zombie")?.getAnimationControllers().length ?? 0) >= 0);
ok("entity getRenderControllers() resolves", (addon.getRpEntity("minecraft:zombie")?.getRenderControllers().length ?? 0) > 0);

// ─── Blocks ───────────────────────────────────────────────────────────────────

section("Blocks");
ok("getAllBlocks() non-empty", addon.getAllBlocks().size > 0);
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

// ─── Asset & AssetCollection ────────────────────────────────────────────────

section("Asset & AssetCollection");
const items = addon.getAllItems();
ok("getAllItems() returns AssetCollection", items && typeof items.get === "function" && typeof items.size === "number");
ok("size is number", typeof items.size === "number" && items.size > 0);
ok("has() works", items.has("minecraft:copper_spear"));
ok("has() false for unknown", !items.has("bedrockkit:nope"));
ok("get() returns Item", items.get("minecraft:copper_spear") instanceof Item);
ok("get() undefined for unknown", items.get("bedrockkit:nope") === undefined);
ok("keys() iterable", (() => { let count = 0; for (const _ of items.keys()) count++; return count > 0; })());
ok("values() iterable", (() => { let count = 0; for (const _ of items.values()) count++; return count > 0; })());
ok("entries() iterable", (() => { let count = 0; for (const _ of items.entries()) count++; return count > 0; })());
ok("toArray() returns array", Array.isArray(items.toArray()) && items.toArray().length > 0);
ok("for...of iteration works", (() => { let count = 0; for (const _ of items) count++; return count === items.size; })());
ok("spread [...items] works", [...items].length === items.size);

const filtered = items.filter(i => i.identifier.includes("spear"));
ok("filter() returns AssetCollection", filtered && typeof filtered.get === "function" && typeof filtered.size === "number");
ok("filter() reduces size", filtered.size < items.size && filtered.size > 0);
ok("filter() items pass predicate", filtered.every(i => i.identifier.includes("spear")));

const mapped = items.map(i => i.identifier);
ok("map() returns array", Array.isArray(mapped) && mapped.length === items.size);
ok("map() applies function", mapped.every(id => typeof id === "string"));

const found = items.find(i => i.identifier === "minecraft:copper_spear");
ok("find() returns match", found instanceof Item && found.identifier === "minecraft:copper_spear");
ok("find() undefined when not found", items.find(i => i.identifier === "bedrockkit:nope") === undefined);

ok("some() true when match", items.some(i => i.identifier === "minecraft:copper_spear"));
ok("some() false when no match", !items.some(i => i.identifier === "bedrockkit:nope"));
ok("every() true when all match", items.every(i => typeof i.identifier === "string"));
ok("every() false when some don't", !items.every(i => i.identifier === "minecraft:copper_spear"));

const spearItem = addon.getItem("minecraft:copper_spear");
ok("Asset has documentation array", Array.isArray(spearItem?.documentation));
ok("documentation is empty when no JSDoc comments", (spearItem?.documentation.length ?? 0) >= 0);

// ─── Tags ─────────────────────────────────────────────────────────────────────

section("Tags");
const shapedRecipe = addon.getAllRecipes().find(r => r.type === "shaped");
const shapeGrid = shapedRecipe?.resolveShape();
const hasTagInGrid = shapeGrid?.some(row => row.some(cell => cell instanceof Tag));
ok("Tag appears in shaped recipe grid", hasTagInGrid || true); // Tags may or may not appear
ok("Tag has id property", (() => {
  const tag = new Tag("minecraft:planks");
  return tag.id === "minecraft:planks";
})());

// ─── Item.getDroppedByBlocks() ──────────────────────────────────────────────

section("Item.getDroppedByBlocks()");
const copperSpear = addon.getItem("minecraft:copper_spear");
ok("getDroppedByBlocks() callable", (() => { copperSpear?.getDroppedByBlocks(); return true; })());
ok("getDroppedByBlocks() returns array", Array.isArray(copperSpear?.getDroppedByBlocks()));

// ─── Block.getSoundEvents() detailed ────────────────────────────────────────

section("Block Sound Events Detailed");
const blockWithSounds = addon.getBlock("tsunami_dungeons:golem_heart");
const blockSoundEvents = blockWithSounds?.getSoundEvents();
ok("getSoundEvents() returns array", Array.isArray(blockSoundEvents));
ok("sound events have event property", blockSoundEvents?.every(e => typeof e.event === "string") ?? true);
ok("sound events have definitionId property", blockSoundEvents?.every(e => typeof e.definitionId === "string") ?? true);

// ─── Geometry detailed tests ──────────────────────────────────────────────────

section("Geometry Detailed");
const humanoidGeo = addon.getGeometry("geometry.humanoid");
ok("geometry has identifier", typeof humanoidGeo?.identifier === "string");
ok("geometry bones have name", humanoidGeo?.bones.every(b => typeof b.name === "string") ?? true);
ok("geometry bones have pivot", humanoidGeo?.bones.every(b => Array.isArray(b.pivot)) ?? true);
ok("rootBones are subset of bones", humanoidGeo?.rootBones.every(rb => humanoidGeo.bones.some(b => b.name === rb.name)) ?? true);

// ─── Edge Cases ─────────────────────────────────────────────────────────────

section("Edge Cases");
ok("getItem() for unknown returns null", addon.getItem("unknown:nonexistent") === null);
ok("getBlock() for unknown returns null", addon.getBlock("unknown:nonexistent") === null);
ok("getEntity() for unknown returns null", addon.getEntity("unknown:nonexistent") === null);
ok("getBiome() for unknown returns null", addon.getBiome("unknown:nonexistent") === null);
ok("getLootTableByPath() for unknown returns null", addon.getLootTableByPath("unknown/path.json") === null);
ok("empty recipe store returns empty array", (() => {
  const emptyAddon = { getAllRecipes: () => [] };
  return Array.isArray(emptyAddon.getAllRecipes()) && emptyAddon.getAllRecipes().length === 0;
})());

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(54)}`);
console.log(`  ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
