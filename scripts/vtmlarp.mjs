import { VTMCharacterData, VTMNpcData, VTMVehicleData } from "./documents/actor.mjs";
import {
  VTMAttributeData, VTMAbilityData, VTMDisciplineData, VTMPowerData,
  VTMBackgroundData, VTMMeritData, VTMFlawData, VTMVirtueData, VTMRitualData, VTMGearData
} from "./documents/item.mjs";
import { VTMActorSheet } from "./sheets/actor-sheet.mjs";
import { VTMVehicleSheet } from "./sheets/vehicle-sheet.mjs";
import { VTMItemSheet } from "./sheets/item-sheet.mjs";
import { ChallengeResponseApp } from "./apps/challenge-response.mjs";
import { ChallengeApp } from "./apps/challenge.mjs";
import { GMChallengeDashboard } from "./apps/gm-dashboard.mjs";
import { XPAuditApp } from "./apps/xp-audit.mjs";
import { BloodBondOverviewApp } from "./apps/blood-bond-overview.mjs";
import { resolveAndPostGestureChallenge } from "./apps/challenge-shared.mjs";

Hooks.once("init", () => {
  console.log("VTMLARP | Initializing Mind's Eye Theatre: Laws of the Night system");

  CONFIG.Actor.dataModels = {
    character: VTMCharacterData,
    npc: VTMNpcData,
    vehicle: VTMVehicleData
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
  ActorsCollection.registerSheet("vtmlarp", VTMVehicleSheet, { types: ["vehicle"], makeDefault: true });

  ItemsCollection.unregisterSheet("core", BaseItemSheet);
  ItemsCollection.registerSheet("vtmlarp", VTMItemSheet, { makeDefault: true });

  Handlebars.registerHelper("vtmCapitalize", str => typeof str === "string" ? str.charAt(0).toUpperCase() + str.slice(1) : str);

  // Combination Disciplines store every parent Discipline they draw on in
  // one string field - "Combination Discipline (Auspex/Celerity/Fortitude)",
  // "Auspex, Celerity", or a plain single name - so a Power's own
  // discipline field can't always link to one compendium entry. This splits
  // it into individual clean names so the sheet can offer a lore link to
  // each parent Discipline separately instead of just the raw combo string.
  Handlebars.registerHelper("vtmParseDisciplineNames", discipline => {
    if (typeof discipline !== "string" || !discipline) return [];
    const inner = discipline.match(/\(([^)]+)\)/)?.[1] ?? discipline;
    return inner.split(/[/,]/).map(s => s.trim()).filter(Boolean);
  });

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
    console.log("VTMLARP | Received socket event:", data.action, "| my user:", game.user.id, game.user.name, "| targetUserIds:", data.targetUserIds, "| am I targeted?", data.targetUserIds?.includes(game.user.id));

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
      retest: data.retest,
      isRetestThrow: !!data.isRetestThrow
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
  const tools = [
    {
      name: "vtmlarp-challenges",
      title: "Active Challenges",
      icon: "fas fa-hand-rock",
      button: true,
      onClick: () => new GMChallengeDashboard().render(true),
      onChange: () => new GMChallengeDashboard().render(true)
    },
    {
      name: "vtmlarp-xp-audit",
      title: "Experience Audit",
      icon: "fas fa-star",
      button: true,
      onClick: () => new XPAuditApp().render(true),
      onChange: () => new XPAuditApp().render(true)
    },
    {
      name: "vtmlarp-blood-bonds",
      title: "Blood Bonds Overview",
      icon: "fas fa-tint",
      button: true,
      onClick: () => new BloodBondOverviewApp().render(true),
      onChange: () => new BloodBondOverviewApp().render(true)
    }
  ];
  for (const tool of tools) {
    if (Array.isArray(tokenControl.tools)) tokenControl.tools.push(tool);
    else tokenControl.tools[tool.name] = tool;
  }
});

