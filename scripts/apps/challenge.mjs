const GESTURES = ["rock", "paper", "scissors", "bomb"];

function beats(a, b) {
  if (a === b) return "tie";
  const wins = { rock: "scissors", paper: "rock", scissors: "paper", bomb: "rock" };
  // Bomb beats Rock and Paper, loses to Scissors (scissors cut the fuse) - common MET house variant.
  if (a === "bomb") return (b === "scissors") ? "lose" : "win";
  if (b === "bomb") return (a === "scissors") ? "win" : "lose";
  return (wins[a] === b) ? "win" : "lose";
}

/**
 * A lightweight tool for logging a Trait-bidding challenge to chat.
 * The actual Rock-Paper-Scissors throw happens face to face between players;
 * this tool tracks trait totals, records the announced gesture, and posts
 * a shareable result card so the table can see who won and what was bid.
 */
export class ChallengeApp extends foundry.appv1.api.Application {
  constructor(actor, options = {}) {
    super(options);
    this.actor = actor;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "vtmlarp-challenge",
      classes: ["vtmlarp", "challenge-app"],
      template: "systems/vtmlarp/templates/apps/challenge.hbs",
      width: 420,
      height: "auto",
      title: "Resolve Challenge"
    });
  }

  /** @override */
  getData(options) {
    const equipmentBonuses = this.actor.items
      .filter(i => i.type === "gear" && i.system.traitBonus)
      .map(i => `${i.name}: ${i.system.traitBonus}`);

    return {
      actor: this.actor,
      gestures: GESTURES,
      challengeTypes: ["physical", "social", "mental", "static"],
      equipmentBonuses
    };
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);
    // Bind directly to the button's click rather than the form's "submit" event -
    // this avoids relying on jQuery's .find()/.on() continuing to behave the same
    // way across Foundry versions, and guarantees the browser never falls back to
    // a native full-page form submission (which looks like the page "reloading").
    const root = html instanceof HTMLElement ? html : html[0];
    root.querySelector("button[type='submit']")?.addEventListener("click", this._onSubmit.bind(this));
  }

  async _onSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget.closest("form");
    const fd = new FormDataExtended(form).object;
    const { challengeType, traitsBid, gesture, opponentName, opponentGesture, retest } = fd;

    const actorName = this.actor.name;
    const opponentLabel = opponentName || "Opponent";

    let result = "";
    let resultLabel = "";
    if (opponentGesture) {
      const outcome = beats(gesture, opponentGesture);
      result = outcome === "tie" ? "Tied" : (outcome === "win" ? "Won" : "Lost");
      resultLabel = result === "Tied" ? "Tied" : (result === "Won" ? `${actorName} Wins!` : `${opponentLabel} Wins!`);
    }

    const content = await renderTemplate("systems/vtmlarp/templates/apps/challenge-card.hbs", {
      actorName,
      challengeType,
      traitsBid,
      gesture,
      opponentName,
      opponentGesture,
      result,
      resultLabel,
      retest
    });

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content
    });

    this.close();
  }
}
