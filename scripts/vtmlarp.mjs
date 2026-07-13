import { VTMCharacterData, VTMNpcData } from "./documents/actor.mjs";
import {
  VTMAttributeData, VTMAbilityData, VTMDisciplineData, VTMPowerData,
  VTMBackgroundData, VTMMeritData, VTMFlawData, VTMVirtueData, VTMRitualData, VTMGearData
} from "./documents/item.mjs";
import { VTMActorSheet } from "./sheets/actor-sheet.mjs";
import { VTMItemSheet } from "./sheets/item-sheet.mjs";
import { ChallengeResponseApp } from "./apps/challenge-response.mjs";
import { GMChallengeDashboard } from "./apps/gm-dashboard.mjs";

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

  // Font Awesome icons instead of emoji glyphs for Rock/Paper/Scissors/Bomb -
  // emoji render as fixed full-color platform graphics that CSS can't
  // recolor, while an icon font's color is just an ordinary styleable
  // property (see .vtm-gesture i rules in vtmlarp.css).
  const GESTURE_ICONS = { rock: "fa-hand-rock", paper: "fa-hand-paper", scissors: "fa-hand-scissors", bomb: "fa-bomb" };
  Handlebars.registerHelper("vtmGestureIcon", gesture => GESTURE_ICONS[gesture] ?? "fa-question");
});

Hooks.once("ready", () => {
  // A Challenge's opponent side is resolved on the responding player's (or,
  // for an unowned NPC, any GM's) own client rather than the challenger's -
  // this system is played online, not face to face, so the challenger must
  // never see the opponent's gesture before it's thrown. ChallengeApp emits
  // this event; every connected client receives it and only the intended
  // recipient(s) actually pop the response dialog.
  game.socket.on("system.vtmlarp", data => {
    // Every GM client tracks the request/resolution pair for the Active
    // Challenges dashboard, regardless of whether this particular GM is the
    // one who'll actually respond - a busy session can have several
    // challenges in flight across different players at once.
    if (game.user.isGM) {
      if (data.action === "challengeRequest") {
        GMChallengeDashboard.trackRequest({
          requestId: data.requestId,
          challengerName: data.challengerName,
          opponentName: data.opponentName,
          challengeType: data.challengeType
        });
      } else if (data.action === "challengeResolved") {
        GMChallengeDashboard.clearRequest(data.requestId);
      }
    }

    if (data.action !== "challengeRequest") return;
    if (!data.targetUserIds.includes(game.user.id)) return;

    const challengerActor = game.actors.get(data.challengerActorId);
    const opponentActor = game.actors.get(data.opponentActorId);
    if (!challengerActor || !opponentActor) return;

    new ChallengeResponseApp({
      requestId: data.requestId,
      challengerActor,
      challengerName: data.challengerName,
      challengeType: data.challengeType,
      challengerGesture: data.challengerGesture,
      opponentActor,
      retest: data.retest
    }).render(true);
  });
});

Hooks.on("getSceneControlButtons", controls => {
  if (!game.user.isGM) return;
  // Foundry v13 restructured getSceneControlButtons from an array to an
  // object keyed by control name; support both shapes rather than assuming
  // one, since this system targets v12-14.
  const tokenControl = Array.isArray(controls) ? controls.find(c => c.name === "token") : controls.token;
  if (!tokenControl) return;
  const tool = {
    name: "vtmlarp-challenges",
    title: "Active Challenges",
    icon: "fas fa-hand-rock",
    button: true,
    onClick: () => new GMChallengeDashboard().render(true),
    onChange: () => new GMChallengeDashboard().render(true)
  };
  if (Array.isArray(tokenControl.tools)) tokenControl.tools.push(tool);
  else tokenControl.tools[tool.name] = tool;
});
