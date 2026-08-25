const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;
const { DialogV2 } = foundry.applications.api;

/**
 * The Mercantile system: a Storyteller creates any number of shops (street
 * gangs, fixers, pop-up magical merchants), each independently open or closed,
 * each stocking real or custom items at a price. Players browse the OPEN shops
 * and buy with money, a Boon owed, or a bartered trade. The Storyteller is the
 * authority for every purchase (they hold the shop stock as a world setting and
 * apply the result), so a purchase a player initiates is sent to the active GM,
 * who debits/credits the buyer, adds the item to their sheet, decrements limited
 * stock, and logs the transaction to chat and the buyer's ledger.
 */

const SETTING = "shops";

export function registerShopSettings() {
  game.settings.register("vtmlarp", SETTING, {
    name: "Mercantile Shops",
    scope: "world",
    config: false,
    type: Object,
    default: { shops: [] }
  });
}

export function getShops() {
  return foundry.utils.duplicate(game.settings.get("vtmlarp", SETTING)?.shops ?? []);
}

async function saveShops(shops) {
  await game.settings.set("vtmlarp", SETTING, { shops });
}

// Serialize all read-modify-write cycles against the shops world setting on the
// GM client. Two purchase requests arriving close together would otherwise both
// read the same stock snapshot and the second save would clobber the first
// (overselling limited stock, losing a decrement). Chaining through one promise
// makes each purchase see the previous one's saved result.
let _shopMutex = Promise.resolve();
function withShopLock(fn) {
  const run = _shopMutex.then(fn, fn);
  _shopMutex = run.then(() => {}, () => {});
  return run;
}

/** Whisper a shop result to the buying player's owners (and the GM), so a
 * failed or successful purchase is visible to the person who initiated it
 * rather than only as a GM-side notification. */
async function notifyBuyer(buyer, text, isFailure) {
  const recipients = game.users.filter(u => u.isGM || buyer.testUserPermission(u, "OWNER")).map(u => u.id);
  await ChatMessage.create({
    whisper: recipients,
    speaker: { alias: "Mercantile" },
    content: `<div class="vtmlarp-shared-entry ${isFailure ? "purchase-failed" : ""}"><p>${text}</p></div>`
  });
}

const PAY_LABELS = { money: "Money", boon: "Boon owed", barter: "Barter/trade" };

// Item categories a shop can stock. A starting set covering the common kinds;
// tell me what else you need after play and I'll add them here.
export const ITEM_CATEGORIES = [
  "Basic Item", "Weapon", "Armor / Shield", "Gear / Tool", "Consumable",
  "Magical Item", "Relic / Artifact", "Ritual Component", "Information", "Service", "Custom"
];

/** Apply a validated purchase (GM-side): pay, add the item, decrement stock,
 * log to chat and the buyer's ledger. `req` = { buyerId, shopId, itemId,
 * method, price, note }. Returns a status string. Serialized so concurrent
 * purchases can't oversell shared stock (see withShopLock). */
export function fulfillPurchase(req) {
  return withShopLock(() => _fulfillPurchase(req));
}

