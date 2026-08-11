import { ChallengeApp } from "../apps/challenge.mjs";
import { FrenzyApp } from "../apps/frenzy.mjs";
import { VaulderieApp } from "../apps/vaulderie.mjs";
import { checkPrerequisites } from "../apps/prerequisites.mjs";
import { logAction } from "../apps/action-log.mjs";
import { SessionLogApp } from "../apps/session-log.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

const CREATABLE_TYPES = {
  discipline: "Discipline", power: "Power", background: "Background",
  merit: "Merit", flaw: "Flaw", ritual: "Ritual", gear: "Gear"
};

// Creating an Item with no img set lets Foundry core assign one of its own
// randomized default icons, and not every one of those actually exists on
// every server (a self-hosted install may not have the full core icon set) -
// several 404'd (silhouette-evil-horned-summon.webp, wave-blue.webp,
// quill-ink-white.webp) the moment a player quick-created a Background.
// Pinning an explicit default per type, from the same icons/svg/* set
// already verified safe elsewhere in this compendium, avoids depending on
// which decorative icons happen to be present on a given install.
const DEFAULT_ITEM_ICONS = {
  discipline: "icons/svg/upgrade.svg",
  power: "icons/svg/lightning.svg",
  background: "icons/svg/house.svg",
  merit: "icons/svg/heal.svg",
  flaw: "icons/svg/hazard.svg",
  ritual: "icons/svg/book.svg",
  gear: "icons/svg/item-bag.svg"
};

// Basic/Intermediate/Advanced/Elder power tiers map 1:1 to a Discipline's
// rating (Basic power present -> rating 1, Advanced -> rating 3, etc.), so
// this doubles as both the sort order for powers under a Discipline and the
// minimum rating a Discipline should auto-bump to once a given tier is
// dragged in.
const LEVEL_ORDER = { basic: 0, intermediate: 1, advanced: 2, elder: 3 };

const HEALTH_LEVELS = ["bruised", "hurt", "injured", "wounded", "mauled", "crippled", "incapacitated"];
const DAMAGE_CYCLE = ["ok", "bashing", "lethal", "aggravated"];

const TAB_DEFS = [
  { id: "main", label: "Main" },
  { id: "attributes", label: "Attributes" },
  { id: "abilities", label: "Abilities" },
  { id: "powers", label: "Disciplines & Powers" },
  { id: "backgrounds", label: "Backgrounds" },
  { id: "meritsflaws", label: "Merits & Flaws" },
  { id: "gear", label: "Gear" },
  { id: "social", label: "Social" },
  { id: "bio", label: "Biography" }
];

const CLAN_OPTIONS = [
  // The 13 core clans
  "Assamite", "Brujah", "Followers of Set", "Gangrel", "Giovanni", "Lasombra",
  "Malkavian", "Nosferatu", "Ravnos", "Toreador", "Tremere", "Tzimisce", "Ventrue",
  // Rare/independent clans with their own clanbooks in this system
  "Baali", "Cappadocian", "Salubri",
  // Bloodlines with dedicated compendium content (packs/antitribu)
  "Blood Brothers", "Harbingers of Skulls", "Kiasyd", "Panders",
  // Other canonical bloodlines (categorization only for now - no dedicated
  // Discipline/mechanics content built yet)
  "Gargoyle", "Daughters of Cacophony", "True Brujah", "Nagaraja", "Samedi", "Lamia",
  "Caitiff"
];

const SECT_OPTIONS = [
  "Camarilla", "Sabbat", "Anarch Movement", "Independent Alliance", "Inconnu", "Ashirra"
];

// Sect lore built from the Camarilla Guide/Sabbat Guide/Anarchs Guide.
// Independent Alliance, Inconnu, and Ashirra have no dedicated sourcebook in
// this system yet, so those three are left unmapped rather than guessing.
const SECT_LORE_LOOKUP = {
  "Camarilla": { pack: "sects", name: "Camarilla" },
  "Sabbat": { pack: "sects", name: "Sabbat" },
  "Anarch Movement": { pack: "sects", name: "Anarch Movement" }
};

// Maps a Clan/Bloodline dropdown value to the JournalEntry that actually
// covers it, since clan lore isn't consistently one-pack-one-entry-per-clan
// (most live in "clans" as a bare-named overview entry alongside many
// differently-titled sub-topic entries; a few bloodlines instead live in
// "antitribu").
const CLAN_LORE_LOOKUP = {
  "Assamite": { pack: "clans", name: "Assamite" },
  "Brujah": { pack: "clans", name: "Brujah" },
  "Followers of Set": { pack: "clans", name: "Followers of Set" },
  "Gangrel": { pack: "clans", name: "Gangrel" },
  "Giovanni": { pack: "clans", name: "Giovanni" },
  "Lasombra": { pack: "clans", name: "Lasombra" },
  "Malkavian": { pack: "clans", name: "Malkavian" },
  "Nosferatu": { pack: "clans", name: "Nosferatu" },
  "Ravnos": { pack: "clans", name: "Ravnos" },
  "Toreador": { pack: "clans", name: "Toreador" },
  "Tremere": { pack: "clans", name: "Tremere" },
  "Tzimisce": { pack: "clans", name: "Tzimisce" },
  "Ventrue": { pack: "clans", name: "Ventrue" },
  "Baali": { pack: "clans", name: "Baali" },
  "Cappadocian": { pack: "clans", name: "Cappadocian (Dark Ages)" },
  "Salubri": { pack: "clans", name: "Salubri" },
  "Blood Brothers": { pack: "antitribu", name: "Blood Brothers" },
  "Harbingers of Skulls": { pack: "antitribu", name: "Harbingers of Skulls" },
  "Kiasyd": { pack: "antitribu", name: "Kiasyd" },
  "Panders": { pack: "antitribu", name: "Panders" },
  "Gargoyle": { pack: "clans", name: "Gargoyles" },
  "Daughters of Cacophony": { pack: "clans", name: "Daughters of Cacophony" },
  "True Brujah": { pack: "clans", name: "True Brujah" },
  "Nagaraja": { pack: "clans", name: "Nagaraja" },
  "Samedi": { pack: "clans", name: "Samedi" },
  "Lamia": { pack: "clans", name: "Lamia (Dark Ages)" },
  "Caitiff": { pack: "clans", name: "Caitiff" }
};

