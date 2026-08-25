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
  const q = getQueue();
  q.push(sub);
  await setQueue(q);
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
    window: { title: "Create Content (Storyteller approval required)", resizable: true },
    actions: { submit: HomebrewApp.#onSubmit }
  };

  static PARTS = { form: { template: "systems/vtmlarp/templates/apps/homebrew.hbs" } };

  async _prepareContext() {
    return { types: TYPES };
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
      game.socket.emit("system.vtmlarp", { action: "homebrewSubmit", sub });
      ui.notifications?.info("Sent to the Storyteller for approval.");
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
    window: { title: "Homebrew Review", resizable: true },
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
    const q = getQueue();
    const sub = q.find(s => s.id === target.dataset.id);
    if (!sub) return;
    try {
      const pack = await ensurePack();
      const data = submissionToItemData(sub);
      await Item.createDocuments([data], { pack: pack.collection });
      await setQueue(q.filter(s => s.id !== sub.id));
      ui.notifications?.info(`Approved "${sub.name}" into the ${PACK_LABEL} compendium.`);
      ChatMessage.create({ speaker: { alias: "Storyteller" }, content: `<p>Approved <strong>${sub.name}</strong> (${TYPES[sub.type] ?? sub.type}) by ${sub.by} into the ${PACK_LABEL} compendium.</p>` });
    } catch (err) {
      console.error("vtmlarp | homebrew approve failed", err);
      ui.notifications?.error("Couldn't create the compendium entry — see the console.");
    }
    this.render();
  }

  static async #onReject(event, target) {
    const q = getQueue();
    const sub = q.find(s => s.id === target.dataset.id);
    await setQueue(q.filter(s => s.id !== target.dataset.id));
    if (sub) ui.notifications?.info(`Rejected "${sub.name}".`);
    this.render();
  }

  static async #onOpenPack() {
    const pack = await ensurePack();
    pack.render(true);
  }
}
