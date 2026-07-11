const { HandlebarsApplicationMixin } = foundry.applications.api;
const { renderTemplate } = foundry.applications.handlebars;

/**
 * The Vaulderie is a Sabbat rite that, at a physical table, is resolved by
 * literally writing each participant's name on an index card per Blood Trait
 * contributed, shuffling the cards together, and having each participant
 * draw back as many cards as she put in - whose name ends up on the cards
 * you draw determines your (asymmetric) Vinculum toward that person. Played
 * online, there's no physical deck to shuffle, so this tool does the same
 * draw virtually and reveals the results to the whole table at once (unlike
 * the Challenge tool, nothing here needs to stay secret between
 * participants - the fiction itself has everyone watching the same shared
 * shuffle and draw).
 */
export class VaulderieApp extends HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  constructor(actor, options = {}) {
    super(options);
    // Seed with the opening actor as the first participant, contributing 1
    // Blood Trait - both easy to edit or remove entirely from the form.
    this.participants = [{ actorId: actor?.id ?? "", traits: 1 }];
  }

  static DEFAULT_OPTIONS = {
    id: "vtmlarp-vaulderie",
    classes: ["vtmlarp", "vaulderie-app"],
    position: { width: 480, height: "auto" },
    window: { title: "Vaulderie", resizable: true }
  };

  static PARTS = {
    form: { template: "systems/vtmlarp/templates/apps/vaulderie.hbs" }
  };

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.actorOptions = game.actors
      .filter(a => ["character", "npc"].includes(a.type))
      .map(a => ({ id: a.id, name: a.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
    context.participants = this.participants;
    return context;
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    this.element.querySelector(".vaulderie-add-participant")?.addEventListener("click", this._onAddParticipant.bind(this));
    this.element.querySelectorAll(".vaulderie-remove-participant").forEach(el =>
      el.addEventListener("click", this._onRemoveParticipant.bind(this)));
    this.element.querySelector("button[type='submit']")?.addEventListener("click", this._onSubmit.bind(this));
  }

  /** Read the current form's participant rows back into this.participants before re-rendering. */
  _syncParticipantsFromForm() {
    const form = this.element.querySelector("form");
    if (!form) return;
    const fd = foundry.utils.expandObject(new FormDataExtended(form).object);
    const rows = fd.participants ? Object.values(fd.participants) : [];
    this.participants = rows.map(r => ({ actorId: r.actorId ?? "", traits: Number(r.traits) || 1 }));
  }

  async _onAddParticipant(event) {
    event.preventDefault();
    this._syncParticipantsFromForm();
    this.participants.push({ actorId: "", traits: 1 });
    this.render();
  }

  async _onRemoveParticipant(event) {
    event.preventDefault();
    this._syncParticipantsFromForm();
    const index = Number(event.currentTarget.dataset.index);
    this.participants.splice(index, 1);
    this.render();
  }

  async _onSubmit(event) {
    event.preventDefault();
    this._syncParticipantsFromForm();

    const participants = this.participants
      .filter(p => p.actorId && p.traits > 0)
      .map(p => ({ actor: game.actors.get(p.actorId), traits: p.traits }))
      .filter(p => p.actor);

    if (participants.length < 2) {
      ui.notifications?.warn("The Vaulderie needs at least two participants, each contributing at least 1 Blood Trait.");
      return;
    }

    // Build the shared deck: one "card" per Blood Trait contributed, each
    // card just identifying its contributor. Fisher-Yates shuffle, then each
    // participant draws back exactly as many cards as they contributed, in
    // the order they're listed - matching "mixes the cards, then each
    // participant draws back the same number she put in."
    let deck = [];
    for (const p of participants) {
      for (let i = 0; i < p.traits; i++) deck.push(p.actor.id);
    }
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    const draws = participants.map(p => {
      const drawnCounts = {};
      for (let i = 0; i < p.traits; i++) {
        const contributorId = deck.pop();
        drawnCounts[contributorId] = (drawnCounts[contributorId] ?? 0) + 1;
      }
      const breakdown = Object.entries(drawnCounts).map(([contributorId, count]) => {
        const contributor = participants.find(o => o.actor.id === contributorId)?.actor;
        return {
          name: contributor?.name ?? "Unknown",
          isSelf: contributorId === p.actor.id,
          count,
          // Only meaningful as a suggestion for a FIRST Vaulderie between
          // this pair - a subsequent one needs a Static Challenge against
          // the existing Vinculum rating instead (see the rules reference).
          suggestedFirstVinculum: 1 + count
        };
      }).filter(b => !b.isSelf);
      return { name: p.actor.name, traits: p.traits, breakdown };
    });

    const content = await renderTemplate("systems/vtmlarp/templates/apps/vaulderie-card.hbs", { draws });
    await ChatMessage.create({ content });

    this.close();
  }
}
