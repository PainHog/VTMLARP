const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

export class VTMItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["vtmlarp", "sheet", "item"],
    position: { width: 520, height: 640 },
    window: { resizable: true },
    // submitOnChange is OFF for the same reason as the actor sheet: Foundry's
    // built-in auto-submit does not persist on this table's hosting. Saving
    // is done explicitly in _onRender's field handler below.
    form: { submitOnChange: false }
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

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    if (!this.isEditable) return;

    // Click a number/text field and its existing value is selected, so typing
    // replaces it instead of appending - matches the actor sheet.
    this.element.addEventListener("focusin", (event) => {
      const t = event.target;
      if (t?.matches?.("input[type='number'], input[type='text']")) t.select();
    });

    // Explicit save for every named form field, since submitOnChange does not
    // persist on this hosting (see DEFAULT_OPTIONS). Includes <prose-mirror>
    // rich-text editors (description/notes), which dispatch their own change
    // event on save.
    const handler = this._onFieldChange.bind(this);
    this.element
      .querySelectorAll("input[name], select[name], textarea[name], prose-mirror[name]")
      .forEach(node => node.addEventListener("change", handler));
  }

  async _onFieldChange(event) {
    const el = event.currentTarget;
    if (el.disabled || el.readOnly) return;
    let value = el.value;
    if (el.type === "checkbox") value = el.checked;
    else if (el.type === "number") value = value === "" ? null : Number(value);
    await this.item.update({ [el.name]: value });
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
