// Plain-English "gist" data for the Clan Picker — a guided, click-through
// helper that lets a new player find the clan that fits the character they want
// to play without reading every compendium entry first. No Foundry globals here
// so it can be unit-tested (see test/clan-guide.test.mjs). It also matches on the
// clan's Disciplines, so typing "dominate" surfaces every clan that gets it. This is a decision
import { CLAN_DISCIPLINES } from "./clan-data.mjs";

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
    tags: ["assassin", "assassination", "killer", "murderer", "hitman", "ninja", "silent", "stealth", "sneaky", "warrior", "hunter", "stalker", "poison", "poisoner", "toxic", "mercenary", "hitwoman", "sniper", "executioner", "judge", "zealot", "blade", "sword", "martial artist", "contract killer", "bounty hunter", "diablerie", "muslim", "middle east"]
  },
  "Brujah": {
    nickname: "The Rabble",
    core: true,
    blurb: "Passionate idealists, rebels and brawlers — fast, furious, and always ready to fight for a cause (or just to fight).",
    tags: ["rebel", "rebellious", "fighter", "brawler", "brawling", "punk", "activist", "warrior", "passionate", "revolutionary", "anarchist", "hothead", "angry", "soldier", "thug", "gangster", "biker", "boxer", "gladiator", "streetfighter", "rioter", "protester", "idealist", "firebrand", "muscle", "tough", "berserker", "melee"]
  },
  "Followers of Set": {
    nickname: "The Serpents",
    core: true,
    blurb: "Tempters and corruptors, cultists of the dark god Set who deal in vice, secrets, and the slow ruin of the righteous.",
    tags: ["tempter", "temptation", "manipulator", "manipulative", "cultist", "cult leader", "corrupter", "corrupting", "seducer", "seductive", "dealer", "drugs", "drug dealer", "pusher", "vice", "smuggler", "blackmailer", "kingpin", "pimp", "crime lord", "con artist", "occultist", "priest", "serpent", "snake", "schemer", "egyptian"]
  },
  "Gangrel": {
    nickname: "The Outlanders",
    core: true,
    blurb: "Feral shapeshifting wanderers close to the Beast — animalistic survivors who roam the wild edges of the world.",
    tags: ["feral", "shapeshifter", "shapechanger", "werewolf", "loner", "survivalist", "survivor", "animal", "animalistic", "wild", "wilderness", "wanderer", "beast", "nomad", "drifter", "wolf", "bear", "druid", "ranger", "tracker", "hermit", "savage", "primal", "barbarian", "outdoorsman", "outsider", "hunter", "biker"]
  },
  "Giovanni": {
    nickname: "The Necromancers",
    core: true,
    blurb: "A wealthy, incestuous merchant family of death-mages who command ghosts and count their money in centuries.",
    tags: ["necromancer", "necromancy", "money", "rich", "wealthy", "family", "mafia", "mobster", "mob", "don", "gangster", "ghosts", "ghost talker", "spirits", "medium", "seance", "occult", "banker", "financier", "business", "businessman", "merchant", "tycoon", "corporate", "crime family", "undertaker", "mortician", "death", "italian"]
  },
  "Lasombra": {
    nickname: "The Keepers",
    core: true,
    blurb: "Aristocratic Sabbat shadow-masters who command living darkness and rule the sect from behind the throne.",
    tags: ["leader", "aristocrat", "shadow", "shadows", "shadowy", "dark", "darkness", "commander", "ruthless", "predator", "sabbat", "noble", "villain", "villainous", "manipulator", "mastermind", "schemer", "tyrant", "overlord", "dominator", "power", "ambitious", "cardinal", "bishop", "cult", "elegant", "sinister"]
  },
  "Malkavian": {
    nickname: "The Lunatics",
    core: true,
    blurb: "Cursed with clan-wide madness that lets them see truths no one else can — insightful, unsettling, and unpredictable.",
    tags: ["madness", "mad", "insane", "insanity", "crazy", "lunatic", "unhinged", "insight", "insightful", "trickster", "seer", "oracle", "prophet", "psychic", "visionary", "chaotic", "chaos", "unpredictable", "wildcard", "fool", "joker", "clown", "jester", "weird", "eccentric", "cryptic", "mystic", "creepy"]
  },
  "Nosferatu": {
    nickname: "The Lepers",
    core: true,
    blurb: "Hideous, hidden info-brokers and spies who trade every secret in the city from the shadows and the sewers below.",
    tags: ["spy", "spying", "espionage", "information", "informant", "info broker", "secrets", "stealth", "sneaky", "sneak", "hidden", "invisible", "hacker", "tech", "computers", "surveillance", "infiltrator", "scout", "lurker", "gossip", "eavesdropper", "blackmailer", "networker", "ugly", "hideous", "monster", "creep", "rat", "sewer", "underground"]
  },
  "Ravnos": {
    nickname: "The Deceivers",
    core: true,
    blurb: "Wandering tricksters and illusionists — masters of misdirection, larceny, and the con, forever on the move.",
    tags: ["trickster", "trick", "illusion", "illusionist", "magician", "con", "con artist", "conman", "grifter", "swindler", "hustler", "thief", "stealing", "pickpocket", "rogue", "deceiver", "liar", "gypsy", "traveler", "roamer", "wanderer", "nomad", "charlatan", "gambler", "showman", "prankster", "fortune teller", "trickery", "sleight of hand"]
  },
  "Toreador": {
    nickname: "The Artists",
    core: true,
    blurb: "Enthralled by beauty, art, and passion — social butterflies who charm, seduce, and lose themselves in the sublime.",
    tags: ["artist", "art", "artistic", "social", "socialite", "beauty", "beautiful", "seducer", "seductive", "lover", "romantic", "charmer", "charming", "charismatic", "aesthete", "celebrity", "famous", "musician", "painter", "poet", "dancer", "model", "actor", "performer", "fashion", "diva", "muse", "sculptor", "sensual", "glamorous", "elegant", "connoisseur"]
  },
  "Tremere": {
    nickname: "The Warlocks",
    core: true,
    blurb: "A rigid pyramid of blood sorcerers who wield Thaumaturgy — scholarly, ambitious, and distrusted by all.",
    tags: ["mage", "magic", "magic user", "sorcerer", "sorcery", "wizard", "warlock", "witch", "spellcaster", "blood magic", "scholar", "academic", "researcher", "alchemist", "arcane", "occult", "occultist", "ritual", "magus", "mystic", "esoteric", "cabal", "ambitious", "calculating", "secretive", "spooky", "caster"]
  },
  "Tzimisce": {
    nickname: "The Fiends",
    core: true,
    blurb: "Flesh-crafting Sabbat scholars and monsters, bound to their ancestral land, who reshape body and bone as art.",
    tags: ["monster", "monstrous", "flesh", "flesh crafter", "body horror", "gore", "scholar", "torturer", "sadist", "transformer", "shapeshifter", "mutant", "mutation", "sabbat", "fiend", "surgeon", "doctor", "butcher", "mad scientist", "experimenter", "deformed", "grotesque", "twisted", "gothic", "aristocrat", "warlord", "alien", "creepy"]
  },
  "Ventrue": {
    nickname: "The Blue Bloods",
    core: true,
    blurb: "Regal leaders and rulers — the clan of kings, who dominate others and expect to be obeyed as a matter of course.",
    tags: ["leader", "ruler", "rulership", "noble", "nobility", "commander", "boss", "businessman", "business", "politician", "politics", "king", "queen", "aristocrat", "wealthy", "rich", "ceo", "executive", "tycoon", "magnate", "lord", "statesman", "senator", "elite", "blueblood", "prince", "authority", "dignified", "refined", "controlled", "dominator", "manager"]
  },
  "Caitiff": {
    nickname: "The Clanless",
    core: true,
    blurb: "Vampires of no clan — no fixed Disciplines, no birthright, and no limits: free to become anything at all.",
    tags: ["clanless", "no clan", "versatile", "freedom", "free", "underdog", "blank slate", "orphan", "custom", "flexible", "independent", "jack of all trades", "generic", "anything", "mutt", "wildcard", "self made", "thin blood", "adaptable"]
  },

  // Bloodlines & rarer lineages.
  "Baali": {
    nickname: "The Demons",
    blurb: "Infernalist heretics who consort with demons and worship the things that sleep beneath the world.",
    tags: ["demon", "demonic", "infernalist", "devil worshiper", "satanist", "villain", "evil", "cultist", "dark priest", "heretic", "occult", "corrupt", "sinister"]
  },
  "Cappadocian": {
    nickname: "The Graverobbers",
    blurb: "Ancient death-scholars who study mortality and the dead — the extinct forebears of the Giovanni.",
    tags: ["death", "scholar", "necromancer", "necromancy", "occult", "philosopher", "professor", "graverobber", "undertaker", "mortician", "thanatologist", "morbid", "monk", "ancient"]
  },
  "Salubri": {
    nickname: "The Healers",
    blurb: "A nearly-extinct clan of healers and cyclopean warrior-saints with a third eye, hunted to the brink by the Tremere.",
    tags: ["healer", "healing", "medic", "warrior", "saint", "holy", "cleric", "paladin", "priest", "monk", "protector", "guardian", "defender", "redeemer", "martyr", "righteous", "outcast", "hunted", "third eye", "mystic"]
  },
  "Blood Brothers": {
    nickname: "The Slaves",
    blurb: "Engineered Sabbat war-ghouls fused into a single hive-minded pack that fights, and dies, as one.",
    tags: ["soldier", "pack", "warrior", "brute", "tank", "disposable", "expendable", "grunt", "squad", "twin", "clone", "war ghoul", "sabbat", "hivemind", "engineered", "fused"]
  },
  "Harbingers of Skulls": {
    nickname: "The Returned",
    blurb: "Vengeful death-mages risen from oblivion — the wronged Cappadocians come back for the Giovanni who supplanted them.",
    tags: ["necromancer", "necromancy", "vengeful", "revenge", "avenger", "death", "deathmage", "undead", "wraith", "spectral", "grim", "sabbat", "skull", "returned", "betrayed"]
  },
  "Kiasyd": {
    nickname: "The Fey-Touched",
    blurb: "Scholarly, alien Lasombra offshoots warped by faerie blood — collectors of secrets, riddles, and strange lore.",
    tags: ["scholar", "bookish", "lorekeeper", "alien", "otherworldly", "fae", "faerie", "changeling", "mystery", "enigmatic", "collector", "riddle", "strange", "weird", "eldritch", "occult"]
  },
  "Panders": {
    nickname: "The Pander",
    blurb: "Clanless Sabbat who earned their name and a seat at the table through sheer merit — the self-made of the sect.",
    tags: ["clanless", "no clan", "self made", "versatile", "adaptable", "underdog", "survivor", "everyman", "sabbat", "orphan"]
  },
  "Gargoyle": {
    nickname: "The Slaves",
    blurb: "Winged servitor creatures the Tremere bred for war — stone-skinned guardians now breaking their chains.",
    tags: ["flight", "flying", "flyer", "winged", "wings", "warrior", "tank", "brute", "servant", "freed slave", "guardian", "sentinel", "protector", "monster", "golem", "gargoyle", "stone", "living statue"]
  },
  "Daughters of Cacophony": {
    nickname: "The Sirens",
    blurb: "Eerie singers whose supernatural voices work miracles and madness — performers on an unearthly stage.",
    tags: ["singer", "singing", "songstress", "vocalist", "voice", "music", "musician", "opera", "artist", "social", "siren", "performer", "diva", "muse", "hypnotic", "sound"]
  },
  "True Brujah": {
    nickname: "The Bloodless",
    blurb: "Cold, calculating scholars who manipulate time itself — the passionless opposite of their fiery cousins.",
    tags: ["scholar", "cold", "time", "time control", "calculating", "analyst", "tactician", "strategist", "detached", "dispassionate", "logical", "stoic", "cerebral", "scientist", "unfeeling", "controlled", "emotionless"]
  },
  "Nagaraja": {
    nickname: "The Flesh-Eaters",
    blurb: "Cannibalistic necromancer-sorcerers who must devour the flesh of the living to survive.",
    tags: ["necromancer", "necromancy", "cannibal", "cannibalism", "flesh eater", "devourer", "occult", "sorcerer", "monster", "ghoul", "hungry", "macabre", "savage", "death"]
  },
  "Samedi": {
    nickname: "The Stiffs",
    blurb: "Rotting, plague-bearing death-priests of the Caribbean who wear their own decay like a mask.",
    tags: ["death", "rot", "rotting", "decay", "decayed", "mercenary", "horror", "voodoo", "hougan", "plague", "disease", "corpse", "zombie", "undead", "grim", "disgusting", "gross"]
  },
  "Lamia": {
    nickname: "The Deathless",
    blurb: "A bloodline of plague-priestess warriors devoted to a dark mother of death — guardians of the Cappadocians.",
    tags: ["warrior", "priestess", "priest", "devout", "death", "plague", "disease", "protector", "bodyguard", "guardian", "defender", "cult", "sisterhood", "dark mother"]
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
      tags: (g.tags ?? []).map(t => t.toLowerCase()),
      disc: (CLAN_DISCIPLINES[name] ?? []).map(d => d.toLowerCase())
    };
    let score = 0;
    for (const t of terms) {
      if (hay.name === t) score += 100;
      else if (hay.name.includes(t)) score += 40;
      if (hay.tags.some(tag => tag === t)) score += 30;
      else if (t.length >= 4 && hay.tags.some(tag => tag.includes(t))) score += 15;
      // A Discipline the clan learns (e.g. "dominate", "auspex", "protean").
      if (hay.disc.some(d => d === t)) score += 25;
      else if (t.length >= 4 && hay.disc.some(d => d.includes(t))) score += 12;
      if (t.length >= 4) {
        if (hay.nick.includes(t)) score += 10;
        if (hay.blurb.includes(t)) score += 5;
      }
    }
    if (score > 0) scored.push({ name, score, i });
  });
  scored.sort((a, b) => b.score - a.score || a.i - b.i);
  return scored.map(s => s.name);
}
