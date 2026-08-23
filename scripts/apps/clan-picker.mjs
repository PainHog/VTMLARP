import { CLANS, CLAN_DISCIPLINES } from "./clan-data.mjs";
import { CLAN_GUIDE, DISCIPLINE_BLURB, searchClans } from "./clan-guide.mjs";
import { CharacterBuilderApp } from "./character-builder.mjs";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

/**
 * "Help Me Pick a Clan" — a guided, click-through browser for new players. It
 * shows one clan at a time with a plain-English gist, its playstyle keywords,
 * and a one-line summary of each of its three Disciplines, so a player can flip
 * through the whole roster (or search "assassin", "artist", "necromancer"…) and
 * find the concept they want. A "Read full lore" button opens the real
 * compendium JournalEntry, and the alternate/bloodline versions are one search
 * away. Purely informational: it never edits a character or the rules.
 */
export class ClanPickerApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "vtmlarp-clan-picker",
    classes: ["vtmlarp", "sheet", "clan-picker"],
    position: { width: 560, height: 620 },
    window: { title: "Help Me Pick a Clan", resizable: true },
    actions: {
      prev: ClanPickerApp.#onPrev,
      next: ClanPickerApp.#onNext,
      jump: ClanPickerApp.#onJump,
      lore: ClanPickerApp.#onLore,
      discipline: ClanPickerApp.#onDiscipline,
      selectClan: ClanPickerApp.#onSelectClan,
      clearSearch: ClanPickerApp.#onClearSearch
    }
  };

  /** name -> compendium UUID for the Disciplines pack, built in _prepareContext
   * so the Discipline links open the right entry. */
  #discUuid = {};

  /** clan name -> book-sourced "About" blurb, extracted from the compendium
   * JournalEntry (cached; null means "looked, none found"). */
  #aboutCache = {};

  /**
   * Pull the clan's own description straight from its compendium lore entry so
   * the "About" text is the book's, not hand-written. Takes the first real
   * descriptive paragraph (skipping the Sect/Disciplines/Advantage label lines),
   * strips HTML and @UUID enricher links, and trims to the first two sentences.
   * Returns null if the clan has no dedicated lore entry (caller falls back).
   */
  async #bookAbout(name) {
    if (name in this.#aboutCache) return this.#aboutCache[name];
    let result = null;
    for (const pn of ["clans", "antitribu", "revenants"]) {
      const pack = game.packs?.get(`vtmlarp.${pn}`);
      if (!pack) continue;
      const entry = (await pack.getIndex()).find(e => e.name === name);
      if (!entry) continue;
      const doc = await pack.getDocument(entry._id);
      const html = (doc?.pages?.contents ?? []).map(p => p.text?.content ?? "").join("\n");
      result = ClanPickerApp.#extractAbout(html);
      break;
    }
    this.#aboutCache[name] = result;
    return result;
  }

  static #LABEL_RE = /^(Sect|Disciplines?|Advantage|Advantages|Disadvantage|Weakness|Organization|Bloodline|Nickname|Appearance|Haven|Background|Quote|Sobriquet)\b/i;

  static #extractAbout(html) {
    if (!html) return null;
    const paras = [...String(html).matchAll(/<p>(.*?)<\/p>/gis)].map(m => m[1]);
    for (const p of paras) {
      // Strip @UUID[...]{Label} -> Label, then any remaining tags/entities.
      const txt = p
        .replace(/@UUID\[[^\]]+\]\{([^}]+)\}/g, "$1")
        .replace(/@UUID\[[^\]]+\]/g, "")
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&").replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (txt.length < 40 || ClanPickerApp.#LABEL_RE.test(txt)) continue;
      // Keep the first one or two sentences.
      const sentences = txt.match(/[^.!?]+[.!?]+/g);
      if (sentences && sentences.length > 2) return sentences.slice(0, 2).join(" ").trim();
      return txt;
    }
    return null;
  }

  static PARTS = { form: { template: "systems/vtmlarp/templates/apps/clan-picker.hbs" } };

  /** Current search text and the index (into the filtered list) being shown. */
  #query = "";
  #index = 0;

  /** The clans matching the current search, best-match first (all clans if no search). */
  #results() {
    const list = searchClans(this.#query, CLANS);
    return list.length ? list : CLANS;
  }

  /** Build the Discipline-name -> compendium UUID lookup once. */
  async #ensureDiscUuid() {
    if (Object.keys(this.#discUuid).length) return;
    const pack = game.packs?.get("vtmlarp.disciplines");
    if (!pack) return;
    for (const e of await pack.getIndex()) {
      const uuid = e.uuid ?? pack.getUuid?.(e._id) ?? `Compendium.vtmlarp.disciplines.${e._id}`;
      // Base Disciplines only (skip powers/paths, which carry ( or — in the name).
      if (!/[(—]/.test(e.name) && !(e.name in this.#discUuid)) this.#discUuid[e.name] = uuid;
    }
  }

  async _prepareContext() {
    await this.#ensureDiscUuid();
    const results = this.#results();
    if (this.#index >= results.length) this.#index = 0;
    const name = results[this.#index];
    const guide = CLAN_GUIDE[name] ?? {};
    const disciplines = (CLAN_DISCIPLINES[name] ?? []).map(d => ({
      name: d,
      blurb: DISCIPLINE_BLURB[d] ?? "",
      uuid: this.#discUuid[d] ?? ""
    }));

    // Compact list for the "jump to any clan" rail.
    const list = results.map((n, i) => ({
      name: n,
      nickname: CLAN_GUIDE[n]?.nickname ?? "",
      active: i === this.#index,
      core: !!CLAN_GUIDE[n]?.core
    }));

    return {
      query: this.#query,
      hasQuery: !!this.#query.trim(),
      count: results.length,
      total: CLANS.length,
      position: this.#index + 1,
      clan: {
        name,
        nickname: guide.nickname ?? "",
        blurb: (await this.#bookAbout(name)) || guide.blurb || "",
        tags: guide.tags ?? [],
        clanless: !(CLAN_DISCIPLINES[name] ?? []).length,
        disciplines
      },
      list
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const search = this.element.querySelector('input[name="clan-search"]');
    if (search) {
      // Live-filter as the player types; keep focus/caret across the re-render.
      search.addEventListener("input", ev => {
        this.#query = ev.target.value;
        this.#index = 0;
        this.render();
      });
      const el = search;
      const end = el.value.length;
      el.focus();
      el.setSelectionRange?.(end, end);
    }
  }

  static #onPrev() {
    const n = this.#results().length;
    this.#index = (this.#index - 1 + n) % n;
    this.render();
  }

  static #onNext() {
    const n = this.#results().length;
    this.#index = (this.#index + 1) % n;
    this.render();
  }

  static #onJump(event, target) {
    const i = Number(target.dataset.index);
    if (Number.isFinite(i)) { this.#index = i; this.render(); }
  }

  static #onClearSearch() {
    this.#query = "";
    this.#index = 0;
    this.render();
  }

  /** Open a Discipline's compendium entry from a clan card link. */
  static async #onDiscipline(event, target) {
    const uuid = target.dataset.uuid;
    if (!uuid) { ui.notifications?.info("No compendium entry linked for that Discipline."); return; }
    const doc = await fromUuid(uuid).catch(() => null);
    if (doc?.sheet) doc.sheet.render(true);
    else ui.notifications?.warn("Couldn't open that Discipline entry.");
  }

  /** Send the player to the Character Builder with this clan pre-selected. */
  static #onSelectClan(event, target) {
    const clan = target.dataset.name;
    if (!clan) return;
    new CharacterBuilderApp({ clan }).render(true);
    this.close();
  }

  /** Open the full compendium lore entry for the shown clan, falling back across
   * the clans/antitribu/revenants JournalEntry packs (same as the sheet). */
  static async #onLore(event, target) {
    const name = target.dataset.name;
    if (!name) return;
    for (const pn of ["clans", "antitribu", "revenants"]) {
      const pack = game.packs.get(`vtmlarp.${pn}`);
      if (!pack) continue;
      const entry = (await pack.getIndex()).find(e => e.name === name);
      if (entry) {
        const doc = await pack.getDocument(entry._id);
        doc.sheet?.render(true);
        return;
      }
    }
    ui.notifications?.info(`No separate lore entry for "${name}" yet — check the Clans & Bloodlines compendiums.`);
  }
}
