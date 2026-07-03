import { ChallengeApp } from "../apps/challenge.mjs";
import { FrenzyApp } from "../apps/frenzy.mjs";
import { checkPrerequisites } from "../apps/prerequisites.mjs";

const CREATABLE_TYPES = {
  discipline: "Discipline", power: "Power", background: "Background",
  merit: "Merit", flaw: "Flaw", ritual: "Ritual", gear: "Gear"
};

const HEALTH_LEVELS = ["bruised", "hurt", "injured", "wounded", "mauled", "crippled", "incapacitated"];
const DAMAGE_CYCLE = ["ok", "bashing", "lethal", "aggravated"];

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

const GENERATION_OPTIONS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

const ARCHETYPE_OPTIONS = [
  "Architect", "Autocrat", "Bon Vivant", "Bravo", "Caregiver", "Cavalier",
  "Celebrant", "Conformist", "Conniver", "Curmudgeon", "Deviant", "Director",
  "Fanatic", "Gallant", "Judge", "Loner", "Martyr", "Masochist", "Monster",
  "Pedagogue", "Perfectionist", "Rebel", "Rogue", "Survivor", "Thrill-Seeker",
  "Traditionalist", "Trickster", "Visionary"
];

export class VTMActorSheet extends foundry.appv1.sheets.ActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["vtmlarp", "sheet", "actor"],
      template: "systems/vtmlarp/templates/actor/character-sheet.hbs",
      width: 820,
      height: 880,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "main" }],
      dragDrop: [{ dragSelector: ".item-list .item", dropSelector: null }]
    });
  }

  /** @override */
  async getData(options) {
    const context = await super.getData(options);
    context.actor = this.actor;
    context.system = this.actor.system;
    const sys = context.system;

    context.healthLevels = HEALTH_LEVELS.map(level => ({
      key: level,
      label: level.charAt(0).toUpperCase() + level.slice(1),
      state: sys.health[level]
    }));

    context.itemsByType = {};
    for (const item of this.actor.items) {
      (context.itemsByType[item.type] ??= []).push(item);
    }

    context.activePowers = (context.itemsByType.power ?? []).filter(item => item.system.active);

    const disciplineItems = context.itemsByType.discipline ?? [];
    context.powerPrereqStatus = {};
    for (const power of context.itemsByType.power ?? []) {
      if (!power.system.prerequisites) continue;
      context.powerPrereqStatus[power.id] = checkPrerequisites(power.system.prerequisites, disciplineItems);
    }

    context.isCharacter = this.actor.type === "character";
    context.CLAN_OPTIONS = CLAN_OPTIONS;
    context.SECT_OPTIONS = SECT_OPTIONS;
    context.GENERATION_OPTIONS = GENERATION_OPTIONS;
    context.ARCHETYPE_OPTIONS = ARCHETYPE_OPTIONS;
    return context;
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);
    if (!this.isEditable) return;

    html.find(".trait-toggle").on("click", this._onToggleTrait.bind(this));
    html.find(".trait-add").on("click", this._onAddTrait.bind(this));
    html.find(".trait-delete").on("click", this._onDeleteTrait.bind(this));
    html.find(".health-box").on("click", this._onCycleHealth.bind(this));
    html.find(".item-edit").on("click", this._onItemEdit.bind(this));
    html.find(".item-delete").on("click", this._onItemDelete.bind(this));
    html.find(".rated-trait-control").on("click", this._onRatedTraitControl.bind(this));
    html.find(".open-challenge").on("click", () => new ChallengeApp(this.actor).render(true));
    html.find(".open-frenzy").on("click", () => new FrenzyApp(this.actor).render(true));
    html.find(".power-toggle").on("click", this._onTogglePower.bind(this));
    html.find(".item-create").on("click", this._onItemCreate.bind(this));
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
    const name = await foundry.applications.api.DialogV2.prompt({
      window: { title: "New Trait" },
      content: `<input type="text" name="trait" placeholder="Trait name" autofocus>`,
      ok: { callback: (e, btn) => btn.form.elements.trait.value }
    }).catch(() => null);
    if (!name) return;
    const list = foundry.utils.getProperty(this.actor.system, path) ?? [];
    await this.actor.update({ [`system.${path}`]: [...list, { name, spent: false }] });
  }

  async _onDeleteTrait(event) {
    event.preventDefault();
    const { path, index } = event.currentTarget.dataset;
    const list = foundry.utils.getProperty(this.actor.system, path);
    const updated = list.filter((_, i) => i !== Number(index));
    await this.actor.update({ [`system.${path}`]: updated });
  }

  async _onRatedTraitControl(event) {
    event.preventDefault();
    const { action, path, index } = event.currentTarget.dataset;
    const list = foundry.utils.duplicate(foundry.utils.getProperty(this.actor.system, path) ?? []);
    if (action === "add") {
      list.push({ name: "New Trait", rating: 1, notes: "" });
    } else if (action === "remove") {
      list.splice(Number(index), 1);
    } else if (action === "increase") {
      list[Number(index)].rating += 1;
    } else if (action === "decrease") {
      list[Number(index)].rating = Math.max(0, list[Number(index)].rating - 1);
    }
    await this.actor.update({ [`system.${path}`]: list });
  }

  async _onCycleHealth(event) {
    event.preventDefault();
    const level = event.currentTarget.dataset.level;
    const current = this.actor.system.health[level];
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
        [`system.health.${level}`]: "ok",
        "system.blood.value": blood - 1
      });
      return;
    }

    const next = DAMAGE_CYCLE[(idx + 1) % DAMAGE_CYCLE.length];
    await this.actor.update({ [`system.health.${level}`]: next });
  }

  /** Create a brand-new embedded Item of the requested type directly on the actor. */
  async _onItemCreate(event) {
    event.preventDefault();
    const { type } = event.currentTarget.dataset;
    const label = CREATABLE_TYPES[type] ?? type;
    await this.actor.createEmbeddedDocuments("Item", [{
      name: `New ${label}`,
      type
    }]);
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

    if (turningOn && item.system.bloodCost) {
      const cost = Number(item.system.bloodCost);
      if (Number.isInteger(cost) && cost > 0) {
        const current = this.actor.system.blood.value;
        await this.actor.update({ "system.blood.value": Math.max(0, current - cost) });
      }
    }
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
  }

  /** @override */
  async _onDropItemCreate(itemData) {
    const items = Array.isArray(itemData) ? itemData : [itemData];
    return super._onDropItemCreate(items);
  }
}
