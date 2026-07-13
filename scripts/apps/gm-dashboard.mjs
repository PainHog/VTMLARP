const { HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * A GM-only view of Challenges currently awaiting a response. Since a
 * Challenge is resolved on the opponent's own client (this system is played
 * online, not face to face - see ChallengeApp/ChallengeResponseApp), a GM
 * running a busy session with several simultaneous challenges in flight has
 * no way to see who's still waiting on whom without asking around in chat.
 * This tracks pending requests in memory (per-GM-client, not persisted) via
 * the "challengeRequest"/"challengeResolved" socket events already emitted
 * by the Challenge tools, and re-renders whenever the list changes.
 */
export class GMChallengeDashboard extends HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  static #pending = new Map();
  static #instance = null;

  static DEFAULT_OPTIONS = {
    id: "vtmlarp-gm-dashboard",
    classes: ["vtmlarp", "gm-dashboard"],
    position: { width: 360, height: "auto" },
    window: { title: "Active Challenges", resizable: true }
  };

  static PARTS = {
    form: { template: "systems/vtmlarp/templates/apps/gm-dashboard.hbs" }
  };

  /** Record a newly-sent Challenge request and refresh the dashboard if open. */
  static trackRequest({ requestId, challengerName, opponentName, challengeType }) {
    this.#pending.set(requestId, { requestId, challengerName, opponentName, challengeType, sentAt: Date.now() });
    this.#instance?.render();
  }

  /** Remove a resolved/blocked Challenge and refresh the dashboard if open. */
  static clearRequest(requestId) {
    this.#pending.delete(requestId);
    this.#instance?.render();
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.pending = [...GMChallengeDashboard.#pending.values()].sort((a, b) => a.sentAt - b.sentAt);
    return context;
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    GMChallengeDashboard.#instance = this;
  }

  /** @override */
  close(options) {
    if (GMChallengeDashboard.#instance === this) GMChallengeDashboard.#instance = null;
    return super.close(options);
  }
}
