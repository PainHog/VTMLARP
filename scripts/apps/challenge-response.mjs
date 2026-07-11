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
    super(options);
    this.request = request;
  }

  static DEFAULT_OPTIONS = {
    id: "vtmlarp-challenge-response",
    classes: ["vtmlarp", "challenge-app"],
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

    await resolveAndPostGestureChallenge({
      challengerActor: this.request.challengerActor,
      challengeType: this.request.challengeType,
      challengerGesture: this.request.challengerGesture,
      opponentActor: this.request.opponentActor,
      opponentGesture: fd.gesture,
      retest: this.request.retest
    });

    this.close();
  }
}
