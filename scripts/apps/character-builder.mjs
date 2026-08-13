const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

const GEN_WILLPOWER_START = { 15: 2, 14: 2, 13: 2, 12: 2, 11: 4, 10: 4, 9: 6, 8: 6, 7: 7, 6: 8, 5: 9, 4: 10 };
const GEN_BLOOD = { 15: [10, 1], 14: [10, 1], 13: [10, 1], 12: [11, 1], 11: [12, 1], 10: [13, 1], 9: [14, 2], 8: [15, 3], 7: [20, 5], 6: [30, 6], 5: [40, 8], 4: [50, 10] };
const LEVEL_TIER = { basic: 1, intermediate: 2, advanced: 3, elder: 4 };

const CLANS = ["Assamite", "Brujah", "Followers of Set", "Gangrel", "Giovanni", "Lasombra", "Malkavian", "Nosferatu", "Ravnos", "Toreador", "Tremere", "Tzimisce", "Ventrue", "Baali", "Cappadocian", "Salubri", "Blood Brothers", "Harbingers of Skulls", "Kiasyd", "Panders", "Gargoyle", "Daughters of Cacophony", "True Brujah", "Nagaraja", "Samedi", "Lamia", "Caitiff"];
const SECTS = ["Camarilla", "Sabbat", "Anarch Movement", "Independent Alliance", "Inconnu", "Ashirra"];
const ARCHETYPES = ["Architect", "Autocrat", "Bon Vivant", "Bravo", "Caregiver", "Cavalier", "Celebrant", "Conformist", "Conniver", "Curmudgeon", "Deviant", "Director", "Fanatic", "Gallant", "Judge", "Loner", "Martyr", "Masochist", "Monster", "Pedagogue", "Perfectionist", "Rebel", "Rogue", "Survivor", "Thrill-Seeker", "Traditionalist", "Trickster", "Visionary"];
const PATHS = ["Path of Humanity", "Path of Blood (Assamite)", "Path of Caine", "Path of Cathari", "Path of Death and the Soul", "Path of Ecstasy", "Path of Evil Revelations", "Path of Harmony", "Path of Honorable Accord", "Path of Lilith", "Path of Night", "Path of Paradox (Ravnos)", "Path of Power and the Inner Voice", "Path of the Feral Heart", "Path of the Warrior", "Path of Typhon (Setite)"];

/**
 * Paged, point-tracked character creator. Each step has a scrollable list of
 * real compendium entries you click to add, with a live counter of points
 * spent vs. allotment. Disciplines auto-pull their core powers to the sheet
 * based on the dots assigned. "Add Character" builds the finished actor.
 */
export class CharacterBuilderApp extends HandlebarsApplicationMixin(ApplicationV2) {
  #step = 0;
  #stepCount = 0;

  static DEFAULT_OPTIONS = {
    id: "vtmlarp-character-builder",
    classes: ["vtmlarp", "sheet", "character-builder"],
    position: { width: 700, height: 780 },
    window: { title: "Character Builder", resizable: true },
    actions: {
      addRow: CharacterBuilderApp.#onAddRow,
      removeRow: CharacterBuilderApp.#onRemoveRow,
      pickAdd: CharacterBuilderApp.#onPickAdd,
      next: CharacterBuilderApp.#onNext,
      back: CharacterBuilderApp.#onBack,
      createCharacter: CharacterBuilderApp.#onCreate
    }
  };

  static PARTS = { form: { template: "systems/vtmlarp/templates/apps/character-builder.hbs" } };

