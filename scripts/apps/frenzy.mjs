import { logAction } from "./action-log.mjs";
import { beats } from "./gesture.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { renderTemplate } = foundry.applications.handlebars;

/**
 * Frenzy and Rötschreck are resolved as a Static Challenge against a Difficulty
 * (the stimulus the Storyteller assigns), per Laws of the Night Revised: the
 * character throws, and on a WIN resists; on a TIE the higher trait total wins,
 * so the Virtue rating must EXCEED the Difficulty to survive a tie ("his
 * Self-Control of two Traits is insufficient" when tied with a Difficulty-3
 * stimulus); on a LOSS the character may RETEST by expending a Virtue Trait
 * (each retest a fresh throw), retesting until they win or run out of Virtue
 * Traits to spend. Standard frenzy (anger/hunger/provocation) tests
 * Self-Control/Instinct; Rötschreck (fire/sunlight) tests Courage. Spending a
 * Willpower Trait instead resists automatically. There is no opposing player
 * throwing against the character, so the static side is resolved with a random
 * gesture and the whole thing is safe to resolve on the character's own client.
 */
export class FrenzyApp extends HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  constructor(actor, options = {}) {
    // Explicit unique id per instance so multiple FrenzyApp windows (e.g.
    // the auto-open-on-Wounded trigger firing while a manually-opened one
    // is still up) don't clash over a shared DOM id - same fix as
    // ChallengeApp.
    super({ id: `vtmlarp-frenzy-${foundry.utils.randomID()}`, ...options });
    this.actor = actor;
  }

  static DEFAULT_OPTIONS = {
    classes: ["vtmlarp", "frenzy-app", "vtmlarp-frenzy"],
    position: { width: 380, height: "auto" },
    window: { title: "VTMLARP.App.FrenzyCheck", resizable: true }
  };

  static PARTS = {
    form: { template: "systems/vtmlarp/templates/apps/frenzy.hbs" }
  };

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.actor = this.actor;
    context.selfControlInstinct = this.actor.system.virtues.selfControlInstinct.rating;
    context.courage = this.actor.system.virtues.courage.rating;
    context.willpower = this.actor.system.willpower.value;
    return context;
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    this.element.querySelector("button[type='submit']")?.addEventListener("click", this._onSubmit.bind(this));
  }

  async _onSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget.closest("form");
    const fd = new foundry.applications.ux.FormDataExtended(form).object;
    const difficulty = Number(fd.difficulty) || 1;
    const spendWillpower = !!fd.spendWillpower;
    const trigger = fd.trigger || "";
    const isRotschreck = fd.virtue === "courage";
    const virtueKey = isRotschreck ? "courage" : "selfControlInstinct";
    const virtueLabel = isRotschreck ? "Courage" : "Self-Control/Instinct";
    const failLabel = isRotschreck ? "Rötschreck!" : "Frenzy!";

    let outcome, detail;
    // Asked to spend Willpower but has none left: warn and fall through to the
    // Virtue test rather than silently pretending the spend happened.
    if (spendWillpower && this.actor.system.willpower.value <= 0) {
      ui.notifications?.warn("No Willpower left to spend — resolving by Virtue test instead.");
    }
    if (spendWillpower && this.actor.system.willpower.value > 0) {
      await this.actor.update({ "system.willpower.value": this.actor.system.willpower.value - 1 });
      outcome = "Resisted";
      detail = "Spent 1 Willpower Trait to automatically resist.";
    } else {
      const rating = Number(this.actor.system.virtues[virtueKey].rating) || 0;
      // Static Challenge: throw vs the stimulus. A win resists; a tie is decided
      // by trait comparison (Virtue must exceed Difficulty to win the tie); a
      // loss may be retested by expending a Virtue Trait (temporary pool), each
      // retest a fresh throw, until a win or the Virtue Traits run out.
      const startTemp = Math.max(0, Number(this.actor.system.virtues[virtueKey].temporary) || 0);
      const rnd = () => ["rock", "paper", "scissors"][Math.floor(Math.random() * 3)];
      const throwsLog = [];
      let retestsLeft = startTemp;
      let resisted = false;
      for (;;) {
        const mine = rnd(), stim = rnd();
        const r = beats(mine, stim);
        const win = r === "win" || (r === "tie" && rating > difficulty);
        throwsLog.push(`${mine} vs ${stim}${r === "tie" ? ` (tie→${rating > difficulty ? "win" : "loss"})` : ""}`);
        if (win) { resisted = true; break; }
        if (retestsLeft > 0) { retestsLeft--; continue; }  // retest by expending a Virtue Trait
        break;
      }
      const spent = startTemp - retestsLeft;
      if (spent > 0) {
        await this.actor.update({ [`system.virtues.${virtueKey}.temporary`]: Math.max(0, startTemp - spent) });
      }
      outcome = resisted ? "Resisted" : failLabel;
      detail = `${virtueLabel} ${rating} Static Challenge vs Difficulty ${difficulty}`
        + (spent > 0 ? `, expended ${spent} Virtue Trait${spent === 1 ? "" : "s"} on retests` : "")
        + `. [${throwsLog.join("; ")}]`;
    }

    const content = await renderTemplate("systems/vtmlarp/templates/apps/frenzy-card.hbs", {
      actorName: this.actor.name,
      trigger,
      difficulty,
      outcome,
      detail
    });

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content
    });

    await logAction(this.actor, `${failLabel === "Rötschreck!" ? "Rötschreck" : "Frenzy"} check (Difficulty ${difficulty}): ${outcome}`);

    this.close();
  }
}
