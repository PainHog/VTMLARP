# Changelog

All notable changes to this system are noted here. Versions are
`major.minor.patch`; the manifest `system.json` is the source of truth.

## 1.36.6 — Homebrew queue integrity & feedback

- **A player's homebrew submission could silently vanish.** The Storyteller's
  Approve/Reject did a read-modify-write of the submission queue outside the
  lock that submissions arrive under, so a submission landing mid-approval was
  overwritten and lost (the player only ever saw "Sent to the Storyteller").
  Approve/Reject now run inside that lock and re-read the queue before writing,
  and two fast approve clicks on the same entry no longer double-process it.
- **Players now hear back on review decisions.** A rejection previously gave the
  submitting player no feedback at all; both approval and rejection now notify
  them.

(Noted, single-GM games unaffected: two Storytellers approving the same entry
simultaneously could still duplicate it — that needs cross-client coordination
the world-setting queue doesn't provide. Frenzy's Willpower-spend update is an
unguarded direct write but is unreachable on a non-owned actor.)

## 1.36.5 — Purchase integrity

- **Purchases now verify the buyer's owner.** Fulfillment runs with GM
  authority and previously trusted the buyer id on the wire, so a crafted
  socket message could charge another player's money / mint boons in their
  name. The request now carries the requesting user and fulfillment refuses it
  unless that user actually owns the buyer actor.
- **No more "charged but no item" half-state.** Payment ran before the item was
  added, so a failure mid-purchase could debit the buyer with nothing to show.
  The item is now created first and the debit is rolled back (item deleted) if
  payment fails — nothing is charged unless the item lands.
- Buyers now get a personal "purchase complete" whisper (they previously only
  saw "request sent").

## 1.36.4 — Challenge double-answer guard

