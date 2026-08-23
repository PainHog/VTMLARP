// Plain-English "gist" data for the Clan Picker — a guided, click-through
// helper that lets a new player find the clan that fits the character they want
// to play without reading every compendium entry first. No Foundry globals here
// so it can be unit-tested (see test/clan-guide.test.mjs). This is a decision
// aid only: it never changes a character or the rules, and every clan has an
// "open full lore" link to the real compendium JournalEntry.
//
// `tags` are player-facing playstyle keywords the search box matches against, so
// someone who types "assassin" is pointed at Assamite, "artist" at Toreador,
// and so on. Keep them lowercase.

export const CLAN_GUIDE = {
  "Assamite": {
    nickname: "The Assassins",
    core: true,
    blurb: "Holy killers and hunters who stalk other vampires and drink their souls — disciplined, deadly, and blood-cursed.",
    tags: ["assassin", "killer", "warrior", "hunter", "stealth", "poison", "mercenary", "diablerie", "muslim", "middle east"]
  },
  "Brujah": {
    nickname: "The Rabble",
    core: true,
    blurb: "Passionate idealists, rebels and brawlers — fast, furious, and always ready to fight for a cause (or just to fight).",
    tags: ["rebel", "fighter", "brawler", "punk", "activist", "warrior", "passionate", "revolutionary", "hothead"]
  },
  "Followers of Set": {
    nickname: "The Serpents",
    core: true,
    blurb: "Tempters and corruptors, cultists of the dark god Set who deal in vice, secrets, and the slow ruin of the righteous.",
    tags: ["tempter", "manipulator", "cultist", "corrupter", "seducer", "dealer", "drugs", "vice", "egyptian", "snake"]
  },
  "Gangrel": {
    nickname: "The Outlanders",
    core: true,
    blurb: "Feral shapeshifting wanderers close to the Beast — animalistic survivors who roam the wild edges of the world.",
    tags: ["feral", "shapeshifter", "loner", "survivalist", "animal", "wild", "wanderer", "beast", "nomad", "wolf"]
  },
  "Giovanni": {
    nickname: "The Necromancers",
    core: true,
    blurb: "A wealthy, incestuous merchant family of death-mages who command ghosts and count their money in centuries.",
    tags: ["necromancer", "money", "family", "mafia", "ghosts", "occult", "banker", "italian", "death", "business"]
  },
  "Lasombra": {
    nickname: "The Keepers",
    core: true,
    blurb: "Aristocratic Sabbat shadow-masters who command living darkness and rule the sect from behind the throne.",
    tags: ["leader", "aristocrat", "shadow", "commander", "ruthless", "predator", "sabbat", "darkness", "noble", "villain"]
  },
  "Malkavian": {
    nickname: "The Lunatics",
    core: true,
    blurb: "Cursed with clan-wide madness that lets them see truths no one else can — insightful, unsettling, and unpredictable.",
    tags: ["madness", "insight", "trickster", "seer", "chaotic", "unpredictable", "crazy", "oracle", "prophet", "fool"]
  },
  "Nosferatu": {
    nickname: "The Lepers",
    core: true,
    blurb: "Hideous, hidden info-brokers and spies who trade every secret in the city from the shadows and the sewers below.",
    tags: ["spy", "information", "stealth", "hidden", "hacker", "broker", "ugly", "monster", "sewer", "networker"]
  },
  "Ravnos": {
    nickname: "The Deceivers",
    core: true,
    blurb: "Wandering tricksters and illusionists — masters of misdirection, larceny, and the con, forever on the move.",
    tags: ["trickster", "illusion", "con", "wanderer", "thief", "deceiver", "gypsy", "traveler", "charlatan", "gambler"]
  },
  "Toreador": {
    nickname: "The Artists",
    core: true,
    blurb: "Enthralled by beauty, art, and passion — social butterflies who charm, seduce, and lose themselves in the sublime.",
    tags: ["artist", "social", "beauty", "seducer", "charmer", "aesthete", "celebrity", "musician", "elegant", "socialite"]
  },
  "Tremere": {
    nickname: "The Warlocks",
    core: true,
    blurb: "A rigid pyramid of blood sorcerers who wield Thaumaturgy — scholarly, ambitious, and distrusted by all.",
    tags: ["mage", "sorcerer", "scholar", "wizard", "blood magic", "ambitious", "warlock", "occult", "ritual", "clique"]
  },
  "Tzimisce": {
    nickname: "The Fiends",
    core: true,
    blurb: "Flesh-crafting Sabbat scholars and monsters, bound to their ancestral land, who reshape body and bone as art.",
    tags: ["monster", "flesh", "body horror", "scholar", "torturer", "transformer", "sabbat", "fiend", "surgeon", "alien"]
  },
  "Ventrue": {
    nickname: "The Blue Bloods",
    core: true,
    blurb: "Regal leaders and rulers — the clan of kings, who dominate others and expect to be obeyed as a matter of course.",
    tags: ["leader", "ruler", "noble", "commander", "businessman", "politician", "king", "aristocrat", "boss", "wealthy"]
  },
  "Caitiff": {
    nickname: "The Clanless",
    core: true,
    blurb: "Vampires of no clan — no fixed Disciplines, no birthright, and no limits: free to become anything at all.",
    tags: ["clanless", "versatile", "freedom", "underdog", "blank slate", "orphan", "custom", "flexible"]
  },

  // Bloodlines & rarer lineages.
  "Baali": {
    nickname: "The Demons",
    blurb: "Infernalist heretics who consort with demons and worship the things that sleep beneath the world.",
    tags: ["demon", "infernalist", "villain", "cultist", "occult", "evil"]
  },
  "Cappadocian": {
    nickname: "The Graverobbers",
    blurb: "Ancient death-scholars who study mortality and the dead — the extinct forebears of the Giovanni.",
    tags: ["death", "scholar", "necromancer", "occult", "philosopher", "graverobber", "ancient"]
  },
  "Salubri": {
    nickname: "The Healers",
    blurb: "A nearly-extinct clan of healers and cyclopean warrior-saints with a third eye, hunted to the brink by the Tremere.",
    tags: ["healer", "warrior", "saint", "protector", "outcast", "hunted", "third eye", "monk"]
  },
  "Blood Brothers": {
    nickname: "The Slaves",
    blurb: "Engineered Sabbat war-ghouls fused into a single hive-minded pack that fights, and dies, as one.",
    tags: ["soldier", "pack", "warrior", "disposable", "sabbat", "hivemind", "engineered"]
  },
  "Harbingers of Skulls": {
    nickname: "The Returned",
    blurb: "Vengeful death-mages risen from oblivion — the wronged Cappadocians come back for the Giovanni who supplanted them.",
    tags: ["necromancer", "vengeful", "death", "undead", "sabbat", "skull", "revenge"]
  },
  "Kiasyd": {
    nickname: "The Fey-Touched",
    blurb: "Scholarly, alien Lasombra offshoots warped by faerie blood — collectors of secrets, riddles, and strange lore.",
    tags: ["scholar", "alien", "fae", "mystery", "collector", "riddle", "strange"]
  },
  "Panders": {
    nickname: "The Pander",
    blurb: "Clanless Sabbat who earned their name and a seat at the table through sheer merit — the self-made of the sect.",
    tags: ["clanless", "self-made", "versatile", "underdog", "sabbat", "orphan"]
  },
  "Gargoyle": {
    nickname: "The Slaves",
    blurb: "Winged servitor creatures the Tremere bred for war — stone-skinned guardians now breaking their chains.",
    tags: ["flight", "warrior", "servant", "guardian", "monster", "stone", "wings"]
  },
  "Daughters of Cacophony": {
    nickname: "The Sirens",
    blurb: "Eerie singers whose supernatural voices work miracles and madness — performers on an unearthly stage.",
    tags: ["singer", "artist", "social", "siren", "performer", "voice", "music"]
  },
  "True Brujah": {
    nickname: "The Bloodless",
    blurb: "Cold, calculating scholars who manipulate time itself — the passionless opposite of their fiery cousins.",
    tags: ["scholar", "cold", "time", "calculating", "analyst", "detached", "logical"]
  },
  "Nagaraja": {
    nickname: "The Flesh-Eaters",
    blurb: "Cannibalistic necromancer-sorcerers who must devour the flesh of the living to survive.",
    tags: ["necromancer", "cannibal", "occult", "monster", "flesh eater", "death"]
  },
  "Samedi": {
    nickname: "The Stiffs",
    blurb: "Rotting, plague-bearing death-priests of the Caribbean who wear their own decay like a mask.",
    tags: ["death", "rot", "mercenary", "horror", "voodoo", "plague", "corpse"]
  },
  "Lamia": {
    nickname: "The Deathless",
    blurb: "A bloodline of plague-priestess warriors devoted to a dark mother of death — guardians of the Cappadocians.",
    tags: ["warrior", "priestess", "death", "plague", "protector", "bodyguard", "cult"]
  }
};

