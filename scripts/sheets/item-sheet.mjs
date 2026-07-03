export class VTMItemSheet extends foundry.appv1.sheets.ItemSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["vtmlarp", "sheet", "item"],
      width: 520,
      height: 480,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description" }]
    });
  }

  /** @override */
  get template() {
    return "systems/vtmlarp/templates/item/item-sheet.hbs";
  }

  /** @override */
  async getData(options) {
    const context = await super.getData(options);
    context.item = this.item;
    context.system = this.item.system;
    return context;
  }
}
