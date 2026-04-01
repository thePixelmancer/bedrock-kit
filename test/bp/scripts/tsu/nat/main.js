// filters_data/modular_mc/_shared/particleEmitter.ts
import {
  system
} from "@minecraft/server";
var component = {
  onRandomTick(event, data) {
    const params = data.params;
    const particles = params.particles;
    if (!particles) return;
    particles.forEach((particle) => {
      event.block.dimension.spawnParticle(particle, event.block.location);
    });
  }
};
system.beforeEvents.startup.subscribe((init) => {
  init.blockComponentRegistry.registerCustomComponent("tsu_nat:particle_emitter", component);
});

// filters_data/modular_mc/_shared/onConsumeEvent.ts
import {
  system as system2
} from "@minecraft/server";
var component2 = {
  onConsume: (event, args) => {
    const params = args.params;
    if (!params) return;
    if (params.clear_negative_effects === true) {
      clearNegativeEffects(event.source);
    }
    if (params.heal) {
      const hp = event.source.getComponent("minecraft:health");
      if (!hp) return;
      const clampedValue = Math.min(20, Math.max(0, hp.currentValue + params.heal));
      hp.setCurrentValue(clampedValue);
    }
    switch (params.effects) {
      case "mandrake_root":
        event.source.addEffect("speed", 20 * 60 * 3, {
          amplifier: 3,
          showParticles: true
        });
        event.source.addEffect("regeneration", 20 * 60 * 3, {
          amplifier: 3,
          showParticles: true
        });
        break;
    }
  }
};
system2.beforeEvents.startup.subscribe((init) => {
  init.itemComponentRegistry.registerCustomComponent("tsu_nat:on_consume_event", component2);
});
function clearNegativeEffects(entity) {
  entity.removeEffect("slowness");
  entity.removeEffect("weakness");
  entity.removeEffect("poison");
  entity.removeEffect("fatal_poison");
  entity.removeEffect("nausea");
  entity.removeEffect("blindness");
  entity.removeEffect("hunger");
  entity.removeEffect("mining_fatigue");
  entity.removeEffect("wither");
  entity.removeEffect("darkness");
  entity.removeEffect("infested");
}

// filters_data/modular_mc/_shared/customLadders.ts
import { system as system3, world } from "@minecraft/server";
function climb(player) {
  const block1 = player.dimension.getBlock(player.location);
  const block2 = block1?.above();
  if (!block1?.hasTag("tsu_nat:can_climb") && !block2?.hasTag("tsu_nat:can_climb")) return;
  const effect = player.isJumping ? "levitation" : "slow_falling";
  player.addEffect(effect, 5, {
    amplifier: 2,
    showParticles: false
  });
  if (player.isSneaking && !player.isJumping) {
    player.applyKnockback({ x: 0, z: 0 }, 0.02);
  }
}
system3.runInterval(() => {
  world.getAllPlayers().forEach((player) => {
    climb(player);
  });
});

// filters_data/modular_mc/_shared/growingCrop.ts
import {
  EquipmentSlot,
  GameMode,
  system as system4
} from "@minecraft/server";
var randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
var component3 = {
  onRandomTick(event, data) {
    const params = data.params;
    const block = event.block;
    const growthState = params.growth_state;
    const moisturizedAmountBonus = (event.block.below()?.permutation.getState("moisturized_amount") || 0) * params.moisturized_amount_bonus;
    const growthChance = params.growth_chance + moisturizedAmountBonus;
    if (Math.random() > growthChance) return;
    const growth = block.permutation.getState(growthState);
    block.setPermutation(block.permutation.withState(growthState, growth + 1));
  },
  onPlayerInteract(event, data) {
    const params = data.params;
    const block = event.block;
    const dimension = event.dimension;
    const player = event.player;
    const growthState = params.growth_state;
    const maxGrowth = params.max_growth;
    if (!player) return;
    const equippable = player.getComponent("minecraft:equippable");
    if (!equippable) return;
    const mainhand = equippable.getEquipmentSlot(EquipmentSlot.Mainhand);
    const hasBoneMeal = mainhand.hasItem() && mainhand.typeId === "minecraft:bone_meal";
    if (!hasBoneMeal) return;
    if (player.getGameMode() === GameMode.Creative) {
      block.setPermutation(block.permutation.withState(growthState, maxGrowth));
    } else {
      let growth = block.permutation.getState(growthState);
      growth += randomInt(1, maxGrowth - growth);
      block.setPermutation(block.permutation.withState(growthState, growth));
      if (mainhand.amount > 1) mainhand.amount--;
      else mainhand.setItem(void 0);
    }
    const effectLocation = block.center();
    dimension.playSound("item.bone_meal.use", effectLocation);
    dimension.spawnParticle("minecraft:crop_growth_emitter", effectLocation);
  }
};
system4.beforeEvents.startup.subscribe(({ blockComponentRegistry }) => {
  blockComponentRegistry.registerCustomComponent("tsu_nat:growable", component3);
});

// filters_data/modular_mc/guidebook/guidebook.js
import { world as world2 } from "@minecraft/server";

// filters_data/modular_mc/_libraries/EasyMenu.js
import { ActionFormData } from "@minecraft/server-ui";
var EasyMenu = class {
  constructor(menuData) {
    this.pages = menuData.pages;
    this.backButton = menuData.backButton;
    this.memory = {};
  }
  showPage(player, pageId, history = []) {
    if (!this.pages[pageId]) {
      console.warn(`Page ${pageId} not found`);
      return;
    }
    const pageData = {
      ...typeof this.pages[pageId] === "function" ? this.pages[pageId](player, history) : this.pages[pageId]
    };
    const form = new ActionFormData();
    if (pageData.title) {
      form.title(pageData.title);
    }
    if (pageData.body) {
      form.body(Array.isArray(pageData.body) ? pageData.body.join("\xA7r\n") : pageData.body);
    }
    const buttons = [];
    pageData.content?.forEach((contentItem) => {
      switch (typeof contentItem) {
        case "string": {
          if (contentItem.startsWith("# ")) {
            form.header(contentItem.slice(2));
          } else if (contentItem === "---") {
            form.divider();
          } else {
            form.label(contentItem);
          }
          break;
        }
        case "object": {
          const buttonLink = contentItem.link ?? pageId;
          const buttonLinkPage = buttonLink !== "exit" && buttonLink !== "back" && this.pages[buttonLink] ? typeof this.pages[buttonLink] === "function" ? this.pages[buttonLink](player, history) : this.pages[buttonLink] : void 0;
          const buttonText = contentItem.text ?? buttonLinkPage?.title ?? buttonLink;
          const buttonImage = contentItem.image ?? buttonLinkPage?.image;
          const resolvedCondition = contentItem.condition ?? buttonLinkPage?.condition;
          if (typeof resolvedCondition === "function" && !resolvedCondition(player)) {
            break;
          }
          buttons.push({
            text: buttonText,
            link: buttonLink,
            image: buttonImage,
            onClick: contentItem.onClick
          });
          form.button(buttonText, buttonImage);
          break;
        }
        default: {
          console.warn(
            `Unknown content type: ${typeof contentItem} at ${contentItem} at ${pageId}`
          );
          break;
        }
      }
    });
    if (this.backButton?.enabled && history.length > 0) {
      if (this.backButton.divider) form.divider();
      form.button(this.backButton.text, this.backButton.image);
    }
    form.show(player).then((formData) => {
      const selection = formData.selection;
      if (formData.canceled || selection === void 0) {
        return;
      }
      const backButtonSelected = this.backButton?.enabled && history.length > 0 && selection === buttons.length;
      if (backButtonSelected) {
        this.goBack(player, history);
      } else if (buttons.length > 0) {
        const selectedButton = buttons[selection];
        const nextPageId = selectedButton.link;
        if (typeof selectedButton?.onClick === "function") {
          selectedButton.onClick(player);
        }
        if (nextPageId === "exit") {
          return;
        } else if (nextPageId === "back") {
          this.goBack(player, history);
        } else if (nextPageId) {
          if (pageId !== nextPageId) {
            history.push(pageId);
          }
          this.showPage(player, nextPageId, history);
        }
      }
    }).catch((error) => {
      player.sendMessage(`Failed to show menu: ${error}`);
    });
  }
  goBack(player, history) {
    const previousPage = history.pop();
    this.showPage(player, previousPage, history);
  }
};

