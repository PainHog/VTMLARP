## Summary

<!-- What does this change and why? -->

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Compendium content
- [ ] Tooling / CI
- [ ] Docs

## Checklist

- [ ] `npm run check` passes locally (lint + manifest + templates + packs)
- [ ] If I edited `packs/_source/`, I ran `npm run build:packs` and committed the compiled `packs/<name>` output
- [ ] If I changed a data schema that live characters may already use, I added a migration in `scripts/migrations.mjs`
- [ ] Bumped `version` in `system.json`
