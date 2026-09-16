const { HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * GM-only report of every character's Experience: current pool, lifetime
 * total awarded (via the "Award XP" star button on the actor sheet), and
 * spent (total - value). Since the ratings +/- controls no longer block a
 * purchase when Experience is insufficient (players are trusted not to abuse
 * it), this recovers the visibility a hard block used to provide, without a
 * full transaction ledger. Because current pool can't drop below 0 (schema
 * min:0), true overspending isn't representable here; instead the audit flags
 * the one anomaly it CAN detect - a current pool LARGER than the recorded
 * lifetime total, which means XP was added directly to the pool instead of
 * through the Award button (`unrecordedAward`).
 */
export class XPAuditApp extends HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "vtmlarp-xp-audit",
    classes: ["vtmlarp", "xp-audit"],
    position: { width: 420, height: "auto" },
    window: { title: "VTMLARP.App.ExperienceAudit", resizable: true }
  };

  static PARTS = {
    form: { template: "systems/vtmlarp/templates/apps/xp-audit.hbs" }
  };

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.rows = game.actors
      .filter(a => a.type === "character")
      .map(a => {
        const value = a.system.experience.value;
        const total = a.system.experience.total ?? 0;
        return { name: a.name, uuid: a.uuid, value, total, spent: Math.max(0, total - value), unrecordedAward: value > total };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
    return context;
  }

  _onRender(context, options) {
    super._onRender(context, options);
    for (const el of this.element.querySelectorAll(".vtm-open-actor[data-uuid]")) {
      el.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const doc = await fromUuid(ev.currentTarget.dataset.uuid).catch(() => null);
        doc?.sheet?.render(true);
      });
    }
  }
}
