# Contributing

Thanks for helping improve the VTMLARP Foundry system.

## Setup

```bash
npm install
```

## Before you commit

Run the full check (the same suite CI runs):

```bash
npm run check
```

This runs ESLint, the unit tests, and the manifest/template/pack validators.

## Editing compendium content

Content is authored as JSON under `packs/_source/<pack>/` — **one document per
file**. After editing, recompile and commit both source and compiled output:

```bash
npm run build:packs
```

- Every document `_id` must be a unique 16-character alphanumeric string
  (generate with Python `uuid.uuid4().hex[:16]`).
- Don't hand-edit anything under `packs/<name>/` — it's generated.
- `npm run check:packs` verifies the committed compiled packs match source.

## Changing data schemas

If you rename or restructure a field that existing characters may already use,
add a migration in `scripts/migrations.mjs` so live worlds are updated on load.
See `CLAUDE.md` for the full conventions.

## Code style

- ES modules, 2-space indent (see `.editorconfig`).
- Use the namespaced Foundry APIs (`foundry.applications.*`,
  `foundry.documents.collections.*`) — the deprecated un-namespaced globals are
  blocked by lint.

## Commits & versioning

- Bump `version` in `system.json` for user-facing changes and note them in
  `CHANGELOG.md`.
- Keep pull requests focused; fill in the PR template checklist.
