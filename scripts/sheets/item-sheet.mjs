const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

export class VTMItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["vtmlarp", "sheet", "item"],
    position: { width: 520, height: 640 },
    window: { resizable: true },
    form: { submitOnChange: true }
  };

  static PARTS = {
    form: { template: "systems/vtmlarp/templates/item/item-sheet.hbs" }
  };

  static TABS = {
    primary: {
      tabs: [
        { id: "description", label: "Description" },
        { id: "details", label: "Details" }
      ],
      initial: "description"
    }
  };

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.item = this.item;
    context.system = this.item.system;
    context.owner = this.item.isOwner;
    // Matches the same fix in actor-sheet.mjs: ApplicationV2 only applies
    // DEFAULT_OPTIONS.classes to the outer .application element, not to
    // this inner <form>, so cssClass needs to carry "vtmlarp sheet item"
    // itself for any CSS scoped to those classes on this specific element.
    context.cssClass = `vtmlarp sheet item ${this.isEditable ? "editable" : "locked"}`;

    // Built explicitly here (rather than trusting an assumed shape from the
    // mixin's own tabGroups context) so the template's active/class logic
    // has no dependency on framework internals beyond `this.tabGroups`,
    // which is the one documented, stable piece of the tabs API.
    const active = this.tabGroups.primary ?? "description";
    context.tabs = {
      description: { id: "description", group: "primary", label: "Description", active: active === "description" },
      details: { id: "details", group: "primary", label: "Details", active: active === "details" }
    };
    return context;
  }

  /**
   * ApplicationV2's built-in tab-switch handler recalculates the window's
   * height to fit whichever tab is now showing (updatePosition defaults to
   * true), which visibly resizes and repositions the whole window every
   * time a tab is clicked. This sheet's tabs are similar enough in height
   * that a fixed size reads better than that jumpiness.
   * @override
   */
  changeTab(tab, group, options = {}) {
    return super.changeTab(tab, group, { ...options, updatePosition: false });
  }
}