// filters_data/modular_mc/guidebook/guidebook.js
var guidebook = new EasyMenu({
  backButton: {
    enabled: true,
    text: "Back",
    image: "textures/gui/controls/left",
    link: "back"
  },
  pages: {
    /* ------------------------------------------------------------------ START */
    start: {
      title: "Introduction",
      content: [
        "# Into the Wild\xA7r",
        "\xA7vThis Add-On expands your experience with new biomes, creatures, foods, brews, blocks, structures and systems.",
        "\xA7vEvery addition has a purpose: materials, crafting, and exploration all connect to create a richer and more rewarding adventure.",
        "\xA7vExplore deeper, survive longer, and make the world truly feel alive.",
        "\xA7vIf you enjoy this Add-On, please support us with a \xA7erating\xA7r on the Marketplace!",
        "---",
        { link: "biomes" },
        { link: "recipes" },
        { link: "extras" },
        { link: "info" }
      ]
    },
    /* ------------------------------------------------------------------ BIOMES */
    biomes: {
      title: "Biomes",
      image: "textures/tsu/nat/guidebook/icons/fungal_grove",
      content: [
        "Choose a biome to learn what unique items and content it contains:",
        "---",
        { link: "fungal_grove" },
        { link: "charred_forest" },
        { link: "maple_forest" },
        { link: "oasis" },
        { link: "salt_flats" }
      ]
    },
    fungal_grove: {
      title: "Fungal Grove",
      image: "textures/tsu/nat/guidebook/icons/fungal_grove",
      content: [
        "\xA7o\xA77Where roots hum songs no man can hear,",
        "\xA7o\xA77Spores drift thick, yet crystal clear.",
        "\xA7o\xA77Dreams take root where reason dies \u2014",
        "\xA7o\xA77The Grove sees all with half-closed eyes.",
        "---",
        "Adventurers can harvest unique building blocks and catch \xA7vFungus Gnats\xA7r, which drop \xA7vWild Yeast\xA7r \u2014 a handy crafting ingredient.",
        "Hunt for \xA7vWild Boars\xA7r and \xA7vcure\xA7r their meat. You might also encounter \xA7vBlooshrooms\xA7r \u2014 feed them glowing mushrooms, then milk them with a bowl to obtain \xA7vMushroom Brew\xA7r.",
        "On rare \xA7lfull moons\xA7r, mysterious \xA7vMandrake Roots\xA7r awaken. Breaking one causes the Mandrake to flee \u2014 chase it quickly to claim the root!",
        "\xA7sFound near: [Taiga Forests]",
        "---",
        { link: "fungus_gnat" },
        { link: "blooshroom" },
        { link: "wild_boar" },
        { link: "wild_yeast" },
        { link: "mandrake_root" },
        { link: "kefir" },
        { link: "kvass" },
        { link: "kombucha" },
        { link: "root_brew" }
      ]
    },
    charred_forest: {
      title: "Charred Forest",
      image: "textures/tsu/nat/guidebook/icons/charred_forest",
      content: [
        "\xA7o\xA77Ash drifts where leaves once danced,",
        "\xA7o\xA77smoke swirls in a ghostly trance.",
        "\xA7o\xA77A faint glow lingers in the night \u2014",
        "\xA7o\xA77a cinder's last, reluctant light.",
        "---",
        "All that remains of a once-lush woodland, now blackened by fire and smoke. Ash covers the ground \u2014 a vital resource for crafting \xA7vGunpowder\xA7r and cleansing \xA7vSoap\xA7r.",
        "Amidst the ruin stand eerie \xA7vCharred Trees\xA7r \u2014 haunting yet beautiful, prized as decorative wood. Harvest them for a chance at extra \xA7vCharcoal\xA7r.",
        "\xA7sFound near: [Temperate Forests]",
        "---",
        { link: "ash" },
        { link: "soap" },
        { link: "gunpowder" }
      ]
    },
    maple_forest: {
      title: "Maple Forest",
      image: "textures/tsu/nat/guidebook/icons/maple_forest",
      content: [
        "\xA7o\xA77Golden ichor in the veins of trees,",
        "\xA7o\xA77a scent rides the amber breeze.",
        "\xA7o\xA77Footsteps soft on carpet ground,",
        "\xA7o\xA77sweet forest, autumn-bound.",
        "---",
        "The \xA7eMaple Forest\xA7r glows with rich autumn colours. Here you'll find \xA7vMaple Wood\xA7r, scattered \xA7vlog bundles\xA7r, and \xA7vsmall fallen logs\xA7r to collect.",
        "Maple trees slowly ooze sweet \xA7vsap\xA7r. Craft a \xA7vSap Bucket\xA7r, attach it to an \xA7voozing maple log\xA7r, then wait patiently \u2014 use a bottle to gather the \xA7vRaw Sap\xA7r, a valuable crafting ingredient.",
        "\xA7eBut beware! \xA7rThe scent of sap draws \xA7vSap Slimes\xA7r, notorious for guarding the forest's bounty.",
        "\xA7sFound near: [Birch and Flower Forests]",
        "---",
        { link: "sap_bucket" },
        { link: "raw_sap" },
        { link: "maple_syrup" },
        { link: "pancake" },
        { link: "sap_slimes" }
      ]
    },
    salt_flats: {
      title: "Salt Flats",
      image: "textures/tsu/nat/guidebook/icons/salt_flats",
      content: [
        "\xA7o\xA77White plains stretch where oceans slept,",
        "\xA7o\xA77their secrets crusted, dry, and kept.",
        "\xA7o\xA77No wind, no wave \u2014 just endless gleam,",
        "\xA7o\xA77a ghost of tides, a sunlit dream.",
        "---",
        "Vast and silent, the \xA7eSalt Flats\xA7r mark the bones of vanished seas. Break salt to gather it, craft blocks to build, or \xA7vcure meat\xA7r with it.",
        "Smelt it into \xA7vNiter\xA7r to produce \xA7vGunpowder\xA7r \u2014 the desert's volatile gift.",
        "\xA7sFound near: [Deserts]",
        "---",
        { link: "salt" },
        { link: "niter" },
        { link: "curing" },
        { link: "tumbleweed" }
      ]
    },
    oasis: {
      title: "Oasis",
      image: "textures/tsu/nat/guidebook/icons/oasis",
      content: [
        "\xA7o\xA77Amid the dunes, a breath of green,",
        "\xA7o\xA77a mirror where the sky's been seen.",
        "\xA7o\xA77Cool water hums beneath the sand \u2014",
        "\xA7o\xA77a gift the desert can't withstand.",
        "---",
        "Scattered across harsh deserts lie rare \xA7voases\xA7r \u2014 pockets of life where \xA7vpalm trees\xA7r rise and \xA7valoe\xA7r soothes the weary.",
        "Near desert shores, \xA7vcattails\xA7r thrive, useful for \xA7vrope\xA7r and \xA7vfarming\xA7r.",
        "\xA7sFound near: [Deserts]",
        "---",
        { link: "aloe" },
        { link: "cattail" },
        { link: "rope" }
      ]
    },
    /* ------------------------------------------------------------------ RECIPES */
    recipes: {
      title: "Recipes",
      image: "textures/tsu/nat/guidebook/icons/recipes",
      content: [
        "Crafting goes beyond the basics \u2014 new recipes let you brew, cure, and process items in unique ways.",
        "---",
        { link: "soap" },
        { link: "root_brew" },
        { link: "kefir" },
        { link: "kvass" },
        { link: "kombucha" },
        { link: "maple_syrup" },
        { link: "pancake" },
        { link: "niter" },
        { link: "gunpowder" },
        { link: "salt" },
        { link: "rope" },
        { link: "cattail" },
        { link: "sap_bucket" },
        { link: "wild_boar" },
        { link: "curing" }
      ]
    },
    /* ------------------------------------------------------------------ ITEMS & CREATURES */
    ash: {
      title: "Ash",
      image: "textures/tsu/nat/items/ash",
      content: [
        "Ash gathers in thin layers on the ground of the \xA7vCharred Forest\xA7r. Break these blocks to collect it.",
        "---",
        "\xA7lUsed in:",
        { link: "soap" },
        { link: "gunpowder" }
      ]
    },
    rope: {
      title: "Rope",
      image: "textures/tsu/nat/items/rope",
      content: [
        "Place rope on the edge of a ledge to create the main \xA7eknot\xA7r. Interact with it while holding more rope to grow it downward. Hold \xA7e[jump]\xA7r to climb up and down freely.",
        "Shoot the main knot with an arrow to break and drop the entire rope.",
        "---",
        "\xA7lRecipe:",
        "3 Leads arranged vertically",
        "---",
        "\xA7lCrafted from:",
        { link: "cattail" }
      ]
    },
    cattail: {
      title: "Cattail",
      image: "textures/tsu/nat/items/cattail",
      content: [
        "Found where deserts meet rivers, and thriving in swamps and mangroves. When fully grown, cattail pods can be crafted into \xA7vseeds\xA7r or combined to make \xA7vstring\xA7r.",
        "---",
        "\xA7lRecipe:",
        "Cattail in a 2\xD72 pattern = 1 String",
        "---",
        "\xA7lUsed in:",
        { link: "rope" }
      ]
    },
    soap: {
      title: "Soap",
      image: "textures/tsu/nat/items/soap",
      content: [
        "Unlike drinking milk, washing with soap cleanses only \xA7lnegative\xA7r effects, leaving positive ones intact.",
        "---",
        "\xA7lRecipe:",
        "Aloe + Ash + Raw Sap",
        "---",
        "\xA7lIngredients:",
        { link: "aloe" },
        { link: "ash" },
        { link: "raw_sap" }
      ]
    },
    gunpowder: {
      title: "Gunpowder",
      image: "textures/items/gunpowder",
      content: [
        "No need to wait for Creepers \u2014 craft your own Gunpowder and use it to make \xA7vTNT\xA7r.",
        "---",
        "\xA7lRecipe:",
        "Niter + Ash + Coal + Salt",
        "---",
        "\xA7lIngredients:",
        { link: "niter" },
        { link: "ash" },
        { link: "salt" }
      ]
    },
    wild_yeast: {
      title: "Wild Yeast",
      image: "textures/tsu/nat/items/wild_yeast",
      content: [
        "A key ingredient required for many brews and fermented drinks. Hunt the glowing \xA7vFungus Gnats\xA7r of the Fungal Grove to harvest it.",
        "---",
        "\xA7lSource:",
        { link: "fungus_gnat" },
        "---",
        "\xA7lUsed in:",
        { link: "kefir" },
        { link: "kvass" },
        { link: "kombucha" },
        { link: "root_brew" }
      ]
    },
    mandrake_root: {
      title: "Mandrake Root",
      image: "textures/tsu/nat/items/mandrake_root",
      content: [
        "Can only be harvested in the \xA7vFungal Grove\xA7r on a \xA7lfull moon\xA7r. Locate the pale blue leafy plant and break it to reveal a living mandrake spirit \u2014 chase it down and strike fast to claim the root.",
        "---",
        "\xA7lUsed in:",
        { link: "root_brew" }
      ]
    },
    kefir: {
      title: "Yoghurt",
      image: "textures/tsu/nat/items/kefir",
      content: [
        "A fermented milk drink that restores hunger and provides a nourishing boost.",
        "---",
        "\xA7lRecipe:",
        "Wild Yeast x4 + Bucket of Milk + Wooden Bowl",
        "---",
        "\xA7lIngredients:",
        { link: "wild_yeast" }
      ]
    },
    kvass: {
      title: "Beetroot Soda",
      image: "textures/tsu/nat/items/kvass",
      content: [
        "A fermented beet juice drink that restores hunger and provides a nourishing boost.",
        "---",
        "\xA7lRecipe:",
        "Wild Yeast + Beetroot + Bread + Wooden Bowl",
        "---",
        "\xA7lIngredients:",
        { link: "wild_yeast" }
      ]
    },
    kombucha: {
      title: "Mushroom Brew",
      image: "textures/tsu/nat/items/kombucha",
      content: [
        "A fermented mushroom brew that restores hunger and provides a nourishing boost.",
        "---",
        "\xA7lRecipe:",
        "Wild Yeast + Glowshroom + Wooden Bowl",
        "---",
        "\xA7lIngredients:",
        { link: "wild_yeast" }
      ]
    },
    root_brew: {
      title: "Root Brew",
      image: "textures/tsu/nat/items/root_brew",
      content: [
        "A fermented herbal root drink that restores hunger and grants healing and speed.",
        "---",
        "\xA7lRecipe:",
        "Wild Yeast + Mandrake Root + Wooden Bowl",
        "---",
        "\xA7lIngredients:",
        { link: "wild_yeast" },
        { link: "mandrake_root" }
      ]
    },
    fungus_gnat: {
      title: "Fungus Gnat",
      image: "textures/tsu/nat/guidebook/icons/firefly",
      content: [
        "Glowing insects that hover throughout the \xA7vFungal Grove\xA7r. Larger than a firefly and easy to spot. Strike one to collect its drop.",
        "---",
        "\xA7lDrops:",
        { link: "wild_yeast" }
      ]
    },
    blooshroom: {
      title: "Blooshroom",
      image: "textures/tsu/nat/guidebook/icons/blooshroom",
      content: [
        "A blue mooshroom with \xA7vGlowshrooms\xA7r on its back. Feed it a Glowshroom then milk it with a bowl to get \xA7vMushroom Brew\xA7r instantly. After that, milking produces \xA7vMushroom Stew\xA7r until you feed it again.",
        "Shearing a Blooshroom will harvest the Glowshrooms, but turns it into a regular cow. Can be bred with \xA7vSporepuff\xA7r.",
        "---",
        "\xA7lDrops:",
        { link: "kombucha" }
      ]
    },
    wild_boar: {
      title: "Wild Boar",
      image: "textures/tsu/nat/guidebook/icons/boar",
      content: [
        "Wild Boars roam the Fungal Grove and drop \xA7vGamey Meat\xA7r, which can be prepared several ways:",
        "---",
        "\xA7lCooked Gamey Meat",
        "Cook in a Furnace",
        "---",
        "\xA7lSmoked Gamey Meat",
        "Cook in a Smoker",
        "---",
        "\xA7lJerky",
        "Place Smoked Gamey Meat on a Salt Block surrounded by Salt on all sides but one. Wait for it to cure into a dense, filling food.",
        "---",
        "\xA7lSee also:",
        { link: "curing" }
      ]
    },
    curing: {
      title: "Curing",
      image: "textures/tsu/nat/items/salt",
      content: [
        "Lay a \xA7vBlock of Salt\xA7r down and surround it with Salt Blocks on all sides except one front-facing window (bottom, top, both sides, and back).",
        "Place \xA7vSmoked Gamey Meat\xA7r in the niche and wait a few minutes for it to become nutrient-dense \xA7vJerky\xA7r.",
        "---",
        "\xA7lRequires:",
        { link: "salt" },
        { link: "wild_boar" }
      ]
    },
    raw_sap: {
      title: "Raw Sap",
      image: "textures/tsu/nat/items/raw_sap",
      content: [
        "Collected from \xA7voozing maple logs\xA7r using a \xA7vSap Bucket\xA7r. Wait patiently, then use a bottle to gather the sap \u2014 a key ingredient for Soap, Maple Syrup, and more.",
        "---",
        "\xA7lCollected using:",
        { link: "sap_bucket" },
        "---",
        "\xA7lUsed in:",
        { link: "soap" },
        { link: "maple_syrup" }
      ]
    },
    sap_bucket: {
      title: "Sap Bucket",
      image: "textures/tsu/nat/guidebook/icons/sap_bucket",
      content: [
        "Attach to an \xA7voozing maple log\xA7r and wait. Use 3 bottles to gather all the sap once it's ready.",
        "---",
        "\xA7lRecipe:",
        "Wooden Plank \xD75 + Stick \xD72 + Iron Ingot",
        "---",
        "\xA7lCollects:",
        { link: "raw_sap" }
      ]
    },
    maple_syrup: {
      title: "Maple Syrup",
      image: "textures/tsu/nat/items/maple_syrup",
      content: [
        "A sweet treat \u2014 drink it as food, use it as a crafting ingredient, or smelt it further in a Furnace to make \xA7vSugar\xA7r.",
        "---",
        "\xA7lRecipe:",
        "Smelt Raw Sap in a Furnace",
        "---",
        "\xA7lIngredients:",
        { link: "raw_sap" },
        "---",
        "\xA7lUsed in:",
        { link: "pancake" }
      ]
    },
    pancake: {
      title: "Pancake",
      image: "textures/tsu/nat/items/pancake",
      content: [
        "Fluffy pancakes smothered in sweet Maple Syrup \u2014 a filling and delicious food.",
        "---",
        "\xA7lRecipe:",
        "Wheat + Egg + Maple Syrup",
        "---",
        "\xA7lIngredients:",
        { link: "maple_syrup" }
      ]
    },
    sap_slimes: {
      title: "Sap Slimes",
      image: "textures/tsu/nat/guidebook/icons/sap_slime",
      content: [
        "Gelatinous cubes drawn to the scent of \xA7vRaw Maple Sap\xA7r. Notoriously protective of the forest's bounty.",
        "---",
        "\xA7lDrops:",
        "Resin Clump"
      ]
    },
    salt: {
      title: "Salt",
      image: "textures/tsu/nat/items/salt",
      content: [
        "Found in the bright white \xA7vSalt Flats\xA7r of some deserts. Break salt crystals to gather it, or craft blocks for building and storage.",
        "---",
        "\xA7lSalt Block Recipe:",
        "4 Salt",
        "---",
        "\xA7lUsed in:",
        { link: "curing" },
        { link: "niter" },
        { link: "gunpowder" }
      ]
    },
    niter: {
      title: "Niter",
      image: "textures/tsu/nat/items/niter",
      content: [
        "Smelted from Salt, Niter is the key ingredient to craft \xA7vGunpowder\xA7r without hunting Creepers.",
        "---",
        "\xA7lRecipe:",
        "Smelt a Block of Salt in a Furnace",
        "---",
        "\xA7lUsed in:",
        { link: "gunpowder" }
      ]
    },
    aloe: {
      title: "Aloe",
      image: "textures/tsu/nat/items/aloe",
      content: [
        "A medicinal plant found in deserts. Break the plant to harvest the green leaf.",
        "---",
        "\xA7lUsed in:",
        { link: "soap" }
      ]
    },
    tumbleweed: {
      title: "Tumbleweed",
      image: "textures/tsu/nat/guidebook/icons/tumbleweed",
      content: [
        "Tumbleweeds drift across the desert as if to punctuate the lonely, arid landscape. Some say they carry seeds from places long forgotten."
      ]
    },
    scarecrow: {
      title: "Scarecrow",
      image: "textures/tsu/nat/guidebook/icons/scarecrow",
      content: [
        "Scarecrows can be found in abandoned farms scattered around the world \u2014 or you can craft your own.",
        "---",
        "\xA7lRecipe:",
        "Carved Pumpkin + Hay Bale + 3\xD7 Sticks"
      ]
    },
    /* ------------------------------------------------------------------ STRUCTURES */
    extras: {
      title: "Structures",
      image: "textures/tsu/nat/guidebook/icons/structures",
      content: [
        "\xA7vNot all discoveries are bound to a single biome. Keep your eyes open while exploring!",
        "---",
        "\xA7v- Giant Trees \xA7s[Taigas]",
        "\xA7v- Palm Trees \xA7s[Beaches, Deserts]",
        "\xA7v- Oasis \xA7s[Desert]",
        "\xA7v- Baobab Trees \xA7s[Savanna]",
        "\xA7v- Hedge Maze \xA7s[Plains, Savanna]",
        "\xA7v- Wells \xA7s[Plains, Savanna, Desert]",
        "\xA7v- Ruins \xA7s[Plains, Savanna]",
        "\xA7v- Windmills \xA7s[Plains]",
        "\xA7v- Lighthouses \xA7s[Cold and Rocky Beaches]",
        "\xA7v- Great Pyramids \xA7s[Desert]",
        "\xA7v- Obelisks \xA7s[Desert]",
        "\xA7v- Abandoned Farms \xA7s[Plains]"
      ]
    },
    /* ------------------------------------------------------------------ INFO */
    info: {
      title: "Info",
      image: "textures/tsu/nat/guidebook/icons/info",
      content: [
        "Need help or want to know more?",
        "---",
        { link: "patch_notes" },
        { link: "support" },
        { link: "credits" }
      ]
    },
    patch_notes: {
      title: "Patch Notes",
      content: [
        "\xA7vCurrent version: \xA7v1.0.0",
        "---",
        "\xA7lUpcoming: \xA7v1.1.0",
        "\xA7d- Fields that hum with violet wind.",
        "\xA7b- A glacier where silence itself sleeps.",
        "\xA7v- A rift that shimmers between worlds.",
        "\xA7a- A forest trapped in eternal twilight.",
        "\xA76- Beneath the roots, treasures await those who dig... or snout around.",
        "\xA7c- In the ashes, they march \u2014 fire given legs.",
        "\xA7g- The earth beneath the maples is alive. Richer, darker, as if it remembers.",
        "\xA7u- An uncanny acquaintance fond of shiny things.",
        "\xA7s- Echoes of forgotten places, waiting to be found.",
        "\xA7vAnd more to come... + your suggestions!",
        "---",
        "Join the Discord and let us know what you want to see next!",
        "\xA7v[ discord.gg/\xA7buEHtjtNQ5T\xA7v ]"
      ]
    },
    support: {
      title: "Support",
      content: [
        "Want to report a \xA7ebug\xA7r or give us some \xA7efeedback\xA7r?",
        "\xA76Join the Add-On's Discord server and talk to the developers:",
        "\xA7b[ discord.gg/uEHtjtNQ5T ]"
      ]
    },
    credits: {
      title: "Credits",
      content: [
        "# \xA7bTsunami Studios",
        "---",
        "\xA7lVision & Direction",
        shuffle(["\xA7vAngelo", "\xA7vRose"]).join("\n"),
        "---",
        "\xA7lDevelopment",
        "\xA7vAngelo",
        "---",
        "\xA7lArt",
        "\xA7vRose",
        "\xA7vAngelo",
        "\xA7vArthur",
        "---",
        "\xA7lQuality Assurance",
        shuffle(["\xA7vEruch", "\xA7vTrevor", "\xA7vAva"]).join("\n"),
        "---",
        "\xA7lMarketing",
        "\xA7vPiero",
        "---",
        "\xA7lSpecial Thanks",
        "\xA7vMerwan",
        "\xA7vPrzemyslaw",
        "\xA7vMarcin",
        "---"
      ]
    }
  }
});
world2.afterEvents.itemUse.subscribe((data) => {
  const player = data.source;
  if (data.itemStack.typeId === "tsu_nat:guidebook") {
    guidebook.showPage(player, "start");
  }
});
function shuffle(array) {
  const newArray = [...array];
  let currentIndex = newArray.length;
  while (currentIndex != 0) {
    const randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [newArray[currentIndex], newArray[randomIndex]] = [
      newArray[randomIndex],
      newArray[currentIndex]
    ];
  }
  return newArray;
}

