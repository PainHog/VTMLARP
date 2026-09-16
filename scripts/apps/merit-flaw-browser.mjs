const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

const CATEGORIES = ["Physical", "Social", "Mental", "Supernatural"];

/**
 * A searchable, category-filtered browser for the Merits & Flaws compendium.
 * The pack holds 260+ entries with numeric-prefixed names, so drag-and-drop
 * alone is painful; this lists them with a live text search and a
 * Physical/Social/Mental/Supernatural dropdown, and an "Add" button drops the
 * chosen Merit or Flaw straight onto the character (preserving the compendium
 * link so its book icon still opens the source).
 */
export class MeritFlawBrowserApp extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(actor, options = {}) {
    super(options);
    this.actor = actor;
  }

  static DEFAULT_OPTIONS = {
    id: "vtmlarp-merit-flaw-browser",
    classes: ["vtmlarp", "sheet", "merit-flaw-browser"],
    position: { width: 540, height: 620 },
    window: { title: "VTMLARP.App.MeritFlawBrowser", resizable: true },
    actions: {
      add: MeritFlawBrowserApp.#onAdd,
      openSource: MeritFlawBrowserApp.#onOpenSource,
      clearSearch: MeritFlawBrowserApp.#onClearSearch
    }
  };

  static PARTS = { form: { template: "systems/vtmlarp/templates/apps/merit-flaw-browser.hbs" } };

  #query = "";
  #category = "";   // "" = all categories
  #kind = "";       // "" = both, else "merit" | "flaw"
  #catalog = null;  // cached full list (built once), so search can hit descriptions

  /** Strip the "NN — " ordering prefix the pack uses for display. */
  static #cleanName(name) {
    return String(name ?? "").replace(/^\s*\d+\s*[—-]\s*/, "").trim() || name;
  }

  /** Build the searchable catalog once: name, category, value, and the plain-text
   * description, so search can match keywords/partial input in the RULES TEXT,
   * not just the title. Cached on the instance (260-ish entries loaded once). */
  async #buildCatalog() {
    const pack = game.packs?.get("vtmlarp.merits-flaws");
    if (!pack) return [];
    const index = await pack.getIndex({ fields: ["type", "system.category", "system.cost", "system.bonus", "system.description"] });
    return [...index]
      .filter(e => e.type === "merit" || e.type === "flaw")
      .map(e => {
        const name = MeritFlawBrowserApp.#cleanName(e.name);
        const descText = String(e.system?.description ?? "").replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/g, " ").toLowerCase();
        return {
          id: e._id,
          uuid: `Compendium.vtmlarp.merits-flaws.${e._id}`,
          name,
          type: e.type,
          isMerit: e.type === "merit",
          category: e.system?.category ?? "",
          value: e.type === "merit" ? (Number(e.system?.cost) || 0) : (Number(e.system?.bonus) || 0),
          // Everything the search scans: name (both cleaned and raw), category, description.
          _search: `${name} ${e.name} ${e.system?.category ?? ""} ${descText}`.toLowerCase()
        };
      });
  }

  async #entries() {
    if (!this.#catalog) this.#catalog = await this.#buildCatalog();
    // Every whitespace-separated term must appear somewhere in the row's text,
    // so "gift blood" matches an entry mentioning both, and partial words work.
    const terms = this.#query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return this.#catalog
      .filter(e => !this.#kind || e.type === this.#kind)
      .filter(e => !this.#category || e.category === this.#category)
      .filter(e => terms.every(t => e._search.includes(t)))
      .sort((a, b) => (a.category || "").localeCompare(b.category || "") || a.value - b.value || a.name.localeCompare(b.name));
  }

  /** @override */
  async _prepareContext() {
    const list = await this.#entries();
    return {
      actorName: this.actor?.name ?? "",
      query: this.#query,
      hasQuery: !!this.#query.trim(),
      category: this.#category,
      kind: this.#kind,
      categories: CATEGORIES,
      count: list.length,
      list
    };
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    const search = this.element.querySelector('input[name="mf-search"]');
    if (search) {
      search.addEventListener("input", ev => { this.#query = ev.target.value; this.render(); });
      const end = search.value.length;
      search.focus();
      search.setSelectionRange?.(end, end);
    }
    this.element.querySelector('select[name="mf-category"]')?.addEventListener("change", ev => {
      this.#category = ev.target.value; this.render();
    });
    this.element.querySelector('select[name="mf-kind"]')?.addEventListener("change", ev => {
      this.#kind = ev.target.value; this.render();
    });
  }

  static async #onAdd(event, target) {
    if (!this.actor) return;
    const uuid = target.dataset.uuid;
    const src = uuid ? await fromUuid(uuid).catch(() => null) : null;
    if (!src) { ui.notifications?.warn("Couldn't load that entry."); return; }
    const data = src.toObject();
    // Preserve the compendium link so the sheet's book icon opens the source.
    data._stats = { ...(data._stats ?? {}), compendiumSource: src.uuid };
    try {
      await this.actor.createEmbeddedDocuments("Item", [data]);
      ui.notifications?.info(`Added ${MeritFlawBrowserApp.#cleanName(src.name)} to ${this.actor.name}.`);
    } catch (err) {
      console.error("VTMLARP | add merit/flaw failed", err);
      ui.notifications?.error(`Couldn't add that: ${err.message}`);
    }
  }

  static async #onOpenSource(event, target) {
    const src = target.dataset.uuid ? await fromUuid(target.dataset.uuid).catch(() => null) : null;
    if (src?.sheet) src.sheet.render(true);
    else ui.notifications?.warn("Couldn't open that entry.");
  }

  static #onClearSearch() { this.#query = ""; this.render(); }
}
