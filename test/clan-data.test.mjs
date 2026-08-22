import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { CLANS, CLAN_DISCIPLINES } from "../scripts/apps/clan-data.mjs";

const rootDir = path.resolve(fileURLToPath(import.meta.url), "../..");

// The set of selectable Discipline names in the compendium source (base
// Disciplines, i.e. not paths/combos with parentheses or em dashes) — the same
// filter the builder's Discipline picker uses.
function disciplineNames() {
  const dir = path.join(rootDir, "packs", "_source", "disciplines");
  const names = new Set();
  for (const f of readdirSync(dir).filter(x => x.endsWith(".json"))) {
    const d = JSON.parse(readFileSync(path.join(dir, f), "utf8"));
    if (d.type === "discipline" && !/[(—]/.test(d.name)) names.add(d.name);
  }
  return names;
}

test("every clan in the picker has a CLAN_DISCIPLINES entry", () => {
  for (const clan of CLANS) {
    assert.ok(clan in CLAN_DISCIPLINES, `CLAN_DISCIPLINES missing entry for "${clan}"`);
  }
});

test("every in-clan Discipline name exists in the compendium", () => {
  const known = disciplineNames();
  for (const [clan, discs] of Object.entries(CLAN_DISCIPLINES)) {
    for (const d of discs) {
      assert.ok(known.has(d), `Clan "${clan}" references unknown Discipline "${d}"`);
    }
  }
});

test("in-clan Discipline lists are the expected size (3, or 0 for Caitiff-likes)", () => {
  for (const [clan, discs] of Object.entries(CLAN_DISCIPLINES)) {
    assert.ok(discs.length === 3 || discs.length === 0, `Clan "${clan}" has ${discs.length} in-clan Disciplines (expected 3 or 0)`);
  }
});
