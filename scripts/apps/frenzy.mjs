import { logAction } from "./action-log.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { renderTemplate } = foundry.applications.handlebars;

/**
 * Frenzy and Rötschreck are both resolved as a static/uncontested Virtue Test
 * against a Difficulty (the stimulus the Storyteller assigns) - there is no
 * opposing party throwing gestures against you, so unlike a Trait challenge
 * this is safe to resolve automatically. Standard frenzy (anger, hunger,
 * provocation) tests Self-Control/Instinct; Rötschreck (fire/sunlight) tests
 * Courage instead - the rulebook's own worked example resolves them the same
 * way, just against a different Virtue. Per that example, a tie is NOT
 * enough to resist ("his Self-Control of two Traits is insufficient" when
 * tied with the stimulus) - the Virtue rating must exceed the Difficulty.
 * Willpower can be spent instead to automatically resist either one.
 */
export class FrenzyApp extends HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  constructor(actor, options = {}) {
    super(options);
    this.actor = actor;
  }

  static DEFAULT_OPTIONS = {
    id: "vtmlarp-frenzy",
    classes: ["vtmlarp", "frenzy-app"],
    position: { width: 380, height: "auto" },
    window: { title: "Frenzy / Rötschreck Check", resizable: true }
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
    const fd = new FormDataExtended(form).object;
    const difficulty = Number(fd.difficulty) || 1;
    const spendWillpower = !!fd.spendWillpower;
    const trigger = fd.trigger || "";
    const isRotschreck = fd.virtue === "courage";
    const virtueKey = isRotschreck ? "courage" : "selfControlInstinct";
    const virtueLabel = isRotschreck ? "Courage" : "Self-Control/Instinct";
    const failLabel = isRotschreck ? "Rötschreck!" : "Frenzy!";

    let outcome, detail;
    if (spendWillpower && this.actor.system.willpower.value > 0) {
      await this.actor.update({ "system.willpower.value": this.actor.system.willpower.value - 1 });
      outcome = "Resisted";
      detail = "Spent 1 Willpower Trait to automatically resist.";
    } else {
      const rating = this.actor.system.virtues[virtueKey].rating;
      // A tie does not resist - the Virtue rating must exceed the Difficulty.
      const resisted = rating > difficulty;
      outcome = resisted ? "Resisted" : failLabel;
      detail = `${virtueLabel} ${rating} vs Difficulty ${difficulty}.`;
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