// filters_data/modular_mc/main/blocks/_block_templates/basic_plant_template/growingPlant.ts
import {
  EquipmentSlot as EquipmentSlot2,
  GameMode as GameMode2,
  system as system5
} from "@minecraft/server";
var component4 = {
  onRandomTick(event, data) {
    const params = data.params;
    if (Math.random() < params.random_growth_chance) {
      event.block.setType(params.grows_into);
    }
  },
  onPlayerInteract(event, data) {
    const params = data.params;
    const block = event.block;
    const dimension = event.dimension;
    const player = event.player;
    if (!player) return;
    const equippable = player.getComponent("minecraft:equippable");
    if (!equippable) return;
    const mainhand = equippable.getEquipmentSlot(EquipmentSlot2.Mainhand);
    const growthItem = params.growth_item ?? "minecraft:bonemeal";
    const hasGrowthItem = mainhand.hasItem() && mainhand.typeId === growthItem;
    if (!hasGrowthItem) return;
    block.setType(params.grows_into);
    if (player.getGameMode() !== GameMode2.Creative) {
      if (mainhand.amount > 1) mainhand.amount--;
      else mainhand.setItem(void 0);
    }
    const effectLocation = block.center();
    dimension.playSound("item.bone_meal.use", effectLocation);
    dimension.spawnParticle("minecraft:crop_growth_emitter", effectLocation);
  }
};
system5.beforeEvents.startup.subscribe(({ blockComponentRegistry }) => {
  blockComponentRegistry.registerCustomComponent("tsu_nat:plant", component4);
});

