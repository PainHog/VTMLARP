const { HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Read-only view of one actor's actionLog (Challenges resolved, Frenzy
 * checks, Powers toggled) - since this system is played online rather than
 * face to face, there's no table to glance across afterward to piece
 * together what actually happened during a busy session.
 */
export class SessionLogApp extends HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  constructor(actor, options = {}) {
    super(options);
    this.actor = actor;
  }

  static DEFAULT_OPTIONS = {
    id: "vtmlarp-session-log",
    classes: ["vtmlarp", "session-log"],
    position: { width: 400, height: 500 },
    window: { resizable: true }
  };

  static PARTS = {
    form: { template: "systems/vtmlarp/templates/apps/session-log.hbs" }
  };

  /** @override */
  get title() {
    return `${this.actor.name} - Session Log`;
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.entries = (this.actor.system.actionLog ?? []).map(e => ({
      ...e,
      display: new Date(e.timestamp).toLocaleString()
    }));
    context.isEditable = this.actor.isOwner;
    return context;
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    this.element.querySelector(".clear-log")?.addEventListener("click", this._onClear.bind(this));
  }

  async _onClear(event) {
    event.preventDefault();
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Clear Session Log" },
      content: `<p>Clear the entire session log for ${this.actor.name}? This can't be undone.</p>`
    });
    if (!confirmed) return;
    await this.actor.update({ "system.actionLog": [] });
    this.render();
  }
}
