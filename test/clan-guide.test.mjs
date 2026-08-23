import { test } from "node:test";
import assert from "node:assert/strict";
import { CLANS, CLAN_DISCIPLINES } from "../scripts/apps/clan-data.mjs";
import { CLAN_GUIDE, DISCIPLINE_BLURB, searchClans } from "../scripts/apps/clan-guide.mjs";

test("every clan has a guide entry with a blurb and tags", () => {
  for (const clan of CLANS) {
    const g = CLAN_GUIDE[clan];
    assert.ok(g, `missing CLAN_GUIDE entry for ${clan}`);
    assert.ok(g.blurb && g.blurb.length > 10, `${clan} needs a real blurb`);
    assert.ok(Array.isArray(g.tags) && g.tags.length >= 3, `${clan} needs playstyle tags`);
    assert.ok(g.tags.every(t => t === t.toLowerCase()), `${clan} tags must be lowercase`);
  }
});

test("no stray guide entries for clans that don't exist", () => {
  for (const name of Object.keys(CLAN_GUIDE)) {
    assert.ok(CLANS.includes(name), `CLAN_GUIDE has "${name}" which is not in CLANS`);
  }
});

test("every clan discipline has a one-line blurb", () => {
  const used = new Set();
  for (const list of Object.values(CLAN_DISCIPLINES)) for (const d of list) used.add(d);
  for (const d of used) {
    assert.ok(DISCIPLINE_BLURB[d], `missing DISCIPLINE_BLURB for ${d}`);
  }
});

test("searchClans returns everything for an empty query", () => {
  assert.deepEqual(searchClans("", CLANS), CLANS);
  assert.deepEqual(searchClans("   ", CLANS), CLANS);
});

test("searchClans points playstyle keywords at the right clan", () => {
  assert.equal(searchClans("assassin", CLANS)[0], "Assamite");
  assert.equal(searchClans("artist", CLANS)[0], "Toreador");
  assert.equal(searchClans("necromancer", CLANS)[0], "Giovanni");
  assert.equal(searchClans("shadow", CLANS)[0], "Lasombra");
  assert.equal(searchClans("madness", CLANS)[0], "Malkavian");
});

test("searchClans matches a clan by name too", () => {
  assert.ok(searchClans("brujah", CLANS).includes("Brujah"));
});

test("searchClans finds every clan that learns a searched Discipline", () => {
  const dominate = searchClans("dominate", CLANS);
  for (const [clan, discs] of Object.entries(CLAN_DISCIPLINES)) {
    if (discs.includes("Dominate")) assert.ok(dominate.includes(clan), `${clan} learns Dominate but wasn't found`);
  }
  // A few spot checks across Disciplines.
  assert.ok(searchClans("protean", CLANS).includes("Gangrel"));
  assert.ok(searchClans("thaumaturgy", CLANS).includes("Tremere"));
  assert.ok(searchClans("necromancy", CLANS).includes("Giovanni"));
});

test("searchClans returns [] when nothing matches", () => {
  assert.deepEqual(searchClans("zzznotathing", CLANS), []);
});
