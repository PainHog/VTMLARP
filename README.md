# VTMLARP — Mind's Eye Theatre: Laws of the Night for Foundry VTT

An unofficial Foundry VTT system for **Mind's Eye Theatre: Vampire the Masquerade** (Laws of the Night Revised) — a trait-bidding, live-action game resolved with Rock-Paper-Scissors rather than dice.

## Status

Early scaffold. Core mechanics implemented:

- Actor data model: Attributes (Physical/Social/Mental Traits), Abilities (Talents/Skills/Knowledges), Willpower, Blood Pool, Virtues, Morality/Path, Health Track (Bruised → Incapacitated), Backgrounds
- Item types: Attribute, Ability, Discipline, Power, Background, Merit, Flaw, Virtue, Ritual, Gear
- Character sheet with clickable Trait chips (toggle spent/available) and a health track that cycles Ok → Bashing → Lethal → Aggravated
- A Challenge resolution tool that logs Trait bids, the announced RPS gesture, and the result to chat
- Compendium pack structure for Disciplines/Powers, Clans, Backgrounds, Merits & Flaws, and Rules Reference (`packs/`)

## Repository layout

- `system.json` — Foundry system manifest
- `scripts/` — system logic (`documents/` data models, `sheets/` Actor & Item sheets, `apps/` the Challenge tool)
- `templates/` — Handlebars sheet templates
- `css/vtmlarp.css` — system styling
- `packs/` — source compendium content (one JSON file per document)
- `reference/` — extracted rulebook text used to build the system (not shipped with the system itself)

## Source material

Rulebooks are being processed one at a time; extracted text lives in `reference/`. As each book is covered, its rules/content get implemented in code and its character options get added to the compendiums in `packs/`.