// filters_data/modular_mc/main/blocks/_block_templates/door_template/door.ts
import {
  world as world3,
  system as system6,
  BlockPermutation,
  ItemStack
} from "@minecraft/server";
var directionOrder = ["north", "west", "south", "east"];
var doorTypes = ["tsu_nat:maple_door", "tsu_nat:charred_door"];
var customDoor = {
  onTick({ block, dimension }, { params }) {
    let power = block.getRedstonePower();
    let topHalf = isTopHalf(block.permutation);
    let otherDoorBlock = topHalf ? block.below() : block.above();
    const currentState = block.permutation.getAllStates();
    if (power > 0 && !currentState["tsu_nat:powered"]) {
      block.setPermutation(
        block.permutation.withState("tsu_nat:powered", true)
      );
      otherDoorBlock.setPermutation(
        otherDoorBlock.permutation.withState("tsu_nat:powered", true)
      );
      openDoor(block, dimension, true);
    }
    let otherBlockPower = otherDoorBlock.getRedstonePower();
    let unpoweredDoor = (power == 0 || power == void 0) && (otherBlockPower == 0 || otherBlockPower == void 0);
    if (unpoweredDoor && currentState["tsu_nat:powered"]) {
      block.setPermutation(
        block.permutation.withState("tsu_nat:powered", false)
      );
      otherDoorBlock.setPermutation(
        otherDoorBlock.permutation.withState("tsu_nat:powered", false)
      );
      openDoor(block, dimension, false, true);
    }
  },
  beforeOnPlayerPlace: (event) => {
    let above = event.block.above()?.typeId;
    if (above !== "minecraft:air") {
      event.cancel = true;
    }
  },
  onPlace(event) {
    const currentStates = event.block.permutation.getAllStates();
    const cardinalDirection = currentStates["minecraft:cardinal_direction"];
    let directionIndex = directionOrder.indexOf(cardinalDirection);
    const blocksAround = [
      event.block.north(),
      event.block.west(),
      event.block.south(),
      event.block.east()
    ];
    let above = event.block.above();
    let topHalf = isTopHalf(event.block.permutation);
    if (above?.typeId !== "minecraft:air" || topHalf) {
      return;
    }
    let flipHinge = false;
    let blockToCheck = blocksAround[(directionIndex + 1) % 4];
    if (doorTypes.includes(blockToCheck?.typeId)) {
      flipHinge = getCardinalDirection(event.block) == getCardinalDirection(blockToCheck);
    }
    const aboveBlockPermutation = BlockPermutation.resolve(event.block.typeId, {
      "tsu_nat:block_half": "top",
      "minecraft:cardinal_direction": cardinalDirection,
      "tsu_nat:door_hinge_bit": flipHinge
    });
    above.setPermutation(aboveBlockPermutation);
    if (flipHinge) {
      event.block.setPermutation(
        event.block.permutation.withState("tsu_nat:door_hinge_bit", true)
      );
    }
  },
  onPlayerInteract({ block, dimension }, { params }) {
    openDoor(block, dimension);
  }
};
function openDoor(block, dimension, forceOpen = false, forceClose = false) {
  const toggleableState = "tsu_nat:open";
  let topHalf = isTopHalf(block.permutation);
  let otherDoorBlock = topHalf ? block.below() : block.above();
  const currentValue = block.permutation.getState(toggleableState);
  let toggledValue = !currentValue;
  if (forceOpen) toggledValue = true;
  if (forceClose) toggledValue = false;
  block.setPermutation(block.permutation.withState(toggleableState, toggledValue));
  otherDoorBlock.setPermutation(
    otherDoorBlock.permutation.withState(toggleableState, toggledValue)
  );
  const toggleSound = toggledValue ? "open.wooden_trapdoor" : "close.wooden_trapdoor";
  dimension.playSound(toggleSound, block.center());
}
world3.afterEvents.playerBreakBlock.subscribe((eventData) => {
  const { block, dimension, brokenBlockPermutation } = eventData;
  const topHalf = isTopHalf(brokenBlockPermutation);
  const aboveBlock = block.above();
  const aboveAboveBlock = block.above()?.above();
  const belowBlock = block.below();
  if (doorTypes.includes(brokenBlockPermutation.type.id)) {
    if (topHalf && doorTypes.includes(belowBlock?.typeId)) {
      dimension.runCommand(`setblock ${belowBlock.x} ${belowBlock.y} ${belowBlock.z} air destroy`);
    } else if (!topHalf && doorTypes.includes(aboveBlock?.typeId)) {
      dimension.runCommand(`setblock ${aboveBlock.x} ${aboveBlock.y} ${aboveBlock.z} air destroy`);
    }
  } else {
    if (doorTypes.includes(aboveBlock?.typeId) && !isTopHalf(aboveBlock.permutation)) {
      let item = new ItemStack(`${aboveBlock?.typeId}`, 1);
      dimension.spawnItem(item, aboveBlock.center());
      dimension.runCommand(`setblock ${aboveBlock.x} ${aboveBlock.y} ${aboveBlock.z} air destroy`);
    }
    if (doorTypes.includes(aboveAboveBlock?.typeId) && isTopHalf(aboveAboveBlock?.permutation)) {
      dimension.runCommand(
        `setblock ${aboveAboveBlock.x} ${aboveAboveBlock.y} ${aboveAboveBlock.z} air destroy`
      );
    }
  }
});
function isTopHalf(blockPermutation) {
  return blockPermutation.getState("tsu_nat:block_half") == "top";
}
function getCardinalDirection(block) {
  const dir = block?.permutation?.getState("minecraft:cardinal_direction");
  return typeof dir === "string" ? dir : void 0;
}
system6.beforeEvents.startup.subscribe((init) => {
  init.blockComponentRegistry.registerCustomComponent("tsu_nat:custom_door", customDoor);
});

