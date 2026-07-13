const { HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * GM-only report of every character's Experience: current pool, lifetime
 * total awarded (via the "Award XP" star button on the actor sheet), and
 * spent (total - value). Since the ratings +/- controls no longer block a
 * purchase when Experience is insufficient (players are trusted not to
 * abuse it), this recovers the visibility a hard block used to provide -
 * a GM can see at a glance who's spent more than they've been awarded,
 * without a full transaction ledger.
 */
export class XPAuditApp extends HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "vtmlarp-xp-audit",
    classes: ["vtmlarp", "xp-audit"],
    position: { width: 420, height: "auto" },
    window: { title: "Experience Audit", resizable: true }
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
        return { name: a.name, value, total, spent: Math.max(0, total - value), overspent: total - value < 0 };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
    return context;
  }
}
