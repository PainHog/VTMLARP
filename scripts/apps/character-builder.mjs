const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

// Starting Willpower by generation (Laws of the Night Revised chart).
const GEN_WILLPOWER_START = { 15: 2, 14: 2, 13: 2, 12: 2, 11: 4, 10: 4, 9: 6, 8: 6, 7: 7, 6: 8, 5: 9, 4: 10 };
const GEN_BLOOD = { 15: [10, 1], 14: [10, 1], 13: [10, 1], 12: [11, 1], 11: [12, 1], 10: [13, 1], 9: [14, 2], 8: [15, 3], 7: [20, 5], 6: [30, 6], 5: [40, 8], 4: [50, 10] };

const CLANS = ["Assamite", "Brujah", "Followers of Set", "Gangrel", "Giovanni", "Lasombra", "Malkavian", "Nosferatu", "Ravnos", "Toreador", "Tremere", "Tzimisce", "Ventrue", "Baali", "Cappadocian", "Salubri", "Blood Brothers", "Harbingers of Skulls", "Kiasyd", "Panders", "Gargoyle", "Daughters of Cacophony", "True Brujah", "Nagaraja", "Samedi", "Lamia", "Caitiff"];
const SECTS = ["Camarilla", "Sabbat", "Anarch Movement", "Independent Alliance", "Inconnu", "Ashirra"];
const ARCHETYPES = ["Architect", "Autocrat", "Bon Vivant", "Bravo", "Caregiver", "Cavalier", "Celebrant", "Conformist", "Conniver", "Curmudgeon", "Deviant", "Director", "Fanatic", "Gallant", "Judge", "Loner", "Martyr", "Masochist", "Monster", "Pedagogue", "Perfectionist", "Rebel", "Rogue", "Survivor", "Thrill-Seeker", "Traditionalist", "Trickster", "Visionary"];
const PATHS = ["Path of Humanity", "Path of Blood (Assamite)", "Path of Caine", "Path of Cathari", "Path of Death and the Soul", "Path of Ecstasy", "Path of Evil Revelations", "Path of Harmony", "Path of Honorable Accord", "Path of Lilith", "Path of Night", "Path of Paradox (Ravnos)", "Path of Power and the Inner Voice", "Path of the Feral Heart", "Path of the Warrior", "Path of Typhon (Setite)"];

/**
 * A standalone, point-tracked character creator. Fill it in section by section
 * with live budget counters; "Create Character" builds a real character Actor
 * from the entries (attributes/abilities/backgrounds/virtues inline, and
 * Disciplines/Merits/Flaws as embedded Items) and opens its sheet.
 */
