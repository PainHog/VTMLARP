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

- **Compendium linking from character sheet dropdowns**: add a small button/link
  next to header dropdown fields (Clan, Sect, etc.) on the actor sheet that
  jumps to the relevant compendium entry (e.g. a link icon next to the Clan
  field opens that clan's lore JournalEntry). Requires resolving a dropdown
  value to a specific compendium document UUID, which isn't a 1:1 mapping
  today (clan lore lives across many differently-named JournalEntry packs
  built book-by-book) — will need either a lookup table maintained by hand,
  or a naming/flag convention added to lore JournalEntries so they can be
  found programmatically by clan/topic.
- **General informational hyperlinking**: broader pass to add inline links
  from sheet text/hints to relevant lore JournalEntry pages (e.g. "history of
  the Sabbat" style topics), so players can read background info without
  hunting through compendiums manually. Same lookup-table/convention
  prerequisite as above.
- Full ApplicationV2/DocumentSheetV2 migration (see Foundry version notes
  above) — the V1 Application framework the sheets currently use will be
  removed in v16.
