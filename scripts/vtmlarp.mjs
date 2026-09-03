import { VTMCharacterData, VTMNpcData, VTMVehicleData, VTMShopData } from "./documents/actor.mjs";
import {
  VTMAttributeData, VTMAbilityData, VTMDisciplineData, VTMPowerData,
  VTMBackgroundData, VTMMeritData, VTMFlawData, VTMVirtueData, VTMRitualData, VTMGearData
} from "./documents/item.mjs";
import { VTMActorSheet } from "./sheets/actor-sheet.mjs";
import { VTMVehicleSheet } from "./sheets/vehicle-sheet.mjs";
import { ShopSheet } from "./sheets/shop-sheet.mjs";
import { VTMItemSheet } from "./sheets/item-sheet.mjs";
import { ChallengeResponseApp } from "./apps/challenge-response.mjs";
import { ChallengeApp } from "./apps/challenge.mjs";
import { GMChallengeDashboard } from "./apps/gm-dashboard.mjs";
import { XPAuditApp } from "./apps/xp-audit.mjs";
import { BloodBondOverviewApp } from "./apps/blood-bond-overview.mjs";
import { STPanelApp } from "./apps/st-panel.mjs";
import { CharacterBuilderApp } from "./apps/character-builder.mjs";
import { ClanPickerApp } from "./apps/clan-picker.mjs";
import { resolveAndPostGestureChallenge } from "./apps/challenge-shared.mjs";
import { registerMigrationSettings, migrateWorldIfNeeded } from "./migrations.mjs";
import { enhanceAccessibility } from "./apps/a11y.mjs";
import { registerShopSettings, MercantilePanelApp, ShopBrowserApp, fulfillPurchase } from "./apps/shops.mjs";
import { registerHomebrewSettings, HomebrewApp, HomebrewReviewApp, enqueueHomebrew } from "./apps/homebrew.mjs";

// Accessibility: after any VTMLARP sheet or dialog renders, give its icon-only
// controls accessible names (title -> aria-label) and keyboard operability. One
// hook per V2 class name; the V2 render hook passes (application, element, ...).
for (const appName of [
  "VTMActorSheet", "VTMVehicleSheet", "VTMItemSheet", "ShopSheet",
  "ChallengeApp", "ChallengeResponseApp", "GMChallengeDashboard", "XPAuditApp",
  "BloodBondOverviewApp", "STPanelApp", "CharacterBuilderApp", "FrenzyApp",
  "VaulderieApp", "SessionLogApp", "MercantilePanelApp", "ShopBrowserApp", "DiablerieApp",
  "HomebrewApp", "HomebrewReviewApp"
]) {
  Hooks.on(`render${appName}`, (app, element) => {
    enhanceAccessibility(element);
    restoreWindowPosition(app);
  });
  Hooks.on(`close${appName}`, (app) => saveWindowPosition(app));
}

/**
 * Per-player window size/position memory. Keyed by the app's class name so all
 * instances of a window (e.g. every character sheet) share the size the player
 * last chose, and it survives a reload. Defensive throughout — a bad stored
 * value must never stop a window from opening.
 */
function saveWindowPosition(app) {
  try {
    const p = app?.position;
    if (!p || !game.settings) return;
    const store = { ...(game.settings.get("vtmlarp", "windowPositions") ?? {}) };
    store[app.constructor.name] = { top: p.top, left: p.left, width: p.width, height: p.height };
    game.settings.set("vtmlarp", "windowPositions", store);
  } catch (err) { console.warn("VTMLARP | couldn't save window position", err); }
}

function restoreWindowPosition(app) {
  try {
    if (app._vtmPosRestored) return;      // only reposition on the first render
    app._vtmPosRestored = true;
    const saved = (game.settings.get("vtmlarp", "windowPositions") ?? {})[app.constructor.name];
    if (!saved) return;
    // Clamp to the current viewport so a window saved on a bigger screen can't
    // open entirely off-screen.
    const pos = { ...saved };
    if (Number.isFinite(pos.left)) pos.left = Math.max(0, Math.min(pos.left, window.innerWidth - 100));
    if (Number.isFinite(pos.top)) pos.top = Math.max(0, Math.min(pos.top, window.innerHeight - 60));
    app.setPosition(pos);
  } catch (err) { console.warn("VTMLARP | couldn't restore window position", err); }
}