// filters_data/modular_mc/main/blocks/_block_templates/grass_block_template/grass_block.ts
import {
  system as system7,
  LiquidType
} from "@minecraft/server";
var component5 = {
  onRandomTick(event, parameters) {
    const dirtBlock = parameters.params?.dirt_block;
    if (!dirtBlock) return;
    const aboveBlock = event.block.above();
    if (!aboveBlock || aboveBlock.isAir || aboveBlock.canBeDestroyedByLiquidSpread(LiquidType.Water) || aboveBlock.liquidSpreadCausesSpawn(LiquidType.Water) || aboveBlock.canContainLiquid(LiquidType.Water) || !aboveBlock.isLiquidBlocking(LiquidType.Water)) {
      return;
    }
    event.block.setType(dirtBlock);
  }
};
system7.beforeEvents.startup.subscribe((init) => {
  init.blockComponentRegistry.registerCustomComponent("tsu_nat:custom_grass_block", component5);
});

// filters_data/modular_mc/main/blocks/_block_templates/leaf_litter_template/leaf_litter.ts
import {
  system as system8
} from "@minecraft/server";
var leafLitter = {
  onRandomTick(event, parameters) {
    const aboveBlock = event.block.above();
    if (aboveBlock && aboveBlock.typeId === "minecraft:snow_layer") {
      aboveBlock.setType("minecraft:air");
    }
  },
  onPlayerInteract: (event, params) => {
    const player = event.player;
    if (!player) return;
    const container = player.getComponent("minecraft:inventory")?.container;
    const heldSlot = container?.getSlot(player.selectedSlotIndex);
    if (!heldSlot?.hasItem() || !heldSlot || !heldSlot.isValid || heldSlot.typeId !== event.block.typeId) {
      return;
    }
    const currentLitterAmount = Number(
      event.block.permutation.getState("tsu_nat:litter_amount") ?? 0
    );
    const newLitterAmount = Math.max(0, Math.min(3, currentLitterAmount + 1));
    if (newLitterAmount > currentLitterAmount) {
      heldSlot.amount === 1 ? heldSlot.setItem() : heldSlot.amount -= 1;
      event.block.setPermutation(
        event.block.permutation.withState("tsu_nat:litter_amount", newLitterAmount)
      );
    }
  }
};
system8.beforeEvents.startup.subscribe((init) => {
  init.blockComponentRegistry.registerCustomComponent("tsu_nat:leaf_litter", leafLitter);
});

