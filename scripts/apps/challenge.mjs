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

  /** Count of not-yet-spent traits in one of the actor's attribute categories. */
  _unspentCount(category) {
    const traits = this.actor.system.attributes?.[category]?.traits ?? [];
    return traits.filter(t => !t.spent).length;
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
      equipmentBonuses,
      fullBidEnabled: game.settings.get("vtmlarp", "fullBidTraitRule"),
      pools: {
        physical: this._unspentCount("physical"),
        social: this._unspentCount("social"),
        mental: this._unspentCount("mental")
      }
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

    const fullBidCheckbox = root.querySelector("input[name='fullBid']");
    const challengeTypeSelect = root.querySelector("select[name='challengeType']");
    const traitsBidInput = root.querySelector("input[name='traitsBid']");
    if (!fullBidCheckbox || !challengeTypeSelect || !traitsBidInput) return;

    const syncFullBid = () => {
      const category = challengeTypeSelect.value;
      if (fullBidCheckbox.checked && ["physical", "social", "mental"].includes(category)) {
        traitsBidInput.value = this._unspentCount(category);
        traitsBidInput.disabled = true;
      } else {
        traitsBidInput.disabled = false;
      }
    };

    fullBidCheckbox.addEventListener("change", syncFullBid);
    challengeTypeSelect.addEventListener("change", syncFullBid);
  }

  async _onSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget.closest("form");
    const fd = new FormDataExtended(form).object;
    const { challengeType, gesture, opponentName, opponentGesture, retest } = fd;
    let traitsBid = fd.traitsBid;

    const actorName = this.actor.name;
    const opponentLabel = opponentName || "Opponent";

    // Full-Bid Trait Rule: spend the whole remaining pool of the matching
    // category at once instead of leaving it to the player to track which
    // individual traits they meant to bid.
    const fullBid = !!fd.fullBid && ["physical", "social", "mental"].includes(challengeType);
    if (fullBid) {
      const traits = this.actor.system.attributes[challengeType].traits;
      const updated = traits.map(t => t.spent ? t : { ...t, spent: true });
      traitsBid = traits.filter(t => !t.spent).length;
      await this.actor.update({ [`system.attributes.${challengeType}.traits`]: updated });
    }

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
      fullBid,
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
