# VTMLARP — Mind's Eye Theatre: Laws of the Night for Foundry VTT

An **unofficial** Foundry VTT system for **Mind's Eye Theatre: Vampire the Masquerade** (Laws of the Night Revised) — a trait-bidding, live-action game resolved with Rock-Paper-Scissors rather than dice. Built for playing MET online.

> Fan project. Not affiliated with or endorsed by the rights holders.

## Features

- **Actors**: full character model (Attributes as Physical/Social/Mental Trait pools, Abilities, Willpower, Blood Pool, Virtues, Morality/Path, a Bruised→Incapacitated health track, Backgrounds, Armor), plus **NPC** (mortal/ghoul/vampire, with the sheet adapting to type) and **Vehicle** actors.
- **Trait-bidding Challenge engine**: Rock-Paper-Scissors gestures, retests, bonus/penalty trait boxes, surprise/coin-toss/static challenges, and a GM dashboard tracking every challenge in flight. Online play never leaks a gesture early.
- **Disciplines & Powers**: powers are ordered in learning sequence `(01), (02)…` and pull onto the sheet in order as dots are assigned; Vicissitude body-modification powers auto-apply Physical/Health changes.
- **Character Builder wizard**: paged, point/freebie-budgeted, click-to-add from the compendiums, auto-fills a clan's in-clan Disciplines (swappable), picks a Derangement, and hover/click compendium context on every choice. Any player can run it; the finished character is owned by whoever built it.
- **Storyteller tools**: Storyteller Panel (apply named trait-modifier effects, run surprise/force/coin-toss challenges), player-removable Afflictions, XP audit, blood-bond overview, session log.
- **Compendiums**: Disciplines/Powers, Clans & Bloodlines, Antitribu, Revenants, Paths, Derangements, Sects, Abilities, Backgrounds, Merits & Flaws, Gear, Rules Reference (player + ST), sample NPCs, cities, mortals/ghouls, and vehicles.
- **Sheet lore links**: clan, sect, path, archetype and virtues each link straight to their compendium entry.

## Installation

This system is distributed as a GitHub branch ZIP (no build runs on the end user's server — compiled packs ship in the repo). In Foundry: **Game Systems → Install System → Manifest URL**, using the `manifest` URL in [`system.json`](system.json).

Compatibility: Foundry **v13** minimum, verified through **v14**. (It uses v13+ ApplicationV2 document sheets, so it will not load on v12.) See `CLAUDE.md` → *Foundry version notes*.

## Development

```bash
npm install            # once
npm run check          # lint + validate manifest/templates/packs (what CI runs)
npm run build:packs    # recompile packs/_source → packs/ LevelDB after editing content
```

Content lives in `packs/_source/<pack>/*.json` (one document per file) and must be recompiled with `npm run build:packs`; commit both source and the compiled `packs/<pack>` output. CI (`.github/workflows/ci.yml`) runs on every push/PR:

- `lint` — ESLint over `scripts/` and `tools/`
- `validate:manifest` — `system.json` structural checks
- `validate:templates` — every Handlebars template compiles
- `validate:packs` — unique/well-formed `_id`s, type & folder-reference integrity
- `check:packs` — committed compiled packs match source (catches "forgot to rebuild")

World data migrations (for schema changes to live characters) go in `scripts/migrations.mjs`. See `CLAUDE.md` for the full content workflow and conventions.

### Releasing

Bump `version` in `system.json`, update `CHANGELOG.md`, commit, then tag:

```bash
git tag v1.14.5 && git push origin v1.14.5
```

The release workflow validates, rebuilds packs, checks the tag matches the
manifest version, and publishes a GitHub Release with a runtime `vtmlarp.zip`
and `system.json` attached.

## Repository layout

- `system.json` — Foundry system manifest
- `scripts/` — `documents/` data models, `sheets/` Actor & Item sheets, `apps/` tools (Challenge, Character Builder, ST Panel, …), `migrations.mjs`
- `templates/` — Handlebars sheet/app templates
- `css/vtmlarp.css` — styling
- `packs/_source/` — source compendium content; `packs/<name>/` — compiled LevelDB (committed)
- `tools/` — build & validation scripts
- `reference/` — extracted rulebook text used while building (not shipped to players)
