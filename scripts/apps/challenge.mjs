import { GESTURES, unspentCount, respondingUsers, resolveAndPostGestureChallenge } from "./challenge-shared.mjs";

// A standing fake opponent so a single tester can resolve a Challenge
// without needing a second logged-in player/GM to respond - always throws
// Rock with a 7-Trait pool, resolved immediately with no socket round-trip.
// TODO: remove once real multi-player testing is available.
const TEST_OPPONENT_ID = "TEST";
const TEST_OPPONENT_GESTURE = "rock";
const TEST_OPPONENT_TRAITS = 7;

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { renderTemplate } = foundry.applications.handlebars;

/**
 * A lightweight tool for logging a Trait-bidding challenge to chat.
 * Physical/Social/Mental Challenges send a private request to the opponent's
 * player (or, for an unowned NPC, any GM), who throws their own gesture on
 * their own client via ChallengeResponseApp - this system is played online
 * rather than face to face, so there's no table to glance across, and the
 * challenger never sees the opponent's gesture before it resolves. Static
 * Challenges have no opposing throw and still resolve immediately here.
 */
export class ChallengeApp extends HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  /**
   * @param {Actor} actor
   * @param {object} [options] ApplicationV2 options.
   * @param {object} [prefill] Pre-selects the form when opened from a
   *   specific Power's "Challenge" button, instead of the generic
   *   "Resolve Challenge" button - {challengeType, retest, powerName}.
   */
  constructor(actor, options = {}, prefill = {}) {
    // A fixed literal id in DEFAULT_OPTIONS meant every ChallengeApp shared
    // one DOM id, so opening this pre-filled (from a Power's own Challenge
    // button) while a plain "Resolve Challenge" instance was already open/
    // tracked could reuse or clash with the existing window instead of
    // rendering the new one with its own prefill - explicitly generating a
    // unique id per instance here (rather than relying on "{id}"-style
    // templating in the static default, which isn't confirmed to apply to
    // plain ApplicationV2) guarantees each instance is independent. CSS
    // targets the "vtmlarp-challenge" class instead, unaffected by this.
    super({ id: `vtmlarp-challenge-${foundry.utils.randomID()}`, ...options });
    this.actor = actor;
    this.prefill = prefill;
  }

  static DEFAULT_OPTIONS = {
    classes: ["vtmlarp", "challenge-app", "vtmlarp-challenge"],
    position: { width: 420, height: "auto" },
    window: { title: "Resolve Challenge", resizable: true }
  };

  static PARTS = {
    form: { template: "systems/vtmlarp/templates/apps/challenge.hbs" }
  };

  /** @override */
  get title() {
    return this.prefill?.powerName ? `Resolve Challenge - ${this.prefill.powerName}` : "Resolve Challenge";
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const equipmentBonuses = this.actor.items
      .filter(i => i.type === "gear" && i.system.traitBonus)
      .map(i => `${i.name}: ${i.system.traitBonus}`);

    context.actor = this.actor;
    context.gestures = GESTURES;
    context.challengeTypes = ["physical", "social", "mental", "static"];
    context.equipmentBonuses = equipmentBonuses;
    context.prefill = this.prefill;
    console.log("VTMLARP | ChallengeApp._prepareContext prefill:", this.prefill, "-> context.challengeTypes:", context.challengeTypes);
    context.actorOptions = [
      { id: TEST_OPPONENT_ID, name: `TEST (practice - ${TEST_OPPONENT_TRAITS} Traits, always ${TEST_OPPONENT_GESTURE})` },
      ...game.actors
        .filter(a => ["character", "npc"].includes(a.type) && a.id !== this.actor.id)
        .map(a => ({ id: a.id, name: a.name }))
        .sort((a, b) => a.name.localeCompare(b.name))
    ];
    context.pools = {
      physical: unspentCount(this.actor, "physical"),
      social: unspentCount(this.actor, "social"),
      mental: unspentCount(this.actor, "mental")
    };
    return context;
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    const root = this.element;
    // Bind directly to the button's click rather than the form's "submit" event -
    // this guarantees the browser never falls back to a native full-page form
    // submission (which looks like the page "reloading").
    root.querySelector("button[type='submit']")?.addEventListener("click", this._onSubmit.bind(this));

    const challengeTypeSelect = root.querySelector("select[name='challengeType']");
    const staticOnly = root.querySelector(".static-only");
    const rpsOnly = root.querySelector(".rps-only");
    const ownPoolHint = root.querySelector(".own-pool-hint");
    const syncChallengeType = () => {
      const category = challengeTypeSelect?.value;
      const isStatic = category === "static";
      if (staticOnly) staticOnly.style.display = isStatic ? "" : "none";
      if (rpsOnly) rpsOnly.style.display = isStatic ? "none" : "";
      if (ownPoolHint && !isStatic) ownPoolHint.textContent = context.pools[category] ?? 0;
    };
    challengeTypeSelect?.addEventListener("change", syncChallengeType);
    syncChallengeType();
  }

  async _onSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget.closest("form");
    const fd = new FormDataExtended(form).object;
    const { challengeType, retest } = fd;

    // Static Challenges (an Ability used against a set Difficulty, no
    // opposing throw) resolve like a Virtue Test: the bid must exceed the
    // Difficulty, a tie is not enough. No opponent is involved, so this
    // resolves immediately without any socket round-trip.
    if (challengeType === "static") {
      const traitsBid = Number(fd.traitsBid) || 0;
      const difficulty = Number(fd.difficulty) || 1;
      const success = traitsBid > difficulty;
      const result = success ? "Won" : "Lost";
      const resultLabel = success ? `${this.actor.name} Succeeds!` : `${this.actor.name} Fails!`;

      const content = await renderTemplate("systems/vtmlarp/templates/apps/challenge-card.hbs", {
        actorName: this.actor.name,
        challengeType,
        traitsBid,
        isStatic: true,
        difficulty,
        result,
        resultLabel,
        retest
      });

      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content
      });

      this.close();
      return;
    }

    const opponentActorId = fd.opponentActorId;

    if (opponentActorId === TEST_OPPONENT_ID) {
      await resolveAndPostGestureChallenge({
        challengerActor: this.actor,
        challengeType,
        challengerGesture: fd.gesture,
        opponentActor: null,
        opponentName: "TEST",
        opponentGesture: TEST_OPPONENT_GESTURE,
        opponentTraitsBid: TEST_OPPONENT_TRAITS,
        retest
      });
      this.close();
      return;
    }

    const opponentActor = opponentActorId ? game.actors.get(opponentActorId) : null;
    if (!opponentActor) {
      ui.notifications?.warn("Pick an opponent before sending the Challenge.");
      return;
    }

    const recipients = respondingUsers(opponentActor);
    if (!recipients.length) {
      ui.notifications?.warn(`No active player or GM is available to respond for ${opponentActor.name}.`);
      return;
    }

    // requestId lets every client (not just the responding one) track and
    // later clear this specific request from the GM dashboard - broadcast
    // unfiltered, unlike targetUserIds above which only the responder acts on.
    const requestId = foundry.utils.randomID();
    game.socket.emit("system.vtmlarp", {
      action: "challengeRequest",
      requestId,
      targetUserIds: recipients.map(u => u.id),
      challengerActorId: this.actor.id,
      challengerName: this.actor.name,
      challengeType,
      challengerGesture: fd.gesture,
      opponentActorId: opponentActor.id,
      opponentName: opponentActor.name,
      retest
    });

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<p><strong>${this.actor.name}</strong> has initiated a ${challengeType} Challenge against <strong>${opponentActor.name}</strong>${this.prefill?.powerName ? ` using <strong>${this.prefill.powerName}</strong>` : ""} - awaiting their response...</p>`
    });

    ui.notifications?.info(`Challenge sent to ${opponentActor.name} - waiting for their response.`);
    this.close();
  }
}
