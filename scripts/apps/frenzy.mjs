/**
 * Frenzy is resolved as a static/uncontested test against a Difficulty (the
 * stimulus the Storyteller assigns) - there is no opposing party throwing
 * gestures against you, so unlike a Trait challenge this is safe to resolve
 * automatically. Compares the character's Self-Control/Instinct rating to
 * the Difficulty; Willpower can be spent instead to automatically resist.
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
      willpower: this.actor.system.willpower.value
    };
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);
    html.find("form").on("submit", this._onSubmit.bind(this));
  }

  async _onSubmit(event) {
    event.preventDefault();
    const fd = new FormDataExtended(event.currentTarget).object;
    const difficulty = Number(fd.difficulty) || 1;
    const spendWillpower = !!fd.spendWillpower;
    const trigger = fd.trigger || "";

    let outcome, detail;
    if (spendWillpower && this.actor.system.willpower.value > 0) {
      await this.actor.update({ "system.willpower.value": this.actor.system.willpower.value - 1 });
      outcome = "Resisted";
      detail = "Spent 1 Willpower Trait to automatically resist.";
    } else {
      const rating = this.actor.system.virtues.selfControlInstinct.rating;
      const resisted = rating >= difficulty;
      outcome = resisted ? "Resisted" : "Frenzy!";
      detail = `Self-Control/Instinct ${rating} vs Difficulty ${difficulty}.`;
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
