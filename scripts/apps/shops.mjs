const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;
const { DialogV2 } = foundry.applications.api;

/**
 * The Mercantile system: a Storyteller creates any number of shops (street
 * gangs, fixers, pop-up magical merchants), each independently open or closed,
 * each stocking real or custom items at a price. Players browse the OPEN shops
 * and buy with money, a Boon owed, or a bartered trade.
 *
 * A shop is a first-class Actor (type "shop"), so it can be dragged in and out
 * of games, stored in compendiums, duplicated, and imported/exported like any
 * document. The Storyteller is the authority for every purchase: a player's
 * purchase request is sent to the active GM, who debits/credits the buyer, adds
 * the item to their sheet, decrements limited stock on the shop Actor, and logs
 * the transaction to chat and the buyer's ledger.
 */

const SETTING = "shops";

export function registerShopSettings() {
  // Retained only as the source for the one-time migration of pre-Actor shops
  // (see migrateSettingShopsToActors). New shops are Actors, not this setting.
  game.settings.register("vtmlarp", SETTING, {
    name: "Mercantile Shops (legacy)",
    scope: "world",
    config: false,
    type: Object,
    default: { shops: [] }
  });
}

/** All shop Actors in the world. */
export function getShopActors() {
  return game.actors.filter(a => a.type === "shop");
}

/** Build a stock-item record with sane defaults; pass overrides for known fields. */
export function makeStockItem(overrides = {}) {
  return {
    id: foundry.utils.randomID(), name: "New Item", category: "Basic Item", description: "",
    price: 0, qty: -1, money: true, boon: false, boonLevel: "minor", barter: false, img: "", traitBonus: "",
    ...overrides
  };
}

// Serialize purchase read-modify-write cycles on the GM client. Two purchase
// requests arriving close together would otherwise both read the same stock
// snapshot and the second update would clobber the first (overselling limited
// stock). Chaining through one promise makes each purchase see the previous
// one's saved result.
let _shopMutex = Promise.resolve();
function withShopLock(fn) {
  const run = _shopMutex.then(fn, fn);
  _shopMutex = run.then(() => {}, () => {});
  return run;
}

/** One-time migration: turn any shops stored in the legacy world setting into
 * shop Actors, then clear the setting so it can't be re-imported. Called from
 * the migration framework. Returns the number of shops migrated. */
export async function migrateSettingShopsToActors() {
  const legacy = game.settings.get("vtmlarp", SETTING)?.shops ?? [];
  if (!legacy.length) return 0;
  const toCreate = legacy.map(s => ({
    name: s.name || "Shop",
    type: "shop",
    system: {
      keeper: s.keeper || "",
      open: !!s.open,
      notes: s.notes || "",
      stock: (s.stock ?? []).map(i => makeStockItem(i))
    }
  }));
  await Actor.createDocuments(toCreate);
  await game.settings.set("vtmlarp", SETTING, { shops: [] });
  return toCreate.length;
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
  const shopActor = game.actors.get(req.shopId);
  if (!shopActor || shopActor.type !== "shop") return fail("That shop no longer exists.");
  const shop = { name: shopActor.name, keeper: shopActor.system.keeper, open: shopActor.system.open };
  if (!shop.open) return fail(`${shop.name} is closed.`);
  const stock = foundry.utils.duplicate(shopActor.system.stock ?? []);
  const item = stock.find(i => i.id === req.itemId);
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

  // Decrement limited stock on the shop Actor.
  if (Number.isFinite(item.qty) && item.qty >= 0) {
    item.qty -= 1;
    await shopActor.update({ "system.stock": stock });
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
    const shops = getShopActors()
      .filter(a => isGM || a.system.open)
      .map(a => ({
        id: a.id, name: a.name, keeper: a.system.keeper, notes: a.system.notes, open: a.system.open,
        stock: (a.system.stock ?? []).filter(i => isGM || !(Number.isFinite(i.qty) && i.qty >= 0 && i.qty < 1))
      }));
    // Characters this user could buy for.
    const buyers = game.actors.filter(a => a.type === "character" && a.isOwner)
      .map(a => ({ id: a.id, name: a.name, money: a.system.money ?? 0 }));
    return { shops, buyers, isGM, hasShops: shops.length > 0 };
  }

  static async #onBuy(event, target) {
    const { shopId, itemId } = target.dataset;
    const shopActor = game.actors.get(shopId);
    const shop = shopActor ? { name: shopActor.name, keeper: shopActor.system.keeper } : null;
    const item = shopActor?.system?.stock?.find(i => i.id === itemId);
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


/** Storyteller-only Mercantile overview: lists the world's shop Actors, creates
 * new ones, toggles open/closed, and opens each shop's sheet to edit its stock.
 * Editing lives on the ShopSheet (a shop is an Actor), so a shop can also be
 * dragged into a compendium and back. */
export class MercantilePanelApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "vtmlarp-mercantile-panel",
    classes: ["vtmlarp", "sheet", "mercantile-panel"],
    position: { width: 520, height: 560 },
    window: { title: "Mercantile — Shops", resizable: true },
    actions: {
      addShop: MercantilePanelApp.#onAddShop,
      editShop: MercantilePanelApp.#onEditShop,
      deleteShop: MercantilePanelApp.#onDeleteShop,
      toggleOpen: MercantilePanelApp.#onToggleOpen,
      openBrowser: () => new ShopBrowserApp().render(true)
    }
  };

  static PARTS = { form: { template: "systems/vtmlarp/templates/apps/mercantile-panel.hbs" } };

  async _prepareContext() {
    const shops = getShopActors()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(a => ({ id: a.id, name: a.name, keeper: a.system.keeper, open: a.system.open, count: (a.system.stock ?? []).length }));
    return { shops, hasShops: shops.length > 0 };
  }

  static async #onAddShop() {
    const [shop] = await Actor.createDocuments([{ name: "New Shop", type: "shop" }]);
    shop?.sheet?.render(true);
    this.render();
  }

  static #onEditShop(event, target) {
    game.actors.get(target.dataset.shopId)?.sheet?.render(true);
  }

  static async #onDeleteShop(event, target) {
    const shop = game.actors.get(target.dataset.shopId);
    if (!shop) return;
    const ok = await DialogV2.confirm({
      window: { title: "Delete Shop" },
      content: `<p>Delete the shop <strong>${shop.name}</strong>? This removes the Actor. (To keep a copy, drag it into a compendium first.)</p>`,
      rejectClose: false
    });
    if (!ok) return;
    await shop.delete();
    this.render();
  }

  static async #onToggleOpen(event, target) {
    const shop = game.actors.get(target.dataset.shopId);
    if (shop) { await shop.update({ "system.open": !shop.system.open }); this.render(); }
  }
}
