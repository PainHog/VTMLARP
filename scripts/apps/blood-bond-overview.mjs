const { HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * GM-only camp-wide view of every character's Blood Bonds/Vinculum, plus a
 * one-click "Decay All" that reduces every bond by 1 (removing any that
 * reach 0) - blood bonds fade without periodic reinforcement per the
 * rulebook, but nothing tracked that automatically before; a Storyteller
 * had to remember and hand-edit every affected sheet individually.
 */
export class BloodBondOverviewApp extends HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "vtmlarp-blood-bond-overview",
    classes: ["vtmlarp", "blood-bond-overview"],
    position: { width: 440, height: "auto" },
    window: { title: "VTMLARP.App.BloodBondsOverview", resizable: true }
  };

  static PARTS = {
    form: { template: "systems/vtmlarp/templates/apps/blood-bond-overview.hbs" }
  };

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.rows = [];
    for (const actor of game.actors.filter(a => a.type === "character")) {
      for (const bond of actor.system.bloodBonds ?? []) {
        context.rows.push({ actorName: actor.name, actorUuid: actor.uuid, boundTo: bond.name, level: bond.level, kind: bond.kind ?? "bond", isVinculum: bond.kind === "vinculum", notes: bond.notes });
      }
    }
    context.rows.sort((a, b) => a.actorName.localeCompare(b.actorName));
    return context;
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    this.element.querySelector(".decay-all")?.addEventListener("click", this._onDecayAll.bind(this));
    for (const el of this.element.querySelectorAll(".vtm-open-actor[data-uuid]")) {
      el.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const doc = await fromUuid(ev.currentTarget.dataset.uuid).catch(() => null);
        doc?.sheet?.render(true);
      });
    }
  }

  async _onDecayAll(event) {
    event.preventDefault();
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: "VTMLARP.App.DecayAllBloodBonds" },
      content: "<p>Reduce every ordinary Blood Bond by 1, removing any that reach 0? Sabbat <strong>Vinculum</strong> rows are left untouched (they don't fade with time — only a further Vaulderie lowers them). This affects every character actor at once.</p>",
      rejectClose: false  // dismissing (Esc/X) returns false instead of rejecting
    });
    if (!confirmed) return;

    // Per-actor try/catch: if one update throws, keep going rather than aborting
    // the batch half-done (which would leave some characters decayed and others
    // not, and a re-run would then double-decay the ones already done).
    const failed = [];
    for (const actor of game.actors.filter(a => a.type === "character")) {
      const bonds = actor.system.bloodBonds ?? [];
      if (!bonds.length) continue;
      // Only ordinary Bonds decay; Vinculum rows pass through unchanged (and a
      // decayed ordinary bond at 0 is dropped).
      const decayed = bonds
        .map(b => (b.kind === "vinculum" ? { ...b } : { ...b, level: b.level - 1 }))
        .filter(b => b.kind === "vinculum" || b.level > 0);
      try {
        await actor.update({ "system.bloodBonds": decayed });
      } catch (err) {
        console.error("VTMLARP | Blood Bond decay failed for", actor.name, err);
        failed.push(actor.name);
      }
    }

    if (failed.length) ui.notifications?.warn(`Blood Bonds decayed, except: ${failed.join(", ")} (see console).`);
    else ui.notifications?.info("Blood Bonds decayed by 1 across all characters.");
    this.render();
  }
}
