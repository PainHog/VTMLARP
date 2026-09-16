const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

/**
 * Player-authored content: a creation form where players design a Thaumaturgy
 * ritual, a new Thaumaturgy path, a combination Discipline, or a custom power.
 * Submissions go to the Storyteller for approval; approved entries are written
 * into a world "Player Added" compendium so they can be dragged onto sheets
 * like any other content. Nothing reaches play without ST sign-off.
 */

const SETTING = "homebrewQueue";
const PACK_NAME = "player-added";
const PACK_LABEL = "Player Added";
const PENDING_KEY = "vtmlarp.pendingHomebrew";

// A player's homebrew submission is world-write (only the GM can queue it), so
// it must be relayed over the socket. To make sure a player's typed work is
// never lost if that relay silently strands, stash unacknowledged submissions
// in this client's localStorage until the GM confirms receipt. All access is
// wrapped in try/catch since localStorage can throw (private mode, etc.).
export function stashPendingHomebrew(sub) {
  try {
    const list = JSON.parse(localStorage.getItem(PENDING_KEY) || "[]");
    list.push(sub);
    // Keep only the most recent few so repeated no-GM strands can't grow this
    // unbounded; a player never has many drafts in flight at once.
    localStorage.setItem(PENDING_KEY, JSON.stringify(list.slice(-5)));
  } catch { /* non-fatal */ }
}
export function clearPendingHomebrew(id) {
  try {
    const list = JSON.parse(localStorage.getItem(PENDING_KEY) || "[]").filter(s => s.id !== id);
    localStorage.setItem(PENDING_KEY, JSON.stringify(list));
  } catch { /* non-fatal */ }
}
export function getPendingHomebrew() {
  try { return JSON.parse(localStorage.getItem(PENDING_KEY) || "[]"); }
  catch { return []; }
}

export function registerHomebrewSettings() {
  game.settings.register("vtmlarp", SETTING, {
    scope: "world", config: false, type: Object, default: { submissions: [] }
  });
}

export function getQueue() {
  return foundry.utils.duplicate(game.settings.get("vtmlarp", SETTING)?.submissions ?? []);
}
async function setQueue(submissions) {
  await game.settings.set("vtmlarp", SETTING, { submissions });
}

// Serialize read-modify-write cycles on the queue so two submissions arriving
// close together on the GM client don't both read the same snapshot and lose one.
let _queueMutex = Promise.resolve();
function withQueueLock(fn) {
  const run = _queueMutex.then(fn, fn);
  _queueMutex = run.then(() => {}, () => {});
  return run;
}

const TYPES = {
  ritual: "Thaumaturgy Ritual",
  path: "Thaumaturgy Path",
  combination: "Combination Discipline",
  power: "Custom Power"
};

/** GM: add a submission to the review queue (called directly for a GM author,
 * or via socket for a player). */
export async function enqueueHomebrew(sub) {
  if (!game.user.isGM) return;
  await withQueueLock(async () => {
    const q = getQueue();
    q.push(sub);
    await setQueue(q);
  });
  ui.notifications?.info(`New homebrew submission from ${sub.by}: "${sub.name}".`);
  // AppV2 instances live in foundry.applications.instances (a Map), not ui.windows (V1 only).
  for (const app of foundry.applications.instances.values()) if (app instanceof HomebrewReviewApp) app.render();
}

/** Find or create the world "Player Added" Item compendium. */
async function ensurePack() {
  const key = `world.${PACK_NAME}`;
  let pack = game.packs.get(key);
  if (!pack) {
    pack = await foundry.documents.collections.CompendiumCollection.createCompendium({
      type: "Item", label: PACK_LABEL, name: PACK_NAME, ownership: { PLAYER: "OBSERVER", ASSISTANT: "OWNER" }
    });
  }
  return pack;
}

/** Map a submission to an Item document data object. */
function submissionToItemData(sub) {
  const common = { description: sub.description || "", source: `Player Added — by ${sub.by}` };
  if (sub.type === "ritual") {
    return { name: sub.name, type: "ritual", img: "icons/svg/book.svg", system: { ...common, path: sub.prereqs || "", level: Number(sub.level) || 1, bloodCost: sub.bloodCost || "" } };
  }
  if (sub.type === "path") {
    return { name: sub.name.startsWith("Thaumaturgy") ? sub.name : `Thaumaturgy (${sub.name})`, type: "discipline", img: "icons/svg/upgrade.svg", system: { ...common, rating: 1 } };
  }
  // combination discipline or custom power -> a power item
  return {
    name: sub.name, type: "power", img: "icons/svg/lightning.svg",
    system: {
      ...common,
      discipline: sub.type === "combination" ? "Combination Discipline" : (sub.prereqs || ""),
      prerequisites: sub.prereqs || "",
      challengeType: sub.challengeType || "none",
      bloodCost: sub.bloodCost || "",
      level: "advanced",
      activation: "challenge"
    }
  };
}

