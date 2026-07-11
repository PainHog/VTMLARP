const { HandlebarsApplicationMixin } = foundry.applications.api;
const { renderTemplate } = foundry.applications.handlebars;

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
export class ChallengeApp extends HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  constructor(actor, options = {}) {
    super(options);
    this.actor = actor;
  }

  static DEFAULT_OPTIONS = {
    id: "vtmlarp-challenge",
    classes: ["vtmlarp", "challenge-app"],
    position: { width: 420, height: "auto" },
    window: { title: "Resolve Challenge", resizable: true }
  };

  static PARTS = {
    form: { template: "systems/vtmlarp/templates/apps/challenge.hbs" }
  };

  /** Count of not-yet-spent traits in one of the actor's attribute categories. */
  _unspentCount(category) {
    const traits = this.actor.system.attributes?.[category]?.traits ?? [];
    return traits.filter(t => !t.spent).length;
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
    context.fullBidEnabled = game.settings.get("vtmlarp", "fullBidTraitRule");
    context.pools = {
      physical: this._unspentCount("physical"),
      social: this._unspentCount("social"),
      mental: this._unspentCount("mental")
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
    const syncChallengeType = () => {
      const isStatic = challengeTypeSelect?.value === "static";
      if (staticOnly) staticOnly.style.display = isStatic ? "" : "none";
      if (rpsOnly) rpsOnly.style.display = isStatic ? "none" : "";
    };
    challengeTypeSelect?.addEventListener("change", syncChallengeType);
    syncChallengeType();

    const fullBidCheckbox = root.querySelector("input[name='fullBid']");
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
    const opponentTraitsBid = fd.opponentTraitsBid;

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

    // Static Challenges (an Ability used against a set Difficulty, no
    // opposing throw) resolve like a Virtue Test: the bid must exceed the
    // Difficulty, a tie is not enough. Physical/Social/Mental Challenges
    // stay a face-to-face Rock-Paper-Scissors clash as normal.
    const isStatic = challengeType === "static";
    const difficulty = isStatic ? (Number(fd.difficulty) || 1) : null;

    let result = "";
    let resultLabel = "";
    if (isStatic) {
      const success = (Number(traitsBid) || 0) > difficulty;
      result = success ? "Won" : "Lost";
      resultLabel = success ? `${actorName} Succeeds!` : `${actorName} Fails!`;
    } else if (opponentGesture) {
      const outcome = beats(gesture, opponentGesture);
      if (outcome === "tie") {
        // Playing remotely, not face to face, so there's no table to visibly
        // compare trait piles - per the rulebook, a matched gesture is broken
        // by whoever bid more Traits; a genuine tie (equal gesture AND equal
        // Traits) stands as a tie with no winner.
        const mine = Number(traitsBid) || 0;
        const theirs = Number(opponentTraitsBid) || 0;
        if (mine > theirs) {
          result = "Won";
          resultLabel = `${actorName} Wins (overbid on tied gesture)!`;
        } else if (theirs > mine) {
          result = "Lost";
          resultLabel = `${opponentLabel} Wins (overbid on tied gesture)!`;
        } else {
          result = "Tied";
          resultLabel = "Tied";
        }
      } else {
        result = outcome === "win" ? "Won" : "Lost";
        resultLabel = result === "Won" ? `${actorName} Wins!` : `${opponentLabel} Wins!`;
      }
    }

    const content = await renderTemplate("systems/vtmlarp/templates/apps/challenge-card.hbs", {
      actorName,
      challengeType,
      traitsBid,
      fullBid,
      isStatic,
      difficulty,
      gesture,
      opponentName,
      opponentGesture,
      opponentTraitsBid,
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