// One-sentence gist of each Discipline the picker might show. Keys must match
// the Discipline names used in CLAN_DISCIPLINES / the compendium.
export const DISCIPLINE_BLURB = {
  "Animalism": "Command beasts and commune with the Beast inside others.",
  "Auspex": "Preternatural senses — read auras, pierce illusions, perceive the unseen.",
  "Celerity": "Supernatural speed and extra actions in a challenge.",
  "Chimerstry": "Weave illusions that fool every sense.",
  "Daimoinon": "Draw on infernal power bargained from demons.",
  "Dementation": "Spread madness and unravel the minds of others.",
  "Dominate": "Control minds and implant commands with a look.",
  "Fortitude": "Supernatural toughness that shrugs off wounds.",
  "Melpominee": "Sing miracles and madness with an unearthly voice.",
  "Mortis": "Ancient death-magic that decays, kills, and animates the dead.",
  "Mytherceria": "Fae-touched sorcery of riddles, cold iron, and enchantment.",
  "Necromancy": "Summon and command ghosts and the restless dead.",
  "Obeah": "Heal body and soul through the mystic third eye.",
  "Obfuscate": "Vanish from sight and move unseen.",
  "Obtenebration": "Command living shadows and smothering darkness.",
  "Potence": "Raw, crushing supernatural strength.",
  "Presence": "Awe, draw, and sway crowds with supernatural charisma.",
  "Protean": "Shapeshift — claws, beast and mist forms, and melding into the earth.",
  "Quietus": "The Assamite's silent arts of poisoned blood and quiet death.",
  "Sanguinus": "Share blood, senses, and powers across a fused pack.",
  "Serpentis": "The serpent-gifts of Set — stolen hearts, snake form, hypnotic eyes.",
  "Temporis": "Bend, hasten, and halt the flow of time itself.",
  "Thanatosis": "Rot and wither living flesh with a touch.",
  "Thaumaturgy": "Versatile, dangerous Tremere blood sorcery.",
  "Valeren": "The Salubri's third-eye path of healing and righteous war.",
  "Vicissitude": "Reshape flesh and bone into art or horror.",
  "Visceratika": "Turn skin to stone and walk through solid rock."
};

