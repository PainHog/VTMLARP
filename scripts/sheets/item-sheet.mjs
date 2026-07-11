const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

export class VTMItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["vtmlarp", "sheet", "item"],
    position: { width: 520, height: 480 },
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
    context.cssClass = this.isEditable ? "editable" : "locked";

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

    // ApplicationV2 doesn't auto-activate ProseMirror editors or the
    // portrait-image FilePicker the way V1's FormApplication did - both
    // need to be wired up by hand on every render.
    for (const editorDiv of this.element.querySelectorAll(".editor")) {
      this._activateEditor(editorDiv);
    }

    this.element.querySelector("img[data-edit]")?.addEventListener("click", event => {
      const target = event.currentTarget.dataset.edit;
      new foundry.applications.apps.FilePicker({
        type: "image",
        current: foundry.utils.getProperty(this.item, target),
        callback: path => this.item.update({ [target]: path })
      }).render(true);
    });
  }
}
