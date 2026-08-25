import { disciplineFreeDots, disciplineFreebieCost } from "./creation-costs.mjs";
import { CLANS, CLAN_DISCIPLINES } from "./clan-data.mjs";
import { GENERATION_TABLE, GENERATION_OPTIONS, PATH_OPTIONS, ARCHETYPE_OPTIONS } from "../game-data.mjs";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

const LEVEL_TIER = { basic: 1, intermediate: 2, advanced: 3, elder: 4 };
// Starting Willpower and Blood by Generation, derived from the shared table so
// the builder and the sheet can't drift.
const GEN_WILLPOWER_START = Object.fromEntries(Object.entries(GENERATION_TABLE).map(([g, i]) => [g, i.willpowerStart]));
const GEN_BLOOD = Object.fromEntries(Object.entries(GENERATION_TABLE).map(([g, i]) => [g, [i.bloodMax, i.bloodPerTurn]]));

const SECTS = ["Camarilla", "Sabbat", "Anarch Movement", "Independent Alliance", "Inconnu", "Ashirra"];

/**
 * Paged, point-tracked character creator. Each step has a scrollable list of
 * real compendium entries you click to add, with a live counter of points
 * spent vs. allotment. Disciplines auto-pull their core powers to the sheet
 * based on the dots assigned. "Add Character" builds the finished actor.
 */
export class CharacterBuilderApp extends HandlebarsApplicationMixin(ApplicationV2) {
  #step = 0;
  #stepCount = 0;
  // A clan pre-selected by the "Select Clan" button in the Clan Picker, applied
  // once on first render so its in-clan Disciplines are seeded automatically.
  #initialClan = "";
  #initialClanApplied = false;

  constructor(options = {}) {
    super(options);
    if (options.clan && CLANS.includes(options.clan)) this.#initialClan = options.clan;
  }

  static DEFAULT_OPTIONS = {
    id: "vtmlarp-character-builder",
    classes: ["vtmlarp", "sheet", "character-builder"],
    position: { width: 700, height: 780 },
    window: { title: "Character Builder", resizable: true },
    actions: {
      addRow: CharacterBuilderApp.#onAddRow,
      removeRow: CharacterBuilderApp.#onRemoveRow,
      pickAdd: CharacterBuilderApp.#onPickAdd,
      openInfo: CharacterBuilderApp.#onOpenInfo,
      openInfoSel: CharacterBuilderApp.#onOpenInfoSel,
      next: CharacterBuilderApp.#onNext,
      back: CharacterBuilderApp.#onBack,
      createCharacter: CharacterBuilderApp.#onCreate
    }
  };

  static PARTS = { form: { template: "systems/vtmlarp/templates/apps/character-builder.hbs" } };

  // name -> compendium UUID lookups, so the info buttons next to the dropdowns
  // (clan/sect/path/derangement/discipline) can open the right entry at click
  // time. Built in _prepareContext.
  #uuid = { discipline: {}, ability: {}, background: {}, meritflaw: {}, derangement: {}, clan: {}, sect: {}, path: {} };