/**
 * Score/filter clans by a free-text query against name, nickname, blurb and
 * playstyle tags. Empty query returns every clan (unscored). Pure and testable.
 * @param {string} query
 * @param {string[]} clanNames  the clans to consider (order preserved on ties)
 * @returns {string[]} matching clan names, best match first
 */
export function searchClans(query, clanNames) {
  const q = (query ?? "").trim().toLowerCase();
  if (!q) return [...clanNames];
  const terms = q.split(/\s+/).filter(Boolean);
  const scored = [];
  clanNames.forEach((name, i) => {
    const g = CLAN_GUIDE[name] ?? {};
    const hay = {
      name: name.toLowerCase(),
      nick: (g.nickname ?? "").toLowerCase(),
      blurb: (g.blurb ?? "").toLowerCase(),
      tags: (g.tags ?? []).map(t => t.toLowerCase())
    };
    let score = 0;
    for (const t of terms) {
      if (hay.name === t) score += 100;
      else if (hay.name.includes(t)) score += 40;
      if (hay.tags.some(tag => tag === t)) score += 30;
      else if (hay.tags.some(tag => tag.includes(t))) score += 15;
      if (hay.nick.includes(t)) score += 10;
      if (hay.blurb.includes(t)) score += 5;
    }
    if (score > 0) scored.push({ name, score, i });
  });
  scored.sort((a, b) => b.score - a.score || a.i - b.i);
  return scored.map(s => s.name);
}
