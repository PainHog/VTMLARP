import { GESTURES, unspentCount, respondingUsers, resolveAndPostGestureChallenge, postGestureChallengePrompt, sealChallengerGesture } from "./challenge-shared.mjs";
import { GMChallengeDashboard } from "./gm-dashboard.mjs";

// A standing fake opponent (Storyteller-only; see the GM-gated actorOptions
// entry below) so a GM can resolve a Challenge solo without a second logged-in
// player - always throws Rock with a 7-Trait pool, resolved immediately with no
// socket round-trip. A deliberate GM testing aid, kept alongside the NPC
// auto-answer toggle and the response dialog's Random button.
const TEST_OPPONENT_ID = "TEST";
const TEST_OPPONENT_GESTURE = "rock";
const TEST_OPPONENT_TRAITS = 7;

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { renderTemplate } = foundry.applications.handlebars;

/**
 * Soft line-of-sight test between two actors' tokens on the active scene.
 * Returns "blocked" (a sight-blocking wall is between them), "clear", or
 * "unknown" (no tokens, no scene, different scenes, or the sight backend isn't
 * available - in which case we don't warn, to avoid false positives on scenes
 * that don't use walls). Deliberately defensive: LOS in MET is usually a
 * roleplay call, so this only ever produces a soft warning, never a hard block.
 */
