import { VTMCharacterData, VTMNpcData } from "./documents/actor.mjs";
import {
  VTMAttributeData, VTMAbilityData, VTMDisciplineData, VTMPowerData,
  VTMBackgroundData, VTMMeritData, VTMFlawData, VTMVirtueData, VTMRitualData, VTMGearData
} from "./documents/item.mjs";
import { VTMActorSheet } from "./sheets/actor-sheet.mjs";
import { VTMItemSheet } from "./sheets/item-sheet.mjs";

Hooks.once("init", () => {
  console.log("VTMLARP | Initializing Mind's Eye Theatre: Laws of the Night system");

  CONFIG.Actor.dataModels = {
    character: VTMCharacterData,
    npc: VTMNpcData
  };

  CONFIG.Item.dataModels = {
    attribute: VTMAttributeData,
    ability: VTMAbilityData,
    discipline: VTMDisciplineData,
    power: VTMPowerData,
    background: VTMBackgroundData,
    merit: VTMMeritData,
    flaw: VTMFlawData,
    virtue: VTMVirtueData,
    ritual: VTMRitualData,
    gear: VTMGearData
  };

  const ActorsCollection = foundry.documents.collections.Actors;
  const ItemsCollection = foundry.documents.collections.Items;
  const BaseActorSheet = foundry.appv1.sheets.ActorSheet;
  const BaseItemSheet = foundry.appv1.sheets.ItemSheet;

  ActorsCollection.unregisterSheet("core", BaseActorSheet);
  ActorsCollection.registerSheet("vtmlarp", VTMActorSheet, { types: ["character", "npc"], makeDefault: true });

  ItemsCollection.unregisterSheet("core", BaseItemSheet);
  ItemsCollection.registerSheet("vtmlarp", VTMItemSheet, { makeDefault: true });

  Handlebars.registerHelper("vtmCapitalize", str => typeof str === "string" ? str.charAt(0).toUpperCase() + str.slice(1) : str);

  const GESTURE_EMOJI = { rock: "✊", paper: "✋", scissors: "✌️", bomb: "💣" };
  Handlebars.registerHelper("vtmGestureEmoji", gesture => GESTURE_EMOJI[gesture] ?? "?");

  // House rule: instead of bidding a hand-picked subset of individual traits,
  // a player can bid their whole remaining trait pool of the matching
  // category (Physical/Social/Mental) at once against the opponent's pool.
  game.settings.register("vtmlarp", "fullBidTraitRule", {
    name: "Full-Bid Trait Rule",
    hint: "Allow players to bid their entire remaining trait pool of a category (Physical/Social/Mental) at once in a Challenge, instead of only individually-selected traits.",
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });
});
