import { GESTURES, resolveAndPostGestureChallenge } from "./challenge-shared.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * The opponent's side of a Challenge: pops up privately on the responding
 * player's (or, for an unowned NPC, any GM's) client after a socket request
 * comes in from ChallengeApp. The challenger's own gesture is deliberately
 * never shown here - only revealed afterward in the posted chat card - so
 * that playing online doesn't let either side peek before committing.
 */
export class ChallengeResponseApp extends HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  constructor(request, options = {}) {
    // Explicit unique id per instance - see ChallengeApp's constructor for
    // why (multiple simultaneous incoming Challenges to the same GM/player
    // shouldn't clash over one shared DOM id).
    super({ id: `vtmlarp-challenge-response-${foundry.utils.randomID()}`, ...options });
    this.request = request;
  }

  static DEFAULT_OPTIONS = {
    classes: ["vtmlarp", "challenge-app", "vtmlarp-challenge-response"],
    position: { width: 380, height: "auto" },
    window: { title: "Incoming Challenge", resizable: true }
  };

  static PARTS = {
    form: { template: "systems/vtmlarp/templates/apps/challenge-response.hbs" }
  };

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.gestures = GESTURES;
    context.challengerName = this.request.challengerName;
    context.challengeType = this.request.challengeType;
    context.opponentActorName = this.request.opponentActor?.name ?? "";
    context.retest = this.request.retest;
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

    // Retests can be blocked by an opponent who can match its conditions
    // (e.g., Dodge blocking a Firearms retest) - blocking skips the throw
    // entirely rather than resolving a gesture exchange.
    if (this.request.retest && fd.block) {
      const opponentName = this.request.opponentActor?.name ?? "Opponent";
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.request.challengerActor }),
        content: `<div class="vtmlarp-challenge-card"><div class="vtm-clash-header"><span>${this.request.challengeType} Challenge - Retest Blocked</span></div>`
          + `<p>${this.request.challengerName}'s retest (<strong>${this.request.retest}</strong>) was blocked by ${opponentName}`
          + (fd.blockSource ? ` using <strong>${fd.blockSource}</strong>` : "") + `.</p>`
          + `<div class="vtm-result-banner result-Lost">${opponentName} Wins (retest blocked)!</div></div>`
      });
      this._broadcastResolved();
      this.close();
      return;
    }

    await resolveAndPostGestureChallenge({
      challengerActor: this.request.challengerActor,
      challengeType: this.request.challengeType,
      challengerGesture: this.request.challengerGesture,
      opponentActor: this.request.opponentActor,
      opponentGesture: fd.gesture,
      retest: this.request.retest
    });

    this._broadcastResolved();
    this.close();
  }

  /** Tell every client (including GMs watching the dashboard) this request is no longer pending. */
  _broadcastResolved() {
    if (!this.request.requestId) return;
    game.socket.emit("system.vtmlarp", { action: "challengeResolved", requestId: this.request.requestId });
  }
}
