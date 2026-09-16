import { GESTURES, claimChallenge, isChallengeResolved, submitChallengeAnswer } from "./challenge-shared.mjs";

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
    window: { title: "VTMLARP.App.IncomingChallenge", resizable: true }
  };

  static PARTS = {
    form: { template: "systems/vtmlarp/templates/apps/challenge-response.hbs" }
  };

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    // Bomb is offered only to a responder flagged as able to throw it (Celerity/
    // Potence), matching the challenger side and the NPC auto-answer gate.
    context.gestures = this.request.opponentActor?.system?.bombAccess ? GESTURES : GESTURES.filter(g => g !== "bomb");
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
    // Quick-throw a random gesture (Rock/Paper/Scissors only - Bomb stays a
    // deliberate manual pick) for GM-run opponents.
    this.element.querySelector(".vtm-random")?.addEventListener("click", (ev) => {
      ev.preventDefault();
      const pool = ["rock", "paper", "scissors"];
      const sel = this.element.querySelector("select[name='gesture']");
      if (sel) sel.value = pool[Math.floor(Math.random() * pool.length)];
      this.element.querySelector(".vtm-submit")?.click();
    });
  }

  async _onSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget.closest("form");
    const fd = new foundry.applications.ux.FormDataExtended(form).object;

    // Require a deliberate gesture pick before doing anything (the select now
    // defaults to a blank "— Choose a Gesture —"), so clicking Throw without
    // touching the dropdown can't silently commit a Rock. A retest BLOCK needs
    // no gesture. Validate BEFORE claiming so a mis-click doesn't lock the card.
    const isBlock = this.request.retest && fd.block;
    if (!isBlock && !fd.gesture) {
      ui.notifications?.warn("Choose a Gesture first.");
      return;
    }

    // Local guard so this popup and the chat card on the same client can't both
    // send an answer; the cross-client result-card guard catches the rest.
    if (!claimChallenge(this.request.requestId)) {
      ui.notifications?.info("This Challenge is already being answered.");
      this.close();
      return;
    }
    if (isChallengeResolved(this.request.requestId)) {
      ui.notifications?.info("This Challenge has already been resolved.");
      this.close();
      return;
    }

    const r = this.request;
    const challengerActor = r.challengerActor ?? (r.challengerActorId ? game.actors.get(r.challengerActorId) : null);
    // Send the answer to the resolver (the challenger, else a GM) - this popup
    // never resolves, because it does NOT hold the challenger's sealed gesture.
    await submitChallengeAnswer({
      requestId: r.requestId,
      resolverUserId: r.resolverUserId,
      challengeType: r.challengeType,
      challengerActorId: r.challengerActorId ?? challengerActor?.id ?? "",
      challengerTokenUuid: r.challengerTokenUuid ?? "",
      challengerMod: Number(r.challengerMod) || 0,
      opponentActorId: r.opponentActorId ?? r.opponentActor?.id ?? "",
      opponentTokenUuid: r.opponentTokenUuid ?? "",
      opponentName: r.opponentActor?.name ?? r.opponentName ?? "Opponent",
      opponentGesture: isBlock ? "" : fd.gesture,
      opponentMod: Number(fd.opponentMod) || 0,
      retest: r.retest,
      isRetestThrow: !!r.isRetestThrow,
      coinToss: !!r.coinToss,
      block: !!isBlock,
      blockSource: fd.blockSource || ""
    }, challengerActor);

    ui.notifications?.info("Answer sent — resolving…");
    this.close();
  }
}
