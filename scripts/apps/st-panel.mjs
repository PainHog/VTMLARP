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

  // Which trait an affliction/modifier can target -> the system field the
  // Active Effect writes to, and the friendly label shown on the sheet.
  static STAT_TARGETS = {
    "attributes.physical.total": "Physical",
    "attributes.social.total": "Social",
    "attributes.mental.total": "Mental",
    "willpower.value": "Willpower",
    "virtues.conscienceConviction.rating": "Conscience / Conviction",
    "virtues.selfControlInstinct.rating": "Self-Control / Instinct",
    "virtues.courage.rating": "Courage"
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
    context.statTargets = Object.entries(STPanelApp.STAT_TARGETS).map(([key, label]) => ({ key, label }));
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

  static async #onApplyStatus() {
    const get = (name) => this.element.querySelector(`[name="${name}"]`)?.value ?? "";
    const name = get("effectName").trim() || "Status Effect";
    const stat = get("effectStat") || "attributes.physical.total";
    const statLabel = STPanelApp.STAT_TARGETS[stat] ?? stat;
    const amount = Number(get("effectAmount")) || 0;
    const rounds = Math.max(0, Number(get("effectRounds")) || 0);
    if (!amount) {
      ui.notifications?.warn("Enter a non-zero Amount (negative for a penalty).");
      return;
    }
    const actors = this.#selectedActors();
    if (!actors.length) {
      ui.notifications?.warn("Select one or more tokens on the canvas first.");
      return;
    }
    // An Active Effect that adds/subtracts Traits from the chosen trait. For
    // Attributes, system.attributes.<x>.total is exactly what Challenges read,
    // so the modifier flows straight into trait bidding while active.
    const effectData = {
      name,
      label: name,
      icon: "icons/svg/aura.svg",
      img: "icons/svg/aura.svg",
      changes: [{
        key: `system.${stat}`,
        mode: CONST.ACTIVE_EFFECT_MODES.ADD,
        value: amount
      }],
      duration: rounds > 0 ? { rounds } : {},
      flags: { vtmlarp: { stTemp: true, statLabel } }
    };
    for (const actor of actors) {
      try {
        await actor.createEmbeddedDocuments("ActiveEffect", [effectData]);
      } catch (err) {
        console.warn("VTMLARP | apply effect failed", err);
      }
    }
    const dur = rounds > 0 ? `${rounds} round(s)` : "until cleared";
    ui.notifications?.info(`Applied "${name}" (${amount > 0 ? "+" : ""}${amount} ${statLabel}, ${dur}) to ${actors.length} token(s).`);
  }

  static async #onClearStatus() {
    const actors = this.#selectedActors();
    if (!actors.length) {
      ui.notifications?.warn("Select one or more tokens on the canvas first.");
      return;
    }
    let cleared = 0;
    for (const actor of actors) {
      const ids = actor.effects.filter(e => e.flags?.vtmlarp?.stTemp).map(e => e.id);
      if (ids.length) {
        try {
          await actor.deleteEmbeddedDocuments("ActiveEffect", ids);
          cleared += ids.length;
        } catch (err) {
          console.warn("VTMLARP | clear effect failed", err);
        }
      }
    }
    ui.notifications?.info(`Cleared ${cleared} Storyteller effect(s) from ${actors.length} token(s).`);
  }
}
