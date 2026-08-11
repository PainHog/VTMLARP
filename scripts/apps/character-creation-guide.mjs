const { HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * A quick-reference popup for this table's house-rules chargen sheet - the
 * same content also lives as a compendium JournalEntry
 * (rules-reference.Custom Rulebook Character Creation Sheet) for anyone who
 * wants to read it there instead; this is just a faster way to pull it up
 * without leaving the actor sheet mid-build.
 */
export class CharacterCreationGuideApp extends HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "vtmlarp-chargen-guide",
    classes: ["vtmlarp", "sheet", "chargen-guide"],
    position: { width: 520, height: 640 },
    window: { title: "Character Creation Guide", resizable: true }
  };

  static PARTS = {
    form: { template: "systems/vtmlarp/templates/apps/character-creation-guide.hbs" }
  };
}