// filters_data/modular_mc/main/blocks/_block_templates/leaves_template/leaves.ts
import {
  system as system9
} from "@minecraft/server";
var customLeaves = {
  beforeOnPlayerPlace: (event, params) => {
    event.permutationToPlace = event.permutationToPlace.withState("tsu_nat:decay", false);
  },
  onRandomTick(event, params) {
    try {
      event.block.dimension.spawnParticle(params.params.particle, event.block.location);
    } catch (error) {
      return;
    }
    if (event.block.permutation.getState("tsu_nat:decay") === false) return;
    if (shouldDecay(event.block)) {
      event.block.dimension.runCommand(
        `setblock ${event.block.x} ${event.block.y} ${event.block.z} minecraft:air destroy`
      );
    }
  }
};
system9.beforeEvents.startup.subscribe((init) => {
  init.blockComponentRegistry.registerCustomComponent("tsu_nat:custom_leaves", customLeaves);
});
function shouldDecay(startBlock, maxDistance = 10) {
  if (isLog(startBlock)) return false;
  const visited = /* @__PURE__ */ new Set();
  const queue = [startBlock];
  const distances = /* @__PURE__ */ new Map();
  const getKey = (x, y, z) => {
    return (x + 1e3) * 4e6 + (y + 1e3) * 2e3 + (z + 1e3);
  };
  const startKey = getKey(startBlock.x, startBlock.y, startBlock.z);
  visited.add(startKey);
  distances.set(startKey, 0);
  let queueIndex = 0;
  while (queueIndex < queue.length) {
    const block = queue[queueIndex++];
    const key = getKey(block.x, block.y, block.z);
    const distance = distances.get(key);
    if (distance >= maxDistance) continue;
    const canTraverse = isLeaf(block) || key === startKey;
    if (!canTraverse) continue;
    const neighbors = [
      block.above(),
      block.below(),
      block.east(),
      block.west(),
      block.north(),
      block.south()
    ];
    const nextDistance = distance + 1;
    for (let i = 0; i < 6; i++) {
      const neighbor = neighbors[i];
      if (!neighbor) continue;
      const neighborKey = getKey(neighbor.x, neighbor.y, neighbor.z);
      if (visited.has(neighborKey)) continue;
      if (isLog(neighbor)) return false;
      visited.add(neighborKey);
      distances.set(neighborKey, nextDistance);
      queue.push(neighbor);
    }
  }
  return true;
}
function isLog(block) {
  return block.typeId.includes("log") || block.typeId.includes("stem") || block.typeId.includes("wood");
}
function isLeaf(block) {
  return block.typeId.includes("leaves");
}

