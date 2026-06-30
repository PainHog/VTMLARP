const { fields } = foundry.data;

class BaseItemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      description: new fields.HTMLField({ required: false, blank: true, initial: "" }),
      source: new fields.StringField({ required: false, blank: true, initial: "" })
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
      level: new fields.StringField({
        required: true,
        initial: "basic",
        choices: ["basic", "intermediate", "advanced"]
      }),
      challengeType: new fields.StringField({
        required: true,
        initial: "physical",
        choices: ["physical", "social", "mental", "static", "none"]
      }),
      bloodCost: new fields.StringField({ required: false, blank: true, initial: "" }),
      retestAbility: new fields.StringField({ required: false, blank: true, initial: "" }),
      duration: new fields.StringField({ required: false, blank: true, initial: "" }),
      system_: new fields.StringField({ required: false, blank: true, initial: "" }),
      activation: new fields.StringField({
        required: true,
        initial: "challenge",
        // passive: always on, no action needed (e.g. Auspex: Heightened Senses)
        // toggle: switched on/off and stays on until the player turns it off (e.g. Obfuscate, many Chimerstry illusions)
        // reflexive: a quick declared action with no challenge, but not always-on (e.g. Celerity bursts)
        // challenge: requires winning a Trait challenge each time it's used
        choices: ["passive", "toggle", "reflexive", "challenge"]
      }),
      active: new fields.BooleanField({ required: true, initial: false })
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