const GENERATION_OPTIONS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

const ARCHETYPE_OPTIONS = [
  "Architect", "Autocrat", "Bon Vivant", "Bravo", "Caregiver", "Cavalier",
  "Celebrant", "Conformist", "Conniver", "Curmudgeon", "Deviant", "Director",
  "Fanatic", "Gallant", "Judge", "Loner", "Martyr", "Masochist", "Monster",
  "Pedagogue", "Perfectionist", "Rebel", "Rogue", "Survivor", "Thrill-Seeker",
  "Traditionalist", "Trickster", "Visionary"
];

const PATH_OPTIONS = [
  "Path of Humanity", "Path of Blood (Assamite)", "Path of Caine", "Path of Cathari",
  "Path of Death and the Soul", "Path of Ecstasy", "Path of Evil Revelations",
  "Path of Harmony", "Path of Honorable Accord", "Path of Lilith",
  "Path of Night: Variants (Lasombra)", "Path of Night",
  "Mayaparisatya: The Path of Paradox (True)", "Path of Paradox (Ravnos)",
  "Path of Power and the Inner Voice", "Path of the Feral Heart", "Path of the Warrior",
  "Path of Typhon (Setite)", "Road of the Beast (Dark Ages)", "Road of Heaven (Dark Ages)",
  "Road of Humanity (Dark Ages)", "Road of Kings (Dark Ages)", "Road of Sin (Dark Ages)",
  "Road of the Bones (Dark Ages)", "Road of the Hive (Dark Ages, Baali)"
];

// The Generation chart from Laws of the Night Revised (Character Creation and
// Traits, p. 95): Max. Traits (in your primary Attribute category), Max.
// Abilities (highest level in any one Ability), Blood Pool max/per-turn spend,
// and starting/max Willpower. Only 5th-13th generation are included - lower
// generations are vanishingly rare for MET player characters, and the
// scanned sourcebook table's column alignment becomes unreliable below 5th,
// so those rows are left for Storyteller judgment rather than risking wrong
// numbers.
const GENERATION_TABLE = {
  13: { maxTraits: 10, maxAbilities: 5, bloodMax: 10, bloodPerTurn: 1, willpowerStart: 2, willpowerMax: 6 },
  12: { maxTraits: 10, maxAbilities: 5, bloodMax: 11, bloodPerTurn: 1, willpowerStart: 2, willpowerMax: 8 },
  11: { maxTraits: 11, maxAbilities: 5, bloodMax: 12, bloodPerTurn: 1, willpowerStart: 4, willpowerMax: 8 },
  10: { maxTraits: 12, maxAbilities: 5, bloodMax: 13, bloodPerTurn: 1, willpowerStart: 4, willpowerMax: 10 },
  9: { maxTraits: 13, maxAbilities: 5, bloodMax: 14, bloodPerTurn: 2, willpowerStart: 6, willpowerMax: 10 },
  8: { maxTraits: 14, maxAbilities: 5, bloodMax: 15, bloodPerTurn: 3, willpowerStart: 6, willpowerMax: 12 },
  7: { maxTraits: 16, maxAbilities: 6, bloodMax: 20, bloodPerTurn: 5, willpowerStart: 7, willpowerMax: 14 },
  6: { maxTraits: 18, maxAbilities: 7, bloodMax: 30, bloodPerTurn: 6, willpowerStart: 8, willpowerMax: 16 },
  5: { maxTraits: 20, maxAbilities: 8, bloodMax: 40, bloodPerTurn: 8, willpowerStart: 9, willpowerMax: 18 }
};

const SIMPLE_LIST_DEFAULTS = {
  derangements: { name: "", description: "" },
  bloodBonds: { name: "", level: 1, notes: "" },
  boons: { who: "", type: "minor", direction: "owed", notes: "" }
};

/**
 * ApplicationV2 action handler for the portrait <img data-action="editImage">.
 * `this` is the sheet instance. Opens a FilePicker and writes the chosen image
 * directly to the actor (and its prototype token) via actor.update, so it
 * persists regardless of the form's submit configuration. The core editImage
 * handler relied on form submission, which is disabled on this sheet, so the
 * picked portrait silently never saved.
 */
async function onEditImage(event, target) {
  const attr = target?.dataset?.edit ?? "img";
  const current = foundry.utils.getProperty(this.actor, attr) ?? this.actor.img;
  // FilePicker moved under foundry.applications.apps in v13; fall back to the
  // still-present global on v12.
  const FP = foundry.applications?.apps?.FilePicker?.implementation
    ?? foundry.applications?.apps?.FilePicker
    ?? FilePicker;
  const picker = new FP({
    type: "image",
    current,
    callback: async (path) => {
      const update = { [attr]: path };
      // Mirror the portrait onto the prototype token when the token is still
      // using the default/blank art, so dropping the actor on a scene shows
      // the picture instead of the mystery-man silhouette. If the token already
      // has its own distinct image, leave it alone.
      if (attr === "img") {
        const tokenSrc = this.actor.prototypeToken?.texture?.src;
        const DEFAULTS = ["icons/svg/mystery-man.svg", "", null, undefined];
        if (DEFAULTS.includes(tokenSrc)) update["prototypeToken.texture.src"] = path;
      }
      await this.actor.update(update);
    },
    top: (this.position?.top ?? 0) + 40,
    left: (this.position?.left ?? 0) + 10
  });
  return picker.browse();
}

