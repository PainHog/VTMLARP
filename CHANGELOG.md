# Changelog

All notable changes to this system are noted here. Versions are
`major.minor.patch`; the manifest `system.json` is the source of truth.

## 1.45.1 — Window scroll & alignment fixes

- **Fixed-size windows now scroll internally** instead of clipping their bottom
  controls when their content grows: the Mercantile panel (shop list), Session
  Log (entries), and the Homebrew create/review windows. (Same
  bounded-flex-height fix already used elsewhere.)
- The clan picker's sticky Previous/Next footer now has an **opaque background**,
  so scrolling Discipline text no longer bleeds through it.
- The Abilities/Backgrounds − / + steppers and the restore icon now sit on **one
  vertically-centered line** instead of stair-stepping.

## 1.45.0 — Merits & Flaws browser

- **New "Browse Merits & Flaws" button** on the Merits & Flaws tab opens a
  searchable browser for the whole compendium:
  - **Keyword search** that matches partial input across the name *and the
    rules text* (so "blood" or "extra trait" finds the right entries, not just
    title matches).
  - **Filters** for type (Merits / Flaws / both) and category
    (Physical / Social / Mental / Supernatural).
  - An **Add** button drops the chosen Merit or Flaw onto the character (keeping
    its compendium link), and a book icon opens the full text.

## 1.44.3 — +/- steppers on rated traits

- **Abilities, Disciplines, and Backgrounds now have − / + buttons** beside their
  dots, so you can nudge a rating up or down without clicking the exact dot.
  Steps are clamped to 0–5, keep the permanent max in sync, and raising a
  Discipline still pulls its next power.

## 1.44.2 — Clan picker layout fix

- **"Help me pick a clan" no longer stacks its two panes.** A CSS rule was
  forcing the picker's root (the rail-beside-card row) into a column, so the
  clan list sat on top of the borderless detail card and looked jammed
  together. The picker is now a proper two-column layout again, with the rail's
  right border as the divider.

## 1.44.1 — Mass-target Challenges

- **Challenge multiple targets at once** for area/multi-target Disciplines and
  abilities: target 2 or more tokens (Foundry targeting) before sending a
  Physical/Social/Mental Challenge and one independent Challenge fires per
  target — the same throw tested against each defender, who each answer
  separately. The Challenge dialog notes this, and the opponent dropdown is
  ignored while 2+ tokens are targeted.

## 1.44.0 — Secret-throw protocol & per-token challenges

**Big change to how Challenges resolve — please smoke-test with two logins.**

- **The challenger's gesture is now truly hidden from the opponent.**
  Previously it rode along in the public prompt card's flags and the socket
  broadcast, so a determined opponent could read it before choosing their
  counter. Now the gesture is *sealed* in a whisper only the challenger and
  Storytellers receive; the opponent's answer is sent to a **resolver** (the
  challenger, or a GM if they're offline) who holds the sealed gesture and posts
  the result. The opponent's client never receives the challenger's throw.
- **Single-resolver design removes double-resolution entirely** — because only
  one elected client resolves, two responders (or two GMs) can no longer post
  contradictory result cards.
- **Answers survive an offline resolver** — each answer is also persisted as a
  whisper and reconciled when the challenger/GM next loads, so a throw isn't
  lost if the resolver was briefly away.
- **Challenges now target a specific token instance.** Targeting one of several
  identical unlinked NPC tokens threads that token through the whole exchange,
  so its own Trait pool, `auto-answer`/Bomb toggles, and action log are used —
  not the shared base actor's.

## 1.43.4 — Duplicate NPC token initiative fix

- **Buffing one of several identical NPC tokens no longer overwrites the
  others' initiative.** The live initiative re-sort now matches the specific
  token instance that changed (by token id for unlinked tokens) instead of every
  combatant sharing the same base actor id.

## 1.43.3 — Challenge double-resolution & void guards

- **A Challenge can no longer be resolved twice.** Result cards now carry their
  request id, and every answer surface (chat card and popup) refuses to resolve
  if a result for that request already exists — closing the window where two
  Storytellers, or an owner on two devices, could both answer and post
  contradictory result cards.
- **A Challenge whose participant was deleted mid-throw is now voided** with a
  clear "Challenge void — X no longer exists" card and the prompt is cleaned up,
  instead of the responder getting a misleading "you don't control this" message
  and the prompt sitting dead forever.
