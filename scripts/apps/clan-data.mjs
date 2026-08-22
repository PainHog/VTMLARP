// Clan/bloodline data used by the Character Builder. Kept in its own module
// (no Foundry globals) so it can be unit-tested against the compendium content.

export const CLANS = [
  "Assamite", "Brujah", "Followers of Set", "Gangrel", "Giovanni", "Lasombra",
  "Malkavian", "Nosferatu", "Ravnos", "Toreador", "Tremere", "Tzimisce",
  "Ventrue", "Baali", "Cappadocian", "Salubri", "Blood Brothers",
  "Harbingers of Skulls", "Kiasyd", "Panders", "Gargoyle",
  "Daughters of Cacophony", "True Brujah", "Nagaraja", "Samedi", "Lamia",
  "Caitiff"
];

// The three in-clan Disciplines each clan/bloodline learns most easily. When a
// clan is picked on the Concept step these are auto-added (at 0 dots) to the
// Disciplines step, where each row is a dropdown the player can swap for a
// different Discipline before assigning points. Caitiff/Panders have no fixed
// three, so they start blank. Names must match the compendium Discipline
// entries exactly (enforced by test/clan-data.test.mjs).
export const CLAN_DISCIPLINES = {
  "Assamite": ["Celerity", "Obfuscate", "Quietus"],
  "Brujah": ["Celerity", "Potence", "Presence"],
  "Followers of Set": ["Obfuscate", "Presence", "Serpentis"],
  "Gangrel": ["Animalism", "Fortitude", "Protean"],
  "Giovanni": ["Dominate", "Necromancy", "Potence"],
  "Lasombra": ["Dominate", "Obtenebration", "Potence"],
  "Malkavian": ["Auspex", "Dementation", "Obfuscate"],
  "Nosferatu": ["Animalism", "Obfuscate", "Potence"],
  "Ravnos": ["Animalism", "Chimerstry", "Fortitude"],
  "Toreador": ["Auspex", "Celerity", "Presence"],
  "Tremere": ["Auspex", "Dominate", "Thaumaturgy"],
  "Tzimisce": ["Animalism", "Auspex", "Vicissitude"],
  "Ventrue": ["Dominate", "Fortitude", "Presence"],
  "Baali": ["Daimoinon", "Obfuscate", "Presence"],
  "Cappadocian": ["Auspex", "Fortitude", "Mortis"],
  "Salubri": ["Auspex", "Fortitude", "Valeren"],
  "Blood Brothers": ["Fortitude", "Potence", "Sanguinus"],
  "Harbingers of Skulls": ["Auspex", "Fortitude", "Necromancy"],
  "Kiasyd": ["Dominate", "Mytherceria", "Obtenebration"],
  "Panders": [],
  "Gargoyle": ["Fortitude", "Potence", "Visceratika"],
  "Daughters of Cacophony": ["Fortitude", "Melpominee", "Presence"],
  "True Brujah": ["Potence", "Presence", "Temporis"],
  "Nagaraja": ["Auspex", "Dominate", "Necromancy"],
  "Samedi": ["Fortitude", "Obfuscate", "Thanatosis"],
  "Lamia": ["Fortitude", "Mortis", "Potence"],
  "Caitiff": []
};
