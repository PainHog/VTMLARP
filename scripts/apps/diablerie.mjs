import { beats } from "./gesture.mjs";

const { HandlebarsApplicationMixin, ApplicationV2, DialogV2 } = foundry.applications.api;

/**
 * The Diablerie action screen (a homebrew flow layered on the book's rules,
 * Laws of the Night Revised p.216). The victim must be in torpor. The
 * diablerist then throws, one Challenge at a time, to steal the victim's power:
 * per Discipline (gaining the first dot of an unknown Discipline or the next dot
 * of a known one), and a single throw to add one Attribute Trait (up to the
 * generation cap). Separate throws cover the Frenzy and Derangement perils.
 * Each throw is a gesture Challenge whose opposing side is thrown at random (as
 * with an auto-answer NPC) - the diablerist picks, then sees win or lose. Every
 * completed diablerie taints the blood further (black veins in the aura,
 * detectable via Aura Perception for ~3 months, or Thaumaturgy's A Taste for
 * Blood indefinitely).
 */
export class DiablerieApp extends HandlebarsApplicationMixin(ApplicationV2) {
  #victimId = "";
  #torpor = false;
  #attributeUsed = false;

  constructor(actor, options = {}) {
    // Per-instance id so opening Diablerie for a second actor doesn't collide on
    // one DOM element with an already-open window (AppV2 keys on id).
    super({ id: `vtmlarp-diablerie-${foundry.utils.randomID()}`, ...options });
    // Diablerie grants PERMANENT gains, so always operate on the base world
    // Actor, never an unlinked token's synthetic actor - writing to the latter
    // only updates that token's delta, so the gains are scene/token-local and
    // vanish when the player switches scenes or gets a fresh token.
    this.actor = (actor?.isToken ? game.actors.get(actor.id) : actor) ?? actor;
  }

  static DEFAULT_OPTIONS = {
    classes: ["vtmlarp", "sheet", "diablerie"],
    position: { width: 560, height: 700 },
    window: { title: "Diablerie — the Amaranth", resizable: true },
    actions: {
      throwDiscipline: DiablerieApp.#onThrowDiscipline,
      throwAttribute: DiablerieApp.#onThrowAttribute,
      throwGeneration: DiablerieApp.#onThrowGeneration,
      throwFrenzy: DiablerieApp.#onThrowFrenzy,
      throwDerangement: DiablerieApp.#onThrowDerangement,
      throwHumanity: DiablerieApp.#onThrowHumanity,
      complete: DiablerieApp.#onComplete
    }
  };

  static PARTS = { form: { template: "systems/vtmlarp/templates/apps/diablerie.hbs" } };