Hooks.once("init", () => {
  console.log("VTMLARP | Initializing Mind's Eye Theatre: Laws of the Night system");

  // Records which system version this world's data was last migrated to.
  registerMigrationSettings();
  // Mercantile shops (world setting).
  registerShopSettings();
  // Player-authored content queue (world setting).
  registerHomebrewSettings();

  // Remembered per-player window sizes/positions (client-scoped): keyed by app
  // class name, so a sheet/dialog reopens at the size and place the player last
  // left it instead of snapping back to the default (see the render/close hooks
  // that read and write this below).
  game.settings.register("vtmlarp", "windowPositions", {
    scope: "client", config: false, type: Object, default: {}
  });

  // Remembered per-player collapsed sheet sections (client-scoped), keyed by
  // actor id then section key. Sections start expanded; this stores the ones a
  // player has minimized so they stay collapsed across reopens/reloads.
  game.settings.register("vtmlarp", "collapsedSections", {
    scope: "client", config: false, type: Object, default: {}
  });

  // Initiative order in MET is by the character's Physical Trait pool plus their
  // Celerity rating, highest first (fastest acts first). "Roll Initiative" fills
  // in that deterministic value rather than a die, and the tracker sorts on it.
  CONFIG.Combat.initiative = { formula: "0", decimals: 0 };
  CONFIG.Combatant.documentClass = class VTMCombatant extends CONFIG.Combatant.documentClass {
    getInitiativeRoll(formula) {
      const a = this.actor;
      const phys = Number(a?.system?.attributes?.physical?.total) || 0;
      // Celerity is a Discipline item; its rating adds to how early you act.
      const cel = Number(a?.items?.find(i => i.type === "discipline" && /^celerity$/i.test(i.name))?.system?.rating) || 0;
      return new Roll(String(phys + cel));
    }
  };

  CONFIG.Actor.dataModels = {
    character: VTMCharacterData,
    npc: VTMNpcData,
    vehicle: VTMVehicleData,
    shop: VTMShopData
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
  ActorsCollection.registerSheet("vtmlarp", ShopSheet, { types: ["shop"], makeDefault: true });

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
// Reset each combatant's per-turn Blood-spend counter when the combat turn or
// round advances, so the per-turn limit warning is measured per turn. GM only
// (writes shared actor data).
for (const hook of ["combatTurn", "combatRound"]) {
  Hooks.on(hook, (combat) => {
    if (!game.user.isGM || !combat?.combatants) return;
    for (const c of combat.combatants) {
      const a = c.actor;
      if (!a) continue;
      if ((Number(a.system?.blood?.spentThisTurn) || 0) > 0) {
        a.update({ "system.blood.spentThisTurn": 0 }).catch(() => {});
      }
      // Blood-buff Traits last one turn/challenge, so clear any lingering
      // blood-boost Active Effects when the turn/round advances rather than
      // relying on the player to remember to clear them.
      const boosts = a.effects?.filter(e => e.flags?.vtmlarp?.bloodBoost).map(e => e.id) ?? [];
      if (boosts.length) a.deleteEmbeddedDocuments("ActiveEffect", boosts).catch(() => {});
    }
  });
}

Hooks.on("preCreateToken", (tokenDoc, data) => {
  const actor = tokenDoc.actor;
  if (!actor) return;

  // The token nameplate should show the CHARACTER's name. Foundry defaults a
  // token's name to the actor's, but a prototype token that ended up carrying a
  // blank or a stray value (e.g. a player's username) would otherwise show that
  // instead. Correct it when the token has no name or its name matches a
  // connected user's name; a deliberate custom token name is left alone.
  if (actor.name) {
    const nm = tokenDoc.name;
    const looksWrong = !nm || game.users.some(u => u.name === nm && nm !== actor.name);
    if (looksWrong) tokenDoc.updateSource({ name: actor.name });
  }

  if (actor.type !== "vehicle") return;
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

  // All Storyteller and player launchers live in the scene-controls toolbar
  // (see getSceneControlButtons below) rather than floating on-screen buttons.

  // A Challenge's opponent side is resolved on the responding player's (or,
  // for an unowned NPC, any GM's) own client rather than the challenger's -
  // this system is played online, not face to face, so the challenger must
  // never see the opponent's gesture before it's thrown. ChallengeApp emits
  // this event; every connected client receives it and only the intended
  // recipient(s) actually pop the response dialog.
  game.socket.on("system.vtmlarp", data => {
    // Delete a Challenge prompt message by its requestId - runs on every
    // client, but only the message's author (the challenger) or a GM actually
    // has permission, so exactly the right client removes it. Used by the NPC
    // auto-answer path to clear the prompt regardless of which client synced it.
    if (data.action === "deleteChallengePromptByRequest") {
      const msg = game.messages?.find(m => m.getFlag?.("vtmlarp", "requestId") === data.requestId);
      if (msg && msg.canUserModify(game.user, "delete")) msg.delete().catch(() => {});
      return;
    }

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
      } else if (data.action === "markChallengeResponded") {
        // Backup for the above: flag the prompt responded so it can't resolve
        // twice even if deletion is delayed or the message lingers on a client.
        game.messages.get(data.messageId)?.setFlag("vtmlarp", "responded", true).catch(() => {});
      } else if (data.action === "homebrewSubmit") {
        // A player submitted homebrew content; the active GM queues it.
        if (game.users.activeGM?.id === game.user.id && data.sub) {
          enqueueHomebrew(data.sub).catch(err => console.error("vtmlarp | homebrewSubmit failed", err));
        }
      } else if (data.action === "shopPurchase") {
        // A player asked to buy from a shop; only the designated active GM
        // fulfills it (debits/credits, adds the item, decrements stock, logs).
        if (game.users.activeGM?.id === game.user.id && data.req) {
          fulfillPurchase(data.req)
            .then(msg => ui.notifications?.info(msg))
            .catch(err => console.error("vtmlarp | shopPurchase failed", err));
        }
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
            .then(a => {
              if (!a) return;
              ui.notifications?.info(`Added ${a.name} for a player via the Character Builder.`);
              // Tell the requesting player it worked (and let their client open
              // the new sheet) - otherwise, from their seat, the character just
              // vanished after "Sent to the Storyteller".
              game.socket.emit("system.vtmlarp", { action: "characterCreated", requesterId: data.requesterId, actorId: a.id, name: a.name });
            })
            .catch(err => {
              console.error("vtmlarp | createCharacter (GM proxy) failed", err);
              ui.notifications?.error(`Couldn't add the submitted character "${payload.name ?? "?"}": ${err.message}`);
              game.socket.emit("system.vtmlarp", { action: "characterCreateFailed", requesterId: data.requesterId, name: payload.name ?? "your character", reason: err.message });
            });
        }
      } else if (data.action === "characterCreated") {
        // The requesting player learns their submission was created and opens it.
        if (data.requesterId === game.user.id) {
          ui.notifications?.info(`Your character "${data.name}" was added by the Storyteller.`);
          game.actors.get(data.actorId)?.sheet?.render(true);
        }
      } else if (data.action === "characterCreateFailed") {
        if (data.requesterId === game.user.id) {
          ui.notifications?.error(`The Storyteller couldn't add "${data.name}": ${data.reason}. Adjust it and submit again.`);
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
        isRetestThrow: !!data.isRetestThrow,
        challengerMod: Number(data.challengerMod) || 0
      }).then(() => {
        game.socket.emit("system.vtmlarp", { action: "challengeResolved", requestId: data.requestId });
        if (game.user.isGM) GMChallengeDashboard.clearRequest?.(data.requestId);
        // Remove the public chat prompt for this Challenge so it can't be
        // clicked to resolve a second time. Try locally (this GM can delete
        // it), and broadcast so whoever authored it (the challenger) also
        // removes it, in case the message hasn't synced to this client yet.
        const prompt = game.messages?.find(m => m.getFlag?.("vtmlarp", "requestId") === data.requestId);
        prompt?.delete?.().catch(() => {});
        game.socket.emit("system.vtmlarp", { action: "deleteChallengePromptByRequest", requestId: data.requestId });
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
      isRetestThrow: !!data.isRetestThrow,
      challengerMod: Number(data.challengerMod) || 0
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

// GM-only compendium entries: any document flagged flags.vtmlarp.gmOnly is
// hidden from non-GM players in the compendium browser. Used to park entries
// that shouldn't be player-visible yet (e.g. powers whose rules we haven't
// finished verifying). GMs always see everything.
Hooks.on("renderCompendium", async (app, html) => {
  if (game.user.isGM) return;
  const collection = app.collection ?? app.document ?? null;
  if (!collection?.getIndex) return;
  let index;
  try { index = await collection.getIndex({ fields: ["flags.vtmlarp.gmOnly"] }); }
  catch { return; }
  const hidden = [...index].filter(e => e.flags?.vtmlarp?.gmOnly).map(e => e._id);
  if (!hidden.length) return;
  const root = html instanceof HTMLElement ? html : html?.[0];
  for (const id of hidden) {
    root?.querySelector(`[data-entry-id="${id}"], [data-document-id="${id}"], li[data-document-id="${id}"]`)?.remove();
  }
});

// Character Builder, Shops and Create Content now live in the scene-controls
// toolbar (see getSceneControlButtons) rather than the Actors sidebar header.

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
  // A dedicated "Mind's Eye Theatre" control group in the left toolbar holds
  // all this system's launchers, so nothing is jammed into the Actors sidebar
  // or floated over the canvas. Foundry v13 restructured this hook from an
  // array to an object keyed by control name; support both shapes (v12-v14).
  const tool = (name, title, icon, App) => ({
    name, title, icon, button: true,
    onClick: () => new App().render(true),
    onChange: () => new App().render(true)
  });

  // Available to everyone (players included).
  const tools = [
    tool("vtmlarp-clan-picker", "Help Me Pick a Clan", "fas fa-question-circle", ClanPickerApp),
    tool("vtmlarp-builder", "Character Builder", "fas fa-user-plus", CharacterBuilderApp),
    tool("vtmlarp-shops", "Shops", "fas fa-store", ShopBrowserApp),
    tool("vtmlarp-create", "Create Content (homebrew)", "fas fa-wand-magic-sparkles", HomebrewApp)
  ];
  // Storyteller-only.
  if (game.user.isGM) {
    tools.push(
      tool("vtmlarp-st-panel", "Storyteller Panel", "fas fa-chess-king", STPanelApp),
      tool("vtmlarp-mercantile", "Mercantile — manage shops", "fas fa-store-alt", MercantilePanelApp),
      tool("vtmlarp-homebrew", "Homebrew Review", "fas fa-scroll", HomebrewReviewApp),
      tool("vtmlarp-challenges", "Active Challenges", "fas fa-hand-rock", GMChallengeDashboard),
      tool("vtmlarp-xp-audit", "Experience Audit", "fas fa-star", XPAuditApp),
      tool("vtmlarp-blood-bonds", "Blood Bonds Overview", "fas fa-tint", BloodBondOverviewApp)
    );
  }

  const group = {
    name: "vtmlarp",
    title: "Mind's Eye Theatre",
    icon: "fas fa-moon",
    layer: "tokens",
    activeTool: tools[0]?.name,
    tools: {}
  };
  for (const t of tools) group.tools[t.name] = t;

  if (Array.isArray(controls)) {
    // v12 array shape: tools must be an array.
    group.tools = tools;
    controls.push(group);
  } else {
    controls[group.name] = group;
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
  const opponentActor = opponentId ? game.actors.get(opponentId) : null;
  // Either side may call a retest (in MET the loser often does). Whoever clicks
  // re-throws as the new challenger against the other party; a GM (who owns
  // both) defaults to re-throwing as the original challenger.
  let thrower, target;
  if (challengerActor?.isOwner) { thrower = challengerActor; target = opponentActor; }
  else if (opponentActor?.isOwner) { thrower = opponentActor; target = challengerActor; }
  else {
    ui.notifications?.warn("You don't control either side of this Challenge, so you can't throw the Retest.");
    return;
  }

  new ChallengeApp(thrower, {}, { challengeType, retest, opponentActorId: target?.id, isRetestThrow: true }).render(true);
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

  // Validate the gesture BEFORE disabling anything: a player who clicks Respond
  // without picking a gesture (the select defaults to blank) must get a nudge
  // and a still-usable card, not a permanently disabled dead-end.
  let gesture;
  if (gestureBtn) {
    gesture = card.querySelector(".vtm-gesture-select")?.value;
    if (!gesture) {
      ui.notifications?.warn("Choose a Gesture first.");
      return;
    }
  }

  // Now disable this card's controls so a second click on the same client can't
  // double-resolve while the async resolution is in flight (the prompt is also
  // deleted/flagged below, but that's async and cross-client).
  card.querySelectorAll("button, select").forEach(el => { el.disabled = true; });

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
  // GM), delete it and mark it responded directly; otherwise ask a GM to, via
  // socket. Wrapped so a permission error can never surface or undo the
  // resolution above. The responded flag backs up deletion for any client that
  // still holds the message (the guard at the top of this handler reads it).
  try {
    if (message.canUserModify(game.user, "delete")) {
      await message.setFlag("vtmlarp", "responded", true);
      await message.delete();
    } else {
      game.socket.emit("system.vtmlarp", { action: "deleteChallengePrompt", messageId: message.id });
      game.socket.emit("system.vtmlarp", { action: "markChallengeResponded", messageId: message.id });
    }
  } catch (err) {
    console.warn("VTMLARP | couldn't remove the challenge prompt (harmless):", err);
  }
  if (req.requestId) game.socket.emit("system.vtmlarp", { action: "challengeResolved", requestId: req.requestId });
});
