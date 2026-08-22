# VTMLARP — Foundry VTT system for Mind's Eye Theatre: Vampire the Masquerade

## Compendium pack build step (IMPORTANT)

Source compendium documents (one JSON file per Item/Actor/JournalEntry) live in
`packs/_source/<pack-name>/*.json`. These are NOT what Foundry loads at runtime —
Foundry requires each compendium pack to be compiled into LevelDB format.

**After adding or editing ANY file under `packs/_source/`, you must recompile
before the changes will show up in Foundry:**

```
npm install   # first time only
npm run build:packs
```

This runs `tools/build-packs.mjs`, which reads the pack list from `system.json`
and compiles every `packs/_source/<name>` folder into the corresponding
`packs/<name>` LevelDB directory (binary files: CURRENT, LOCK, LOG,
MANIFEST-*, *.log). **The compiled `packs/<name>` output must be committed to
git** — since the system is distributed as a GitHub branch ZIP download (no
build step runs on the end user's Foundry server), the repo must ship with
already-compiled packs.

Do not hand-edit anything under `packs/<name>` directly (only `packs/_source/<name>`)
— it will be overwritten on the next build.

## Validation & CI (IMPORTANT)

Before committing content changes, run `npm run check`. It runs three
validators (also enforced in CI via `.github/workflows/ci.yml` on every push
and PR):

- `npm run validate:manifest` (`tools/validate-manifest.mjs`) — sanity-checks
  `system.json`: version is semver, every pack has a source dir, referenced
  esmodules/styles/lang files exist, packFolders point at real packs.
- `npm run validate:packs` (`tools/validate-packs.mjs`) — every source doc has a
  well-formed 16-char alphanumeric `_id`, no duplicate `_id` across the whole
  repo, folder files have a `sorting`, and each doc's `type` is a declared
  subtype. This replaces the old manual dupe-scan.
- `npm run check:packs` (`tools/check-packs-current.mjs`) — extracts the
  committed compiled packs and compares their documents to source, so "edited
  source but forgot to `npm run build:packs`" is caught. (A raw `git diff` can't
  do this — LevelDB output is non-deterministic at the byte level.)

So the content loop is: edit `packs/_source/` → `npm run build:packs` →
`npm run check` → commit both source and compiled output.

## World data migrations (IMPORTANT)

`scripts/migrations.mjs` runs registered migrations once per world on load (GM
only), keyed off the `vtmlarp.systemMigrationVersion` world setting, then stamps
the world with the current version. **Whenever a schema change renames/restructures
stored data that live characters may already have, add a migration** — Foundry
does not rewrite existing documents for you. Append an entry to `MIGRATIONS`
with the shipping version and an idempotent `migrate(ctx)` using the
`updateActors` / `updateItems` / `updateOwnedItems` / `updateScenes` helpers.
The list is intentionally empty at 1.13.x (framework introduced with no pending
changes; first load just baselines the version).

## Foundry version notes

- `system.json` `compatibility` currently targets Foundry v12 (`minimum`/`verified`: "12").
- The system has also been patched to run under Foundry v13/v14: sheet classes
  use `foundry.appv1.sheets.ActorSheet`/`ItemSheet` (not the deprecated global
  `ActorSheet`/`ItemSheet`) and `scripts/vtmlarp.mjs` uses
  `foundry.documents.collections.Actors`/`Items`, since the un-namespaced
  globals are deprecated in v13 and will be removed entirely in v15.
- `getData()` in both `scripts/sheets/actor-sheet.mjs` and
  `scripts/sheets/item-sheet.mjs` explicitly sets `context.actor`/`context.item`/
  `context.system` from `this.actor`/`this.item` rather than relying on
  whatever shape `super.getData()` happens to return — this changed between
  Foundry versions and caused a "Cannot read properties of undefined" crash.
- The sheets still use the V1 Application framework (`FormApplication`/
  `ActorSheet`/`ItemSheet`), which v16 will remove entirely. A full migration
  to `foundry.applications.api.ApplicationV2`/`DocumentSheetV2` is future work.

## Compendium content build workflow

See `packs/README.md` for the sourcebook-by-sourcebook changelog of what's
been built. The overall project workflow (established across many sessions):
user splits/uploads a sourcebook PDF to Google Drive → fetch and assemble a
plain-text reference file into `reference/<Book> - FULL.txt` → build compendium
JSON into `packs/_source/<pack>/` following the schemas in
`scripts/documents/item.mjs`/`actor.mjs` → recompile packs (see above) →
verify no duplicate `_id` values across the whole repo → commit and push.

Every document `_id` must be generated with Python's `uuid.uuid4().hex[:16]`
(never a low-entropy RNG) to avoid collisions across concurrently-built content.

## To-do / future work

- **Compendium linking from character sheet dropdowns**: DONE — the actor
  sheet has `.open-lore` book icons next to Clan, Sect, Path, Nature/Demeanor
  and Virtues that resolve the selected value to a compendium JournalEntry via
  `CLAN_LORE_LOOKUP`/`SECT_LORE_LOOKUP` (in `actor-sheet.mjs`) and open it.
  `_onOpenLore` falls back across the clans/antitribu/revenants packs so
  bloodlines not in the primary lookup still resolve. The Character Builder has
  the equivalent (`openInfo`/`openInfoSel`). Remaining nicety: a naming/flag
  convention on lore JournalEntries so no hand-maintained lookup table is
  needed.
- **General informational hyperlinking**: broader pass to add inline links
  from sheet text/hints to relevant lore JournalEntry pages (e.g. "history of
  the Sabbat" style topics), so players can read background info without
  hunting through compendiums manually. Same lookup-table/convention
  prerequisite as above.
- Full ApplicationV2/DocumentSheetV2 migration (see Foundry version notes
  above) — the V1 Application framework the sheets currently use will be
  removed in v16.
