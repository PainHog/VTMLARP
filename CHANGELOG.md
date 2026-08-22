# Changelog

All notable changes to this system are noted here. Versions are
`major.minor.patch`; the manifest `system.json` is the source of truth.

## 1.14.x — Hardening for release

- **Project tooling / CI**: added a GitHub Actions workflow that runs on every
  push and PR — ESLint over `scripts/`+`tools/`, `system.json` manifest checks,
  Handlebars template compilation **and** unregistered-helper detection, source
  compendium validation (unique/well-formed `_id`s, type & folder-reference
  integrity), and a semantic check that the committed compiled packs match
  source. Exposed as `npm run check`.
- **World data migrations**: `scripts/migrations.mjs` runs versioned, GM-only
  migrations once per world on load, so future schema changes can safely rewrite
  live characters' data.
- **Onboarding**: rewrote the README to the current feature set and added a
  "Getting Started" guide to the Rules Reference compendium.
- **Sheet lore links**: `_onOpenLore` now falls back across the
  clans/antitribu/revenants packs so bloodlines resolve their lore link.
- **Housekeeping**: removed dead variables flagged by ESLint; patched a dev-only
  transitive dependency advisory.

## 1.13.x — Character Builder & content ordering

- **Character Builder**: paged wizard with live point/freebie budgeting,
  click-to-add compendium lists, clan auto-fill of in-clan Disciplines with
  per-row swap dropdowns, compendium-backed Derangement picker, and hover/click
  compendium context on every choice. Any player can run it; the finished
  character is owned by whoever built it (with a Storyteller-proxied fallback
  when the player lacks the create-actor permission).
- **Discipline power ordering**: every Discipline/path/blood-magic power across
  all sourcebooks now carries a book-order sort and a sequential learning number
  shown in the compendium as `(01), (02)…`, and powers pull onto the sheet in
  order as dots are assigned.

_Earlier history predates this changelog; see the git log and `packs/README.md`
for the sourcebook-by-sourcebook content record._
