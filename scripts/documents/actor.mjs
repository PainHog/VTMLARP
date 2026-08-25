import { GENERATION_TABLE } from "../game-data.mjs";

const { fields } = foundry.data;

/** A single named Trait the character has bid points into (e.g. an Ability, Background, Discipline). */
function ratedTraitField(initial = {}) {
  return new fields.SchemaField({
    name: new fields.StringField({ required: true, initial: "" }),
    rating: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
    // The permanent maximum. Normally equals rating; when rating is temporarily
    // reduced (shift-click a dot) max stays, so the sheet shows the lost dots
    // and can restore them. 0 means "untracked" (treat as equal to rating).
    max: new fields.NumberField({ required: false, integer: true, min: 0, initial: 0 }),
    notes: new fields.StringField({ required: false, blank: true, initial: "" })
  }, initial);
}

function traitField() {
  return new fields.SchemaField({
    name: new fields.StringField({ required: true, initial: "" }),
    spent: new fields.BooleanField({ required: true, initial: false }),
    // Negative Traits live in the same physical/social/mental pool as their
    // positive counterparts rather than a separate list, since that's where
    // a player actually thinks to look for them and where they affect
    // challenge counts - this flag is what marks a trait as one.
    negative: new fields.BooleanField({ required: true, initial: false })
  });
}

function attributeCategorySchema() {
  return new fields.SchemaField({
    priority: new fields.StringField({
      required: true,
      initial: "tertiary",
      choices: ["primary", "secondary", "tertiary"]
    }),
    traits: new fields.ArrayField(traitField()),
    // The Trait Bidding rule cares about how many Traits total a character
    // has in a pool, not the individual named entries below - a player
    // should be able to set/see that count directly (e.g. "12 Physical")
    // without first having to type out all 12 names as separate chips.
    total: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 })
  });
}

function healthTrackSchema() {
  const levelNames = ["bruised", "hurt", "injured", "wounded", "mauled", "crippled", "incapacitated"];
  const fieldsObj = {};
  for (const level of levelNames) {
    fieldsObj[level] = new fields.StringField({
      required: true,
      initial: "ok",
      choices: ["ok", "bashing", "lethal", "aggravated"]
    });
  }
  return new fields.SchemaField(fieldsObj);
}

/**
 * Extra Health Levels from sources like basic Fortitude ("you gain one
 * additional health level, which functions just like an extra Healthy line
 * on your health level chart") genuinely add boxes to the track, rather
 * than being some abstract bonus - this array holds those bonus boxes,
 * each tracked with the same damage-state string as the 7 fixed levels.
 */
function bonusHealthLevelField() {
  return new fields.StringField({
    required: true,
    initial: "ok",
    choices: ["ok", "bashing", "lethal", "aggravated"]
  });
}

function virtueSchema() {
  return new fields.SchemaField({
    rating: new fields.NumberField({ required: true, integer: true, min: 0, max: 5, initial: 1 }),
    temporary: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 })
  });
}

// Maximum permanent Willpower by generation (Laws of the Night Revised, p. 95
// Generation chart, Willpower "start/max" column - this is the max). Your
// generation sets the ceiling to which permanent Willpower can be raised.
// 14th/15th (thin-blood) aren't on the book chart, so they use the 13th-gen
// cap; 3rd and below are left out (ST's call).
export const GENERATION_WILLPOWER_MAX = Object.fromEntries(
  Object.entries(GENERATION_TABLE).map(([g, info]) => [g, info.willpowerMax])
);

export class VTMCharacterData extends foundry.abstract.TypeDataModel {
  /**
   * Generation caps maximum permanent Willpower, so set willpower.max from the
   * character's generation as the BASE value here — in prepareBaseData, which
   * runs before Active Effects — so a Power/ST effect that raises willpower.max
   * adds on top of the generation cap instead of being overwritten afterward.
   */
  prepareBaseData() {
    super.prepareBaseData?.();
    const cap = GENERATION_WILLPOWER_MAX[this.generation];
    if (cap != null) this.willpower.max = cap;
  }

  /**
   * After Active Effects have applied, clamp the current Willpower pool to the
   * effective (post-effect) maximum for display.
   */
  prepareDerivedData() {
    super.prepareDerivedData?.();
    if (this.willpower.max != null && this.willpower.value > this.willpower.max) {
      this.willpower.value = this.willpower.max;
    }
  }

