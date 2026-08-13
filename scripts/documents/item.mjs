const { fields } = foundry.data;

class BaseItemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      description: new fields.HTMLField({ required: false, blank: true, initial: "" }),
      source: new fields.StringField({ required: false, blank: true, initial: "" }),
      // A GM-curated flag (e.g. for Disciplines/Rituals/Paths deemed too
      // powerful to hand out without a conversation first) - shown as a
      // badge on the actor sheet rather than a hard drag-drop block, since
      // the Storyteller is the one enforcing it at the table either way.
      stApprovalRequired: new fields.BooleanField({ required: true, initial: false })
    };
  }
}

export class VTMAttributeData extends BaseItemData {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      category: new fields.StringField({
        required: true,
        initial: "physical",
        choices: ["physical", "social", "mental"]
      }),
      negative: new fields.BooleanField({ required: true, initial: false })
    };
  }
}

export class VTMAbilityData extends BaseItemData {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      category: new fields.StringField({
        required: true,
        initial: "talent",
        choices: ["talent", "skill", "knowledge"]
      }),
      rating: new fields.NumberField({ required: true, integer: true, min: 0, initial: 1 })
    };
  }
}

export class VTMDisciplineData extends BaseItemData {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      clanAffinity: new fields.StringField({ required: false, blank: true, initial: "" }),
      rating: new fields.NumberField({ required: true, integer: true, min: 0, initial: 1 }),
      retestAbility: new fields.StringField({ required: false, blank: true, initial: "" })
    };
  }
}

export class VTMPowerData extends BaseItemData {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      discipline: new fields.StringField({ required: false, blank: true, initial: "" }),
      // The power's sequential level within its Discipline (1 = first power
      // learned, 2 = second, ...). 0 = unset. Shown on the sheet as "(N)".
      seq: new fields.NumberField({ required: false, integer: true, min: 0, initial: 0 }),
      level: new fields.StringField({
        required: true,
        initial: "basic",
        // "elder" covers the rare Elder-tier powers (e.g. Loki's Gift,
        // Song in the Dark) beyond the normal Basic/Intermediate/Advanced
        // progression - it was missing here even though several compendium
        // entries legitimately use it, which silently failed schema
        // validation (and therefore drag-and-drop onto a sheet) for them.
        choices: ["basic", "intermediate", "advanced", "elder"]
      }),
      challengeType: new fields.StringField({
        required: true,
        initial: "physical",
        choices: ["physical", "social", "mental", "static", "none"]
      }),
      bloodCost: new fields.StringField({ required: false, blank: true, initial: "" }),
      retestAbility: new fields.StringField({ required: false, blank: true, initial: "" }),
      duration: new fields.StringField({ required: false, blank: true, initial: "" }),
      activation: new fields.StringField({
        required: true,
        initial: "challenge",
        // passive: always on, no action needed (e.g. Auspex: Heightened Senses)
        // toggle: switched on/off and stays on until the player turns it off (e.g. Obfuscate, many Chimerstry illusions)
        // reflexive: a quick declared action with no challenge, but not always-on (e.g. Celerity bursts)
        // challenge: requires winning a Trait challenge each time it's used
        choices: ["passive", "toggle", "reflexive", "challenge"]
      }),
      active: new fields.BooleanField({ required: true, initial: false }),
      // Comma-separated list of "Discipline Name" or "Discipline Name (rating)" prerequisites,
      // e.g. "Animalism (2), Dominate (2)" for a combination Discipline. Free text so it can
      // describe "or" conditions (e.g. "Fortitude or Potence") that a strict structured field can't.
      prerequisites: new fields.StringField({ required: false, blank: true, initial: "" }),

      // Body-modification powers (Vicissitude: Horrid Form, etc.): while toggled
      // on, add these many Physical Traits (to the pool) and bonus Health
      // levels. Applied/removed automatically when the power is switched on/off.
      bodyMod: new fields.SchemaField({
        physical: new fields.NumberField({ required: false, integer: true, initial: 0 }),
        health: new fields.NumberField({ required: false, integer: true, initial: 0 }),
        // Fleshcraft/Bonecraft-style powers where the player chooses what to
        // add/remove each use (Physical/Social/Mental Traits or Health levels)
        // from a dialog, rather than a fixed bonus.
        choose: new fields.BooleanField({ required: false, initial: false })
      })
    };
  }
}

export class VTMBackgroundData extends BaseItemData {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      rating: new fields.NumberField({ required: true, integer: true, min: 0, initial: 1 })
    };
  }
}

export class VTMMeritData extends BaseItemData {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      cost: new fields.NumberField({ required: true, integer: true, min: 0, initial: 1 }),
      category: new fields.StringField({ required: false, blank: true, initial: "" })
    };
  }
}

export class VTMFlawData extends BaseItemData {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      bonus: new fields.NumberField({ required: true, integer: true, min: 0, initial: 1 }),
      category: new fields.StringField({ required: false, blank: true, initial: "" })
    };
  }
}

export class VTMVirtueData extends BaseItemData {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      rating: new fields.NumberField({ required: true, integer: true, min: 0, max: 5, initial: 1 })
    };
  }
}

export class VTMRitualData extends BaseItemData {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      path: new fields.StringField({ required: false, blank: true, initial: "" }),
      level: new fields.NumberField({ required: true, integer: true, min: 1, initial: 1 }),
      bloodCost: new fields.StringField({ required: false, blank: true, initial: "" })
    };
  }
}

export class VTMGearData extends BaseItemData {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      quantity: new fields.NumberField({ required: true, integer: true, min: 0, initial: 1 }),
      traitBonus: new fields.StringField({ required: false, blank: true, initial: "" })
    };
  }
}