export class VTMActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  // Tracks which collapsible sections (attribute/ability categories,
  // discipline groups) are currently collapsed, keyed by their
  // data-collapse-key. Kept on the instance rather than in actor data so it
  // survives re-renders without writing UI state into the document.
  #collapsedKeys = new Set();

  static DEFAULT_OPTIONS = {
    classes: ["vtmlarp", "sheet", "actor"],
    position: { width: 960, height: 880 },
    window: { resizable: true },
    // submitOnChange is deliberately OFF: Foundry's built-in form auto-submit
    // was confirmed (via console logging) to NOT actually persist on this
    // table's hosting - selecting a Clan left system.clan "" across every
    // subsequent render. Saving is done explicitly by _onFieldChange below,
    // which is the SOLE write path for plain named fields, so there are no
    // dueling concurrent actor.update() calls (the earlier cause of text/
    // array data loss during character creation).
    form: { submitOnChange: false },
    // Own the portrait-image action rather than inheriting the core one: the
    // core handler routes the new path through form submission (which is off
    // here), so on this setup the picked image never actually persisted. Our
    // handler writes it straight to the document, and also mirrors it onto the
    // prototype token so it shows up when the actor is dropped on a scene.
    actions: { editImage: onEditImage }
  };

  static PARTS = {
    form: { template: "systems/vtmlarp/templates/actor/character-sheet.hbs" }
  };

  static TABS = {
    primary: {
      tabs: TAB_DEFS.map(({ id }) => ({ id })),
      initial: "main"
    }
  };

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.actor = this.actor;
    context.system = this.actor.system;
    context.owner = this.actor.isOwner;
    // The root <form> template tag is `class="{{cssClass}} flexcol"` - this
    // was only ever "editable"/"locked", never actually including
    // "vtmlarp sheet actor" at all. ApplicationV2 only applies
    // DEFAULT_OPTIONS.classes to the outer .application window element, not
    // to this inner <form>, so every CSS rule requiring .vtmlarp/.sheet on
    // this specific element - `.window-content:has(.vtmlarp.sheet)`,
    // `form.vtmlarp.sheet {...}` - silently never matched. That's the actual
    // root cause of the sheet never getting a bounded, scrollable body:
    // not a missing scrollbar style, but this element never carrying the
    // classes those styles were scoped to in the first place.
    context.cssClass = `vtmlarp sheet actor ${this.isEditable ? "editable" : "locked"}`;
    const sys = context.system;

    const active = this.tabGroups.primary ?? "main";
    context.tabs = {};
    for (const { id, label } of TAB_DEFS) {
      context.tabs[id] = { id, group: "primary", label, active: active === id };
    }

    // Bonus Health Levels (e.g. from basic Fortitude) act as extra "Healthy"
    // boxes ahead of the fixed 7-level track, per the rulebook.
    const bonusLevels = (sys.bonusHealth ?? []).map((state, i) => ({
      key: `bonus-${i}`, label: "Healthy", state, bonus: true, bonusIndex: i
    }));
    const fixedLevels = HEALTH_LEVELS.map(level => ({
      key: level,
      label: level.charAt(0).toUpperCase() + level.slice(1),
      state: sys.health[level],
      bonus: false
    }));
    context.healthLevels = [...bonusLevels, ...fixedLevels];

    context.itemsByType = {};
    for (const item of this.actor.items) {
      (context.itemsByType[item.type] ??= []).push(item);
    }

    const allPowerItems = context.itemsByType.power ?? [];

    const disciplineItems = context.itemsByType.discipline ?? [];
    context.powerPrereqStatus = {};
    for (const power of allPowerItems) {
      if (!power.system.prerequisites) continue;
      context.powerPrereqStatus[power.id] = checkPrerequisites(power.system.prerequisites, disciplineItems);
    }

    // Group each dragged-in Discipline with its own Powers, sorted Basic ->
    // Intermediate -> Advanced -> Elder, so a Discipline's levels stack
    // directly beneath it instead of living in an entirely separate list a
    // player has to cross-reference by name. A Power whose system.discipline
    // string doesn't exactly match any Discipline the actor actually has
    // (combination Discipline prerequisite tags like "Auspex, Celerity", or
    // a power dragged in before its parent Discipline was) falls back to an
    // "Other Powers" bucket rather than being silently dropped.
    const sortByLevel = (a, b) => (LEVEL_ORDER[a.system.level] ?? 99) - (LEVEL_ORDER[b.system.level] ?? 99);
    const remainingPowers = new Set(allPowerItems);
    context.disciplineGroups = disciplineItems.map(discipline => {
      const powers = allPowerItems.filter(p => p.system.discipline === discipline.name);
      for (const p of powers) remainingPowers.delete(p);
      return { discipline, powers: powers.sort(sortByLevel) };
    });
    context.otherPowers = [...remainingPowers].sort(sortByLevel);

    context.isCharacter = this.actor.type === "character";
    context.isGM = game.user.isGM;
    context.xpSpent = Math.max(0, (sys.experience.total ?? 0) - (sys.experience.value ?? 0));
    context.NPC_TYPE_OPTIONS = ["vampire", "ghoul", "mortal", "spirit", "other"];
    context.CLAN_OPTIONS = CLAN_OPTIONS;
    context.SECT_OPTIONS = SECT_OPTIONS;
    context.GENERATION_OPTIONS = GENERATION_OPTIONS;
    context.ARCHETYPE_OPTIONS = ARCHETYPE_OPTIONS;
    // Always include the actor's current Path, even if it predates this list
    // or is a homebrew Path, so the dropdown never silently swaps it out.
    context.PATH_OPTIONS = PATH_OPTIONS.includes(sys.morality.path)
      ? PATH_OPTIONS : [sys.morality.path, ...PATH_OPTIONS].filter(Boolean);
    context.generationInfo = GENERATION_TABLE[sys.generation] ?? null;

    // Lore-linking buttons next to Clan/Sect dropdowns. These are always
    // rendered (rather than conditionally, per an earlier attempt that still
    // didn't actually show up for the player even with a valid Clan/Sect
    // selected) - the button is a fixed part of the layout. With nothing
    // selected yet (or a value with no dedicated compendium entry), fall
    // back to the general "Character Creation" reference doc rather than a
    // dead/blank button - there's no single "Clans overview"/"Sects
    // overview" doc in this compendium, but Character Creation is where a
    // player actually picking one would look anyway.
    const CHARACTER_CREATION_ENTRY = { pack: "rules-reference", name: "Character Creation" };
    context.clanLoreEntry = sys.clan ? (CLAN_LORE_LOOKUP[sys.clan] ?? { pack: "clans", name: sys.clan }) : CHARACTER_CREATION_ENTRY;
    context.sectLoreEntry = sys.sect ? (SECT_LORE_LOOKUP[sys.sect] ?? { pack: "sects", name: sys.sect }) : CHARACTER_CREATION_ENTRY;
    context.pathLoreEntry = sys.morality.path ? { pack: "paths-of-enlightenment", name: sys.morality.path } : CHARACTER_CREATION_ENTRY;
    // Nature and Demeanor both draw from the same shared "Nature and Demeanor
    // Archetypes" reference doc regardless of whether a value is picked yet
    // (no per-archetype documents exist), and the Virtues (Conscience/
    // Conviction, Self-Control/Instinct, Courage) all point to the same
    // shared Virtues reference doc.
    context.archetypeLoreEntry = { pack: "rules-reference", name: "Nature and Demeanor Archetypes" };
    context.virtuesLoreEntry = { pack: "rules-reference", name: "Virtues" };
    return context;
  }

  /**
   * ApplicationV2's built-in tab-switch handler recalculates the window's
   * height to fit whichever tab is now showing (updatePosition defaults to
   * true), which visibly resizes and repositions the whole window every
   * time a tab is clicked - jarring on a sheet with 8 tabs of very different
   * lengths (Main vs. Biography). Keep the sheet's own fixed size instead.
   * @override
   */
  changeTab(tab, group, options = {}) {
    return super.changeTab(tab, group, { ...options, updatePosition: false });
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);

    // Two prior CSS-selector attempts at forcing .window-content into a
    // bounded, scrollable flex column did not actually take effect (data
    // confirmed correct via console logging, but content stayed invisible
    // below the fold) - rather than guess at another selector, set this
    // directly via JS on ApplicationV2's own documented `this.window.content`
    // element, which removes any dependency on CSS specificity, selector
    // support, or cascade ordering assumptions.
    if (this.window?.content) {
      this.window.content.style.display = "flex";
      this.window.content.style.flexDirection = "column";
      this.window.content.style.overflow = "hidden";
    }

    const el = this.element;
    const on = (selector, event, handler) => {
      el.querySelectorAll(selector).forEach(node => node.addEventListener(event, handler));
    };

    // Select the whole existing value when a number/text field gains focus,
    // so a player can just click a total (Physical, Mental, Willpower, Blood,
    // etc.) and type the new number straight over it instead of having to
    // clear it out first. `focusin` (delegated on the root) rather than a
    // per-node `focus` listener so it also covers fields added after render.
    el.addEventListener("focusin", (event) => {
      const t = event.target;
      if (t?.matches?.("input[type='number'], input[type='text']")) t.select();
    });

    // Available to everyone (not just owners with edit rights) - opening a
    // lore entry to read isn't an edit.
    on(".open-lore", "click", this._onOpenLore.bind(this));
    on(".open-source", "click", this._onOpenSource.bind(this));
    on(".open-power-discipline-lore", "click", this._onOpenPowerDisciplineLore.bind(this));
    // Collapse/expand is local UI state, not a document edit, so it should
    // work even for players/observers without edit rights on this actor.
    on(".collapsible-header", "click", this._onToggleCollapse.bind(this));
    on(".open-session-log", "click", () => new SessionLogApp(this.actor).render(true));

    if (!this.isEditable) return;

    on(".trait-toggle", "click", this._onToggleTrait.bind(this));
    on(".trait-add", "click", this._onAddTrait.bind(this));
    on(".trait-delete", "click", this._onDeleteTrait.bind(this));
    on(".health-box", "click", this._onCycleHealth.bind(this));
    on(".health-level-add", "click", this._onAddHealthLevel.bind(this));
    on(".health-level-remove", "click", this._onRemoveHealthLevel.bind(this));
    on(".item-edit", "click", this._onItemEdit.bind(this));
    // Clicking the item's name itself also opens its sheet, so players can
    // read a Discipline/Power's full text without hunting for the small
    // pencil icon separately.
    on(".item-name", "click", this._onItemEdit.bind(this));
    on(".item-delete", "click", this._onItemDelete.bind(this));
    on(".rated-trait-control", "click", this._onRatedTraitControl.bind(this));
    on(".open-challenge", "click", () => new ChallengeApp(this.actor).render(true));
    on(".open-frenzy", "click", () => new FrenzyApp(this.actor).render(true));
    on(".open-vaulderie", "click", () => new VaulderieApp(this.actor).render(true));
    on(".power-toggle", "click", this._onTogglePower.bind(this));
    on(".power-use", "click", this._onUsePower.bind(this));
    on(".power-challenge", "click", this._onInitiatePowerChallenge.bind(this));
    on(".item-create", "click", this._onItemCreate.bind(this));
    on(".simple-list-add", "click", this._onSimpleListAdd.bind(this));
    on(".simple-list-remove", "click", this._onSimpleListRemove.bind(this));
    on(".apply-generation", "click", this._onApplyGeneration.bind(this));
    on(".award-xp", "click", this._onAwardXP.bind(this));
    on(".item-rating-control", "click", this._onItemRatingControl.bind(this));

    // Explicit save for every plain named <input>/<select>/<textarea> - the
    // actor name field plus all system.* fields (Clan, Sect, Bloodline,
    // Nature, Demeanor, Generation, Path, Willpower/Blood pools, ability/
    // background specialization names, biography textareas, etc.). This is
    // the sole write path for these fields since submitOnChange is off (see
    // DEFAULT_OPTIONS) - Foundry's built-in auto-submit does not persist on
    // this hosting. Controls with their own dedicated handlers above (trait
    // dots, health boxes, item rating steppers) are clicks/anchors, not
    // named form inputs, so they never double-fire this.
    on("input[name], select[name], textarea[name], prose-mirror[name]", "change", this._onFieldChange.bind(this));

    // ApplicationV2 doesn't auto-wire a "dragDrop" static option into actual
    // drag/drop event listeners the way V1's FormApplication did (that
    // binding lived in FormApplication.activateListeners, which no longer
    // runs) - the underlying _onDragStart/_onDrop/_onDropItemCreate pipeline
    // is still inherited from ActorSheetV2, but something has to actually
    // attach it to the DOM on every render.
    new foundry.applications.ux.DragDrop.implementation({
      dragSelector: ".item-list .item",
      dropSelector: null,
      permissions: {
        dragstart: () => this.isEditable,
        drop: () => this.isEditable
      },
      callbacks: {
        dragstart: this._onDragStart.bind(this),
        drop: this._onDrop.bind(this)
      }
    }).bind(this.element);

    // Re-apply whichever sections the user previously collapsed, since a
    // fresh render rebuilds the DOM from scratch and would otherwise forget.
    el.querySelectorAll(".collapsible").forEach(node => {
      const key = node.dataset.collapseKey;
      if (key && this.#collapsedKeys.has(key)) node.classList.add("collapsed");
    });
  }

  /**
   * Explicit save for any plain named <input>/<select>/<textarea> with no
   * other dedicated handler (actor name, Clan, Sect, Nature, Demeanor,
   * Generation, Path, Willpower/Blood pools, specialization/name text
   * fields, biography, etc.). This is the sole write path for these fields
   * (submitOnChange is off), so it never races another actor.update().
   */
  async _onFieldChange(event) {
    const el = event.currentTarget;
    if (el.disabled || el.readOnly) return;
    let value = el.value;
    if (el.type === "checkbox") value = el.checked;
    else if (el.type === "number") value = value === "" ? null : Number(value);
    await this.actor.update({ [el.name]: value });
  }

  /** Toggle a collapsible section (attribute/ability category, discipline group) open/closed. */
  _onToggleCollapse(event) {
    // Ignore clicks on nested action buttons (edit/delete/add-trait/etc.) or
    // form inputs (e.g. the category Total field) inside the header, so
    // toggling collapse doesn't fight with those.
    if (event.target.closest("a, input, select, label")) return;
    const container = event.currentTarget.closest(".collapsible");
    if (!container) return;
    const key = container.dataset.collapseKey;
    const collapsed = container.classList.toggle("collapsed");
    if (!key) return;
    if (collapsed) this.#collapsedKeys.add(key);
    else this.#collapsedKeys.delete(key);
  }

  /**
   * Open the original compendium document a dragged-in Item came from
   * (Discipline, Merit, Flaw, Background), using the UUID Foundry itself
   * stamps onto _stats.compendiumSource when an Item is imported from a
   * compendium - a read-only view of the source, since the embedded copy on
   * the actor is what's actually being played.
   */
  async _onOpenSource(event) {
    event.preventDefault();
    const uuid = event.currentTarget.dataset.uuid;
    if (!uuid) return;
    const doc = await fromUuid(uuid);
    if (!doc) {
      ui.notifications?.warn("Couldn't find the original compendium entry for this item.");
      return;
    }
    doc.sheet.render(true);
  }

  /**
   * Open a parent Discipline's own compendium container from a Power's
   * inline lore link - a Combination Discipline's discipline field lists
   * every Discipline it draws on (see vtmParseDisciplineNames), so this
   * looks up by that individual name in the Disciplines & Powers
   * compendium rather than assuming a 1:1 match to the clicked Power.
   */
  async _onOpenPowerDisciplineLore(event) {
    event.preventDefault();
    const name = event.currentTarget.dataset.name;
    const pack = game.packs.get("vtmlarp.disciplines");
    if (!pack) return;
    const index = await pack.getIndex();
    const entry = index.find(e => e.name === name && e.type === "discipline");
    if (!entry) {
      ui.notifications?.warn(`No Discipline compendium entry found for "${name}".`);
      return;
    }
    const doc = await pack.getDocument(entry._id);
    doc.sheet.render(true);
  }

  /** Open the compendium JournalEntry backing a Clan/Path lore link button. */
  async _onOpenLore(event) {
    event.preventDefault();
    const { pack: packName, name } = event.currentTarget.dataset;
    if (!name) {
      ui.notifications?.warn("Select a value first to open its lore entry.");
      return;
    }
    const pack = game.packs.get(`vtmlarp.${packName}`);
    if (!pack) {
      ui.notifications?.warn(`Compendium "${packName}" not found.`);
      return;
    }
    const index = await pack.getIndex();
    const entry = index.find(e => e.name === name);
    if (!entry) {
      ui.notifications?.warn(`No compendium entry found for "${name}".`);
      return;
    }
    const doc = await pack.getDocument(entry._id);
    doc.sheet.render(true);
  }

  /** Add a blank entry to one of the plain object-array lists (Derangements, Blood Bonds, Boons). */
  async _onSimpleListAdd(event) {
    event.preventDefault();
    const { path } = event.currentTarget.dataset;
    const list = foundry.utils.getProperty(this.actor.system, path) ?? [];
    await this.actor.update({ [`system.${path}`]: [...list, { ...SIMPLE_LIST_DEFAULTS[path] }] });
  }

  async _onSimpleListRemove(event) {
    event.preventDefault();
    const { path, index } = event.currentTarget.dataset;
    const list = foundry.utils.getProperty(this.actor.system, path);
    const updated = list.filter((_, i) => i !== Number(index));
    await this.actor.update({ [`system.${path}`]: updated });
  }

  /**
   * Set Blood/Willpower max (and clamp current values down if they now
   * exceed the new max) from the Generation chart. Opt-in via a button
   * rather than automatic, since Storytellers may run a compressed Blood
   * Pool or otherwise deviate from the chart on purpose.
   */
  async _onApplyGeneration(event) {
    event.preventDefault();
    const info = GENERATION_TABLE[this.actor.system.generation];
    if (!info) {
      ui.notifications?.warn("No Generation chart data below 5th generation - set Blood/Willpower manually.");
      return;
    }
    const sys = this.actor.system;
    await this.actor.update({
      "system.blood.max": info.bloodMax,
      "system.blood.perTurn": info.bloodPerTurn,
      "system.blood.value": Math.min(sys.blood.value, info.bloodMax),
      "system.willpower.max": info.willpowerMax,
      "system.willpower.value": Math.min(sys.willpower.value, info.willpowerMax)
    });
  }

  /** GM-only: grant Experience, bumping both the current pool and the lifetime total the XP Audit view reads from. */
  async _onAwardXP(event) {
    event.preventDefault();
    const amount = await foundry.applications.api.DialogV2.prompt({
      window: { title: `Award Experience to ${this.actor.name}` },
      content: `<input type="number" name="amount" value="1" min="1" autofocus>`,
      ok: { callback: (e, btn) => Number(btn.form.elements.amount.value) || 0 }
    }).catch(() => null);
    if (!amount) return;
    const sys = this.actor.system;
    await this.actor.update({
      "system.experience.value": sys.experience.value + amount,
      "system.experience.total": (sys.experience.total ?? 0) + amount
    });
  }

  async _onToggleTrait(event) {
    event.preventDefault();
    const { path, index } = event.currentTarget.dataset;
    const list = foundry.utils.getProperty(this.actor.system, path);
    const updated = list.map((t, i) => i === Number(index) ? { ...t, spent: !t.spent } : t);
    await this.actor.update({ [`system.${path}`]: updated });
  }

  async _onAddTrait(event) {
    event.preventDefault();
    const { path } = event.currentTarget.dataset;
    const isAttributeCategory = path.startsWith("attributes.") && path.endsWith(".traits");
    const result = await foundry.applications.api.DialogV2.prompt({
      window: { title: "New Trait" },
      content: `<input type="text" name="trait" placeholder="Trait name" autofocus>`
        + (isAttributeCategory ? `<label style="display:block;margin-top:6px;"><input type="checkbox" name="negative"> Negative Trait</label>` : ""),
      ok: { callback: (e, btn) => ({ name: btn.form.elements.trait.value, negative: btn.form.elements.negative?.checked ?? false }) }
    }).catch(() => null);
    if (!result?.name) return;
    const { name, negative } = result;

    // Per Laws of the Night Revised's Experience cost table: a new Attribute
    // Trait costs 1 Experience. Negative Traits aren't a purchase (they're a
    // self-imposed penalty), so they're free.
    const update = {};
    if (isAttributeCategory && !negative) {
      this._spendXP(update, 1);
    }

    const list = foundry.utils.getProperty(this.actor.system, path) ?? [];
    update[`system.${path}`] = [...list, { name, spent: false, negative }];
    await this.actor.update(update);
  }

  /**
   * Deduct `cost` Experience into the given update payload for bookkeeping.
   * Never blocks the actual trait/rating change over it - Storytellers
   * generally trust their players not to abuse this, and a hard block here
   * just gets in the way of live play. Experience is clamped at 0 rather
   * than going negative, with a soft notification if the actor came up
   * short, so the shortfall is visible without stopping anything.
   */
  _spendXP(update, cost) {
    const current = this.actor.system.experience.value;
    if (current < cost) {
      ui.notifications?.warn(`${this.actor.name} spent more Experience than they had (needed ${cost}, had ${current}) - allowed anyway.`);
    }
    update["system.experience.value"] = Math.max(0, current - cost);
    return true;
  }

  async _onDeleteTrait(event) {
    event.preventDefault();
    const { path, index } = event.currentTarget.dataset;
    const list = foundry.utils.getProperty(this.actor.system, path);
    const updated = list.filter((_, i) => i !== Number(index));
    await this.actor.update({ [`system.${path}`]: updated });
  }

  /**
   * Per Laws of the Night Revised's Experience cost table: a new Ability
   * Trait costs 1 Experience up to rating 5, 2 Experience for ratings 6-10
   * (it gets harder to find things you don't already know); a new
   * Background Trait costs 1 Experience regardless of rating. Anything
   * else (e.g. free-form rated lists this control might be reused for
   * later) is left uncosted.
   */
  _ratedTraitCost(path, newRating) {
    if (path.startsWith("abilities.")) return newRating <= 5 ? 1 : 2;
    if (path === "backgrounds") return 1;
    return 0;
  }

  async _onRatedTraitControl(event) {
    event.preventDefault();
    const { action, path, index } = event.currentTarget.dataset;
    const list = foundry.utils.duplicate(foundry.utils.getProperty(this.actor.system, path) ?? []);
    const update = {};

    if (action === "add") {
      const cost = this._ratedTraitCost(path, 1);
      if (cost > 0 && !this._spendXP(update, cost)) return;
      list.push({ name: "New Trait", rating: 1, notes: "" });
    } else if (action === "remove") {
      list.splice(Number(index), 1);
    } else if (action === "increase") {
      const newRating = list[Number(index)].rating + 1;
      const cost = this._ratedTraitCost(path, newRating);
      if (cost > 0 && !this._spendXP(update, cost)) return;
      list[Number(index)].rating = newRating;
    } else if (action === "decrease") {
      list[Number(index)].rating = Math.max(0, list[Number(index)].rating - 1);
    }

    update[`system.${path}`] = list;
    await this.actor.update(update);
  }

  /** Manual +/- for any embedded Item's system.rating (Disciplines, dragged-in Backgrounds). */
  async _onItemRatingControl(event) {
    event.preventDefault();
    const { itemId, action } = event.currentTarget.dataset;
    const item = this.actor.items.get(itemId);
    if (!item) return;
    const delta = action === "increase" ? 1 : -1;
    const newRating = Math.max(0, item.system.rating + delta);
    await item.update({ "system.rating": newRating });
  }

  async _onCycleHealth(event) {
    event.preventDefault();
    const { level, bonusIndex } = event.currentTarget.dataset;
    // A bonus (extra "Healthy") box lives in the system.bonusHealth array by
    // index instead of a named system.health.<level> field.
    const isBonus = bonusIndex !== undefined;
    const path = isBonus ? `bonusHealth.${bonusIndex}` : `health.${level}`;
    const current = isBonus
      ? this.actor.system.bonusHealth[Number(bonusIndex)]
      : this.actor.system.health[level];
    const idx = DAMAGE_CYCLE.indexOf(current);

    // Shift-click heals with Blood instead of worsening: 1 Blood Trait heals one box
    // of bashing or lethal damage. This only spends the character's own Blood pool
    // and isn't contested by anyone, so it's safe to automate. Aggravated damage
    // cannot be healed this way and must be healed through other means (rest, etc.).
    if (event.shiftKey) {
      if (current === "ok" || current === "aggravated") return;
      const blood = this.actor.system.blood.value;
      if (blood <= 0) {
        ui.notifications?.warn("Not enough Blood to heal.");
        return;
      }
      await this.actor.update({
        [`system.${path}`]: "ok",
        "system.blood.value": blood - 1
      });
      return;
    }

    const next = DAMAGE_CYCLE[(idx + 1) % DAMAGE_CYCLE.length];
    await this.actor.update({ [`system.${path}`]: next });

    // Open (never force-resolve) a Frenzy check once real damage crosses
    // into Wounded or worse - exact table rules on when Frenzy applies vary
    // too much to hard-enforce a result, but popping the tool pre-filled
    // beats relying on someone remembering to open it manually mid-combat.
    // The player/GM can just close it if a check isn't actually called for.
    if (!isBonus && next !== "ok" && HEALTH_LEVELS.indexOf(level) >= HEALTH_LEVELS.indexOf("wounded")) {
      new FrenzyApp(this.actor).render(true);
    }
  }

  /**
   * Add or remove a bonus "Healthy" box (e.g. granted by basic Fortitude,
   * which the rulebook says "functions just like an extra Healthy line on
   * your health level chart"). New boxes are added undamaged; removing one
   * always drops the last box in the list.
   */
  async _onAddHealthLevel(event) {
    event.preventDefault();
    const list = this.actor.system.bonusHealth ?? [];
    await this.actor.update({ "system.bonusHealth": [...list, "ok"] });
  }

  async _onRemoveHealthLevel(event) {
    event.preventDefault();
    const list = this.actor.system.bonusHealth ?? [];
    if (!list.length) return;
    await this.actor.update({ "system.bonusHealth": list.slice(0, -1) });
  }

  /** Create a brand-new embedded Item of the requested type directly on the actor. */
  async _onItemCreate(event) {
    event.preventDefault();
    const { type } = event.currentTarget.dataset;
    const label = CREATABLE_TYPES[type] ?? type;
    await this.actor.createEmbeddedDocuments("Item", [{
      name: `New ${label}`,
      type,
      img: DEFAULT_ITEM_ICONS[type] ?? "icons/svg/mystery-man.svg"
    }]);
    this.render();
  }

  /**
   * Toggle a passive/toggle-activation power on or off. This only flips the power's own
   * "active" state and, on activation, deducts a flat numeric Blood cost if one is set.
   * It never resolves a Trait challenge - powers with activation "challenge" (anything
   * contested against another party) are not given a toggle and must still be played out
   * with the Challenge tool, since only the table's actual Rock-Paper-Scissors throw can
   * decide a contested outcome.
   */
  async _onTogglePower(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    const item = this.actor.items.get(itemId);
    if (!item || !["passive", "toggle"].includes(item.system.activation)) return;

    const turningOn = !item.system.active;
    await item.update({ "system.active": turningOn });

    let bloodSpent = 0;
    if (turningOn && item.system.bloodCost) {
      const cost = Number(item.system.bloodCost);
      if (Number.isInteger(cost) && cost > 0) {
        const current = this.actor.system.blood.value;
        await this.actor.update({ "system.blood.value": Math.max(0, current - cost) });
        bloodSpent = cost;
      }
    }
    const summary = `${turningOn ? "Activated" : "Deactivated"} ${item.name}${bloodSpent ? ` (spent ${bloodSpent} Blood)` : ""}`;
    await logAction(this.actor, summary);
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<p><strong>${this.actor.name}</strong> ${summary.charAt(0).toLowerCase()}${summary.slice(1)}.</p>`
    });
    this.render();
  }

  /** A reflexive Power (a declared action with no Challenge or persistent toggle) - just announces its use to chat. */
  async _onUsePower(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    const item = this.actor.items.get(itemId);
    if (!item) return;

    let bloodSpent = 0;
    if (item.system.bloodCost) {
      const cost = Number(item.system.bloodCost);
      if (Number.isInteger(cost) && cost > 0) {
        const current = this.actor.system.blood.value;
        await this.actor.update({ "system.blood.value": Math.max(0, current - cost) });
        bloodSpent = cost;
      }
    }

    const summary = `Used ${item.name}${bloodSpent ? ` (spent ${bloodSpent} Blood)` : ""}`;
    await logAction(this.actor, summary);
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<p><strong>${this.actor.name}</strong> uses <strong>${item.name}</strong>${bloodSpent ? ` (spends ${bloodSpent} Blood)` : ""}.</p>`
    });
  }

  /** Open ChallengeApp pre-filled with a specific Power's own challengeType/retestAbility. */
  _onInitiatePowerChallenge(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    const item = this.actor.items.get(itemId);
    if (!item) return;
    new ChallengeApp(this.actor, {}, {
      challengeType: item.system.challengeType,
      retest: item.system.retestAbility,
      powerName: item.name
    }).render(true);
  }

  _onItemEdit(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    this.actor.items.get(itemId)?.sheet.render(true);
  }

  async _onItemDelete(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    await this.actor.items.get(itemId)?.delete();
    this.render();
  }

  /** Set the drag payload when picking up an item row from one of the sheet's item-lists. */
  _onDragStart(event) {
    const itemId = event.currentTarget.closest(".item")?.dataset.itemId;
    const item = this.actor.items.get(itemId);
    if (!item) return;
    event.dataTransfer.setData("text/plain", JSON.stringify(item.toDragData()));
  }

  /** Resolve a drop (from a compendium, another actor, or the sidebar) into a real Item and hand it to _onDropItemCreate. */
  async _onDrop(event) {
    let data;
    try {
      data = JSON.parse(event.dataTransfer.getData("text/plain"));
    } catch (err) {
      console.warn("VTMLARP | Drop event had no parseable text/plain data:", err);
      return;
    }
    console.log("VTMLARP | Drop data:", data);
    if (data?.type !== "Item") {
      console.warn(`VTMLARP | Ignored drop of type "${data?.type}" (only "Item" drops are handled).`);
      return;
    }
    const item = await Item.implementation.fromDropData(data);
    if (!item) {
      console.warn("VTMLARP | Item.fromDropData() could not resolve this drop - uuid was:", data.uuid);
      ui.notifications?.warn("Couldn't resolve the dropped item - check the browser console for details.");
      return;
    }
    console.log("VTMLARP | Resolved dropped item:", item.name, item.type, item.uuid);
    await this._onDropItemCreate(item.toObject());
    // createEmbeddedDocuments confirmed succeeding (visible in the log above)
    // isn't the same as this sheet actually re-rendering to show it - rather
    // than trust that ApplicationV2 auto-re-renders on every embedded
    // document change the same way V1 did, force it explicitly so a newly
    // dropped item is guaranteed to actually appear without needing the
    // sheet closed and reopened.
    this.render();
  }

  /**
   * Attribute and Ability compendium entries are reference lookups, not
   * embeddable Items - the sheet represents attributes/abilities as plain
   * named traits on the actor's own data (system.attributes.*.traits,
   * system.abilities.*), with no item-list section to display a raw
   * "attribute"/"ability" Item. Dropping one straight through would create
   * an Item that never appears anywhere on the sheet, silently going
   * nowhere. Convert these two types into the matching trait entry instead
   * of creating an Item; every other type (background, merit, discipline,
   * power, etc.) still has a real item-list section, so it's created as
   * a normal embedded Item via the default behavior.
   */
  async _onDropItemCreate(itemData) {
    try {
      const items = Array.isArray(itemData) ? itemData : [itemData];
      const passthrough = [];
      const updates = {};

      const pushTrait = (path, entry) => {
        const current = updates[path] ?? foundry.utils.getProperty(this.actor.system, path) ?? [];
        updates[path] = [...current, entry];
      };

      for (const data of items) {
        if (data.type === "attribute") {
          const category = ["physical", "social", "mental"].includes(data.system?.category)
            ? data.system.category : "physical";
          pushTrait(`attributes.${category}.traits`, { name: data.name, spent: false, negative: !!data.system?.negative });
        } else if (data.type === "ability") {
          const key = { talent: "talents", skill: "skills", knowledge: "knowledges" }[data.system?.category] ?? "talents";
          pushTrait(`abilities.${key}`, { name: data.name, rating: Number(data.system?.rating) || 1, notes: "" });
        } else {
          passthrough.push(data);
        }
      }

      if (Object.keys(updates).length) {
        await this.actor.update(Object.fromEntries(Object.entries(updates).map(([k, v]) => [`system.${k}`, v])));
      }
      // ActorSheetV2 doesn't provide a _onDropItemCreate of its own to fall
      // back to (that was a V1 FormApplication pipeline method) - passthrough
      // types are just embedded normally.
      if (passthrough.length) {
        const created = await this.actor.createEmbeddedDocuments("Item", passthrough);
        console.log(`VTMLARP | createEmbeddedDocuments returned ${created.length} document(s):`, created.map(d => `${d.name} (${d.type})`));
        await this._autoBumpDisciplineRatings(created);
        return created;
      }
    } catch (err) {
      // A drag/drop that visibly "does nothing" is otherwise impossible to
      // diagnose - createEmbeddedDocuments failures (e.g. schema validation
      // rejections) throw here rather than showing a console error, so
      // surface them as a notification instead of swallowing them silently.
      console.error("VTMLARP | Item drop failed:", err);
      ui.notifications?.error(`Failed to add item to ${this.actor.name}: ${err.message}`);
    }
  }

  /**
   * A Discipline's rating should reflect the highest-tier Power actually
   * dragged in under it (Basic -> 1, Intermediate -> 2, Advanced -> 3,
   * Elder -> 4), so players don't also have to remember to separately bump
   * the rating number by hand every time. Only ever raises the rating, never
   * lowers it - a Storyteller-set higher rating (e.g. for Elder NPCs who
   * don't have every intervening Power written up) is never overwritten.
   */
  async _autoBumpDisciplineRatings(createdItems) {
    const newPowers = createdItems.filter(i => i.type === "power" && i.system.discipline);
    if (!newPowers.length) return;
    for (const power of newPowers) {
      const discipline = this.actor.items.find(i => i.type === "discipline" && i.name === power.system.discipline);
      if (!discipline) continue;
      const required = (LEVEL_ORDER[power.system.level] ?? 0) + 1;
      if (discipline.system.rating < required) {
        await discipline.update({ "system.rating": required });
      }
    }
  }
}