  static defineSchema() {
    return {
      concept: new fields.StringField({ required: false, blank: true, initial: "" }),
      clan: new fields.StringField({ required: false, blank: true, initial: "" }),
      bloodline: new fields.StringField({ required: false, blank: true, initial: "" }),
      sect: new fields.StringField({ required: false, blank: true, initial: "" }),
      generation: new fields.NumberField({ required: true, integer: true, min: 4, max: 15, initial: 13 }),
      nature: new fields.StringField({ required: false, blank: true, initial: "" }),
      demeanor: new fields.StringField({ required: false, blank: true, initial: "" }),
      title: new fields.StringField({ required: false, blank: true, initial: "" }),
      coterie: new fields.StringField({ required: false, blank: true, initial: "" }),

      attributes: new fields.SchemaField({
        physical: attributeCategorySchema(),
        social: attributeCategorySchema(),
        mental: attributeCategorySchema()
      }),

      // A single flat, alphabetical list of Abilities. Mind's Eye Theatre uses
      // one undifferentiated Ability list (unlike tabletop's Talents/Skills/
      // Knowledges split). Characters created before 1.17.x are migrated from
      // the old three-list shape into this array (see migrations.mjs).
      abilities: new fields.ArrayField(ratedTraitField()),

      willpower: new fields.SchemaField({
        value: new fields.NumberField({ required: true, integer: true, min: 0, initial: 1 }),
        max: new fields.NumberField({ required: true, integer: true, min: 0, initial: 1 })
      }),

      // Set true the first time a Generation is applied, so auto-seeding of
      // starting Willpower/Blood happens once (at creation) and never
      // overwrites an established pool if the Generation changes later.
      generationApplied: new fields.BooleanField({ required: false, initial: false }),

      // Player checks this when they've finished spending at character
      // creation; the Creation Tracker on the sheet uses it to show a
      // "locked in" state.
      creationComplete: new fields.BooleanField({ required: false, initial: false }),

      // Creation Tracker rules set: false = this table's custom rules
      // (11 Abilities / 5 Disciplines / 12 Freebies), true = original Laws of
      // the Night Revised (5 Abilities / 3 Disciplines / 5 Freebies).
      useOriginalRules: new fields.BooleanField({ required: false, initial: false }),

      // Player took a Derangement at creation for +2 Freebies (custom rule).
      // Tracked explicitly so the bonus is discoverable in the tracker itself,
      // separate from the in-play Derangements list.
      creationDerangement: new fields.BooleanField({ required: false, initial: false }),

      experience: new fields.SchemaField({
        value: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        // Lifetime Experience ever awarded (bumped alongside value when a
        // Storyteller grants XP), so total spent can be recovered as
        // total - value without a full transaction ledger - lets the ST
        // Audit view show who's actually spending what without needing to
        // ask around.
        total: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 })
      }),

      blood: new fields.SchemaField({
        value: new fields.NumberField({ required: true, integer: true, min: 0, initial: 10 }),
        max: new fields.NumberField({ required: true, integer: true, min: 0, initial: 10 }),
        perTurn: new fields.NumberField({ required: true, integer: true, min: 0, initial: 1 }),
        // Blood spent so far this combat turn (reset on turn change) - used to
        // warn when a spend exceeds the generation's per-turn limit.
        spentThisTurn: new fields.NumberField({ required: false, integer: true, min: 0, initial: 0 })
      }),

      // Blush of Life: spend a Blood Trait to pass for mortal for the scene.
      blushOfLife: new fields.BooleanField({ required: false, initial: false }),

      // Diablerie taint. Each act of diablerie adds black veins to the aura;
      // count is how many times committed, lastDate a timestamp. Detectable via
      // Aura Perception for ~3 months, or via Thaumaturgy's A Taste for Blood
      // indefinitely (Laws of the Night Revised, p. 216).
      diablerie: new fields.SchemaField({
        count: new fields.NumberField({ required: false, integer: true, min: 0, initial: 0 }),
        lastDate: new fields.StringField({ required: false, blank: true, initial: "" })
      }),

