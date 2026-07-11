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
export class FrenzyApp extends foundry.appv1.api.Application {
  constructor(actor, options = {}) {
    super(options);
    this.actor = actor;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "vtmlarp-frenzy",
      classes: ["vtmlarp", "frenzy-app"],
      template: "systems/vtmlarp/templates/apps/frenzy.hbs",
      width: 380,
      height: "auto",
      title: "Frenzy / Rötschreck Check"
    });
  }

  /** @override */
  getData(options) {
    return {
      actor: this.actor,
      selfControlInstinct: this.actor.system.virtues.selfControlInstinct.rating,
      courage: this.actor.system.virtues.courage.rating,
      willpower: this.actor.system.willpower.value
    };
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);
    const root = html instanceof HTMLElement ? html : html[0];
    root.querySelector("button[type='submit']")?.addEventListener("click", this._onSubmit.bind(this));
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

    this.close();
  }
}
