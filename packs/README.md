# Compendium Source Data

Each subfolder here corresponds to a compendium pack declared in `system.json`. Foundry v12 reads these folders directly as "source" compendiums — one JSON file per document, no build/compile step required.

- `attributes/` — the 27 named Physical/Social/Mental Traits (e.g. Brawny, Charismatic, Clever) plus their Negative-Trait counterparts, as Attribute items (92 files: 20 positive + 10/11/10 negative per category)
- `abilities/` — the 30 core Abilities (Talents/Skills/Knowledges) as Ability items
- `disciplines/` — Discipline and Power items (drag onto a character's Powers tab). Includes Sabbat-sourced content from the Sabbat Guide: Dark Thaumaturgy (Fires of the Inferno, Path of Phobos, Taking of the Spirit, and Dark Thaumaturgical Rituals), the Kiasyd Discipline Mytherceria, and the Blood Brothers' Sanguinus.
- `clans/` — Clan write-ups as Journal Entries
- `antitribu/` — Sabbat antitribu clans and unique Sabbat bloodlines (e.g. Assamite antitribu, Blood Brothers, Kiasyd, Panders, Salubri antitribu, Serpents of the Light) as Journal Entries, following the same schema as `clans/`
- `backgrounds/` — Background items (Allies, Contacts, Fame, Generation, Herd, Influence, Mentor, Resources, Retainers)
- `merits-flaws/` — Merit and Flaw items
- `rules-reference/` — Player-safe Journal entries for rules lookups: challenges (full trait-bidding mechanics), combat/weapons, archetypes, healing & damage, status, social rituals (Sabbat Auctoritas/Ignoblis Ritae, Vaulderie, Monomacy), and experience/advancement costs. Safe to expose to players.
- `rules-reference-st/` — Storyteller-only Journal entries (diablerie, derangements, frenzy/Rötschreck difficulty tables, feeding & hunger difficulty tables). Keep this compendium's visibility restricted to GMs — these cover ST-adjudicated material that players shouldn't be able to look up and game (e.g. exact frenzy/hunger difficulty numbers, derangement triggers).
- `paths-of-enlightenment/` — Sabbat Paths of Enlightenment as Journal Entries (Caine, Cathari, Death and the Soul, Evil Revelations, the Feral Heart, Honorable Accord, Lilith, Power and the Inner Voice). Alternate Morality codes most Sabbat vampires follow instead of Humanity — no schema changes needed; a vampire following a Path just sets `morality.path` on their actor to the Path's name. Each entry documents the Path's two Virtues, its core philosophy, and a paraphrased hierarchy of sin ("Following the Path") describing the escalating acts that cost a Path Trait, mirroring how Humanity's hierarchy of sin works in the core book.

## Workflow

As each sourcebook is processed, the rules/content extracted from it is converted into JSON entries here, following the schema in `scripts/documents/item.mjs`. `potence-prowess.json` in `disciplines/` is a worked example of the expected shape for a `power` item.

Every document needs a unique 16-character alphanumeric `_id`. Generate one however is convenient (e.g. `foundry.utils.randomID()` in a Foundry console, or any 16-char random string) — it just needs to be stable and unique within the pack.