async function _fulfillPurchase(req) {
  const buyer = game.actors.get(req.buyerId);
  if (!buyer) return "Buyer not found.";
  const fail = async (msg) => { await notifyBuyer(buyer, msg, true); return msg; };
  const shops = getShops();
  const shop = shops.find(s => s.id === req.shopId);
  if (!shop) return fail("That shop no longer exists.");
  if (!shop.open) return fail(`${shop.name} is closed.`);
  const item = shop.stock?.find(i => i.id === req.itemId);
  if (!item) return fail("That item is no longer in stock.");
  if (Number.isFinite(item.qty) && item.qty >= 0 && item.qty < 1) return fail(`${item.name} is sold out.`);

  const method = req.method;
  const price = Number(item.price) || 0;

  // Payment.
  if (method === "money") {
    const have = Number(buyer.system.money) || 0;
    if (have < price) return fail(`${buyer.name} can't afford ${item.name} (needs ${price}, has ${have}).`);
    await buyer.update({ "system.money": have - price });
  } else if (method === "boon") {
    const boons = foundry.utils.duplicate(buyer.system.boons ?? []);
    const level = ["minor", "major", "blood"].includes(item.boonLevel) ? item.boonLevel : "minor";
    boons.push({ who: shop.keeper || shop.name, type: level, direction: "owed", notes: `For ${item.name}` });
    await buyer.update({ "system.boons": boons });
  } // barter: no automatic debit - the traded goods/service are recorded in the note.

  // Add the item to the buyer's sheet (as a Gear item), linking the source if any.
  const desc = (item.category ? `<p class="hint"><em>${item.category}</em></p>` : "") + (item.description || "");
  const itemData = {
    name: item.name,
    type: "gear",
    img: item.img || "icons/svg/item-bag.svg",
    system: { description: desc, quantity: 1, traitBonus: item.traitBonus || "" }
  };
  await buyer.createEmbeddedDocuments("Item", [itemData]);

  // Decrement limited stock.
  if (Number.isFinite(item.qty) && item.qty >= 0) {
    item.qty -= 1;
    await saveShops(shops);
  }

  // Log: buyer ledger + chat.
  const costLabel = method === "money" ? `${price} money`
    : method === "boon" ? "a Boon owed"
      : (req.note ? `barter: ${req.note}` : "barter");
  const ledger = foundry.utils.duplicate(buyer.system.transactions ?? []);
  ledger.push({
    when: new Date().toLocaleString(),
    shop: shop.name,
    item: item.name,
    method: PAY_LABELS[method] ?? method,
    cost: costLabel,
    notes: req.note || ""
  });
  await buyer.update({ "system.transactions": ledger });

  await ChatMessage.create({
    speaker: { alias: shop.name },
    content: `<div class="vtmlarp-shared-entry"><h3>${shop.name}</h3>`
      + `<p><strong>${buyer.name}</strong> acquired <strong>${item.name}</strong> for ${costLabel}.</p>`
      + (req.note ? `<p><em>${req.note}</em></p>` : "")
      + `</div>`
  });

  // Refresh any open Mercantile UIs. ApplicationV2 instances live in
  // foundry.applications.instances (a Map), NOT ui.windows (V1 only).
  for (const app of foundry.applications.instances.values()) {
    if (app instanceof MercantilePanelApp || app instanceof ShopBrowserApp) app.render();
  }
  return `${buyer.name} bought ${item.name} from ${shop.name}.`;
}

/** Player/GM shop browser: lists OPEN shops (GM sees all) and their stock, with
 * a Buy control per item. */
