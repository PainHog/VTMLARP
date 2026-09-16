// Clan/bloodline data used by the Character Builder. Kept in its own module
// (no Foundry globals) so it can be unit-tested against the compendium content.

export const CLANS = [
  "Assamite", "Brujah", "Followers of Set", "Gangrel", "Giovanni", "Lasombra",
  "Malkavian", "Nosferatu", "Ravnos", "Toreador", "Tremere", "Tzimisce",
  "Ventrue", "Baali", "Cappadocian", "Salubri", "Blood Brothers",
  "Harbingers of Skulls", "Kiasyd", "Panders", "Gargoyle",
  "Daughters of Cacophony", "True Brujah", "Nagaraja", "Samedi", "Lamia",
  "Caitiff",
  // Sabbat antitribu selectable as their own clan (their lore lives in the
  // `antitribu` pack). Blood Brothers, Harbingers of Skulls, Kiasyd and Panders
  // are already listed above under their own names.
  "Assamite Antitribu", "Brujah Antitribu", "Gangrel Antitribu",
  "Malkavian Antitribu", "Nosferatu Antitribu", "Ravnos Antitribu",
  "Salubri Antitribu", "Serpents of the Light", "Toreador Antitribu",
  "Ventrue Antitribu"
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
  "Salubri": ["Auspex", "Fortitude", "Obeah"],
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
  "Caitiff": [],
  // Sabbat antitribu in-clan Disciplines (per the sourcebook lore entries).
  "Assamite Antitribu": ["Celerity", "Obfuscate", "Quietus"],
  "Brujah Antitribu": ["Celerity", "Potence", "Presence"],
  "Gangrel Antitribu": ["Celerity", "Obfuscate", "Protean"], // City Gangrel
  "Malkavian Antitribu": ["Auspex", "Dementation", "Obfuscate"],
  "Nosferatu Antitribu": ["Animalism", "Obfuscate", "Potence"],
  "Ravnos Antitribu": ["Animalism", "Chimerstry", "Fortitude"],
  "Salubri Antitribu": ["Auspex", "Fortitude", "Valeren"],
  "Serpents of the Light": ["Obfuscate", "Presence", "Serpentis"],
  "Toreador Antitribu": ["Auspex", "Celerity", "Presence"],
  "Ventrue Antitribu": ["Dominate", "Fortitude", "Presence"]
};