function lineOfSightState(challenger, opponent) {
  try {
    const ta = challenger?.getActiveTokens?.()[0];
    const tb = opponent?.getActiveTokens?.()[0];
    if (!ta || !tb || !canvas?.ready) return "unknown";
    if (ta.document?.parent?.id !== tb.document?.parent?.id) return "unknown";
    const origin = ta.center;
    const dest = tb.center;
    if (!origin || !dest) return "unknown";
    const backend = foundry.canvas?.geometry?.ClockwiseSweepPolygon
      ?? globalThis.ClockwiseSweepPolygon
      ?? CONFIG.Canvas?.polygonBackends?.sight;
    if (typeof backend?.testCollision !== "function") return "unknown";
    return backend.testCollision(origin, dest, { type: "sight", mode: "any" }) ? "blocked" : "clear";
  } catch {
    return "unknown";
  }
}

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
    window: { title: "VTMLARP.App.ResolveChallenge", resizable: true }
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
    // Bomb isn't a universal throw: the book grants it only via Rapidity
    // (Celerity) / Vigor (Potence). Only offer it when this actor is flagged as
    // able to throw Bomb (the sheet's "…can throw Bomb" toggle), matching how
    // the NPC auto-answer path already gates on system.bombAccess.
    context.gestures = this.actor?.system?.bombAccess ? GESTURES : GESTURES.filter(g => g !== "bomb");
    context.challengeTypes = ["physical", "social", "mental", "static"];
    context.equipmentBonuses = equipmentBonuses;
    context.prefill = this.prefill;
    // Natural "target then challenge" flow: if the challenger has exactly one
    // token targeted (Foundry's native targeting) and it isn't their own token,
    // pre-select it as the opponent. The dropdown stays fully editable, so this
    // is a convenience only. token.actor.id resolves to the base actor id (even
    // for an unlinked NPC token), which is exactly what the opponent dropdown
    // and the socket resolution (game.actors.get) expect. Don't override an
    // explicit prefill (e.g. a retest that already names the opponent).
    if (!context.prefill?.opponentActorId) {
      const targets = Array.from(game.user.targets ?? []);
      if (targets.length === 1) {
        const tActor = targets[0]?.actor;
        if (tActor && tActor.id !== this.actor.id && ["character", "npc"].includes(tActor.type)) {
          context.prefill = { ...context.prefill, opponentActorId: tActor.id };
        }
      }
    }
    context.actorOptions = [
      // The fake practice opponent is a testing aid — show it only to the
      // Storyteller so players don't see a "TEST (always Rock)" entry in their
      // real opponent list.
      ...(game.user.isGM ? [{ id: TEST_OPPONENT_ID, name: `TEST (practice - ${TEST_OPPONENT_TRAITS} Traits, always ${TEST_OPPONENT_GESTURE})` }] : []),
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
    const fd = new foundry.applications.ux.FormDataExtended(form).object;
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
        opponentActorId: TEST_OPPONENT_ID,
        opponentGesture: TEST_OPPONENT_GESTURE,
        opponentTraitsBid: TEST_OPPONENT_TRAITS,
        retest,
        isRetestThrow: !!this.prefill?.isRetestThrow
      });
      this.close();
      return;
    }

    const opponentActor = opponentActorId ? game.actors.get(opponentActorId) : null;
    if (!opponentActor) {
      ui.notifications?.warn("Pick an opponent before sending the Challenge.");
      return;
    }

    // Soft line-of-sight warning: if both tokens are on the scene and a wall
    // blocks sight between them, confirm before targeting out of line of sight.
    if (lineOfSightState(this.actor, opponentActor) === "blocked") {
      const proceed = await foundry.applications.api.DialogV2.confirm({
        window: { title: "VTMLARP.App.OutOfLineOfSight" },
        content: `<p><strong>${opponentActor.name}</strong> doesn't appear to be in your line of sight — a wall blocks it. Send the Challenge anyway?</p>`
      }).catch(() => false);
      if (!proceed) return;
    }

    // Resolve the SPECIFIC opponent instance: if the challenger has exactly one
    // token targeted and it's this opponent, use that token's actor (so one of
    // several identical unlinked NPC tokens is distinguished from its
    // duplicates). Otherwise fall back to the base actor from the dropdown.
    const targets = Array.from(game.user?.targets ?? []);
    const targetedToken = targets.length === 1 && targets[0]?.actor?.id === opponentActorId ? targets[0] : null;
    const opponentInstance = targetedToken?.actor ?? opponentActor;
    const opponentTokenUuid = targetedToken?.document?.uuid ?? "";
    const challengerTokenUuid = this.actor.isToken ? (this.actor.token?.uuid ?? "") : "";

    const recipients = respondingUsers(opponentInstance);
    if (!recipients.length) {
      ui.notifications?.warn(`No player or GM is set up to respond for ${opponentInstance.name}.`);
      return;
    }

    const requestId = foundry.utils.randomID();
    const challengerMod = Number(fd.challengerMod) || 0;

    // SEAL the challenger's gesture in a whisper only the challenger + GMs
    // receive, so it never reaches the opponent's client. The public prompt
    // card below carries NO gesture - resolution happens on a resolver client
    // (this challenger, else a GM) that holds the seal.
    await sealChallengerGesture({ requestId, challengerGesture: fd.gesture, challengerActor: this.actor });

    // Primary answer surface: a public chat card with gesture buttons the
    // opponent can use whenever they load chat (no live socket needed). It holds
    // no secret - just the request metadata and token refs.
    await postGestureChallengePrompt({
      challengerActor: this.actor,
      challengeType,
      opponentActor: opponentInstance,
      opponentName: opponentInstance.name,
      challengerTokenUuid,
      opponentTokenUuid,
      retest,
      isRetestThrow: !!this.prefill?.isRetestThrow,
      requestId,
      challengerMod
    });

    // Bonus instant-popup + GM dashboard tracking. No challenger gesture on the
    // wire; carries the resolver id and token refs so the answer can route back.
    game.socket.emit("system.vtmlarp", {
      action: "challengeRequest",
      requestId,
      resolverUserId: game.user.id,
      targetUserIds: recipients.map(u => u.id),
      challengerActorId: this.actor.id,
      challengerTokenUuid,
      challengerName: this.actor.name,
      challengeType,
      opponentActorId: opponentInstance.id,
      opponentTokenUuid,
      opponentName: opponentInstance.name,
      retest,
      isRetestThrow: !!this.prefill?.isRetestThrow,
      coinToss: false,
      challengerMod
    });

    // Auto-answer NPC: the CHALLENGER's own client holds the gesture, so it can
    // resolve locally right away (no leak - nothing is sent to an opponent). Do
    // this when this client is the designated responder OR nobody who could
    // respond for the NPC is online, so an auto-answer NPC never strands.
    const anyResponderOnline = recipients.some(u => u.active);
    if (opponentInstance.type === "npc" && opponentInstance.system?.autoChallenge
        && (recipients[0]?.id === game.user.id || !anyResponderOnline)) {
      const pool = ["rock", "paper", "scissors"];
      if (opponentInstance.system?.bombAccess) pool.push("bomb");
      const opponentGesture = pool[Math.floor(Math.random() * pool.length)];
      await resolveAndPostGestureChallenge({
        challengerActor: this.actor, challengeType, challengerGesture: fd.gesture,
        opponentActor: opponentInstance, opponentGesture, retest, isRetestThrow: !!this.prefill?.isRetestThrow, challengerMod,
        requestId
      });
      game.socket.emit("system.vtmlarp", { action: "challengeResolved", requestId });
      GMChallengeDashboard.clearRequest?.(requestId);
      for (const m of game.messages ?? []) {
        if (m.getFlag?.("vtmlarp", "requestId") === requestId && (m.getFlag("vtmlarp", "promptCard") || m.getFlag("vtmlarp", "sealedThrow"))) {
          m.delete?.().catch(() => {});
        }
      }
      this.close();
      return;
    }

    // Honest feedback: the prompt card persists in chat and is answerable
    // whenever a responder loads it, but if NOBODY who can answer for this
    // opponent is online right now, say so plainly instead of implying it will
    // be answered promptly.
    if (anyResponderOnline) {
      ui.notifications?.info(`Challenge sent to ${opponentActor.name} - they can respond from the chat log.`);
    } else {
      ui.notifications?.warn(`Challenge posted for ${opponentActor.name}, but no one who can answer for it is online right now. It will wait in the chat log until they log in.`);
    }
    this.close();
  }
}