  /** Strip HTML to a short plain-text blurb for hover tooltips. */
  static #blurb(html) {
    if (!html) return "";
    const txt = String(html).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    return txt.length > 320 ? `${txt.slice(0, 317)}…` : txt;
  }

  async _prepareContext() {
    const idx = async (packName, fields) => {
      const pack = game.packs.get(`vtmlarp.${packName}`);
      if (!pack) return [];
      return [...(await pack.getIndex({ fields }))].map(e => ({ ...e, uuid: e.uuid ?? pack.getUuid?.(e._id) ?? `Compendium.vtmlarp.${packName}.${e._id}` }));
    };
    const blurb = CharacterBuilderApp.#blurb;
    const remember = (kind, name, uuid) => { if (name && uuid) this.#uuid[kind][name] = uuid; };

    const abilities = (await idx("abilities", ["system.description"]))
      .map(e => { remember("ability", e.name, e.uuid); return { name: e.name, uuid: e.uuid, info: blurb(e.system?.description) }; })
      .sort((a, b) => a.name.localeCompare(b.name));

    const seen = new Set();
    const disciplineList = (await idx("disciplines", ["type", "system.description"]))
      .filter(e => e.type === "discipline" && !/[(—]/.test(e.name))
      .filter(e => { if (seen.has(e.name)) return false; seen.add(e.name); return true; })
      .map(e => { remember("discipline", e.name, e.uuid); return { name: e.name, uuid: e.uuid, info: blurb(e.system?.description) }; })
      .sort((a, b) => a.name.localeCompare(b.name));

    const backgrounds = (await idx("backgrounds", ["system.description"]))
      .map(e => { remember("background", e.name, e.uuid); return { name: e.name, uuid: e.uuid, info: blurb(e.system?.description) }; })
      .sort((a, b) => a.name.localeCompare(b.name));

    const mf = (await idx("merits-flaws", ["type", "system.cost", "system.bonus", "system.description"]))
      .map(e => { remember("meritflaw", e.name, e.uuid); return { name: e.name, type: e.type, cost: e.type === "flaw" ? (e.system?.bonus ?? 1) : (e.system?.cost ?? 1), uuid: e.uuid, info: blurb(e.system?.description) }; })
      .sort((a, b) => a.name.localeCompare(b.name));

    // Derangements are JournalEntries; offer them as a dropdown so a player can
    // pick the specific Derangement they take (for the +2 Freebies rule).
    const derangements = (await idx("derangements"))
      .map(e => { remember("derangement", e.name, e.uuid); return e.name; })
      .sort();

    // Clan lore lives across three JournalEntry packs; sects and paths in one
    // each. Map their names to UUIDs so the Concept-step info buttons work.
    for (const p of ["clans", "antitribu", "revenants"]) for (const e of await idx(p)) remember("clan", e.name, e.uuid);
    for (const e of await idx("sects")) remember("sect", e.name, e.uuid);
    for (const e of await idx("paths-of-enlightenment")) remember("path", e.name, e.uuid);

    return {
      clans: CLANS, initialClan: this.#initialClan, sects: SECTS, paths: PATH_OPTIONS, archetypes: ARCHETYPE_OPTIONS,
      generations: [...GENERATION_OPTIONS].reverse(),
      abilities, disciplineList, backgrounds, derangements,
      merits: mf.filter(e => e.type === "merit"),
      flaws: mf.filter(e => e.type === "flaw")
    };
  }

  /** Open a compendium document by UUID in its own sheet. */
  static async #openUuid(uuid) {
    if (!uuid) { ui.notifications?.warn("No compendium entry is linked to this."); return; }
    const doc = await fromUuid(uuid).catch(() => null);
    if (doc?.sheet) doc.sheet.render(true);
    else ui.notifications?.warn("Couldn't open that compendium entry.");
  }

  /** Info icon on a pick-list entry: open its compendium page. */
  static async #onOpenInfo(event, target) {
    event.preventDefault(); event.stopPropagation();
    await CharacterBuilderApp.#openUuid(target.dataset.uuid);
  }

  /** Info button next to a dropdown: open the currently-selected value's page. */
  static async #onOpenInfoSel(event, target) {
    event.preventDefault(); event.stopPropagation();
    const kind = target.dataset.kind;
    // The related <select> is either named (clan/sect/path/derangement) or the
    // discipline dropdown in the same row.
    const sel = target.dataset.for
      ? this.element.querySelector(`[name="${target.dataset.for}"]`)
      : target.closest(".builder-row")?.querySelector("select[name='name']");
    const name = sel?.value;
    if (!name) { ui.notifications?.info("Pick something first, then click for its info."); return; }
    await CharacterBuilderApp.#openUuid(this.#uuid[kind]?.[name]);
  }

  _onRender(context, options) {
    super._onRender(context, options);
    this.#stepCount = this.element.querySelectorAll(".builder-step").length;
    // Bind the root-level recompute listeners once: the AppV2 root element
    // persists across re-renders, so re-adding them each render would stack a
    // duplicate #recompute per keystroke (a known source of lag).
    if (!this.element.dataset.vtmRecomputeBound) {
      this.element.dataset.vtmRecomputeBound = "1";
      this.element.addEventListener("input", () => this.#recompute());
      this.element.addEventListener("change", () => this.#recompute());
    }
    // Auto-fill in-clan Disciplines when the clan is chosen on the Concept step.
    this.element.querySelector('[name="clan"]')?.addEventListener("change", (e) => {
      this.#applyClanDisciplines(e.target.value);
    });
    // Seed the in-clan Disciplines for a clan pre-selected from the Clan Picker.
    if (this.#initialClan && !this.#initialClanApplied) {
      this.#initialClanApplied = true;
      this.#applyClanDisciplines(this.#initialClan);
      ui.notifications?.info(`Character Builder started with clan ${this.#initialClan}.`);
    }
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
    if (!tpl || !container) return null;
    const frag = tpl.content.cloneNode(true);
    for (const [k, v] of Object.entries(prefill)) {
      const field = frag.querySelector(`[name="${k}"]`);
      if (field) field.value = v;
    }
    container.appendChild(frag);
    return container.lastElementChild;
  }

  /**
   * Populate the Disciplines step with the picked clan's three in-clan
   * Disciplines (at 0 dots). Previously auto-added clan rows are cleared first
   * so re-picking a clan swaps the set cleanly; manually-added rows are kept.
   */
  #applyClanDisciplines(clan) {
    const container = this.element.querySelector(".rows-discipline");
    if (!container) return;
    container.querySelectorAll(".builder-row[data-clan-row]").forEach(r => r.remove());
    const discs = CLAN_DISCIPLINES[clan] ?? [];
    const anchor = container.firstElementChild;
    for (const name of discs) {
      const row = this.#addRow("discipline", { name, rating: 0 });
      if (!row) continue;
      row.dataset.clanRow = "1";
      if (anchor) container.insertBefore(row, anchor);
    }
    this.#recompute();
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
    // Update EVERY element matching the selector (several counters - freebies,
    // attributes, etc. - appear both on their own step and again on the Review
    // step; querySelector would only refresh the first, leaving Review stale).
    const set = (sel, txt, over) => {
      el.querySelectorAll(sel).forEach(n => {
        n.textContent = txt;
        n.classList.toggle("over", !!over);
      });
    };
    const attr = this.#num('[name="phys"]') + this.#num('[name="soc"]') + this.#num('[name="ment"]');
    set(".count-attributes", `${attr} / 15`, attr > 15);
    const abil = this.#rows("ability").reduce((n, r) => n + r.rating, 0);
    const abilB = this.#orig() ? 5 : 11;
    set(".count-abilities", `${abil} / ${abilB}`, abil > abilB);
    const dRows = this.#rows("discipline");
    const discRatings = dRows.map(r => r.rating);
    // Only dots up to 3 per Discipline draw from the free-dot allotment; dots 4
    // and 5 are freebie-only.
    const freeDots = disciplineFreeDots(discRatings);
    const discB = this.#orig() ? 3 : 5;
    set(".count-disciplines", `${freeDots} / ${discB}`, freeDots > discB);
    const bg = this.#rows("background").reduce((n, r) => n + r.rating, 0);
    set(".count-backgrounds", `${bg} / 5`, bg > 5);
    const virt = this.#num('[name="conscience"]') + this.#num('[name="selfcontrol"]') + this.#num('[name="courage"]');
    set(".count-virtues", `${virt} / 10`, virt > 10);
    const gen = this.#num('[name="generation"]') || 13;
    set(".count-willpower", `${GEN_WILLPOWER_START[gen] ?? 2}`);

    const over = (s, b) => Math.max(0, s - b);
    // Discipline Freebie cost: dots 4 and 5 always cost 6 and 9; and any
    // free-tier dots (<=3) beyond the allotment cost tiered (3/6/9), cheapest
    // first. (Shared with the sheet's creation tracker.)
    const discFree = disciplineFreebieCost(discRatings, discB);
    const mf = this.#rows("meritflaw");
    const meritCost = mf.filter(r => r.type === "merit").reduce((n, r) => n + r.cost, 0);
    const flawValue = mf.filter(r => r.type === "flaw").reduce((n, r) => n + r.cost, 0);
    const freebiesSpent = over(attr, 15) + over(abil, abilB) + over(bg, 5) + over(virt, 10) * 2 + discFree + meritCost;
    const base = this.#orig() ? 5 : 12;
    const derange = el.querySelector('[name="derangement"]')?.value ? 2 : 0;
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

    // Flat, alphabetical Ability list (MET has no Talent/Skill/Knowledge split).
    const ab = this.#rows("ability")
      .filter(r => r.name)
      .map(r => ({ name: r.name, rating: r.rating, max: r.rating, notes: "" }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const backgrounds = this.#rows("background").filter(r => r.name).map(r => ({ name: r.name, rating: r.rating, max: r.rating, notes: "" }));

    const items = [];
    // Disciplines: create the container AND auto-pull its core powers up to the
    // tier matching the dots assigned (Basic=1, Intermediate=2, Advanced=3...).
    const discPack = game.packs.get("vtmlarp.disciplines");
    let discIndex = [];
    let folderByName = {};
    if (discPack) {
      discIndex = [...(await discPack.getIndex({ fields: ["type", "folder", "system.discipline", "system.level", "sort", "flags.vtmlarp.gmOnly"] }))]
        // Never auto-pull GM-only (unverified/hidden) powers onto a character.
        .filter(e => !(e.flags?.vtmlarp?.gmOnly && !game.user.isGM));
      (discPack.folders ?? []).forEach(f => { folderByName[f.name] = f.id; });
    }
    for (const r of this.#rows("discipline")) {
      if (!r.name) continue;
      items.push({ name: r.name, type: "discipline", img: "icons/svg/upgrade.svg", system: { rating: r.rating, description: `<p>${r.name}.</p>` } });
      // A Discipline's powers are learned IN ORDER, one per dot. Pull the core
      // powers (in this Discipline's main folder), sort them by level then their
      // sort/name so they're in progression order, and take the first `rating`
      // of them - so 3 dots gives the 1st, 2nd and 3rd powers, not every power
      // of every tier.
      const folderId = folderByName[r.name];
      const core = discIndex.filter(e => e.type === "power"
        && (folderId ? e.folder === folderId : e.system?.discipline === r.name));
      core.sort((a, b) =>
        (LEVEL_TIER[a.system?.level] ?? 9) - (LEVEL_TIER[b.system?.level] ?? 9)
        || (a.sort ?? 0) - (b.sort ?? 0)
        || a.name.localeCompare(b.name));
      const chosen = core.slice(0, Math.max(0, r.rating));
      const docs = await Promise.all(chosen.map(e => discPack.getDocument(e._id).catch(() => null)));
      for (const doc of docs) {
        if (doc) { const o = doc.toObject(); delete o._id; items.push(o); }
      }
    }
    for (const r of this.#rows("meritflaw")) {
      if (!r.name) continue;
      const isMerit = r.type === "merit";
      items.push({ name: r.name, type: isMerit ? "merit" : "flaw", img: isMerit ? "icons/svg/heal.svg" : "icons/svg/hazard.svg", system: isMerit ? { cost: r.cost } : { bonus: r.cost } });
    }

    // Stamp the current user as OWNER of the finished character, so whoever
    // ran the builder can immediately open and edit their own sheet (whether
    // they're a player or the Storyteller).
    const OWNER = CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
    const actorData = {
      name, type: "character",
      ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE, [game.user.id]: OWNER },
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
        creationDerangement: !!val("derangement"),
        derangements: val("derangement") ? [{ name: val("derangement"), description: "" }] : [],
        useOriginalRules: this.#orig()
      },
      items
    };

    // Players don't have the core "Create New Actors" permission by default, so
    // a direct Actor.create() would throw for them. Try it directly if allowed;
    // otherwise hand the assembled character off to an online Storyteller (GM)
    // via socket, who creates it and leaves this user flagged as the owner.
    const canCreate = game.user.isGM
      || (game.user.can?.("ACTOR_CREATE") ?? game.user.hasPermission?.("ACTOR_CREATE") ?? false);

    let actor = null;
    if (canCreate) {
      try { actor = await Actor.create(actorData); }
      catch (err) { console.error("vtmlarp | character-builder create failed", err); }
    }

    if (actor) {
      ui.notifications?.info(`Created ${name} with ${items.length} item(s).`);
      this.close();
      actor.sheet?.render(true);
      return;
    }

    // Fall back to asking a Storyteller to create it.
    if (game.users.activeGM) {
      game.socket.emit("system.vtmlarp", { action: "createCharacter", actorData, requesterId: game.user.id });
      ui.notifications?.info(`Sent ${name} to the Storyteller to add — you'll be set as its owner.`);
      this.close();
    } else {
      ui.notifications?.error("Couldn't create the character: no Storyteller (GM) is online. Ask your ST to be online, or to grant you \"Create New Actors\" permission.");
    }
  }
}