- The "Re-throw Retest" button disables on click so a double-click can't spawn
  two parallel retest challenges.

## 1.43.2 — Challenge live-play & visibility fixes

- **The Challenge response popup no longer silently throws Rock.** Its gesture
  dropdown now defaults to a blank "— Choose a Gesture —" and requires a
  deliberate pick, matching the chat-card path — clicking Throw without picking
  can't commit an unintended Rock.
- **Auto-answer NPCs resolve even when the Storyteller is offline.** If a player
  challenges an auto-answering NPC and no one who could respond for it is
  online, the challenger's own client resolves it (instead of the throw waiting
  forever), and the player is told honestly when a challenge is posted with no
  one online to answer it.
- **The "Storyteller Only" rules compendium is now hidden from players** (it was
  readable by anyone from the Compendium sidebar).
- Clicking "clear affliction" on someone else's sheet (as a non-owner) now says
  so instead of silently doing nothing.
- Bootstrap: the socket dispatcher ignores malformed payloads defensively.

## 1.43.1 — Harden the remaining Storyteller-relayed flows

These three actions touch things a player doesn't own (a world compendium,
another player's actor, the shared log), so they still route through the
Storyteller — but they no longer silently strand:

- **Homebrew submissions can't be lost.** The draft is saved locally the moment
  you submit; it's cleared only when the Storyteller's client confirms it
  reached the queue. If no confirmation arrives you're warned, and reopening
  the Homebrew window restores the draft so you can resend.
- **The Vaulderie now reports** when a participant's Blood couldn't be spent
  (no owner/Storyteller available to apply it) instead of revealing the rite as
  if it had been.
- **Action-log entries survive a missing Storyteller** — when no GM is online to
  write to an unowned actor's log, the entry is posted as a GM-whispered chat
  message so the record isn't lost.

## 1.43.0 — Shop purchases no longer require the Storyteller

- **Buying from a shop now happens instantly on the player's own client** with
  no "sent to the Storyteller" round-trip. Every charge — the purchased item,
  the money/boon debit, and the transaction ledger — is on the buyer's own
  character, which the player owns, so it just works. Previously a purchase was
  routed to the active Storyteller and could hard-block ("No Storyteller is
  online") or silently vanish if the ST's client didn't process it.
- The only shared write, decrementing the shop's stock count, is handled
  best-effort (directly if you own the shop, else via an online GM); if nobody
  can update it the sale still completes and stock can be corrected later. No
  purchase is ever lost or blocked over shared stock.

## 1.42.3 — Character creation no longer bounces permitted players to the ST

- **Fixed the bug where a player who finished the Character Builder saw "sent
  to the Storyteller" and the character was lost.** The builder used a broken
  client-side permission check (`game.user.can("ACTOR_CREATE")` — the wrong
  API — combined with a `??` that never reached the correct check), so a player
  who *does* have "Create New Actors" was misdetected and needlessly routed
  through a Storyteller socket proxy that could silently fail. The builder now
  just attempts the create directly and lets Foundry enforce the real
  permission — so a permitted player's character is created instantly, on their
  own client, with no ST involvement. The ST fallback remains only for a player
  who genuinely lacks the permission, now with honest wording.

## 1.42.2 — Sheet dropdown & template fixes

- **Clan / Sect / Nature / Demeanor dropdowns no longer render blank** for a
  value that isn't in the built-in list (a revenant, Dark-Ages, or homebrew
  clan, or any imported actor). The sheet now injects the actor's own stored
  value into each list — matching the guard the Path dropdown already had — so
  touching the dropdown can't silently overwrite a real value.