      // Armor: `max` is the rating of the worn armor, `value` its current
      // remaining protection (players lower it as it soaks hits).
      armor: new fields.SchemaField({
        value: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        max: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 })
      }),

      morality: new fields.SchemaField({
        path: new fields.StringField({ required: true, initial: "Path of Humanity" }),
        rating: new fields.NumberField({ required: true, integer: true, min: 0, max: 10, initial: 7 })
      }),

      virtues: new fields.SchemaField({
        conscienceConviction: virtueSchema(),
        selfControlInstinct: virtueSchema(),
        courage: virtueSchema()
      }),

      health: healthTrackSchema(),
      bonusHealth: new fields.ArrayField(bonusHealthLevelField()),

      backgrounds: new fields.ArrayField(ratedTraitField()),

      derangements: new fields.ArrayField(new fields.SchemaField({
        name: new fields.StringField({ required: true, initial: "" }),
        description: new fields.StringField({ required: false, blank: true, initial: "" })
      })),

      // A running record of what actually happened to this character
      // in-session - Challenges resolved, Frenzy checks, Powers toggled -
      // since this system is played online rather than face to face, a
      // Storyteller can't just glance across the table to reconstruct a
      // busy night's events afterward. Newest-first is enforced by callers
      // (logAction), not this field itself.
      actionLog: new fields.ArrayField(new fields.SchemaField({
        timestamp: new fields.NumberField({ required: true }),
        summary: new fields.StringField({ required: true, initial: "" })
      })),

      bloodBonds: new fields.ArrayField(new fields.SchemaField({
        name: new fields.StringField({ required: true, initial: "" }),
        // 1-3 covers an ordinary Blood Bond (3 = Full Bond); Sabbat's
        // Vinculum, resolved through the Vaulderie rite, uses the full 1-10
        // scale, so this can't be capped at 3 the way an ordinary bond is.
        level: new fields.NumberField({ required: true, integer: true, min: 1, max: 10, initial: 1 }),
        notes: new fields.StringField({ required: false, blank: true, initial: "" })
      })),

      boons: new fields.ArrayField(new fields.SchemaField({
        who: new fields.StringField({ required: true, initial: "" }),
        type: new fields.StringField({
          required: true, initial: "minor", choices: ["minor", "major", "blood"]
        }),
        direction: new fields.StringField({
          required: true, initial: "owed", choices: ["owed", "owedToMe"]
        }),
        notes: new fields.StringField({ required: false, blank: true, initial: "" })
      })),

      // Spending money (the Mercantile system). Free-form pool; Resources
      // Background still represents lifestyle/standing separately.
      money: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),

      // Purchase ledger - every Mercantile transaction is appended here (and
      // posted to chat) so players and the Storyteller have a record.
      transactions: new fields.ArrayField(new fields.SchemaField({
        when: new fields.StringField({ required: false, blank: true, initial: "" }),
        shop: new fields.StringField({ required: false, blank: true, initial: "" }),
        item: new fields.StringField({ required: false, blank: true, initial: "" }),
        method: new fields.StringField({ required: false, blank: true, initial: "" }),
        cost: new fields.StringField({ required: false, blank: true, initial: "" }),
        notes: new fields.StringField({ required: false, blank: true, initial: "" })
      })),

      biography: new fields.HTMLField({ required: false, blank: true, initial: "" }),
      notes: new fields.HTMLField({ required: false, blank: true, initial: "" })
    };
  }
}

export class VTMNpcData extends VTMCharacterData {
  static defineSchema() {
    const schema = super.defineSchema();
    schema.npcType = new fields.StringField({
      required: true,
      initial: "vampire",
      choices: ["vampire", "ghoul", "mortal", "spirit", "other"]
    });
    // When set, this NPC answers a Challenge automatically with a random
    // gesture (Storyteller convenience) instead of the GM having to respond in
    // the dialog. Bomb is only included in the random pick if bombAccess is on.
    schema.autoChallenge = new fields.BooleanField({ required: false, initial: false });
    schema.bombAccess = new fields.BooleanField({ required: false, initial: false });
    return schema;
  }
}

/**
 * A driveable/rideable vehicle - deliberately its own minimal schema rather
 * than extending VTMCharacterData, since a vehicle has no Attributes,
 * Abilities, Disciplines, Virtues, etc. Grid footprint (width/height, in
 * grid squares) is the field that actually matters for tabletop use - a
 * sedan seats 4 and occupies 4x2 squares, a semi occupies 10x2, and so on -
 * this drives the Actor's prototypeToken size directly (see
 * VTMVehicleSheet._onApplyGridSize) so dragging one onto a scene places a
 * correctly-sized token without the GM having to configure it by hand.
 */
export class VTMVehicleData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      description: new fields.HTMLField({ required: false, blank: true, initial: "" }),
      source: new fields.StringField({ required: false, blank: true, initial: "" }),
      seats: new fields.NumberField({ required: true, integer: true, min: 0, initial: 4 }),
      gridWidth: new fields.NumberField({ required: true, integer: true, min: 1, initial: 4 }),
      gridHeight: new fields.NumberField({ required: true, integer: true, min: 1, initial: 2 }),
      durability: new fields.StringField({ required: false, blank: true, initial: "" }),
      notes: new fields.HTMLField({ required: false, blank: true, initial: "" }),
      // A single shared image (e.g. a top-down car render) can't be
      // recolored procedurally, but Foundry tokens support a "tint" color
      // multiplied onto the texture - toggling this randomizes it from a
      // small palette every time a new token is created from this Actor
      // (see the preCreateToken hook in vtmlarp.mjs), so a dozen Sedans on
      // the same scene don't all look identically navy blue.
      randomizeTint: new fields.BooleanField({ required: true, initial: false })
    };
  }
}
