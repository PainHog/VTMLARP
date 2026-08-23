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

const PAY_LABELS = { money: "Money", boon: "Boon owed", barter: "Barter/trade" };

/** Apply a validated purchase (GM-side): pay, add the item, decrement stock,
 * log to chat and the buyer's ledger. `req` = { buyerId, shopId, itemId,
 * method, price, note }. Returns a status string. */
export async function fulfillPurchase(req) {
  const buyer = game.actors.get(req.buyerId);
  if (!buyer) return "Buyer not found.";
  const shops = getShops();
  const shop = shops.find(s => s.id === req.shopId);
  if (!shop) return "That shop no longer exists.";
  if (!shop.open) return `${shop.name} is closed.`;
  const item = shop.stock?.find(i => i.id === req.itemId);
  if (!item) return "That item is no longer in stock.";
  if (Number.isFinite(item.qty) && item.qty >= 0 && item.qty < 1) return `${item.name} is sold out.`;

  const method = req.method;
  const price = Number(item.price) || 0;

  // Payment.
  if (method === "money") {
    const have = Number(buyer.system.money) || 0;
    if (have < price) return `${buyer.name} can't afford ${item.name} (needs ${price}, has ${have}).`;
    await buyer.update({ "system.money": have - price });
  } else if (method === "boon") {
    const boons = foundry.utils.duplicate(buyer.system.boons ?? []);
    boons.push({ who: shop.keeper || shop.name, type: "minor", direction: "owed", notes: `For ${item.name}` });
    await buyer.update({ "system.boons": boons });
  } // barter: no automatic debit - the traded goods/service are recorded in the note.

  // Add the item to the buyer's sheet (as a Gear item), linking the source if any.
  const itemData = {
    name: item.name,
    type: "gear",
    img: item.img || "icons/svg/item-bag.svg",
    system: { description: item.description || "", quantity: 1, traitBonus: item.traitBonus || "" }
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

  // Refresh any open Mercantile UIs.
  for (const app of Object.values(ui.windows)) {
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
      deleteItem: MercantilePanelApp.#onDeleteItem,
      openBrowser: () => new ShopBrowserApp().render(true)
    }
  };

  static PARTS = { form: { template: "systems/vtmlarp/templates/apps/mercantile-panel.hbs" } };

  async _prepareContext() {
    return { shops: getShops() };
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
    (shop.stock ??= []).push({ id: foundry.utils.randomID(), name: "New Item", description: "", price: 0, qty: -1, money: true, boon: false, barter: false, img: "", traitBonus: "" });
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
    (shop.stock ??= []).push({ id: foundry.utils.randomID(), name: doc.name, description: doc.system.description || "", price: 0, qty: -1, money: true, boon: false, barter: false, img: doc.img, traitBonus: doc.system.traitBonus || "" });
    await saveShops(shops);
    this.render();
  }
}