- **A responder could answer the same Challenge twice.** When the challenger and
  an online responder are both players, the responder gets TWO answer surfaces
  at once — the instant response popup and the clickable chat-card prompt — and
  neither disabled the other, so answering both produced two contradictory
  result cards and duplicate log entries. Added a synchronous client-side claim
  (keyed by the Challenge's requestId): exactly one surface can resolve a given
  Challenge, and resolving the card now also closes any open response popup. On
  a resolution error the claim is released so the responder can retry.
- **Prompt cleanup no longer requires a GM.** The `deleteChallengePrompt` /
  `markChallengeResponded` socket handlers were GM-only, so with no GM online
  the challenger couldn't clear or flag their own prompt and it stayed
  re-clickable. They now run on whichever client can modify the message (its
  author or a GM), guarded by `canUserModify`.

## 1.36.3 — "Apply to Blood/Willpower" no longer wipes pools

- The "Apply to Blood/Willpower" button on the character sheet reset Blood to
  full and Willpower to its starting value, despite a tooltip promising it only
  "clamps current values down if needed." An accidental click mid-session
  refilled Blood and erased spent Willpower with no undo. It now does exactly
  what the tooltip says — updates the max/regen and clamps current pools down
  only if they exceed the new maximum, never refilling or resetting upward.
  (Starting values are still seeded automatically the first time Generation is
  set.)

## 1.36.2 — Player character-create hand-back

- When a player without "Create New Actors" permission submitted a character,
  the Storyteller-side proxy created it correctly, but the `characterCreated` /
  `characterCreateFailed` replies were nested inside a GM-only branch — so the
  player never got the "your character was added" confirmation and the new
  sheet never auto-opened (on failure they saw nothing at all). Moved both
  replies out to run on the requesting player's client. The actor was always
  created and owned by them; this restores the promised hand-back.

## 1.36.1 — Shops visible to players; diablerie attribute fix

- **Players couldn't see any shop.** Shop Actors were created with no
  ownership, so they defaulted to NONE — which hides an actor from every non-GM
  client, leaving the shop browser empty for players (nobody could buy
  anything). New shops are now created with default OBSERVER, and a migration
  (1.36.1) grants OBSERVER to existing shops still at NONE (a GM's deliberate
  per-shop restriction is left alone). Purchases remain GM-fulfilled, so
  read-only visibility is all players need.
- **Diablerie's Attribute throw** read the derived attribute total, so a
  diablerist with an active attribute buff (Blood/Celerity/Storyteller effect)
  would bake that buff permanently into the base on a win. It now reads the
  stored base.

## 1.36.0 — Multiplayer challenge/rite fixes (critical audit)

- **BLOCKER: player-vs-player Challenges could resolve twice and threw a
  permission error.** Resolving a Challenge logs an action entry to *both*
  actors, but the resolving client rarely owns the *other* player's actor, so
  `actor.update()` was rejected — the exception aborted the handler before its
  cleanup, leaving the prompt card live and re-clickable (duplicate results on
  reload). `logAction` now never throws and routes an un-owned actor's log
  through the GM (who owns every actor) over the socket. This affected nearly
  every non-GM-vs-non-GM challenge — the mechanic that runs all session.
- **Vaulderie no longer silently fails for non-owned participants.** The rite
  debits each participant's Blood; a player adding another player's actor hit
  the same permission wall mid-loop, so the draw never posted and Blood was
  partially spent. Debits now apply to owned actors directly and route the rest
  through the GM, and never abort the draw/reveal.
- **Willpower spend no longer corrupts the pool under a reducing effect.**
  "Spend Willpower" read the display-clamped value; under a max-lowering effect
  that permanently destroyed stored Willpower. It now spends from the stored
  base.
- **Editing a buffed stat no longer bakes the buff into the base.** The
  de-bake-on-save guard (previously attribute-totals only) now covers any field
  currently under an active effect — Willpower and the three Virtues included,
  which the Storyteller Panel can also buff.

## 1.35.3 — Stay on branch-tip distribution

- Reverted `manifest`/`download` to the branch-tip URLs (raw `system.json` /
  branch-archive zip): this environment can't push git tags, so the tagged
  Release couldn't be published here, and branch-tip is the flow that actually
  works for the live server. The `release.yml` workflow stays in the repo,
  inert, for cutting versioned Releases later. README/CLAUDE.md updated to match.
- Fixed the `readme`/`changelog` manifest links, which pointed at a
  non-existent `main` branch (404), to the active branch.

## 1.35.2 — Sheet-field save guard

- Added `validate:sheet-fields` (`tools/validate-sheet-fields.mjs`) to the
  check suite. The document sheets run with `submitOnChange: false` and persist
  via an explicit delegated `change` listener, so a form control that uses the
  wrong save mechanism for its sheet (a bare `name=` on the shop sheet, which
  reads `data-field`, or a persistent control with no save identifier at all)
  renders fine but silently never saves. The validator reads each sheet's
  template and mechanism and fails the build on any mis-wired control, closing
  the "field added but doesn't save" class of bug. `data-transient` opts a
  genuinely non-persistent control out.
- Gave the pre-built example PCs their own "Sample Player Characters" folder
  (distinct from the NPC "Sample Characters" folder).

## 1.35.1 — Docs & sample-character cleanup

- Reworked the QA "playtest" characters into proper **Sample Characters**
  (renamed the pack and the two example PCs, removed "delete after testing"
  flavor) so they read as intentional examples in a live game.
- Updated README and CLAUDE.md: distribution is now tagged GitHub Releases via
  the `releases/latest` manifest, not a branch ZIP.

## 1.35.0 — Localization foundation & tagged releases

- **Tagged GitHub releases with update detection.** `system.json` `manifest`
  and `download` now point at `releases/latest`, so Foundry can detect and
  install updates instead of every install being pinned to the branch tip.
  Pushing a `vX.Y.Z` tag runs the release workflow (validate → rebuild packs →
  verify tag matches the manifest version → zip runtime files → publish a
  GitHub Release with `vtmlarp.zip` + `system.json`).
- **Internationalization (i18n) foundation.** Added a `validate:i18n` CI check
  (`tools/validate-i18n.mjs`) that fails the build if any `{{localize}}` in a
  template or `game.i18n.localize/format(...)` in a script references a key
  missing from `lang/en.json`. First conversion phase: every application window
  title now resolves through a `VTMLARP.App.*` localization key. (Remaining UI
  strings are a phased, gameplay-neutral effort tracked for later.)

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
