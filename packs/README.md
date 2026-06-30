# Compendium Source Data

Each subfolder here corresponds to a compendium pack declared in `system.json`. Foundry v12 reads these folders directly as "source" compendiums — one JSON file per document, no build/compile step required.

- `disciplines/` — Discipline and Power items (drag onto a character's Powers tab)
- `clans/` — Clan write-ups as Journal Entries
- `backgrounds/` — Background items
- `merits-flaws/` — Merit and Flaw items
- `rules-reference/` — Journal entries for rules lookups (challenges, combat, frenzy, etc.)

## Workflow

As each sourcebook is processed, the rules/content extracted from it is converted into JSON entries here, following the schema in `scripts/documents/item.mjs`. `potence-prowess.json` in `disciplines/` is a worked example of the expected shape for a `power` item.

Every document needs a unique 16-character alphanumeric `_id`. Generate one however is convenient (e.g. `foundry.utils.randomID()` in a Foundry console, or any 16-char random string) — it just needs to be stable and unique within the pack.
