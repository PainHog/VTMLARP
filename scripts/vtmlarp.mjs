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
import { STPanelApp } from "./apps/st-panel.mjs";
import { CharacterBuilderApp } from "./apps/character-builder.mjs";
import { resolveAndPostGestureChallenge } from "./apps/challenge-shared.mjs";
import { registerMigrationSettings, migrateWorldIfNeeded } from "./migrations.mjs";
import { enhanceAccessibility } from "./apps/a11y.mjs";

// Accessibility: after any VTMLARP sheet or dialog renders, give its icon-only
// controls accessible names (title -> aria-label) and keyboard operability. One
// hook per V2 class name; the V2 render hook passes (application, element, ...).
for (const appName of [
  "VTMActorSheet", "VTMVehicleSheet", "VTMItemSheet",
  "ChallengeApp", "ChallengeResponseApp", "GMChallengeDashboard", "XPAuditApp",
  "BloodBondOverviewApp", "STPanelApp", "CharacterBuilderApp", "FrenzyApp",
  "VaulderieApp", "SessionLogApp"
]) {
  Hooks.on(`render${appName}`, (app, element) => enhanceAccessibility(element));
}

Hooks.once("init", () => {
  console.log("VTMLARP | Initializing Mind's Eye Theatre: Laws of the Night system");

  // Records which system version this world's data was last migrated to.
  registerMigrationSettings();

  // Initiative is a flat d20 roll - MET breaks ties/order with a random draw
  // rather than a stat, so the Combat Tracker's "Roll Initiative" just rolls
  // 1d20 for each combatant.
  CONFIG.Combat.initiative = { formula: "1d20", decimals: 0 };

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

  // Unregister the core default sheets so ours is the only option. The core
  // sheet class lives under the deprecated `foundry.appv1` namespace (removed
  // in v15); guard the access so this keeps working when that namespace is
  // gone - registering ours as makeDefault is what actually matters, and an
  // unregister of an absent class would only throw.
  const BaseActorSheet = foundry.appv1?.sheets?.ActorSheet;
  const BaseItemSheet = foundry.appv1?.sheets?.ItemSheet;
  if (BaseActorSheet) ActorsCollection.unregisterSheet("core", BaseActorSheet);
  ActorsCollection.registerSheet("vtmlarp", VTMActorSheet, { types: ["character", "npc"], makeDefault: true });
  ActorsCollection.registerSheet("vtmlarp", VTMVehicleSheet, { types: ["vehicle"], makeDefault: true });

  if (BaseItemSheet) ItemsCollection.unregisterSheet("core", BaseItemSheet);
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

  // Build a dot row for a rated trait: `max` dots, the first `rating` filled.
  // If the rating exceeds max (e.g. Abilities above 5 at low generation), the
  // row grows to show them all.
  Handlebars.registerHelper("vtmDots", (rating, max) => {
    const r = Math.max(0, Number(rating) || 0);
    const m = Math.max(r, Number(max) || 5);
    return Array.from({ length: m }, (_, i) => ({ value: i + 1, filled: i < r }));
  });

  Handlebars.registerHelper("gt", (a, b) => Number(a) > Number(b));

  // Like vtmDots but also marks dots between the current rating and the
  // permanent max as "lost" (temporarily reduced), for the temp-loss display.
  Handlebars.registerHelper("vtmDotsMax", (rating, permMax, cap) => {
    const r = Math.max(0, Number(rating) || 0);
    const pm = Math.max(r, Number(permMax) || 0);
    const c = Math.max(pm, Number(cap) || 5);
    return Array.from({ length: c }, (_, i) => ({
      value: i + 1,
      filled: i < r,
      lost: i >= r && i < pm
    }));
  });
});

// A vehicle's token art is usually one shared image (e.g. a top-down car
// render) that can't be recolored per-instance directly - Foundry tokens
// support a "tint" color multiplied onto the texture instead, so a Vehicle
// Actor with system.randomizeTint checked gets a random tint from a small
// palette every time a new token is created from it, giving visual variety
// (a lot with a fleet) without needing a separate image per color.
const VEHICLE_TINT_PALETTE = ["#1a1a1a", "#e6e6e6", "#8a0303", "#0d2b4a", "#2f4f2f", "#4a3c1a", "#6b6b6b"];
Hooks.on("preCreateToken", (tokenDoc, data) => {
  const actor = tokenDoc.actor;
  if (actor?.type !== "vehicle") return;
  const update = {};
  // Always size a vehicle token from its grid footprint, so it drops onto the
  // scene at the right multi-square size regardless of what the prototype token
  // happened to carry (a manually-created vehicle, an imported one, etc.).
  const w = Number(actor.system.gridWidth);
  const h = Number(actor.system.gridHeight);
  if (w > 0) update.width = w;
  if (h > 0) update.height = h;
  if (actor.system.randomizeTint) {
    update["texture.tint"] = VEHICLE_TINT_PALETTE[Math.floor(Math.random() * VEHICLE_TINT_PALETTE.length)];
  }
  if (Object.keys(update).length) tokenDoc.updateSource(update);
});