  async _prepareContext() {
    const idx = async (packName, fields) => {
      const pack = game.packs.get(`vtmlarp.${packName}`);
      if (!pack) return [];
      return [...(await pack.getIndex({ fields }))];
    };
    const abilities = (await idx("abilities", ["system.category"]))
      .map(e => ({ name: e.name, category: e.system?.category ?? "talent" }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const disciplineList = [...new Set((await idx("disciplines", ["type"]))
      .filter(e => e.type === "discipline" && !/[(—]/.test(e.name)).map(e => e.name))].sort();
    const backgrounds = (await idx("backgrounds")).map(e => e.name).sort();
    const mf = (await idx("merits-flaws", ["type", "system.cost", "system.bonus"]))
      .map(e => ({ name: e.name, type: e.type, cost: e.type === "flaw" ? (e.system?.bonus ?? 1) : (e.system?.cost ?? 1) }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      clans: CLANS, sects: SECTS, paths: PATHS, archetypes: ARCHETYPES,
      generations: [15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4],
      abilities, disciplineList, backgrounds,
      merits: mf.filter(e => e.type === "merit"),
      flaws: mf.filter(e => e.type === "flaw")
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    this.#stepCount = this.element.querySelectorAll(".builder-step").length;
    this.element.addEventListener("input", () => this.#recompute());
    this.element.addEventListener("change", () => this.#recompute());
    this.#showStep(this.#step);
    this.#recompute();
  }

  #showStep(n) {
    this.#step = Math.max(0, Math.min(this.#stepCount - 1, n));
    const steps = [...this.element.querySelectorAll(".builder-step")];
    steps.forEach((s, i) => s.classList.toggle("active", i === this.#step));
    const label = this.element.querySelector(".builder-stepname");
    if (label) label.textContent = `Step ${this.#step + 1} / ${this.#stepCount}: ${steps[this.#step]?.dataset.title ?? ""}`;
    this.element.querySelector(".builder-back")?.toggleAttribute("disabled", this.#step === 0);
    const onLast = this.#step === this.#stepCount - 1;
    this.element.querySelector(".builder-next")?.classList.toggle("hidden", onLast);
    this.element.querySelector(".builder-create")?.classList.toggle("hidden", !onLast);
  }

  static #onNext() { this.#showStep(this.#step + 1); }
  static #onBack() { this.#showStep(this.#step - 1); }

  static #onAddRow(event, target) { this.#addRow(target.dataset.kind); this.#recompute(); }

  #addRow(kind, prefill = {}) {
    const tpl = this.element.querySelector(`template.row-${kind}`);
    const container = this.element.querySelector(`.rows-${kind}`);
    if (!tpl || !container) return;
    const frag = tpl.content.cloneNode(true);
    for (const [k, v] of Object.entries(prefill)) {
      const field = frag.querySelector(`[name="${k}"]`);
      if (field) field.value = v;
    }
    container.appendChild(frag);
  }

  static #onRemoveRow(event, target) { target.closest(".builder-row")?.remove(); this.#recompute(); }

  /** Click an entry in a pick-list to add a pre-filled row for it. */
  static #onPickAdd(event, target) {
    const { kind, name, category, type, cost } = target.dataset;
    const prefill = { name };
    if (category) prefill.category = category;
    if (type) prefill.type = type;
    if (cost) prefill.cost = cost;
    this.#addRow(kind, prefill);
    this.#recompute();
    // scroll the new row into view
    const rows = this.element.querySelector(`.rows-${kind}`);
    rows?.lastElementChild?.scrollIntoView({ block: "nearest" });
  }

  #num(sel) { return Number(this.element.querySelector(sel)?.value) || 0; }

  #rows(kind) {
    return [...this.element.querySelectorAll(`.rows-${kind} .builder-row`)].map(row => {
      const get = (n) => row.querySelector(`[name="${n}"]`)?.value ?? "";
      return { name: get("name").trim(), rating: Number(get("rating")) || 0, category: get("category"), type: get("type"), cost: Number(get("cost")) || 0 };
    });
  }

  #orig() { return !!this.element.querySelector('[name="useOriginal"]')?.checked; }

  #recompute() {
    const el = this.element;
    const set = (sel, txt, over) => {
      const n = el.querySelector(sel);
      if (!n) return;
      n.textContent = txt;
      n.classList.toggle("over", !!over);
    };
    const attr = this.#num('[name="phys"]') + this.#num('[name="soc"]') + this.#num('[name="ment"]');
    set(".count-attributes", `${attr} / 15`, attr > 15);
    const abil = this.#rows("ability").reduce((n, r) => n + r.rating, 0);
    const abilB = this.#orig() ? 5 : 11;
    set(".count-abilities", `${abil} / ${abilB}`, abil > abilB);
    const dRows = this.#rows("discipline");
    const disc = dRows.reduce((n, r) => n + r.rating, 0);
    const discB = this.#orig() ? 3 : 5;
    set(".count-disciplines", `${disc} / ${discB}`, disc > discB || dRows.some(r => r.rating > 3));
    const bg = this.#rows("background").reduce((n, r) => n + r.rating, 0);
    set(".count-backgrounds", `${bg} / 5`, bg > 5);
    const virt = this.#num('[name="conscience"]') + this.#num('[name="selfcontrol"]') + this.#num('[name="courage"]');
    set(".count-virtues", `${virt} / 10`, virt > 10);
    const gen = this.#num('[name="generation"]') || 13;
    set(".count-willpower", `${GEN_WILLPOWER_START[gen] ?? 2}`);

    const over = (s, b) => Math.max(0, s - b);
    const TIER = [3, 6, 9, 12];
    const discCosts = dRows.flatMap(r => Array.from({ length: r.rating }, (_, i) => TIER[Math.min(i, 3)])).sort((a, b) => a - b);
    const discFree = discCosts.slice(0, Math.max(0, disc - discB)).reduce((n, c) => n + c, 0);
    const mf = this.#rows("meritflaw");
    const meritCost = mf.filter(r => r.type === "merit").reduce((n, r) => n + r.cost, 0);
    const flawValue = mf.filter(r => r.type === "flaw").reduce((n, r) => n + r.cost, 0);
    const freebiesSpent = over(attr, 15) + over(abil, abilB) + over(bg, 5) + over(virt, 10) * 2 + discFree + meritCost;
    const base = this.#orig() ? 5 : 12;
    const derange = el.querySelector('[name="derangement"]')?.checked ? 2 : 0;
    const pool = Math.min(21, base + Math.min(7, flawValue) + derange);
    set(".count-freebies", `${freebiesSpent} / ${pool}`, freebiesSpent > pool);
  }

  static async #onCreate() {
    const el = this.element;
    const val = (n) => el.querySelector(`[name="${n}"]`)?.value ?? "";
    const num = (n) => Number(el.querySelector(`[name="${n}"]`)?.value) || 0;
    const name = val("charname").trim();
    if (!name) { ui.notifications?.warn("Give the character a name first."); this.#showStep(0); return; }

    const gen = num("generation") || 13;
    const [bloodMax, perTurn] = GEN_BLOOD[gen] ?? [10, 1];
    const wpStart = GEN_WILLPOWER_START[gen] ?? 2;

    const cats = [["physical", num("phys")], ["social", num("soc")], ["mental", num("ment")]].sort((a, b) => b[1] - a[1]);
    const priority = {}; ["primary", "secondary", "tertiary"].forEach((p, i) => { priority[cats[i][0]] = p; });
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
    // Disciplines: create the container AND auto-pull its core powers up to the
    // tier matching the dots assigned (Basic=1, Intermediate=2, Advanced=3...).
    const discPack = game.packs.get("vtmlarp.disciplines");
    let discIndex = [];
    let folderByName = {};
    if (discPack) {
      discIndex = [...(await discPack.getIndex({ fields: ["type", "folder", "system.discipline", "system.level"] }))];
      (discPack.folders ?? []).forEach(f => { folderByName[f.name] = f.id; });
    }
    for (const r of this.#rows("discipline")) {
      if (!r.name) continue;
      items.push({ name: r.name, type: "discipline", img: "icons/svg/upgrade.svg", system: { rating: r.rating, description: `<p>${r.name}.</p>` } });
      // core powers = in this discipline's main folder, tier <= rating
      const folderId = folderByName[r.name];
      const matches = discIndex.filter(e => e.type === "power"
        && (e.folder === folderId || e.system?.discipline === r.name)
        && (LEVEL_TIER[e.system?.level] ?? 9) <= r.rating
        && (folderId ? e.folder === folderId : true));
      const docs = await Promise.all(matches.map(e => discPack.getDocument(e._id).catch(() => null)));
      for (const doc of docs) {
        if (doc) { const o = doc.toObject(); delete o._id; items.push(o); }
      }
    }
    for (const r of this.#rows("meritflaw")) {
      if (!r.name) continue;
      const isMerit = r.type === "merit";
      items.push({ name: r.name, type: isMerit ? "merit" : "flaw", img: isMerit ? "icons/svg/heal.svg" : "icons/svg/hazard.svg", system: isMerit ? { cost: r.cost } : { bonus: r.cost } });
    }

    const actor = await Actor.create({
      name, type: "character",
      system: {
        clan: val("clan"), sect: val("sect"), nature: val("nature"), demeanor: val("demeanor"),
        generation: gen, generationApplied: true,
        morality: { path: val("path") || "Path of Humanity", rating: 7 },
        attributes: attrData, abilities: ab, backgrounds,
        virtues: {
          conscienceConviction: { rating: num("conscience") || 1, temporary: num("conscience") || 1 },
          selfControlInstinct: { rating: num("selfcontrol") || 1, temporary: num("selfcontrol") || 1 },
          courage: { rating: num("courage") || 1, temporary: num("courage") || 1 }
        },
        willpower: { value: wpStart, max: wpStart },
        blood: { value: bloodMax, max: bloodMax, perTurn },
        creationComplete: false,
        creationDerangement: !!el.querySelector('[name="derangement"]')?.checked,
        useOriginalRules: this.#orig()
      },
      items
    });
    ui.notifications?.info(`Created ${name} with ${items.length} item(s).`);
    this.close();
    actor?.sheet?.render(true);
  }
}
