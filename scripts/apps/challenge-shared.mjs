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

/** Count of not-yet-spent traits in one of an actor's attribute categories. */
export function unspentCount(actor, category) {
  const traits = actor?.system?.attributes?.[category]?.traits ?? [];
  return traits.filter(t => !t.spent).length;
}

/**
 * Resolve a Physical/Social/Mental Challenge and post the result to chat.
 * Always bids each side's full remaining trait pool of the matching
 * category (no manual Traits Bid entry) - simplest to play out online,
 * where the two sides can't just glance at each other's trait cards
 * across a table the way they could face to face.
 */
export async function resolveAndPostGestureChallenge({ challengerActor, challengeType, challengerGesture, opponentActor, opponentGesture, retest }) {
  const challengerName = challengerActor.name;
  const opponentName = opponentActor?.name ?? "Opponent";
  const traitsBid = unspentCount(challengerActor, challengeType);
  const opponentTraitsBid = opponentActor ? unspentCount(opponentActor, challengeType) : null;

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
    challengeType,
    traitsBid,
    isStatic: false,
    gesture: challengerGesture,
    opponentName,
    opponentGesture,
    opponentTraitsBid,
    result,
    resultLabel,
    retest
  });

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: challengerActor }),
    content
  });
}

/**
 * Users eligible to respond on behalf of `actor`: its active player owners,
 * or (if it has none, e.g. a Storyteller-run NPC) every active GM.
 */
export function respondingUsers(actor) {
  const owners = game.users.filter(u => u.active && !u.isGM && actor.testUserPermission(u, "OWNER"));
  if (owners.length) return owners;
  return game.users.filter(u => u.active && u.isGM);
}