  async _prepareContext() {
    const victims = game.actors
      .filter(a => ["character", "npc"].includes(a.type) && a.id !== this.actor.id)
      .map(a => ({ id: a.id, name: a.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const victim = this.#victimId ? game.actors.get(this.#victimId) : null;

    let disciplines = [];
    if (victim) {
      const mine = new Map(this.actor.items.filter(i => i.type === "discipline").map(i => [i.name, Number(i.system.rating) || 0]));
      disciplines = victim.items
        .filter(i => i.type === "discipline")
        .map(i => {
          const vRating = Number(i.system.rating) || 0;
          const myRating = mine.get(i.name) ?? 0;
          const targetLevel = myRating + 1;
          const known = myRating > 0;
          const canGain = targetLevel <= vRating; // can't exceed what the victim had
          return { name: i.name, vRating, myRating, targetLevel, known, canGain };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
    }

    // A generation throw is available only when the victim is of LOWER
    // generation (a smaller number = closer to Caine) than the diablerist.
    const myGen = Number(this.actor.system.generation) || 13;
    const vGen = victim ? (Number(victim.system.generation) || 13) : null;
    const genAvailable = vGen != null && vGen < myGen;

    return {
      diablerist: this.actor.name,
      victims,
      victimId: this.#victimId,
      victimName: victim?.name ?? "",
      torpor: this.#torpor,
      disciplines,
      attributeUsed: this.#attributeUsed,
      myGen, vGen, genAvailable,
      taint: this.actor.system.diablerie?.count ?? 0
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    this.element.querySelector('[name="victim"]')?.addEventListener("change", (e) => {
      this.#victimId = e.target.value; this.#attributeUsed = false; this.render();
    });
    this.element.querySelector('[name="torpor"]')?.addEventListener("change", (e) => {
      this.#torpor = e.target.checked;
    });
  }

  #requireTorpor() {
    if (!this.#torpor) {
      ui.notifications?.warn("The victim must be in torpor before you can drain their soul.");
      return false;
    }
    return true;
  }

  /** Pop a gesture picker; resolve against a random opposing throw. Returns
   * "win" | "lose" (ties resolve as a loss - the soul slips free). */
  async #throw(title) {
    const pick = await DialogV2.prompt({
      window: { title },
      content: `<p>${title}</p><label>Your gesture
        <select name="g"><option value="rock">Rock</option><option value="paper">Paper</option><option value="scissors">Scissors</option></select></label>`,
      ok: { label: "Throw", callback: (e, btn) => btn.form.elements.g.value }
    }).catch(() => null);
    if (!pick) return null;
    const opp = ["rock", "paper", "scissors"][Math.floor(Math.random() * 3)];
    const outcome = beats(pick, opp);
    return { win: outcome === "win", pick, opp, outcome };
  }

  async #post(html) {
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: this.actor }), content: html });
  }

  static async #onThrowDiscipline(event, target) {
    if (!this.#requireTorpor()) return;
    const name = target.dataset.name;
    const targetLevel = Number(target.dataset.level) || 1;
    const res = await this.#throw(`Diablerie — steal ${name} ${targetLevel}`);
    if (!res) return;
    if (res.win) {
      try {
        const existing = this.actor.items.find(i => i.type === "discipline" && i.name === name);
        if (existing) await existing.update({ "system.rating": targetLevel });
        else await this.actor.createEmbeddedDocuments("Item", [{ name, type: "discipline", img: "icons/svg/upgrade.svg", system: { rating: targetLevel, description: `<p>Gained through diablerie.</p>` } }]);
        ui.notifications?.info(`Gained ${name} ${targetLevel}.`);
      } catch (err) {
        console.error("vtmlarp | diablerie discipline gain failed", err);
        ui.notifications?.error(`Couldn't apply ${name} — see the console.`);
      }
      await this.#post(`<div class="vtmlarp-shared-entry"><p><strong>${this.actor.name}</strong> tears <strong>${name}</strong> (level ${targetLevel}) from the dying soul. <em>(${res.pick} vs ${res.opp})</em></p></div>`);
    } else {
      await this.#post(`<p><strong>${this.actor.name}</strong> reaches for <strong>${name}</strong> but does not gain it. <em>(${res.pick} vs ${res.opp})</em></p>`);
    }
    this.render();
  }

  static async #onThrowAttribute(event, target) {
    if (!this.#requireTorpor()) return;
    if (this.#attributeUsed) { ui.notifications?.info("You've already made your Attribute throw for this diablerie."); return; }
    const pool = this.element.querySelector('[name="attrPool"]')?.value || "physical";
    const res = await this.#throw(`Diablerie — steal an Attribute Trait (${pool})`);
    if (!res) return;
    this.#attributeUsed = true;
    const cap = (await import("../game-data.mjs")).GENERATION_TABLE[this.actor.system.generation]?.maxTraits;
    const cur = Number(this.actor.system.attributes[pool]?.total) || 0;
    if (res.win) {
      if (cap && cur >= cap) {
        await this.#post(`<p><strong>${this.actor.name}</strong> wins the Trait, but is already at their generation cap (${cap}) for ${pool}.</p>`);
      } else {
        await this.actor.update({ [`system.attributes.${pool}.total`]: cur + 1 });
        await this.#post(`<p><strong>${this.actor.name}</strong> claims <strong>+1 ${pool} Trait</strong> from the victim. <em>(${res.pick} vs ${res.opp})</em></p>`);
      }
    } else {
      await this.#post(`<p><strong>${this.actor.name}</strong> fails to claim an Attribute Trait. <em>(${res.pick} vs ${res.opp})</em></p>`);
    }
    this.render();
  }

  static async #onThrowGeneration() {
    if (!this.#requireTorpor()) return;
    const victim = this.#victimId ? game.actors.get(this.#victimId) : null;
    const myGen = Number(this.actor.system.generation) || 13;
    const vGen = victim ? (Number(victim.system.generation) || 13) : null;
    if (vGen == null || vGen >= myGen) { ui.notifications?.info("The victim must be of lower generation to steal generation."); return; }
    const res = await this.#throw("Diablerie — steal a Generation");
    if (!res) return;
    if (res.win) {
      const newGen = myGen - 1;
      const info = (await import("../game-data.mjs")).GENERATION_TABLE[newGen];
      const update = { "system.generation": newGen };
      if (info) { update["system.blood.max"] = info.bloodMax; update["system.blood.perTurn"] = info.bloodPerTurn; }
      await this.actor.update(update);
      await this.#post(`<div class="vtmlarp-shared-entry"><p><strong>${this.actor.name}</strong> draws closer to Caine — generation lowered to <strong>${newGen}th</strong>. <em>(${res.pick} vs ${res.opp})</em></p></div>`);
    } else {
      await this.#post(`<p><strong>${this.actor.name}</strong> fails to claim the victim's potent blood. <em>(${res.pick} vs ${res.opp})</em></p>`);
    }
    this.render();
  }

  static async #onThrowHumanity() {
    const res = await this.#throw("Diablerie — resist losing Humanity/Path");
    if (!res) return;
    if (res.win) {
      await this.#post(`<p><strong>${this.actor.name}</strong> holds onto their remaining conscience. <em>(${res.pick} vs ${res.opp})</em></p>`);
      return;
    }
    const cur = Number(this.actor.system.morality?.rating) || 0;
    await this.actor.update({ "system.morality.rating": Math.max(0, cur - 1) });
    await this.#post(`<p><strong>${this.actor.name}</strong> loses a point of <strong>${this.actor.system.morality?.path || "Humanity"}</strong> (now ${Math.max(0, cur - 1)}) for the Amaranth. <em>(${res.pick} vs ${res.opp})</em></p>`);
    this.render();
  }

  static async #onThrowFrenzy() {
    const res = await this.#throw("Diablerie — resist the euphoric Frenzy");
    if (!res) return;
    if (res.win) {
      await this.#post(`<p><strong>${this.actor.name}</strong> masters the euphoria and resists Frenzy. <em>(${res.pick} vs ${res.opp})</em></p>`);
    } else {
      await this.#post(`<div class="vtmlarp-challenge-card"><div class="vtm-result-banner result-Lost">${this.actor.name} succumbs to Frenzy!</div><p>The stolen soul's euphoria overwhelms them. <em>(${res.pick} vs ${res.opp})</em></p></div>`);
    }
  }

  static async #onThrowDerangement() {
    const res = await this.#throw("Diablerie — resist a Derangement");
    if (!res) return;
    if (res.win) {
      await this.#post(`<p><strong>${this.actor.name}</strong> keeps their mind whole — no Derangement. <em>(${res.pick} vs ${res.opp})</em></p>`);
      return;
    }
    // Apply a random Derangement from the compendium.
    let name = "A new Derangement (Storyteller's choice)";
    try {
      const pack = game.packs.get("vtmlarp.derangements");
      const index = pack ? [...(await pack.getIndex())] : [];
      if (index.length) name = index[Math.floor(Math.random() * index.length)].name;
    } catch { /* fall back to placeholder */ }
    const list = foundry.utils.duplicate(this.actor.system.derangements ?? []);
    list.push({ name, description: "Gained through diablerie." });
    await this.actor.update({ "system.derangements": list });
    await this.#post(`<p><strong>${this.actor.name}</strong> is scarred by the soul they consumed — gains the Derangement <strong>${name}</strong>. <em>(${res.pick} vs ${res.opp})</em></p>`);
  }

  static async #onComplete() {
    const d = this.actor.system.diablerie ?? { count: 0 };
    await this.actor.update({
      "system.diablerie.count": (Number(d.count) || 0) + 1,
      "system.diablerie.lastDate": new Date().toLocaleString()
    });
    await this.#post(`<div class="vtmlarp-shared-entry"><h3>Diablerie committed</h3>`
      + `<p><strong>${this.actor.name}</strong> has consumed a soul. Black veins now run through their aura — visible to Aura Perception for about three months, and to Thaumaturgy's <em>A Taste for Blood</em> forever.</p></div>`);
    ui.notifications?.info(`${this.actor.name}'s diablerie is recorded (taint x${(Number(d.count) || 0) + 1}).`);
    this.render();
  }
}