// filters_data/modular_mc/main/blocks/_block_templates/log_template/log.ts
import { world as world4, system as system10 } from "@minecraft/server";
world4.beforeEvents.playerInteractWithBlock.subscribe((event) => {
  if (!event.isFirstEvent) return;
  if (event.block.typeId.startsWith("tsu_nat:stripped") || !event.block.typeId.endsWith("_log") || !event.block.typeId.startsWith("tsu_nat:")) {
    return;
  }
  if (event.itemStack?.hasTag("minecraft:is_axe") || event.itemStack?.hasTag("minecraft:axe")) {
    const strippedId = toStrippedLog(event.block.typeId);
    const rotationState = event.block.permutation.getState("minecraft:block_face");
    system10.run(() => {
      try {
        event.block.setType(strippedId);
        event.block.setPermutation(
          event.block.permutation.withState("minecraft:block_face", rotationState)
        );
        event.block.dimension.playSound("use.wood", event.block.location);
      } catch (error) {
      }
    });
  }
});
function toStrippedLog(id) {
  if (!id.startsWith("tsu_nat:") || !id.endsWith("_log")) {
    return id;
  }
  const type = id.slice("tsu_nat:".length, -"_log".length);
  return `tsu_nat:stripped_${type}_log`;
}

// filters_data/modular_mc/main/blocks/_block_templates/sapling_template/sapling.ts
import { system as system11, GameMode as GameMode3 } from "@minecraft/server";
var customSapling = {
  onRandomTick({ block, dimension }, { params }) {
    const lightLevel = block.getLightLevel();
    if (lightLevel < 9) return;
    if (Math.random() < params.grow_chance) {
      dimension.placeFeature("tsu_nat:tsu_nat_red_maple_tree.feature", block.location);
    }
  },
  onPlayerInteract({ block, dimension, player }, { params }) {
    if (!player) return;
    const equippable = player.getComponent("minecraft:equippable");
    if (!equippable) return;
    const mainhand = equippable.getEquipmentSlot("Mainhand");
    const hasBoneMeal = mainhand.hasItem() && mainhand.typeId === "minecraft:bone_meal";
    if (!hasBoneMeal) return;
    const growsInto = params.grows_into;
    if (!growsInto) return;
    const selectedFeature = growsInto[Math.floor(Math.random() * growsInto.length)];
    if (player.getGameMode() === GameMode3.Creative) {
      dimension.placeFeature(selectedFeature, block.location);
    } else {
      if (Math.random() < params.bonemeal_grow_chance) {
        dimension.placeFeature(selectedFeature, block.location);
        if (mainhand.amount > 1) {
          mainhand.amount--;
        } else {
          mainhand.setItem(void 0);
        }
      }
    }
    const effectLocation = block.center();
    dimension.playSound("item.bone_meal.use", effectLocation);
    dimension.spawnParticle("minecraft:crop_growth_emitter", effectLocation);
  }
};
system11.beforeEvents.startup.subscribe((init) => {
  init.blockComponentRegistry.registerCustomComponent("tsu_nat:custom_sapling", customSapling);
});

// filters_data/modular_mc/main/blocks/_block_templates/slab_template/slab.ts
import { Direction, world as world5, system as system12 } from "@minecraft/server";
world5.beforeEvents.playerInteractWithBlock.subscribe((event) => {
  const { block, itemStack, blockFace, player } = event;
  if (!itemStack || !isCustomSlab(itemStack.typeId)) return;
  const convertToDoubleSlab = (targetBlock) => {
    const doubleSlabId = toDoubleSlab(targetBlock.typeId);
    event.cancel = true;
    system12.run(() => {
      targetBlock.setType(doubleSlabId);
      const container = player.getComponent("minecraft:inventory")?.container;
      if (container && player.selectedSlotIndex !== void 0) {
        const currentItem = container.getItem(player.selectedSlotIndex);
        if (currentItem && currentItem.amount > 1) {
          currentItem.amount -= 1;
          container.setItem(player.selectedSlotIndex, currentItem);
        } else {
          container.setItem(player.selectedSlotIndex, void 0);
        }
      }
    });
  };
  if (itemStack.typeId === block.typeId) {
    const slabState = block.permutation.getState("minecraft:vertical_half");
    const shouldConvert = slabState === "top" && blockFace === Direction.Down || slabState === "bottom" && blockFace === Direction.Up;
    if (shouldConvert) {
      convertToDoubleSlab(block);
      return;
    }
  }
  if (blockFace === Direction.Up) {
    const blockAbove = block.above();
    if (blockAbove && blockAbove.typeId === itemStack.typeId && blockAbove.permutation.getState("minecraft:vertical_half") === "top") {
      convertToDoubleSlab(blockAbove);
      return;
    }
  }
  if (blockFace === Direction.Down) {
    const blockBelow = block.below();
    if (blockBelow && blockBelow.typeId === itemStack.typeId && blockBelow.permutation.getState("minecraft:vertical_half") === "bottom") {
      convertToDoubleSlab(blockBelow);
      return;
    }
  }
});
function isCustomSlab(itemTypeId) {
  const customSlabPattern = /^tsu_nat:[a-zA-Z]+_slab$/;
  return customSlabPattern.test(itemTypeId);
}
function toDoubleSlab(slabType) {
  return slabType.replace(/slab/g, "double_slab");
}

// filters_data/modular_mc/main/blocks/_block_templates/trapdoor_template/trapdoor.ts
import { system as system13 } from "@minecraft/server";
var BlockToggleableComponent = {
  onTick({ block, dimension }, { params }) {
    let power = block.getRedstonePower();
    const currentState = block.permutation.getAllStates();
    if (power > 0 && !currentState["tsu_nat:powered"]) {
      block.setPermutation(
        block.permutation.withState("tsu_nat:powered", true)
      );
      openTrapdoor(block, dimension, true);
    }
    let unpoweredDoor = power == 0 || power == void 0;
    if (unpoweredDoor && currentState["tsu_nat:powered"]) {
      block.setPermutation(
        block.permutation.withState("tsu_nat:powered", false)
      );
      openTrapdoor(block, dimension, false, true);
    }
  },
  onPlayerInteract({ block, dimension }, { params }) {
    const toggleableState = "tsu_nat:open";
    const currentValue = block.permutation.getState(toggleableState);
    const toggledValue = !currentValue;
    block.setPermutation(block.permutation.withState(toggleableState, toggledValue));
    const toggleSound = toggledValue ? "open.wooden_trapdoor" : "close.wooden_trapdoor";
    dimension.playSound(toggleSound, block.center());
  }
};
system13.beforeEvents.startup.subscribe(({ blockComponentRegistry }) => {
  blockComponentRegistry.registerCustomComponent("tsu_nat:custom_trapdoor", BlockToggleableComponent);
});
function openTrapdoor(block, dimension, forceOpen = false, forceClose = false) {
  const toggleableState = "tsu_nat:open";
  const currentValue = block.permutation.getState(toggleableState);
  let toggledValue = !currentValue;
  if (forceOpen) toggledValue = true;
  if (forceClose) toggledValue = false;
  block.setPermutation(block.permutation.withState(toggleableState, toggledValue));
  const toggleSound = toggledValue ? "open.wooden_trapdoor" : "close.wooden_trapdoor";
  dimension.playSound(toggleSound, block.center());
}