/** The player/GM creation form. */
export class HomebrewApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "vtmlarp-homebrew",
    classes: ["vtmlarp", "sheet", "homebrew"],
    position: { width: 560, height: 640 },
    window: { title: "VTMLARP.App.CreateContent", resizable: true },
    actions: { submit: HomebrewApp.#onSubmit }
  };

  static PARTS = { form: { template: "systems/vtmlarp/templates/apps/homebrew.hbs" } };

  async _prepareContext() {
    return { types: TYPES };
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    // If a previous submission was never confirmed by the Storyteller, its draft
    // was stashed locally — restore it into the form so the player can resend
    // instead of retyping. Use the most recent pending draft.
    const pending = getPendingHomebrew();
    if (!pending.length) return;
    const draft = pending[pending.length - 1];
    const el = this.element;
    for (const field of ["name", "type", "level", "prereqs", "bloodCost", "challengeType", "description"]) {
      const input = el.querySelector(`[name="${field}"]`);
      if (input && draft[field] != null && draft[field] !== "") input.value = draft[field];
    }
    ui.notifications?.info("Restored an unconfirmed homebrew draft — submit again to resend.");
  }

  static async #onSubmit() {
    const el = this.element;
    const v = (n) => el.querySelector(`[name="${n}"]`)?.value ?? "";
    const name = v("name").trim();
    if (!name) { ui.notifications?.warn("Give your creation a name."); return; }
    const sub = {
      id: foundry.utils.randomID(),
      by: game.user.name,
      byUserId: game.user.id,
      type: v("type") || "power",
      name,
      level: v("level"),
      prereqs: v("prereqs").trim(),
      bloodCost: v("bloodCost").trim(),
      challengeType: v("challengeType"),
      description: v("description").trim(),
      submittedAt: new Date().toLocaleString()
    };

    if (game.user.isGM) {
      await enqueueHomebrew(sub);
      ui.notifications?.info("Added to the review queue (open Homebrew Review to approve).");
    } else if (game.users.activeGM) {
      // World-write, so it must be relayed to the GM. Stash the draft locally
      // first; it's cleared when the GM confirms receipt (homebrewSubmitReceived)
      // or reports failure. If no confirmation arrives, warn and keep the draft.
      stashPendingHomebrew(sub);
      game.socket.emit("system.vtmlarp", { action: "homebrewSubmit", sub });
      ui.notifications?.info("Sent to the Storyteller — waiting for confirmation…");
      setTimeout(() => {
        if (getPendingHomebrew().some(s => s.id === sub.id)) {
          ui.notifications?.warn(`No confirmation from the Storyteller that "${sub.name}" was received. Your draft is saved — reopen Homebrew to resend.`);
        }
      }, 8000);
    } else {
      ui.notifications?.error("No Storyteller is online to receive your submission.");
      return;
    }
    this.close();
  }
}

/** Storyteller review queue: approve (writes to the Player Added compendium) or
 * reject each submission. */
export class HomebrewReviewApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "vtmlarp-homebrew-review",
    classes: ["vtmlarp", "sheet", "homebrew-review"],
    position: { width: 620, height: 680 },
    window: { title: "VTMLARP.App.HomebrewReview", resizable: true },
    actions: {
      approve: HomebrewReviewApp.#onApprove,
      reject: HomebrewReviewApp.#onReject,
      openPack: HomebrewReviewApp.#onOpenPack
    }
  };

  static PARTS = { form: { template: "systems/vtmlarp/templates/apps/homebrew-review.hbs" } };

  async _prepareContext() {
    return { submissions: getQueue().map(s => ({ ...s, typeLabel: TYPES[s.type] ?? s.type })) };
  }

  static async #onApprove(event, target) {
    const id = target.dataset.id;
    let approved = null;
    // Run under the same lock as enqueue, and re-read the queue INSIDE the lock
    // before writing it back - otherwise a submission that arrives (via the
    // socket enqueue, on this same GM client) between our read and write is
    // silently overwritten and lost. A second approve of the same entry finds
    // it already gone and no-ops.
    await withQueueLock(async () => {
      const sub = getQueue().find(s => s.id === id);
      if (!sub) return;
      try {
        const pack = await ensurePack();
        await Item.createDocuments([submissionToItemData(sub)], { pack: pack.collection });
      } catch (err) {
        console.error("vtmlarp | homebrew approve failed", err);
        ui.notifications?.error("Couldn't create the compendium entry — see the console.");
        return;  // leave the submission in the queue
      }
      await setQueue(getQueue().filter(s => s.id !== id));
      approved = sub;
    });
    if (approved) {
      ui.notifications?.info(`Approved "${approved.name}" into the ${PACK_LABEL} compendium.`);
      ChatMessage.create({ speaker: { alias: "Storyteller" }, content: `<p>Approved <strong>${approved.name}</strong> (${TYPES[approved.type] ?? approved.type}) by ${approved.by} into the ${PACK_LABEL} compendium.</p>` });
      if (approved.byUserId) game.socket.emit("system.vtmlarp", { action: "homebrewReviewed", byUserId: approved.byUserId, name: approved.name, approved: true });
    }
    this.render();
  }

  static async #onReject(event, target) {
    const id = target.dataset.id;
    let rejected = null;
    await withQueueLock(async () => {
      const q = getQueue();
      rejected = q.find(s => s.id === id) ?? null;
      if (rejected) await setQueue(q.filter(s => s.id !== id));
    });
    if (rejected) {
      ui.notifications?.info(`Rejected "${rejected.name}".`);
      // The player otherwise gets no feedback at all on a rejection.
      if (rejected.byUserId) game.socket.emit("system.vtmlarp", { action: "homebrewReviewed", byUserId: rejected.byUserId, name: rejected.name, approved: false });
    }
    this.render();
  }

  static async #onOpenPack() {
    const pack = await ensurePack();
    pack.render(true);
  }
}