// "Re-throw Retest" button on a resolved Challenge's chat card - there was
// previously no way to actually act on a noted Retest short of manually
// reopening the Challenge tool and re-entering everything by hand. Bound
// via document-level delegated click rather than a specific
// "renderChatMessage(HTML)" hook, since that hook's exact name/signature
// changed between the Foundry versions this system targets (v12-14) and a
// delegated listener works identically regardless.
document.addEventListener("click", event => {
  const button = event.target.closest(".vtm-retest-throw");
  if (!button) return;
  event.preventDefault();

  const { challengerId, opponentId, challengeType, retest } = button.dataset;
  const challengerActor = game.actors.get(challengerId);
  if (!challengerActor) {
    ui.notifications?.warn("The challenger for this Retest no longer exists.");
    return;
  }
  if (!challengerActor.isOwner) {
    ui.notifications?.warn(`You don't control ${challengerActor.name} - only they can throw this Retest.`);
    return;
  }

  new ChallengeApp(challengerActor, {}, { challengeType, retest, opponentActorId: opponentId, isRetestThrow: true }).render(true);
});

// Responding to a Challenge directly from its chat card's gesture buttons
// (see postGestureChallengePrompt in challenge-shared.mjs) - this is the
// primary response path, not just a fallback: it only depends on normal
// chat history loading, not on a live socket push actually reaching the
// opponent's client, which testing showed isn't reliable on every setup.
// The message is public (anyone can see a Challenge is happening) but only
// the opponent's own owner (or a GM) is permitted to actually click a
// response - the challenger's own gesture stays hidden in the message's
// flags, never rendered into the visible card, until it resolves.
document.addEventListener("click", async event => {
  const gestureBtn = event.target.closest(".vtm-gesture-respond");
  const blockBtn = event.target.closest(".vtm-retest-block-submit");
  if (!gestureBtn && !blockBtn) return;
  event.preventDefault();

  const card = (gestureBtn ?? blockBtn).closest("[data-message-id]");
  const message = card && game.messages.get(card.dataset.messageId);
  if (!message) {
    ui.notifications?.warn("This Challenge's chat message no longer exists.");
    return;
  }

  const req = message.flags?.vtmlarp;
  if (!req) return;
  if (req.responded) {
    ui.notifications?.warn("This Challenge has already been responded to.");
    return;
  }

  const opponentActor = req.opponentActorId ? game.actors.get(req.opponentActorId) : null;
  if (!opponentActor?.isOwner) {
    ui.notifications?.warn(`You don't control ${req.opponentName || "this actor"} - only they (or a GM) can respond to this Challenge.`);
    return;
  }

  const challengerActor = game.actors.get(req.challengerActorId);
  if (!challengerActor) {
    ui.notifications?.warn("The challenger for this Challenge no longer exists.");
    return;
  }

  let gesture;
  if (gestureBtn) {
    gesture = card.querySelector(".vtm-gesture-select")?.value;
    if (!gesture) {
      ui.notifications?.warn("Choose a Gesture first.");
      return;
    }
  }

  await message.setFlag("vtmlarp", "responded", true);

  if (blockBtn) {
    // Retests can be blocked by an opponent who can match its conditions
    // (e.g., Dodge blocking a Firearms retest) - blocking skips the throw
    // entirely rather than resolving a gesture exchange.
    const blockSource = card.querySelector(".vtm-retest-block-source")?.value?.trim();
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: challengerActor }),
      content: `<div class="vtmlarp-challenge-card"><div class="vtm-clash-header"><span>${req.challengeType} Challenge - Retest Blocked</span></div>`
        + `<p>${challengerActor.name}'s retest (<strong>${req.retest}</strong>) was blocked by ${opponentActor.name}`
        + (blockSource ? ` using <strong>${blockSource}</strong>` : "") + `.</p>`
        + `<div class="vtm-result-banner result-Lost">${opponentActor.name} Wins (retest blocked)!</div></div>`
    });
  } else {
    await resolveAndPostGestureChallenge({
      challengerActor,
      challengeType: req.challengeType,
      challengerGesture: req.challengerGesture,
      opponentActor,
      opponentGesture: gesture,
      retest: req.retest,
      isRetestThrow: req.isRetestThrow
    });
  }

  if (req.requestId) game.socket.emit("system.vtmlarp", { action: "challengeResolved", requestId: req.requestId });
  await message.delete();
});
