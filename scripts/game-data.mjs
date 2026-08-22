// Shared game reference data — the single source of truth for values that the
// actor sheet, the Character Builder, and the actor data model all need. These
// used to be copied into each of those files and had drifted apart (the builder
// offered fewer Paths than the sheet, and three separate Generation tables were
// maintained by hand). No Foundry globals here, so it's unit-testable.

export const GENERATION_OPTIONS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

export const ARCHETYPE_OPTIONS = [
  "Architect", "Autocrat", "Bon Vivant", "Bravo", "Caregiver", "Cavalier",
  "Celebrant", "Conformist", "Conniver", "Curmudgeon", "Deviant", "Director",
  "Fanatic", "Gallant", "Judge", "Loner", "Martyr", "Masochist", "Monster",
  "Pedagogue", "Perfectionist", "Rebel", "Rogue", "Survivor", "Thrill-Seeker",
  "Traditionalist", "Trickster", "Visionary"
];

export const PATH_OPTIONS = [
  "Path of Humanity", "Path of Blood (Assamite)", "Path of Caine", "Path of Cathari",
  "Path of Death and the Soul", "Path of Ecstasy", "Path of Evil Revelations",
  "Path of Harmony", "Path of Honorable Accord", "Path of Lilith",
  "Path of Night: Variants (Lasombra)", "Path of Night",
  "Mayaparisatya: The Path of Paradox (True)", "Path of Paradox (Ravnos)",
  "Path of Power and the Inner Voice", "Path of the Feral Heart", "Path of the Warrior",
  "Path of Typhon (Setite)", "Road of the Beast (Dark Ages)", "Road of Heaven (Dark Ages)",
  "Road of Humanity (Dark Ages)", "Road of Kings (Dark Ages)", "Road of Sin (Dark Ages)",
  "Road of the Bones (Dark Ages)", "Road of the Hive (Dark Ages, Baali)"
];

// The Generation chart from Laws of the Night Revised (Character Creation and
// Traits, p. 95): Max. Traits (in your primary Attribute category), Max.
// Abilities (highest level in any one Ability), Blood Pool max/per-turn spend,
// and starting/max Willpower. Only 4th-15th generation are included - lower
// generations are vanishingly rare for MET player characters.
export const GENERATION_TABLE = {
  15: { maxTraits: 10, maxAbilities: 5, bloodMax: 10, bloodPerTurn: 1, willpowerStart: 2, willpowerMax: 6 },
  14: { maxTraits: 10, maxAbilities: 5, bloodMax: 10, bloodPerTurn: 1, willpowerStart: 2, willpowerMax: 6 },
  13: { maxTraits: 10, maxAbilities: 5, bloodMax: 10, bloodPerTurn: 1, willpowerStart: 2, willpowerMax: 6 },
  12: { maxTraits: 10, maxAbilities: 5, bloodMax: 11, bloodPerTurn: 1, willpowerStart: 2, willpowerMax: 8 },
  11: { maxTraits: 11, maxAbilities: 5, bloodMax: 12, bloodPerTurn: 1, willpowerStart: 4, willpowerMax: 8 },
  10: { maxTraits: 12, maxAbilities: 5, bloodMax: 13, bloodPerTurn: 1, willpowerStart: 4, willpowerMax: 10 },
  9: { maxTraits: 13, maxAbilities: 5, bloodMax: 14, bloodPerTurn: 2, willpowerStart: 6, willpowerMax: 10 },
  8: { maxTraits: 14, maxAbilities: 5, bloodMax: 15, bloodPerTurn: 3, willpowerStart: 6, willpowerMax: 12 },
  7: { maxTraits: 16, maxAbilities: 6, bloodMax: 20, bloodPerTurn: 5, willpowerStart: 7, willpowerMax: 14 },
  6: { maxTraits: 18, maxAbilities: 7, bloodMax: 30, bloodPerTurn: 6, willpowerStart: 8, willpowerMax: 16 },
  5: { maxTraits: 20, maxAbilities: 8, bloodMax: 40, bloodPerTurn: 8, willpowerStart: 9, willpowerMax: 18 },
  4: { maxTraits: 25, maxAbilities: 9, bloodMax: 50, bloodPerTurn: 10, willpowerStart: 10, willpowerMax: 20 }
};
