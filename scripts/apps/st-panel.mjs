import { postGestureChallengePrompt } from "./challenge-shared.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Storyteller Panel - a GM-only toolbox for driving scenes:
 *  - Initiate a Challenge (optionally flagged "Surprise") against a player.
 *  - Force a Challenge between two players (ST sets the initiator's gesture).
 *  - Throw a no-Traits coin toss to decide something by gesture alone.
 *  - Apply / clear status effects on the currently-selected tokens.
 *
 * The Challenge actions reuse the same chat-log prompt flow as the player
 * Challenge tools, so responses don't depend on live socket delivery.
 */
export class STPanelApp extends HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "vtmlarp-st-panel",
    classes: ["vtmlarp", "sheet", "st-panel"],
    position: { width: 480, height: "auto" },
    window: { title: "Storyteller Panel", resizable: true },
    actions: {
      postChallenge: STPanelApp.#onPostChallenge,
      applyStatus: STPanelApp.#onApplyStatus,
      clearStatus: STPanelApp.#onClearStatus
    }
  };

  static PARTS = {
    form: { template: "systems/vtmlarp/templates/apps/st-panel.hbs" }
  };

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.actors = game.actors
      .filter(a => ["character", "npc"].includes(a.type))
      .map(a => ({ id: a.id, name: a.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
    context.challengeTypes = ["physical", "social", "mental"];
    context.gestures = ["rock", "paper", "scissors", "bomb"];
    context.statuses = (CONFIG.statusEffects ?? [])
      .map(s => ({ id: s.id, label: game.i18n.localize(s.name ?? s.label ?? s.id) }))
      .filter(s => s.id)
      .sort((a, b) => a.label.localeCompare(b.label));
    return context;
  }

  /** Read the challenge section of the form. */
  #readChallengeForm() {
    const form = this.element.querySelector("form") ?? this.element;
    const get = (name) => form.querySelector(`[name="${name}"]`)?.value ?? "";
    return {
      mode: get("mode"),
      challengerId: get("challenger"),
      opponentId: get("opponent"),
      challengeType: get("challengeType"),
      challengerGesture: get("challengerGesture"),
      retest: get("retest").trim()
    };
  }

  static async #onPostChallenge() {
    const { mode, challengerId, opponentId, challengeType, challengerGesture, retest } = this.#readChallengeForm();
    const challengerActor = game.actors.get(challengerId);
    const opponentActor = game.actors.get(opponentId);
    if (!challengerActor || !opponentActor) {
      ui.notifications?.warn("Pick both a challenger and an opponent.");
      return;
    }
    if (challengerActor.id === opponentActor.id) {
      ui.notifications?.warn("Challenger and opponent must be different actors.");
      return;
    }
    if (!challengerGesture) {
      ui.notifications?.warn("Choose the challenger's Gesture (kept hidden until the opponent responds).");
      return;
    }
    const coinToss = mode === "coinToss";
    const surprise = mode === "surprise";
    await postGestureChallengePrompt({
      challengerActor,
      challengeType: coinToss ? "coin toss" : challengeType,
      challengerGesture,
      opponentActor,
      opponentName: opponentActor.name,
      retest: coinToss ? "" : retest,
      requestId: foundry.utils.randomID(),
      surprise,
      coinToss
    });
    ui.notifications?.info(`Challenge posted to chat: ${challengerActor.name} vs ${opponentActor.name}.`);
  }

  #selectedActors() {
    const tokens = canvas?.tokens?.controlled ?? [];
    const actors = tokens.map(t => t.actor).filter(a => a);
    return actors;
  }

  static async #toggleStatusOnSelection(active) {
    const statusId = (this.element.querySelector('[name="status"]')?.value) || "";
    if (!statusId) {
      ui.notifications?.warn("Pick a status effect first.");
      return;
    }
    const actors = this.#selectedActors();
    if (!actors.length) {
      ui.notifications?.warn("Select one or more tokens on the canvas first.");
      return;
    }
    for (const actor of actors) {
      try {
        await actor.toggleStatusEffect(statusId, { active });
      } catch (err) {
        console.warn("VTMLARP | status toggle failed", err);
      }
    }
    ui.notifications?.info(`${active ? "Applied" : "Cleared"} status on ${actors.length} token(s).`);
  }

  static async #onApplyStatus() { return STPanelApp.#toggleStatusOnSelection.call(this, true); }
  static async #onClearStatus() { return STPanelApp.#toggleStatusOnSelection.call(this, false); }
}