// filters_data/modular_mc/main/blocks/ash_block/ash.ts
import {
  system as system14
} from "@minecraft/server";
var component6 = {
  onRandomTick(event, params) {
    const aboveBlock = event.block.above();
    if (aboveBlock && aboveBlock.typeId === "minecraft:snow_layer") {
      aboveBlock.setType("minecraft:air");
    }
  },
  onPlayerInteract: (event, params) => {
    const player = event.player;
    if (!player) return;
    const container = player.getComponent("minecraft:inventory")?.container;
    const heldSlot = container?.getSlot(player.selectedSlotIndex);
    if (!heldSlot?.hasItem() || !heldSlot || !heldSlot.isValid) return;
    const shouldLayer = event.block.typeId === heldSlot?.typeId;
    if (!shouldLayer) return;
    const currentLayerAmount = Number(event.block.permutation.getState("tsu_nat:height") ?? 0);
    const newLayerAmount = Math.max(0, Math.min(15, currentLayerAmount + 1));
    if (newLayerAmount > currentLayerAmount) {
      heldSlot.amount === 1 ? heldSlot.setItem() : heldSlot.amount -= 1;
      if (newLayerAmount <= 6) {
        event.block.setPermutation(
          event.block.permutation.withState("tsu_nat:height", newLayerAmount)
        );
      } else {
        event.block.setType(params.params.full_block);
      }
    }
  }
};
system14.beforeEvents.startup.subscribe((init) => {
  init.blockComponentRegistry.registerCustomComponent("tsu_nat:layered", component6);
});

// filters_data/modular_mc/main/blocks/rope/rope.ts
import {
  system as system15,
  EquipmentSlot as EquipmentSlot3
} from "@minecraft/server";
var component7 = {
  onPlayerInteract(event) {
    const equippable = event.player?.getComponent("minecraft:equippable");
    const mainhand = equippable?.getEquipmentSlot(EquipmentSlot3.Mainhand);
    if (!mainhand?.hasItem()) return;
    if (mainhand?.typeId !== "tsu_nat:rope") return;
    let bottomFreeBlock = event.block.below();
    while (bottomFreeBlock?.typeId === "tsu_nat:rope") {
      bottomFreeBlock = bottomFreeBlock.below();
    }
    if (bottomFreeBlock?.isAir || bottomFreeBlock?.isLiquid) {
      bottomFreeBlock.setPermutation(
        event.block.permutation.withState("tsu_nat:rope_section", "rope")
      );
      if (mainhand.amount > 1) {
        mainhand.amount--;
      } else {
        mainhand.setItem();
      }
    }
  },
  onStepOn(event) {
    if (event.entity?.typeId === "minecraft:arrow") {
      event.dimension.runCommand(
        `setblock ${event.block.x} ${event.block.y} ${event.block.z} air destroy`
      );
    }
  }
};
system15.beforeEvents.startup.subscribe((init) => {
  init.blockComponentRegistry.registerCustomComponent("tsu_nat:rope", component7);
});

// filters_data/modular_mc/main/blocks/sap_bucket/sapBucket.ts
import {
  system as system16,
  ItemStack as ItemStack2
} from "@minecraft/server";
var component8 = {
  onRandomTick(event, data) {
    event.block.dimension.playSound("cauldron_drip.water.pointed_dripstone", event.block.location);
    const params = data.params;
    const fillChance = params.fill_chance;
    const depletionChance = params.depletion_chance;
    const maxFill = params.max_state_value;
    const currentFill = event.block.permutation.getState(params.state);
    const neighbor = oozingNeighbor(event.block);
    if (!neighbor) return;
    if (currentFill >= maxFill) return;
    if (Math.random() < fillChance) {
      event.block.setPermutation(
        event.block.permutation.withState("tsu_nat:filled_level", currentFill + 1)
      );
      if (Math.random() < depletionChance) {
        neighbor.setType("tsu_nat:maple_log");
        neighbor.setPermutation(neighbor.permutation.withState("minecraft:block_face", "down"));
      }
    }
  },
  onPlayerInteract(event, data) {
    const player = event.player;
    if (!player) return;
    const inventory = player.getComponent("minecraft:inventory")?.container;
    const handSlot = inventory?.getSlot(player.selectedSlotIndex);
    if (!handSlot || !handSlot.hasItem()) return;
    if (handSlot.typeId !== "minecraft:glass_bottle") return;
    const params = data.params;
    const currentFill = event.block.permutation.getState(params.state);
    if (currentFill <= 0) return;
    event.block.setPermutation(
      event.block.permutation.withState(params.state, currentFill - 1)
    );
    if (handSlot.amount === 1) {
      handSlot.setItem();
    } else {
      handSlot.amount -= 1;
    }
    if (inventory?.emptySlotsCount) {
      inventory?.addItem(new ItemStack2("tsu_nat:raw_sap", 1));
    } else {
      player.dimension.spawnItem(new ItemStack2("tsu_nat:raw_sap", 1), event.block.center());
    }
    player.playSound("bottle.fill");
  }
};
system16.beforeEvents.startup.subscribe((init) => {
  init.blockComponentRegistry.registerCustomComponent("tsu_nat:sap_bucket", component8);
});
function oozingNeighbor(block) {
  const opposites = {
    north: "south",
    south: "north",
    east: "west",
    west: "east"
  };
  const placedOnFace = block.permutation.getState("minecraft:block_face") ?? "south";
  const facingDirection = opposites[placedOnFace];
  const neighborBlock = block[facingDirection]?.();
  if (neighborBlock?.typeId === "tsu_nat:oozing_maple_log") {
    return neighborBlock;
  } else {
    return false;
  }
}

// filters_data/modular_mc/main/items/gamey_meat/cureTimer.ts
import {
  system as system17
} from "@minecraft/server";
var component9 = {
  onRandomTick(event, parameters) {
    if (event.block.isWaterlogged) return;
    if (event.block.permutation.getState(parameters.params.cured_state) === true) return;
    const chance = parameters.params?.chance ?? 1;
    if (Math.random() > chance) return;
    const hasSaltAbove = event.block.above()?.typeId === "tsu_nat:salt_block";
    if (!hasSaltAbove) return;
    const surroundedBySalt = hasNeighbors(event.block, "tsu_nat:salt_block") >= 5;
    if (!surroundedBySalt) return;
    event.block.setPermutation(
      event.block.permutation.withState(parameters.params.cured_state, true)
    );
  }
};
system17.beforeEvents.startup.subscribe((init) => {
  init.blockComponentRegistry.registerCustomComponent("tsu_nat:cure_timer", component9);
});
function hasNeighbors(block, neighborId) {
  const neighbors = [
    block.above()?.typeId === neighborId,
    block.below()?.typeId === neighborId,
    block.north()?.typeId === neighborId,
    block.south()?.typeId === neighborId,
    block.east()?.typeId === neighborId,
    block.west()?.typeId === neighborId
  ];
  return neighbors.filter((neighbor) => neighbor).length;
}

// filters_data/modular_mc/main/mobs/mandrake/block/mandrakeRootComponent.js
import { world as world6, system as system18 } from "@minecraft/server";
var component10 = {
  onPlayerBreak(event, { params }) {
    const isDay = world6.getTimeOfDay() < 12e3;
    const isFullMoon = world6.getMoonPhase() === 0;
    if (!isDay && isFullMoon) {
      event.dimension.spawnEntity(params.type, event.block.center());
    }
  }
};
system18.beforeEvents.startup.subscribe((init) => {
  init.blockComponentRegistry.registerCustomComponent(
    "tsu_nat:turn_to_entity_at_night",
    component10
  );
});

// filters_data/modular_mc/welcome_system/welcome.js
import { world as world7 } from "@minecraft/server";
world7.afterEvents.playerSpawn.subscribe((event) => {
  if (event.initialSpawn) {
    if (!event.player.getDynamicProperty("tsu_nat:joined_server")) {
      event.player.runCommand("give @s tsu_nat:guidebook");
      event.player.setDynamicProperty("tsu_nat:joined_server", true);
    }
    const joinMessage = { translate: "tsu_nat.welcome_message" };
    event.player.sendMessage(joinMessage);
  }
});
//# sourceMappingURL=main.js.map