Hooks.once("ready", () => {
  // Run any pending world-data migrations before anything else touches the
  // data (GM only; no-ops when the world is already current).
  migrateWorldIfNeeded();

  // Always-visible Storyteller Panel launcher for GMs. The scene-control
  // button (see getSceneControlButtons) doesn't render on every Foundry
  // version's control layout, so a GM also gets a small fixed on-screen button
  // that opens the panel - guaranteed present regardless of scene-control API
  // changes across v12-v14.
  if (game.user.isGM && !document.getElementById("vtmlarp-st-launcher")) {
    const btn = document.createElement("button");
    btn.id = "vtmlarp-st-launcher";
    btn.type = "button";
    btn.title = "Open the Storyteller Panel";
    btn.innerHTML = `<i class="fas fa-chess-king"></i> ST Panel`;
    btn.addEventListener("click", () => new STPanelApp().render(true));
    document.body.appendChild(btn);
  }

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
      } else if (data.action === "deleteChallengePrompt") {
        // A player resolved a Challenge but can't delete the challenger's
        // prompt message themselves - a GM does it on their behalf.
        game.messages.get(data.messageId)?.delete().catch(() => {});
      } else if (data.action === "createCharacter") {
        // A player built a character but lacks "Create New Actors" permission,
        // so a GM creates it for them - keeping the requesting player flagged
        // as the OWNER. Only the single designated active GM acts, so multiple
        // connected GMs don't each create a duplicate.
        if (game.users.activeGM?.id === game.user.id && data.actorData) {
          const payload = foundry.utils.duplicate(data.actorData);
          if (data.requesterId) {
            payload.ownership = payload.ownership ?? {};
            payload.ownership[data.requesterId] = CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
          }
          Actor.create(payload)
            .then(a => { if (a) ui.notifications?.info(`Added ${a.name} for a player via the Character Builder.`); })
            .catch(err => console.error("vtmlarp | createCharacter (GM proxy) failed", err));
        }
      }
    }

    if (data.action !== "challengeRequest") return;
    if (!data.targetUserIds.includes(game.user.id)) return;

    const challengerActor = game.actors.get(data.challengerActorId);
    const opponentActor = game.actors.get(data.opponentActorId);
    if (!challengerActor || !opponentActor) return;

    // NPC auto-response: when the opposed NPC is set to auto-randomize, resolve
    // the throw automatically with a random gesture instead of popping the
    // response dialog - so the Storyteller doesn't have to answer (and re-answer
    // on retests) every Challenge. It still bids the NPC's real Trait pool
    // (resolveAndPostGestureChallenge derives that from the actor). Only the
    // first designated responder acts, so multiple GMs don't double-resolve.
    if (opponentActor.type === "npc" && opponentActor.system?.autoChallenge
        && data.targetUserIds[0] === game.user.id) {
      const pool = ["rock", "paper", "scissors"];
      if (opponentActor.system?.bombAccess) pool.push("bomb");
      const opponentGesture = pool[Math.floor(Math.random() * pool.length)];
      resolveAndPostGestureChallenge({
        challengerActor,
        challengeType: data.challengeType,
        challengerGesture: data.challengerGesture,
        opponentActor,
        opponentGesture,
        retest: data.retest,
        isRetestThrow: !!data.isRetestThrow
      }).then(() => {
        game.socket.emit("system.vtmlarp", { action: "challengeResolved", requestId: data.requestId });
        if (game.user.isGM) GMChallengeDashboard.clearRequest?.(data.requestId);
      }).catch(err => console.error("VTMLARP | NPC auto-challenge failed", err));
      return;
    }

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

// Add an "Activate Scene" entry to the right-click menu on the top scene
// navigation tabs, so a GM can pull everyone to a scene straight from the nav
// bar instead of opening the Scenes sidebar. Core Foundry doesn't put Activate
// on the nav-tab menu on every version; this adds it consistently.
// Post any compendium entry (Item, JournalEntry, Actor) to the chat log, so a
// Storyteller can share a power, clan write-up, rule, etc. with the table.
async function postDocumentToChat(doc) {
  if (!doc) return;
  let body = "";
  if (doc.documentName === "JournalEntry") {
    const pages = doc.pages?.contents ?? [];
    body = pages.map(p => `${pages.length > 1 ? `<h3>${p.name}</h3>` : ""}${p.text?.content ?? ""}`).join("");
  } else if (doc.documentName === "Item") {
    body = doc.system?.description ?? "";
  } else {
    body = doc.system?.biography ?? doc.system?.concept ?? "";
  }
  let content = `<div class="vtmlarp-shared-entry"><h2>${doc.name}</h2>${body}</div>`;
  try {
    const TE = foundry.applications?.ux?.TextEditor?.implementation ?? globalThis.TextEditor;
    content = await TE.enrichHTML(content, { async: true });
  } catch { /* posting raw HTML is fine if enrichment isn't available */ }
  await ChatMessage.create({ content, speaker: { alias: doc.name } });
}

