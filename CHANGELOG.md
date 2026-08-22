# Changelog

All notable changes to this system are noted here. Versions are
`major.minor.patch`; the manifest `system.json` is the source of truth.

## 1.15.x – 1.16.0 — Polish, accessibility, and a Storyteller convenience

- **NPC auto-answer challenges**: a per-NPC toggle makes it respond to a
  Challenge automatically with a random gesture (plus a "can throw Bomb"
  option), still bidding its real Trait pool, and re-throwing on retests — so
  the Storyteller doesn't have to answer every challenge. A "Random" quick-throw
  button was also added to the manual response dialog.
- **Accessibility**: icon-only controls get accessible names and keyboard
  operability via a shared render hook; tooltips added to edit/delete icons.
- **Compatibility**: set honestly to `minimum: 13` (the system uses v13+
  ApplicationV2 document sheets and would not load on v12).
- **Correctness**: unified the Path list and Generation tables so the Character
  Builder and the sheet can't drift (the builder was missing the Dark Ages
  Roads); fixed the vehicle sheet silently not saving; delete-confirmation on
  embedded items; Frenzy warns when there's no Willpower to spend; various
  null-guards and a GM guard on Award XP.
- **UX**: empty-state hints on all item lists; clickable actor names in the
  Blood Bond and XP Audit views; clearer GM-dashboard empty state.
- **Tests**: the core RPS+Bomb gesture resolution, the discipline creation-cost
  math, the clan→disciplines map, and the shared game-data are all unit-tested.

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
