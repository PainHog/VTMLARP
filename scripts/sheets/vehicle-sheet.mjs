const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

/**
 * A deliberately minimal sheet for the "vehicle" Actor type - no Attributes/
 * Abilities/Disciplines, just seats, grid footprint, durability, and notes.
 * The grid width/height fields drive the Actor's own prototypeToken size
 * directly, so dragging this Actor onto a scene places a correctly-sized
 * token (a sedan takes up 4x2 squares, a semi 10x2, etc.) without the GM
 * having to configure token size by hand every time.
 */
export class VTMVehicleSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["vtmlarp", "sheet", "vehicle"],
    position: { width: 480, height: 680 },
    window: { resizable: true }
    // NB: no submitOnChange - like the actor/item sheets, this hosting doesn't
    // reliably persist the V2 auto-submit, so fields are saved explicitly by
    // _onFieldChange below.
  };

  static PARTS = {
    form: { template: "systems/vtmlarp/templates/actor/vehicle-sheet.hbs" }
  };

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.actor = this.actor;
    context.system = this.actor.system;
    context.owner = this.actor.isOwner;
    context.cssClass = `vtmlarp sheet vehicle ${this.isEditable ? "editable" : "locked"}`;
    context.tokenWidth = this.actor.prototypeToken.width;
    context.tokenHeight = this.actor.prototypeToken.height;
    return context;
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    if (!this.isEditable) return;
    this.element.querySelector(".apply-grid-size")?.addEventListener("click", this._onApplyGridSize.bind(this));
    // Save each field explicitly on change (bound per-node, so listeners don't
    // accumulate on the persistent root across re-renders).
    for (const el of this.element.querySelectorAll("input[name], select[name], textarea[name], prose-mirror[name]")) {
      el.addEventListener("change", this._onFieldChange.bind(this));
    }
  }

  async _onFieldChange(event) {
    const el = event.currentTarget;
    if (el.disabled || el.readOnly) return;
    const name = el.getAttribute("name");
    if (!name) return;
    let value = el.value;
    if (el.type === "checkbox") value = el.checked;
    else if (el.type === "number") value = value === "" ? null : Number(value);
    await this.actor.update({ [name]: value });
  }

  /** Push the Grid Width/Height fields onto this Actor's own prototypeToken, so new tokens dropped from it are already correctly sized. */
  async _onApplyGridSize(event) {
    event.preventDefault();
    const { gridWidth, gridHeight } = this.actor.system;
    await this.actor.update({
      "prototypeToken.width": gridWidth,
      "prototypeToken.height": gridHeight
    });
    ui.notifications?.info(`${this.actor.name}'s token size set to ${gridWidth}x${gridHeight} squares.`);
  }
}
