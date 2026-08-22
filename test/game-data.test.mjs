import { test } from "node:test";
import assert from "node:assert/strict";
import { GENERATION_OPTIONS, GENERATION_TABLE, PATH_OPTIONS, ARCHETYPE_OPTIONS } from "../scripts/game-data.mjs";

test("every generation option has a full table row", () => {
  for (const g of GENERATION_OPTIONS) {
    const row = GENERATION_TABLE[g];
    assert.ok(row, `GENERATION_TABLE missing generation ${g}`);
    for (const key of ["maxTraits", "maxAbilities", "bloodMax", "bloodPerTurn", "willpowerStart", "willpowerMax"]) {
      assert.equal(typeof row[key], "number", `gen ${g} missing numeric ${key}`);
    }
  }
});

test("the path and archetype lists are non-empty and unique", () => {
  assert.ok(PATH_OPTIONS.length >= 16);
  assert.ok(ARCHETYPE_OPTIONS.length >= 12);
  assert.equal(new Set(PATH_OPTIONS).size, PATH_OPTIONS.length, "duplicate Path");
  assert.equal(new Set(ARCHETYPE_OPTIONS).size, ARCHETYPE_OPTIONS.length, "duplicate Archetype");
});

test("Path list includes the Dark Ages Roads (builder/sheet parity)", () => {
  assert.ok(PATH_OPTIONS.some(p => p.includes("Road of")), "expected Dark Ages Roads in the shared Path list");
});