export class ShopBrowserApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "vtmlarp-shop-browser",
    classes: ["vtmlarp", "sheet", "shop-browser"],
    position: { width: 620, height: 640 },
    window: { title: "Shops", resizable: true },
    actions: { buy: ShopBrowserApp.#onBuy }
  };

  static PARTS = { form: { template: "systems/vtmlarp/templates/apps/shop-browser.hbs" } };

  _onRender(context, options) {
    super._onRender(context, options);
    // The Buy button lives inside a <summary>; a click there would otherwise
    // toggle the collapsible open/closed. Keep buying and expanding separate.
    for (const btn of this.element.querySelectorAll(".shop-buy-btn")) {
      btn.addEventListener("click", ev => ev.preventDefault());
    }
  }

  async _prepareContext() {
    const isGM = game.user.isGM;
    const shops = getShops()
      .filter(s => isGM || s.open)
      .map(s => ({ ...s, stock: (s.stock ?? []).filter(i => isGM || !(Number.isFinite(i.qty) && i.qty >= 0 && i.qty < 1)) }));
    // Characters this user could buy for.
    const buyers = game.actors.filter(a => a.type === "character" && a.isOwner)
      .map(a => ({ id: a.id, name: a.name, money: a.system.money ?? 0 }));
    return { shops, buyers, isGM, hasShops: shops.length > 0 };
  }

  static async #onBuy(event, target) {
    const { shopId, itemId } = target.dataset;
    const shop = getShops().find(s => s.id === shopId);
    const item = shop?.stock?.find(i => i.id === itemId);
    if (!item) { ui.notifications?.warn("Item not found."); return; }

    // Which of the user's characters is buying?
    const buyers = game.actors.filter(a => a.type === "character" && a.isOwner);
    if (!buyers.length) { ui.notifications?.warn("You have no character to buy with."); return; }
    const buyerOptions = buyers.map(a => `<option value="${a.id}">${a.name} (money: ${a.system.money ?? 0})</option>`).join("");
    const methods = [];
    if (item.money !== false) methods.push(`<option value="money">Money (${Number(item.price) || 0})</option>`);
    if (item.boon) methods.push(`<option value="boon">Boon owed to ${shop.keeper || shop.name}</option>`);
    if (item.barter) methods.push(`<option value="barter">Barter / trade</option>`);
    if (!methods.length) methods.push(`<option value="money">Money (${Number(item.price) || 0})</option>`);

    const result = await DialogV2.prompt({
      window: { title: `Buy ${item.name}` },
      content: `<div class="flexcol" style="gap:6px;">`
        + `<label>Buyer <select name="buyer">${buyerOptions}</select></label>`
        + `<label>Pay with <select name="method">${methods.join("")}</select></label>`
        + `<label>Note (barter details, etc.) <input type="text" name="note" placeholder="optional"></label></div>`,
      ok: {
        label: "Buy",
        callback: (e, btn) => ({
          buyerId: btn.form.elements.buyer.value,
          method: btn.form.elements.method.value,
          note: btn.form.elements.note.value.trim()
        })
      }
    }).catch(() => null);
    if (!result) return;

    const req = { buyerId: result.buyerId, shopId, itemId, method: result.method, price: Number(item.price) || 0, note: result.note };

    if (game.user.isGM) {
      const msg = await fulfillPurchase(req);
      ui.notifications?.info(msg);
    } else if (game.users.activeGM) {
      game.socket.emit("system.vtmlarp", { action: "shopPurchase", req });
      ui.notifications?.info(`Purchase request for ${item.name} sent to the Storyteller.`);
    } else {
      ui.notifications?.error("No Storyteller is online to complete the purchase.");
    }
  }
}

/** Storyteller-only Mercantile panel: create/edit shops, toggle open/closed,
 * manage stock. */