export class CharacterBuilderApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "vtmlarp-character-builder",
    classes: ["vtmlarp", "sheet", "character-builder"],
    position: { width: 660, height: 820 },
    window: { title: "Character Builder", resizable: true },
    actions: {
      addRow: CharacterBuilderApp.#onAddRow,
      removeRow: CharacterBuilderApp.#onRemoveRow,
      createCharacter: CharacterBuilderApp.#onCreate
    }
  };

  static PARTS = { form: { template: "systems/vtmlarp/templates/apps/character-builder.hbs" } };

  async _prepareContext() {
    return { clans: CLANS, sects: SECTS, paths: PATHS, archetypes: ARCHETYPES, generations: [15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4] };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    this.element.addEventListener("input", () => this.#recompute());
    this.element.addEventListener("change", () => this.#recompute());
    this.#recompute();
  }

  /** Add a new dynamic row (ability/discipline/background/merit-flaw) from its <template>. */
  static #onAddRow(event, target) {
    const kind = target.dataset.kind;
    const tpl = this.element.querySelector(`template.row-${kind}`);
    const container = this.element.querySelector(`.rows-${kind}`);
    if (tpl && container) {
      container.appendChild(tpl.content.cloneNode(true));
      this.#recompute();
    }
  }

  static #onRemoveRow(event, target) {
    target.closest(".builder-row")?.remove();
    this.#recompute();
  }

  #num(sel) { return Number(this.element.querySelector(sel)?.value) || 0; }

  #rows(kind) {
    return [...this.element.querySelectorAll(`.rows-${kind} .builder-row`)].map(row => {
      const get = (n) => row.querySelector(`[name="${n}"]`)?.value ?? "";
      return { name: get("name").trim(), rating: Number(get("rating")) || 0, category: get("category"), type: get("type"), cost: Number(get("cost")) || 0 };
    });
  }

  /** Live recompute of every budget counter and the freebie summary. */
  #recompute() {
    const el = this.element;
    const set = (sel, txt, over) => {
      const node = el.querySelector(sel);
      if (!node) return;
      node.textContent = txt;
      node.classList.toggle("over", !!over);
    };

    const attr = this.#num('[name="phys"]') + this.#num('[name="soc"]') + this.#num('[name="ment"]');
    set(".count-attributes", `${attr} / 15`, attr > 15);

    const abil = this.#rows("ability").reduce((n, r) => n + r.rating, 0);
    const abilBudget = el.querySelector('[name="useOriginal"]')?.checked ? 5 : 11;
    set(".count-abilities", `${abil} / ${abilBudget}`, abil > abilBudget);

    const discRows = this.#rows("discipline");
    const disc = discRows.reduce((n, r) => n + r.rating, 0);
    const discBudget = el.querySelector('[name="useOriginal"]')?.checked ? 3 : 5;
    set(".count-disciplines", `${disc} / ${discBudget}`, disc > discBudget || discRows.some(r => r.rating > 3));

    const bg = this.#rows("background").reduce((n, r) => n + r.rating, 0);
    set(".count-backgrounds", `${bg} / 5`, bg > 5);

    const virt = this.#num('[name="conscience"]') + this.#num('[name="selfcontrol"]') + this.#num('[name="courage"]');
    set(".count-virtues", `${virt} / 10`, virt > 10);

    const gen = this.#num('[name="generation"]') || 13;
    const wpStart = GEN_WILLPOWER_START[gen] ?? 2;
    set(".count-willpower", `${wpStart}`);

    // Freebies: overspend beyond each area's budget, tiered Disciplines, plus
    // Merit costs. Pool = base + Flaw values (max 7) + 2 for a Derangement.
    const over = (spent, budget) => Math.max(0, spent - budget);
    const TIER = [3, 6, 9, 12];
    const discCosts = discRows.flatMap(r => Array.from({ length: r.rating }, (_, i) => TIER[Math.min(i, 3)])).sort((a, b) => a - b);
    const discOver = Math.max(0, disc - discBudget);
    const discFreebies = discCosts.slice(0, discOver).reduce((n, c) => n + c, 0);

    const mf = this.#rows("meritflaw");
    const meritCost = mf.filter(r => r.type === "merit").reduce((n, r) => n + r.cost, 0);
    const flawValue = mf.filter(r => r.type === "flaw").reduce((n, r) => n + r.cost, 0);

    const freebiesSpent = over(attr, 15) + over(abil, abilBudget) + over(bg, 5) * 1
      + over(virt, 10) * 2 + discFreebies + meritCost;
    const base = el.querySelector('[name="useOriginal"]')?.checked ? 5 : 12;
    const derange = el.querySelector('[name="derangement"]')?.checked ? 2 : 0;
    const pool = Math.min(21, base + Math.min(7, flawValue) + derange);
    set(".count-freebies", `${freebiesSpent} / ${pool}`, freebiesSpent > pool);
  }

  static async #onCreate() {
    const el = this.element;
    const val = (n) => el.querySelector(`[name="${n}"]`)?.value ?? "";
    const num = (n) => Number(el.querySelector(`[name="${n}"]`)?.value) || 0;
    const name = val("charname").trim();
    if (!name) { ui.notifications?.warn("Give the character a name first."); return; }

    const gen = num("generation") || 13;
    const [bloodMax, perTurn] = GEN_BLOOD[gen] ?? [10, 1];
    const wpStart = GEN_WILLPOWER_START[gen] ?? 2;

    // Attributes: assign priority by which total is highest/lowest.
    const cats = [["physical", num("phys")], ["social", num("soc")], ["mental", num("ment")]].sort((a, b) => b[1] - a[1]);
    const priority = {};
    ["primary", "secondary", "tertiary"].forEach((p, i) => { priority[cats[i][0]] = p; });
    const attrData = {};
    for (const [key, total] of [["physical", num("phys")], ["social", num("soc")], ["mental", num("ment")]]) {
      attrData[key] = { priority: priority[key], total, traits: [] };
    }

    const ab = { talents: [], skills: [], knowledges: [] };
    for (const r of this.#rows("ability")) {
      if (!r.name) continue;
      const key = { talent: "talents", skill: "skills", knowledge: "knowledges" }[r.category] ?? "talents";
      ab[key].push({ name: r.name, rating: r.rating, max: r.rating, notes: "" });
    }

    const backgrounds = this.#rows("background").filter(r => r.name).map(r => ({ name: r.name, rating: r.rating, max: r.rating, notes: "" }));

    const items = [];
    for (const r of this.#rows("discipline")) {
      if (!r.name) continue;
      items.push({ name: r.name, type: "discipline", img: "icons/svg/upgrade.svg", system: { rating: r.rating, description: `<p>${r.name}. Drag its powers in from the Disciplines compendium.</p>` } });
    }
    for (const r of this.#rows("meritflaw")) {
      if (!r.name) continue;
      const isMerit = r.type === "merit";
      items.push({ name: r.name, type: isMerit ? "merit" : "flaw", img: isMerit ? "icons/svg/heal.svg" : "icons/svg/hazard.svg", system: isMerit ? { cost: r.cost } : { bonus: r.cost } });
    }

    const actor = await Actor.create({
      name,
      type: "character",
      system: {
        clan: val("clan"), sect: val("sect"), nature: val("nature"), demeanor: val("demeanor"),
        generation: gen, generationApplied: true,
        morality: { path: val("path") || "Path of Humanity", rating: 7 },
        attributes: attrData,
        abilities: ab,
        backgrounds,
        virtues: {
          conscienceConviction: { rating: num("conscience") || 1, temporary: num("conscience") || 1 },
          selfControlInstinct: { rating: num("selfcontrol") || 1, temporary: num("selfcontrol") || 1 },
          courage: { rating: num("courage") || 1, temporary: num("courage") || 1 }
        },
        willpower: { value: wpStart, max: wpStart },
        blood: { value: bloodMax, max: bloodMax, perTurn },
        creationComplete: false,
        creationDerangement: !!el.querySelector('[name="derangement"]')?.checked,
        useOriginalRules: !!el.querySelector('[name="useOriginal"]')?.checked
      },
      items
    });

    ui.notifications?.info(`Created ${name}.`);
    this.close();
    actor?.sheet?.render(true);
  }
}
