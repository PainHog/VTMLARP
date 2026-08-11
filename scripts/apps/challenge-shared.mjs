import { logAction } from "./action-log.mjs";

const { renderTemplate } = foundry.applications.handlebars;

export const GESTURES = ["rock", "paper", "scissors", "bomb"];

export function beats(a, b) {
  if (a === b) return "tie";
  const wins = { rock: "scissors", paper: "rock", scissors: "paper", bomb: "rock" };
  // Bomb beats Rock and Paper, loses to Scissors (scissors cut the fuse) - common MET house variant.
  if (a === "bomb") return (b === "scissors") ? "lose" : "win";
  if (b === "bomb") return (a === "scissors") ? "win" : "lose";
  return (wins[a] === b) ? "win" : "lose";
}

/**
 * Traits an actor can bid in one attribute category (Physical/Social/Mental).
 * The bid pool is the category's Total (what players actually fill in: 7/5/3),
 * reduced by any named Trait chips already marked spent. Named chips are
 * optional flavor, so an actor with a Total of 7 and no chips bids 7 - earlier
 * this only counted chips, so those characters bid 0.
 */
export function unspentCount(actor, category) {
  const cat = actor?.system?.attributes?.[category];
  if (!cat) return 0;
  const total = Number(cat.total) || 0;
  const spentChips = (cat.traits ?? []).filter(t => t.spent).length;
  const available = total - spentChips;
  return available > 0 ? available : 0;
}

/**
 * Resolve a Physical/Social/Mental Challenge and post the result to chat.
 * Always bids each side's full remaining trait pool of the matching
 * category (no manual Traits Bid entry) - simplest to play out online,
 * where the two sides can't just glance at each other's trait cards
 * across a table the way they could face to face.
 */
export async function resolveAndPostGestureChallenge({
  challengerActor, challengeType, challengerGesture, opponentActor, opponentGesture, retest,
  // Overrides for a fake/no-document opponent (e.g. the "TEST" practice
  // opponent) where there's no real Actor to derive a name/pool from.
  opponentName: opponentNameOverride, opponentTraitsBid: opponentTraitsBidOverride, opponentActorId: opponentActorIdOverride,
  // True when this resolution IS itself a Retest throw (opened via the
  // "Re-throw Retest" button) rather than an original Challenge - a Retest
  // can only be used once per original Challenge, so the resulting card
  // still shows what Retest was used, but must not offer another one.
  isRetestThrow = false
}) {
  const challengerName = challengerActor.name;
  const opponentName = opponentNameOverride ?? opponentActor?.name ?? "Opponent";
  const traitsBid = unspentCount(challengerActor, challengeType);
  const opponentTraitsBid = opponentTraitsBidOverride ?? (opponentActor ? unspentCount(opponentActor, challengeType) : null);

  let result = "";
  let resultLabel = "";
  if (opponentGesture) {
    const outcome = beats(challengerGesture, opponentGesture);
    if (outcome === "tie") {
      // Playing remotely, not face to face, so there's no table to visibly
      // compare trait piles - per the rulebook, a matched gesture is broken
      // by whoever bid more Traits; a genuine tie (equal gesture AND equal
      // pool size) stands as a tie with no winner.
      if (traitsBid > opponentTraitsBid) {
        result = "Won";
        resultLabel = `${challengerName} Wins (overbid on tied gesture)!`;
      } else if (opponentTraitsBid > traitsBid) {
        result = "Lost";
        resultLabel = `${opponentName} Wins (overbid on tied gesture)!`;
      } else {
        result = "Tied";
        resultLabel = "Tied";
      }
    } else {
      result = outcome === "win" ? "Won" : "Lost";
      resultLabel = result === "Won" ? `${challengerName} Wins!` : `${opponentName} Wins!`;
    }
  }

  const content = await renderTemplate("systems/vtmlarp/templates/apps/challenge-card.hbs", {
    actorName: challengerName,
    challengerActorId: challengerActor.id,
    challengeType,
    traitsBid,
    isStatic: false,
    gesture: challengerGesture,
    opponentName,
    opponentActorId: opponentActorIdOverride ?? opponentActor?.id ?? "",
    opponentGesture,
    opponentTraitsBid,
    result,
    resultLabel,
    retest,
    retestAvailable: !!retest && !isRetestThrow
  });

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: challengerActor }),
    content
  });

  if (result) {
    await logAction(challengerActor, `${challengeType} Challenge vs ${opponentName}: ${resultLabel}`);
    if (opponentActor) await logAction(opponentActor, `${challengeType} Challenge vs ${challengerName}: ${resultLabel}`);
  }
}

/**
 * Users eligible to respond on behalf of `actor`: its player owners, or
 * (if it has none, e.g. a Storyteller-run NPC) every GM. Not gated on
 * "currently active" - the response now happens via a persistent chat
 * message (see postGestureChallengePrompt) rather than a live popup, so an
 * offline player can still respond whenever they next log in and load chat.
 */
export function respondingUsers(actor) {
  const owners = game.users.filter(u => !u.isGM && actor.testUserPermission(u, "OWNER"));
  if (owners.length) return owners;
  return game.users.filter(u => u.isGM);
}

/**
 * Post a public chat message with clickable gesture buttons the opponent
 * (or a GM, for an unowned NPC) can respond to whenever they next load
 * chat - this doesn't depend on a live socket push to work at all, only on
 * normal chat history loading, which happens regardless of real-time
 * connectivity between clients. The challenger's own gesture is stored in
 * the message's flags (not rendered into the visible text) so it isn't
 * revealed until the opponent actually responds and the result posts -
 * anyone can see that a Challenge is happening, but only the opponent's
 * owner (or a GM) is permitted to actually click a response.
 */
export async function postGestureChallengePrompt({
  challengerActor, challengeType, challengerGesture, opponentActor, opponentName, retest, isRetestThrow, requestId
}) {
  const content = await renderTemplate("systems/vtmlarp/templates/apps/challenge-prompt-card.hbs", {
    challengerName: challengerActor.name,
    challengeType,
    opponentName,
    opponentActorId: opponentActor?.id ?? "",
    retest,
    gestures: GESTURES
  });

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: challengerActor }),
    content,
    flags: {
      vtmlarp: {
        requestId,
        challengerActorId: challengerActor.id,
        challengeType,
        challengerGesture,
        opponentActorId: opponentActor?.id ?? "",
        opponentName,
        retest: retest ?? "",
        isRetestThrow: !!isRetestThrow,
        responded: false
      }
    }
  });
}