- **Shop item descriptions are now HTML-escaped** in the buyer's browse dialog
  (they're entered as plain text), so a `<` in a description can't break the
  layout or inject markup into other players' buy windows.
- Added `min`/`max` to the Willpower, Blood, Path-rating and Virtue number
  inputs so out-of-range typing is caught inline.
- Removed a dead builder action entry.

## 1.42.1 — Health/effect cleanup & data fixes

- **Deleting an active body-mod power now cleans up no matter how it's deleted.**
  Its bonus Physical Traits and extra Health boxes live on the actor, so
  removing the power from the Items sidebar or via a macro (not just the sheet's
  delete button) used to strand them — permanent stat inflation and orphaned
  Health boxes. A deletion hook now strips them for every deletion route.
- **Blood spent to heal now counts toward your per-turn Blood limit** and warns
  past it, like every other Blood expenditure (previously healing bypassed the
  tracker).
- Fixed two city NPCs stored with an invalid generation of 0 (which the schema
  silently clamped on load).

## 1.42.0 — Sabbat content & builder improvements

- **Starting Morality/Path rating is now a Character Builder choice.** A new
  "Morality start" field (default 7) means a Sabbat character on a Path of
  Enlightenment no longer has to be built at 7 and corrected by hand — set the
  Path-appropriate starting rating at creation.
- **The ten Sabbat antitribu are now selectable clans** (Assamite, Brujah,
  Gangrel, Malkavian, Nosferatu, Ravnos, and Salubri Antitribu, Serpents of
  the Light, Toreador and Ventrue Antitribu), each with its correct in-clan
  Disciplines, clan-guide search entry, and lore button wired to its journal —
  so their built lore is reachable from the sheet and builder instead of only
  through base-clan + Sabbat sect.
- **Ignoblis Ritae** are now written up in the Sabbat sect journal (the pack's
  minor rites and how Storytellers can reward them), alongside the existing
  Auctoritas Ritae / Vaulderie / Monomacy coverage.
- **Added a ready-to-play Sabbat pregen** (Sister Valentina, a Tzimisce pack
  priest on the Path of Caine) so a player can jump in without building.

## 1.41.1 — Deep function-audit fixes

From a line-by-line audit of the data models, sheets, dialogs, and core plumbing:

- **Using or activating a Blood-costing power now respects your Blood and the
  per-turn limit.** The reflexive "use power" path could clamp your pool to 0
  yet report the full cost as paid; both the toggle and use paths now refuse
  when short and count the spend against your generation's per-turn Blood limit
  (previously only Blood Boost / Blush of Life did).
- **Clicking a Discipline's dots to raise it now pulls its next core power(s)**
  onto the sheet, matching the +/- stepper and the Character Builder instead of
  leaving a raised dot with no matching power.
- **Migrations no longer silently strand a document.** If migrating one actor
  or item throws, the migration now re-runs on next load instead of stamping
  itself complete and leaving that document on the old schema forever.
- **Random-build Virtues** now use one rolled value for both the permanent
  rating and the spendable pool (they could previously differ).
- Hardened a tie-break edge case and a couple of list handlers against
  malformed input. No behavior change in normal play.

## 1.41.0 — Challenge rules-accuracy fixes

Corrected four places where the resolution mechanics diverged from Laws of
the Night Revised (verified against the sourcebook):

- **Diablerie now always costs a Humanity/Path Trait — "no test, no appeal."**
  The button no longer rolls a resistable throw (which let the diablerist keep
  the point ~half the time); it deducts one point automatically, and the ST may
  rule more is lost.
- **Frenzy/Rötschreck retests are capped at one**, matching the book (a single
  retest by risking a temporary Virtue Trait). Previously a character could
  re-throw once per temporary Virtue Trait, badly inflating resist odds.
  Losing that retest now also inflicts a temporary Derangement, as written.
- **Bomb is no longer a universal throw.** It's offered in the challenge and
  response gesture pickers only to a character flagged as able to throw Bomb
  (the sheet's "…can throw Bomb" toggle, representing Celerity/Potence),
  matching how the NPC auto-answer already gated it.
- Removed an incorrect page citation from the Diablerie +2 XP reminder.

The RPS+Bomb win/tie table and tie-by-Traits resolution were audited and
confirmed already faithful to the book.

## 1.40.2 — World-migration single-authority guard

- **World data migrations now run on only the single active Storyteller
  client**, matching every other authority-mutating path. Previously any GM
  client that loaded the world ran the pending migrations; with two GMs
  logging in at once a document-creating migration (e.g. the shop conversion)
  could run on both and create duplicate documents. Elects exactly one runner.

## 1.40.1 — Silent-failure & error-feedback fixes

- **Purchases and homebrew submissions that fail on the Storyteller's side no
  longer vanish silently.** When a shop purchase or a homebrew submission is
  relayed to the ST and something goes wrong fulfilling it, the requesting
  player now gets an explicit error instead of the request appearing to still
  be pending after "sent to the Storyteller."
- **Editing a value a sheet rejects now snaps back with a warning** instead of
  leaving the rejected value visible as if it had saved — this now covers the
  actor sheet's list-row (Blood Bond / Boon / Status) fields and every field on
  the shop sheet.
- **Toggling a power you can't afford is refused up front.** Activating a
  Blood-costing power with too little Blood used to silently clamp the pool to 0
  as if you'd paid full price; it now warns and leaves the power off.
- **The Vaulderie warns when no Storyteller is online to spend a participant's
  Blood** (previously that participant's Blood was quietly never deducted), and
  answering an already-claimed Challenge now says so instead of just closing.

## 1.40.0 — Tablet/small-screen & readability fixes

- **Action buttons no longer fall off-screen on a tablet.** The Character
  Builder ("Add Character"/"Next") and the Diablerie window ("Record the
  Diablerie") could extend below a short/tablet viewport, putting their buttons
  out of reach. Both now clamp their height to the viewport and scroll their
  body internally, so the controls stay reachable.
- Blood Bond / Boon / Status rows now **wrap** instead of overflowing
  horizontally on a narrow sheet, and the tab bar wraps to a second line.
- **Result banners are more readable** — the "Won/Resisted" green and "Tied"
  gold were washed out on the cream card and are now darker; also fixed the
  Frenzy banner losing its color after an earlier change.

## 1.39.1 — Shop boon-tier schema fix

- Fixed a regression from 1.39.0: the shop stock schema still only allowed the
  old boon levels, so selecting the new **Trivial** or **Life** tier on a shop
  item silently failed to save. The stock field now accepts the full ladder, and
  a migration remaps any existing shop stock still holding the old "blood" level
  to "life".

## 1.39.0 — Social systems: Vinculum, boon tiers, Status

- **"Decay All" no longer erodes Sabbat Vinculum.** Blood Bond entries now carry
  a Bond/Vinculum type; ordinary Bonds decay as before, Vinculum rows are left
  untouched (per the book, Vinculum doesn't fade with time — only a further
  Vaulderie lowers it). The Blood Bond Overview shows the type, and the sheet has
  a per-row Bond/Vinculum selector.
- **Boon tiers now follow the canonical Prestation ladder** — trivial / minor /
  major / **life** (the "life boon" was missing; the non-canonical "blood" tier
  is migrated to "life"). Updated on the character sheet, the shop stock editor,
  and purchase fulfillment.
- **Status Traits tracker added.** A new sheet section (Social tab) lists a
  character's sect Status Traits (Acknowledged, etc.) with a live count —
  Status is standing gained/lost in play, correctly not a purchasable Background.
- The Character Builder now warns if a **Malkavian** is built without a
  derangement (their clan weakness).

## 1.38.0 — Socket-payload hardening

- Defense-in-depth on the GM-proxy socket handlers (a player's browser console
  can craft `system.vtmlarp` messages; Foundry's raw socket can't authenticate
  the sender, so these constrain the payload):
  - **createCharacter** now only ever creates a `character` (never a shop/npc/
    other type via the proxy), grants OWNER to exactly the requesting user and
    discards any wire-supplied ownership (no granting default/all-users), and
    requires the requester to be a real user.
  - **debitBlood** (Vaulderie) now applies only a valid non-negative integer,
    clamped to the actor's max — a crafted NaN/huge value can no longer corrupt
    a blood pool.
  - **logActorAction** coerces the summary to a bounded plain string.
  - **shopPurchase** now rejects a missing/unknown requester (previously an
    omitted requesterId skipped the buyer-ownership check).
- Removed "Status" from the Random Character background pool — Status isn't a
  purchasable Background in this edition.

## 1.37.3 — XP audit clarity & guards

- Combat/weapons/gear and XP/advancement audited against the book: combat is
  correctly fully manual (gear values, armor, and the combat rules journal all
  accurate), and the XP flow (award math, self-managed spend, audit) is sound.
- The XP Audit's anomaly flag is now named for what it actually detects — a
  **current pool larger than the recorded total** (XP added directly instead of
  via Award XP), which the UI already labeled "unrecorded award." Fixed the
  misleading internal name/docstring.
- **Award XP now rejects a negative amount** (it would previously add it and let
  the schema clamp both pool and total to 0, silently wiping a character's XP).
  To deduct, edit the Experience fields directly.
- Diablerie's completion card now reminds the Storyteller to award +2 Experience
  if the victim was of lower generation (the book's award, which is
  ST-adjudicated so it isn't applied automatically).

## 1.37.2 — Chat-card polish

- Frenzy/Rötschreck result banner now uses a valid status class so it's colored
  correctly (it was emitting an invalid CSS class for Rötschreck).
- Coin-toss challenge cards no longer show empty "( )" trait counts.
- Vaulderie result card is now attributed to "The Vaulderie" rather than the
  runner. (Lifecycle + chat-card audits otherwise found no crashes, dead
  handlers, or rendering breaks — the delegated challenge-card handler correctly
  survives reload and late-join.)

## 1.37.1 — Revert Sabbat allotment special-casing

- Reverted the 1.37.0 Sabbat chargen change. The table's house rules already
  account for Sabbat players under the uniform (expanded) allotment, so
  special-casing Sabbat in the builder/sheet would have misflagged a
  correctly-built Sabbat character as over budget. The allotment is uniform
  again for all sects.

## 1.37.0 — Sabbat character creation

- **Sabbat characters now use the correct creation allotment.** The builder
  ignored Sect entirely, so a Sabbat character got the Camarilla allotment (3
  Disciplines + 5 free Backgrounds). Per the book, Sabbat get **one extra Basic
  Discipline and no free Backgrounds** (Backgrounds must be bought with Free
  Traits). Both the Character Builder's live budget and the character sheet's
  creation tracker now apply the Sabbat allotment when Sect = Sabbat (+1
  Discipline, 0 free Backgrounds), so a correctly-built Sabbat is no longer
  flagged over budget. The Random Character generator picks a non-Sabbat sect so
  its Camarilla-style build stays consistent.
- Under the expanded house-rule default, Sabbat get one more than the expanded
  Discipline allotment (6) and still 0 free Backgrounds; tick "Original rules"
  for the strict book values (4 Disciplines).

## 1.36.17 — Aggravated healing rules-text fix

- The Player Rules Reference said aggravated damage costs "three Blood Traits,
  one Willpower Trait, and a night of rest" per level. Per the book, the first
  aggravated level each rest period costs 3 Blood + a day's rest (no Willpower);
  a Willpower Trait is required only for each *additional* level healed in the
  same rest. Corrected — it also now agrees with the Feeding & Hunger journal,
  which already stated it correctly. A full journal-content audit otherwise
  verified all 13 clan Disciplines and weaknesses and every core rule (challenge
  resolution, the MET health track, frenzy, feeding, diablerie, chargen)
  accurate against the book.

## 1.36.16 — Item/Vehicle portrait double-picker

- Clicking an Item or Vehicle portrait opened TWO file pickers — a manual one
  that saves and the inherited core one that doesn't persist under this system's
  form handling (so picking an image in the wrong dialog silently did nothing).
  Removed the stray `editImage` action from those portraits so only the working
  picker fires, matching the actor and shop sheets. A broad integration +
  compendium-integrity sweep (2,188 docs, 2,670 lore links) otherwise came back
  clean.

## 1.36.15 — Shop browser scroll + NPC tab fixes

- **Shop browser** had the same collapsed-flex-height bug the Clan Picker did
  (its item list could overflow the window / hide the search header instead of
  scrolling internally). Applied the same bounded-flex-height fix. A deep audit
  confirmed the Clan Picker fix is correct and that shop-browser was the only
  other window with this structure.
- **Mortal/ghoul NPC sheet**: if the last-viewed tab was Disciplines & Powers
  (whose nav item is hidden for non-vampires), the sheet could show an orphaned
  empty Powers tab. It now falls back to the Main tab.

## 1.36.14 — Clan Picker scroll fix

- The "Help Me Pick a Clan" window showed only the search box — the scrollable
  clan roster (the left rail) collapsed to zero height because the inner flex
  layout had no bounded height. Gave the window-content and part wrapper a
  full-height flex column so the clan list gets real height and scrolls, and
  players can browse the whole roster again.

## 1.36.13 — Final robustness nits

- A convergence sweep across the whole codebase came back clean (ownership,
  null-safety, socket handling, number parsing all verified sound). Two tiny
  hardening fixes: the area-of-effect template now uses the v13+ `author` field
  instead of the deprecated `user`, and the challenge-request socket handler
  guards `targetUserIds` against a malformed payload before dereferencing it.

## 1.36.12 — Background text corrections

- Every Laws of the Night Revised Merit/Flaw point value and category was
  verified correct against the book (creation budgets are sound). Two Background
  text fixes: the **Influence** background was missing the **Health** sphere
  (the book lists 15 areas; it had 14), and **Resources** mislabeled the income
  scale ($200/Poverty is the no-Traits level, not one Trait — one Trait is
  $500).

## 1.36.11 — Deleting an active power cleans up its effects

- Deleting a body-mod / auto-effect power while it was toggled ON left its
  Active Effects and bonus Health boxes orphaned on the character (permanent
  stat inflation and Health boxes with no way to remove them). Deleting an
  active power now strips its tagged effects and bonus Health first, matching
  the toggle-off path. Removed a stale unused field while there.

## 1.36.10 — Discipline activation challenge-types

- Fixed misleading challenge types on a few powers (the core Discipline set was
  otherwise verified fully accurate vs the book): **Fortitude Resilience &
  Resistance** are reflexive damage-soak Simple Tests, not contested Physical
  Challenges, so they're now "static"; **Celerity Alacrity / Swiftness /
  Legerity** just grant actions and "do not draw retests from any Ability"
  (book p.~4548), so they're now "none" instead of implying a Physical
  Challenge to activate.

## 1.36.9 — Book-correct combat: health track, healing, frenzy

- **Health track rebuilt to the Laws of the Night Revised model.** It used the
  tabletop 7-level wound names (Bruised/Hurt/Injured/Wounded/Mauled/Crippled/
  Incapacitated); the book (p.190) uses **8 levels in three tiers — 2 Healthy,
  3 Bruised, 2 Wounded, Incapacitated**. The schema, sheet, and all sample
  content now use the correct track, and a migration remaps every existing
  character/NPC's damage (bottom-aligned, so severity — including Incapacitated
  — is preserved; the extra box appears as a fresh Healthy line).
- **Bashing damage heals correctly.** 1 Blood Trait now heals **two** levels of
  bashing (or one lethal), per the book's healing rules — it previously charged
  1 Blood per level for both.
- **Frenzy / Rötschreck is now a real Static Challenge.** It was a deterministic
  Virtue-vs-Difficulty comparison; it now throws a Static Challenge (win
  resists; a tie is won only if the Virtue exceeds the Difficulty; a loss
  retests by expending Virtue Traits until a win or the Traits run out).
  Spending a Willpower Trait still auto-resists.

- **Salubri in-clan Disciplines corrected** to Auspex / Fortitude / **Obeah**
  (was Valeren) — Obeah is the Salubri Discipline in Laws of the Night Revised;
  Valeren is a different-sourcebook Discipline and stays available as content,
  just not the base clan's trio. Verified the rest of the creation math and the
  full generation chart against the book — all correct.
- **Character→NPC conversion now unlinks the prototype token**, matching the
  intended NPC model (many independent copies) instead of leaving it linked so
  every dropped copy shared one data source.
- **NPC auto-answer prefers online Storytellers** when picking the responder,
  so a multi-GM game can't hand the auto-throw to an offline GM. (Single-GM
  games were already fine.)
- **Challenges honor Foundry's native token targeting:** if you have exactly
  one token targeted when you open a Challenge, that token's actor is
  pre-selected as the opponent. The dropdown stays editable; no target keeps
  the old manual pick.

## 1.36.7 — Storyteller-tool fixes

- **A positive Willpower status effect now works.** The ST Panel could apply a
  Willpower modifier, but a *buff* on `willpower.value` was immediately clamped
  back down to the max in derived data — so "+2 Willpower" did nothing.
  Willpower effects now also move the cap by the same amount, so a buff is
  actually usable (and a penalty lowers the cap too). Attribute/Virtue effects
  were already correct.
- **"Decay All" Blood Bonds is now retry-safe.** The decay loop had no
  per-actor error handling, so a single failing update would abort it half-done
  — leaving some characters decayed and others not, and a re-run would
  double-decay the finished ones. Each actor is now handled independently and
  any failures are reported.

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