Hooks.on("getCompendiumEntryContext", (application, options) => {
  const resolve = async (li) => {
    const el = li instanceof HTMLElement ? li : (li?.[0] ?? li);
    const uuid = el?.dataset?.uuid ?? el?.dataset?.entryUuid;
    if (uuid) return fromUuid(uuid);
    const id = el?.dataset?.documentId ?? el?.dataset?.entryId;
    const pack = el?.closest?.("[data-pack]")?.dataset?.pack
      ?? application?.collection?.collection ?? application?.metadata?.id;
    return (pack && id) ? fromUuid(`Compendium.${pack}.${id}`) : null;
  };
  options.push({
    name: "Post to Chat",
    icon: '<i class="fas fa-comment-dots"></i>',
    callback: async (li) => {
      const doc = await resolve(li);
      if (!doc) return ui.notifications?.warn("Couldn't resolve that compendium entry.");
      await postDocumentToChat(doc);
    }
  });
});

// A "Character Builder" button at the top of the Actors sidebar directory.
Hooks.on("renderActorDirectory", (app, html) => {
  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!root) return;
  const header = root.querySelector(".directory-header .header-actions")
    ?? root.querySelector(".directory-header .action-buttons")
    ?? root.querySelector(".directory-header");
  if (!header || header.querySelector(".vtmlarp-build-character")) return;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "vtmlarp-build-character";
  btn.innerHTML = `<i class="fas fa-user-plus"></i> Character Builder`;
  btn.addEventListener("click", () => new CharacterBuilderApp().render(true));
  header.prepend(btn);
});

Hooks.on("getSceneNavigationContext", (nav, options) => {
  const sceneIdOf = (li) => {
    const el = li instanceof HTMLElement ? li : (li?.[0] ?? li);
    return el?.dataset?.sceneId ?? el?.getAttribute?.("data-scene-id");
  };
  options.push({
    name: "Activate Scene",
    icon: '<i class="fas fa-bullseye"></i>',
    condition: (li) => {
      if (!game.user.isGM) return false;
      const scene = game.scenes.get(sceneIdOf(li));
      return !!scene && !scene.active;
    },
    callback: (li) => {
      const scene = game.scenes.get(sceneIdOf(li));
      return scene?.activate();
    }
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
      name: "vtmlarp-st-panel",
      title: "Storyteller Panel",
      icon: "fas fa-chess-king",
      button: true,
      onClick: () => new STPanelApp().render(true),
      onChange: () => new STPanelApp().render(true)
    },
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

  // Resolve and post the result FIRST. Creating a new chat message is always
  // allowed, but updating/deleting the challenger's prompt message is NOT
  // permitted for a different player (only its author or a GM) - so that
  // cleanup must never come before, or block, the actual resolution.
  if (blockBtn) {
    // Retests can be blocked by an opponent who can match its conditions
    // (e.g., Dodge blocking a Firearms retest) - blocking skips the throw
    // entirely rather than resolving a gesture exchange.
    const blockSource = card.querySelector(".vtm-retest-block-source")?.value?.trim();
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: challengerActor }),
      content: `<div class="vtmlarp-challenge-card"><div class="vtm-clash-header"><span>${req.challengeType} Challenge - Retest Cancelled</span></div>`
        + `<p>${challengerActor.name}'s retest (<strong>${req.retest}</strong>) was cancelled by ${opponentActor.name}`
        + (blockSource ? ` giving up <strong>${blockSource}</strong>` : "") + `.</p>`
        + `<div class="vtm-result-banner result-Lost">${opponentActor.name} Wins (retest cancelled)!</div></div>`
    });
  } else {
    const opponentMod = Number(card.querySelector(".vtm-opponent-mod-input")?.value) || 0;
    await resolveAndPostGestureChallenge({
      challengerActor,
      challengeType: req.challengeType,
      challengerGesture: req.challengerGesture,
      opponentActor,
      opponentGesture: gesture,
      retest: req.retest,
      isRetestThrow: req.isRetestThrow,
      coinToss: req.coinToss,
      challengerMod: req.challengerMod,
      opponentMod
    });
  }

  // Now clean up the prompt. If this client may modify the message (author or
  // GM), do it directly; otherwise ask a GM to, via socket. Wrapped so a
  // permission error can never surface or undo the resolution above.
  try {
    if (message.canUserModify(game.user, "delete")) {
      await message.delete();
    } else {
      game.socket.emit("system.vtmlarp", { action: "deleteChallengePrompt", messageId: message.id });
    }
  } catch (err) {
    console.warn("VTMLARP | couldn't remove the challenge prompt (harmless):", err);
  }
  if (req.requestId) game.socket.emit("system.vtmlarp", { action: "challengeResolved", requestId: req.requestId });
});