export class MercantilePanelApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "vtmlarp-mercantile-panel",
    classes: ["vtmlarp", "sheet", "mercantile-panel"],
    position: { width: 680, height: 720 },
    window: { title: "Mercantile — Shops", resizable: true },
    actions: {
      addShop: MercantilePanelApp.#onAddShop,
      deleteShop: MercantilePanelApp.#onDeleteShop,
      toggleOpen: MercantilePanelApp.#onToggleOpen,
      addItem: MercantilePanelApp.#onAddItem,
      createItem: MercantilePanelApp.#onCreateItem,
      deleteItem: MercantilePanelApp.#onDeleteItem,
      openBrowser: () => new ShopBrowserApp().render(true)
    }
  };

  static PARTS = { form: { template: "systems/vtmlarp/templates/apps/mercantile-panel.hbs" } };

  async _prepareContext() {
    return { shops: getShops(), categories: ITEM_CATEGORIES };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    // Persist edits to shop/item fields on change.
    for (const el of this.element.querySelectorAll("[data-field]")) {
      el.addEventListener("change", this.#onFieldChange.bind(this));
    }
    // Accept Gear items dropped onto a shop as new stock. Bind once per root
    // (the V2 root element persists across re-renders).
    const root = this.element;
    if (!root.dataset.vtmDropBound) {
      root.dataset.vtmDropBound = "1";
      root.addEventListener("dragover", ev => ev.preventDefault());
      root.addEventListener("drop", ev => this._onDrop(ev));
    }
  }

  async #onFieldChange(event) {
    const el = event.currentTarget;
    const { shopId, itemId, field } = el.dataset;
    let value = el.type === "checkbox" ? el.checked : el.value;
    if (el.type === "number") value = Number(value);
    // A blank quantity means "unlimited" (-1), not 0 — otherwise clearing the
    // box would read as sold out. (Number("") is 0.)
    if (field === "qty" && el.value === "") value = -1;
    // Serialize against concurrent purchases so an edit and a sale don't clobber
    // each other's snapshot of the shops setting.
    await withShopLock(async () => {
      const shops = getShops();
      const shop = shops.find(s => s.id === shopId);
      if (!shop) return;
      if (itemId) {
        const item = shop.stock?.find(i => i.id === itemId);
        if (item) item[field] = value;
      } else {
        shop[field] = value;
      }
      await saveShops(shops);
    });
    // Show/hide the boon-level select inline without a full re-render.
    if (field === "boon" && itemId) {
      const sel = this.element.querySelector(`select[data-field="boonLevel"][data-item-id="${itemId}"]`);
      if (sel) sel.style.display = value ? "" : "none";
    }
  }

  static async #onAddShop() {
    const shops = getShops();
    shops.push({ id: foundry.utils.randomID(), name: "New Shop", keeper: "", open: false, notes: "", stock: [] });
    await saveShops(shops);
    this.render();
  }

  static async #onDeleteShop(event, target) {
    const shops = getShops().filter(s => s.id !== target.dataset.shopId);
    await saveShops(shops);
    this.render();
  }

  static async #onToggleOpen(event, target) {
    const shops = getShops();
    const shop = shops.find(s => s.id === target.dataset.shopId);
    if (shop) { shop.open = !shop.open; await saveShops(shops); this.render(); }
  }

  static async #onAddItem(event, target) {
    const shops = getShops();
    const shop = shops.find(s => s.id === target.dataset.shopId);
    if (!shop) return;
    (shop.stock ??= []).push({ id: foundry.utils.randomID(), name: "New Item", category: "Basic Item", description: "", price: 0, qty: -1, money: true, boon: false, boonLevel: "minor", barter: false, img: "", traitBonus: "" });
    await saveShops(shops);
    this.render();
  }

  /** Guided item-creation form: name + type dropdown + the mandatory pricing/
   * payment fields, with flavor at the bottom. Adds the finished item to stock. */
  static async #onCreateItem(event, target) {
    const shopId = target.dataset.shopId;
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
          return {
            id: foundry.utils.randomID(), name,
            category: f.category.value,
            price: Number(f.price.value) || 0,
            qty: Number.isFinite(Number(f.qty.value)) ? Number(f.qty.value) : -1,
            money: f.money.checked, boon: f.boon.checked, boonLevel: f.boonLevel.value, barter: f.barter.checked,
            traitBonus: f.traitBonus.value.trim(),
            description: f.description.value.trim(),
            img: ""
          };
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
    const shops = getShops();
    const shop = shops.find(s => s.id === shopId);
    if (!shop) return;
    (shop.stock ??= []).push(result);
    await saveShops(shops);
    this.render();
  }

  static async #onDeleteItem(event, target) {
    const shops = getShops();
    const shop = shops.find(s => s.id === target.dataset.shopId);
    if (shop) { shop.stock = (shop.stock ?? []).filter(i => i.id !== target.dataset.itemId); await saveShops(shops); this.render(); }
  }

  /** Accept a Gear item dropped from a compendium/sidebar as new stock. */
  async _onDrop(event) {
    let data;
    try { data = JSON.parse(event.dataTransfer.getData("text/plain")); } catch { return; }
    if (data?.type !== "Item") return;
    const doc = await fromUuid(data.uuid).catch(() => null);
    if (!doc || doc.type !== "gear") { ui.notifications?.info("Drop a Gear item to add it as stock."); return; }
    const shopEl = event.target.closest?.("[data-shop-id]");
    const shopId = shopEl?.dataset?.shopId;
    const shops = getShops();
    const shop = shops.find(s => s.id === shopId) ?? shops[0];
    if (!shop) { ui.notifications?.warn("Create a shop first, then drop items onto it."); return; }
    (shop.stock ??= []).push({ id: foundry.utils.randomID(), name: doc.name, category: "Gear / Tool", description: doc.system.description || "", price: 0, qty: -1, money: true, boon: false, boonLevel: "minor", barter: false, img: doc.img, traitBonus: doc.system.traitBonus || "" });
    await saveShops(shops);
    this.render();
  }
}
