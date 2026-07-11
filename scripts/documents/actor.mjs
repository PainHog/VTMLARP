const { fields } = foundry.data;

/** A single named Trait the character has bid points into (e.g. an Ability, Background, Discipline). */
function ratedTraitField(initial = {}) {
  return new fields.SchemaField({
    name: new fields.StringField({ required: true, initial: "" }),
    rating: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
    notes: new fields.StringField({ required: false, blank: true, initial: "" })
  }, initial);
}

function traitField() {
  return new fields.SchemaField({
    name: new fields.StringField({ required: true, initial: "" }),
    spent: new fields.BooleanField({ required: true, initial: false })
  });
}

function attributeCategorySchema() {
  return new fields.SchemaField({
    priority: new fields.StringField({
      required: true,
      initial: "tertiary",
      choices: ["primary", "secondary", "tertiary"]
    }),
    traits: new fields.ArrayField(traitField())
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

export class VTMCharacterData extends foundry.abstract.TypeDataModel {
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

      negativeTraits: new fields.ArrayField(traitField()),

      abilities: new fields.SchemaField({
        talents: new fields.ArrayField(ratedTraitField()),
        skills: new fields.ArrayField(ratedTraitField()),
        knowledges: new fields.ArrayField(ratedTraitField())
      }),

      willpower: new fields.SchemaField({
        value: new fields.NumberField({ required: true, integer: true, min: 0, initial: 1 }),
        max: new fields.NumberField({ required: true, integer: true, min: 0, initial: 1 })
      }),

      experience: new fields.SchemaField({
        value: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 })
      }),

      blood: new fields.SchemaField({
        value: new fields.NumberField({ required: true, integer: true, min: 0, initial: 10 }),
        max: new fields.NumberField({ required: true, integer: true, min: 0, initial: 10 }),
        perTurn: new fields.NumberField({ required: true, integer: true, min: 0, initial: 1 })
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

      freeTraits: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),

      derangements: new fields.ArrayField(new fields.SchemaField({
        name: new fields.StringField({ required: true, initial: "" }),
        description: new fields.StringField({ required: false, blank: true, initial: "" })
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
    return schema;
  }
}
