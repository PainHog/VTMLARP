# Changelog

All notable changes to this system are noted here. Versions are
`major.minor.patch`; the manifest `system.json` is the source of truth.

## 1.20.x — Mercantile, area templates, auto-effects, LOS

- **Mercantile shop system.** A Storyteller-run economy: create any number of
  shops (street gangs, fixers, pop-up magical merchants), each independently
  open/closed, each stocking items (typed via a guided **Create Item** form with
  a type dropdown, or dragged from the Gear compendium) at a price with a
  quantity and accepted payment methods. Players browse open shops and buy with
  **money, a Boon owed, or barter**; the Storyteller is the authority (a purchase
  is applied by the active GM), and every sale is logged to chat and the buyer's
  Purchase Ledger, with the item added to their sheet. Actors gained a `money`
  pool and a `transactions` ledger.
- **Area of effect templates.** Powers/rituals can define an area (circle/cone/
  ray/rect + size); a **Place Area** button drops a MeasuredTemplate on the
  canvas at the caster's token.
- **Generalized auto-apply status effects.** Any power can carry an
  auto-effect (Physical/Social/Mental/Willpower/Health modifiers) that applies
  as a tagged Active Effect while the power is toggled on and removes when off —
  generalizing the Vicissitude body-mod to every Discipline.
- **Line-of-sight warning.** Initiating a Challenge against a token blocked by a
  sight wall now asks for confirmation (soft warning, never a hard block).
- **Diablerie system.** A per-vampire Diablerie screen (victim must be in
  torpor): throw one Challenge at a time (opposing gesture at random) to steal
  each Discipline (first dot of unknown / next dot of known), one Attribute
  Trait, and — when the victim is lower generation — a Generation; separate
  throws for the Frenzy, Derangement and Humanity perils. Records blood taint
  (black veins, detectable via Aura Perception / A Taste for Blood) on the sheet.
- **Blood/Willpower economy rules.** Spend Blood for +1 temporary Physical Trait
  (tracked, clearable), Blush of Life toggle, one-click Spend Willpower, and a
  per-turn Blood-spend warning that resets each combat turn.
- **Player-authored content + approval.** Players submit homebrew (Thaumaturgy
  rituals/paths, combination Disciplines, custom powers); the Storyteller
  approves them into a world "Player Added" compendium.

## 1.17.x – 1.18.x — Full compendium enrichment

- **Every compendium description brought to a book-grounded standard.** ~380
  entries rewritten from the actual sourcebooks with vivid flavor plus complete
  MET mechanics, structured fields preserved and a strict no-invention rule:
  ~230 Discipline powers (all core Disciplines, Necromancy/blood-magic paths,
  Thaumaturgy paths, and bloodline Disciplines), 38 Abilities, 112 Merits &
  Flaws, and flavor leads on 22 weapons. Clan lore, Paths and Derangements were
  already rich and left intact.
- The enrichment surfaced further structured fixes (Alchemy→Science and Taking
  of the Spirit→Subterfuge retests) and filled an empty clan-lore stub (Jan
  Pieterzoon).

## 1.16.x – 1.17.x — Content accuracy & flat Abilities

- **Abilities** are now a single flat, alphabetical MET list instead of the
  tabletop Talents/Skills/Knowledges split — across the data model, sheet and
  Character Builder — with a world migration (1.17.1) that merges existing
  characters' three lists, and all 198 sample-NPCs converted.
- **Discipline data audit against the sourcebooks** — corrected 68 powers:
  costs that had leaked into the retest field, `activation: challenge` powers
  with no challenge type, retests set to an attribute instead of an Ability, and
  Static-Challenge powers whose type was wrong; plus a mislabeled Flaw
  (Natural Leader → Infamous Sire), found by cross-checking every Merit/Flaw
  cost against the rulebook.
- **GM-only compendium entries** (`flags.vtmlarp.gmOnly`) hidden from players in
  the browser and the builder; used to park two powers with unverified rules.

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
