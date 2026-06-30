import { ChallengeApp } from "../apps/challenge.mjs";

const HEALTH_LEVELS = ["bruised", "hurt", "injured", "wounded", "mauled", "crippled", "incapacitated"];
const DAMAGE_CYCLE = ["ok", "bashing", "lethal", "aggravated"];

export class VTMActorSheet extends ActorSheet {
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

    context.isCharacter = this.actor.type === "character";
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
    const next = DAMAGE_CYCLE[(DAMAGE_CYCLE.indexOf(current) + 1) % DAMAGE_CYCLE.length];
    await this.actor.update({ [`system.health.${level}`]: next });
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
