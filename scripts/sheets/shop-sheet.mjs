import { ITEM_CATEGORIES, makeStockItem } from "../apps/shops.mjs";
import { browseSheetImage } from "./edit-image.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;
const { DialogV2 } = foundry.applications.api;

/**
 * Sheet for a Shop Actor (type "shop"): edit the keeper, open/closed state,
 * notes, and the stock table. Because a shop is now a real Actor, it can be
 * dragged into a compendium, duplicated, and imported/exported like any
 * document — this sheet is just its editor. Stock edits write straight to
 * this.actor.system.stock via actor.update.
 */
export class ShopSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["vtmlarp", "sheet", "shop-sheet"],
    position: { width: 640, height: 640 },
    window: { resizable: true },
    form: { submitOnChange: false },
    actions: {
      addItem: ShopSheet.#onAddItem,
      createItem: ShopSheet.#onCreateItem,
      deleteItem: ShopSheet.#onDeleteItem,
      previewShop: ShopSheet.#onPreview
    }
  };

  static PARTS = { form: { template: "systems/vtmlarp/templates/actor/shop-sheet.hbs" } };

  async _prepareContext() {
    return {
      actor: this.actor,
      shop: this.actor,
      system: this.actor.system,
      stock: this.actor.system.stock ?? [],
      categories: ITEM_CATEGORIES,
      editable: this.isEditable,
      cssClass: `vtmlarp sheet shop-sheet ${this.isEditable ? "editable" : "locked"}`
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    if (!this.isEditable) return;
    for (const el of this.element.querySelectorAll("[data-field]")) {
      el.addEventListener("change", this.#onFieldChange.bind(this));
    }
    const root = this.element;
    if (!root.dataset.vtmDropBound) {
      root.dataset.vtmDropBound = "1";
      root.addEventListener("dragover", ev => ev.preventDefault());
      root.addEventListener("drop", ev => this._onDropStock(ev));
    }
    this.element.querySelector(".profile-img")
      ?.addEventListener("click", (event) => browseSheetImage(this.actor, this, event.currentTarget));
  }

  /** Persist an inline edit to a shop field or a stock-item field. */
  async #onFieldChange(event) {
    const el = event.currentTarget;
    const { itemId, field } = el.dataset;
    let value = el.type === "checkbox" ? el.checked : el.value;
    if (el.type === "number") value = Number(value);
    if (field === "qty" && el.value === "") value = -1;  // blank qty = unlimited

    if (itemId) {
      const stock = foundry.utils.duplicate(this.actor.system.stock ?? []);
      const item = stock.find(i => i.id === itemId);
      if (!item) return;
      item[field] = value;
      await this.actor.update({ "system.stock": stock });
      if (field === "boon") {
        const sel = this.element.querySelector(`select[data-field="boonLevel"][data-item-id="${itemId}"]`);
        if (sel) sel.style.display = value ? "" : "none";
      }
    } else if (field === "name") {
      // The shop's display name is the Actor's own name, not a system field.
      await this.actor.update({ name: value });
    } else {
      await this.actor.update({ [`system.${field}`]: value });
    }
  }

  static async #onAddItem() {
    const stock = foundry.utils.duplicate(this.actor.system.stock ?? []);
    stock.push(makeStockItem());
    await this.actor.update({ "system.stock": stock });
  }

  static async #onDeleteItem(event, target) {
    const stock = (this.actor.system.stock ?? []).filter(i => i.id !== target.dataset.itemId);
    await this.actor.update({ "system.stock": stock });
  }

  static async #onPreview() {
    const { ShopBrowserApp } = await import("../apps/shops.mjs");
    new ShopBrowserApp().render(true);
  }

  /** Guided item-creation form (mirrors the old Mercantile Create Item dialog). */
  static async #onCreateItem() {
    const catOptions = ITEM_CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join("");
    const result = await DialogV2.prompt({
      window: { title: "Create Shop Item" },
      position: { width: 460 },
      content: `<div class="flexcol vtmlarp-create-item" style="gap:8px;">
        <label>Name <span class="req">*</span><input type="text" name="name" autofocus required></label>
        <label>Type <select name="category">${catOptions}</select></label>
        <div class="flexrow" style="gap:8px;">
          <label>Price <span class="req">*</span><input type="number" name="price" value="0" min="0"></label>
          <label>Quantity <input type="number" name="qty" value="-1" title="-1 = unlimited"></label>
        </div>
        <fieldset><legend>Accepted payment</legend>
          <label class="check"><input type="checkbox" name="money" checked> Money</label>
          <label class="check"><input type="checkbox" name="boon"> Boon owed</label>
          <label class="boon-level-wrap" style="display:none;">Boon level
            <select name="boonLevel"><option value="minor">Minor</option><option value="major">Major</option><option value="blood">Blood/Life</option></select>
          </label>
          <label class="check"><input type="checkbox" name="barter"> Barter / trade</label>
        </fieldset>
        <label>Trait bonus (weapons/armor, optional) <input type="text" name="traitBonus" placeholder="e.g. +2 Traits, 2 Health absorbed"></label>
        <label>Description / flavor <textarea name="description" rows="4" placeholder="What it is, what it does, any rules notes"></textarea></label>
      </div>`,
      ok: {
        label: "Add to shop",
        callback: (e, btn) => {
          const f = btn.form.elements;
          const name = f.name.value.trim();
          if (!name) return null;
          return makeStockItem({
            name,
            category: f.category.value,
            price: Number(f.price.value) || 0,
            qty: Number.isFinite(Number(f.qty.value)) ? Number(f.qty.value) : -1,
            money: f.money.checked, boon: f.boon.checked, boonLevel: f.boonLevel.value, barter: f.barter.checked,
            traitBonus: f.traitBonus.value.trim(),
            description: f.description.value.trim()
          });
        }
      },
      render: (e, dialog) => {
        const form = dialog.element.querySelector("form") ?? dialog.element;
        const boon = form.querySelector('[name="boon"]');
        const wrap = form.querySelector(".boon-level-wrap");
        const sync = () => { if (wrap) wrap.style.display = boon.checked ? "" : "none"; };
        boon?.addEventListener("change", sync); sync();
      }
    }).catch(() => null);
    if (!result) return;
    const stock = foundry.utils.duplicate(this.actor.system.stock ?? []);
    stock.push(result);
    await this.actor.update({ "system.stock": stock });
  }

  /** Accept a Gear item dropped from a compendium/sidebar as new stock. */
  async _onDropStock(event) {
    let data;
    try { data = JSON.parse(event.dataTransfer.getData("text/plain")); } catch { return; }
    if (data?.type !== "Item") return;
    const doc = await fromUuid(data.uuid).catch(() => null);
    if (!doc || doc.type !== "gear") { ui.notifications?.info("Drop a Gear item to add it as stock."); return; }
    const stock = foundry.utils.duplicate(this.actor.system.stock ?? []);
    stock.push(makeStockItem({
      name: doc.name, category: "Gear / Tool", description: doc.system.description || "",
      img: doc.img, traitBonus: doc.system.traitBonus || ""
    }));
    await this.actor.update({ "system.stock": stock });
  }
}
