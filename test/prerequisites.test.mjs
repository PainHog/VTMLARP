import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePrerequisites, checkPrerequisites } from "../scripts/apps/prerequisites.mjs";

const disc = (name, rating) => ({ name, system: { rating } });

test("parsePrerequisites: empty / whitespace yields no groups", () => {
  assert.deepEqual(parsePrerequisites(""), []);
  assert.deepEqual(parsePrerequisites(null), []);
  assert.deepEqual(parsePrerequisites("   "), []);
});

test("parsePrerequisites: AND groups split on commas, OR within a group", () => {
  const groups = parsePrerequisites("Fortitude (1) or Potence (1), Presence (2)");
  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0], [{ name: "Fortitude", rating: 1 }, { name: "Potence", rating: 1 }]);
  assert.deepEqual(groups[1], [{ name: "Presence", rating: 2 }]);
});

test("parsePrerequisites: a bare name with no parenthetical is rating 0", () => {
  assert.deepEqual(parsePrerequisites("Auspex"), [[{ name: "Auspex", rating: 0 }]]);
});

test("parsePrerequisites: non-numeric parenthetical annotation reads as rating 0", () => {
  assert.deepEqual(parsePrerequisites("Protean (Elder / Earth Control)"),
    [[{ name: "Protean", rating: 0 }]]);
});

test("checkPrerequisites: empty requirement is always met", () => {
  assert.deepEqual(checkPrerequisites("", []), { met: true, missing: [] });
});

test("checkPrerequisites: AND of two groups, one missing", () => {
  const owned = [disc("Fortitude", 2)];
  const res = checkPrerequisites("Fortitude (1), Presence (2)", owned);
  assert.equal(res.met, false);
  assert.deepEqual(res.missing, ["Presence (2)"]);
});

test("checkPrerequisites: OR group satisfied by either side", () => {
  assert.equal(checkPrerequisites("Fortitude (1) or Potence (1)", [disc("Potence", 1)]).met, true);
  assert.equal(checkPrerequisites("Fortitude (1) or Potence (1)", [disc("Fortitude", 1)]).met, true);
});

test("checkPrerequisites: rating must meet or exceed the requirement", () => {
  assert.equal(checkPrerequisites("Celerity (3)", [disc("Celerity", 2)]).met, false);
  assert.equal(checkPrerequisites("Celerity (3)", [disc("Celerity", 3)]).met, true);
});

test("checkPrerequisites: substring match works both directions (annotated names)", () => {
  // Owned name is annotated, requirement is the base name.
  assert.equal(checkPrerequisites("Protean (2)", [disc("Protean (Earth Control)", 2)]).met, true);
  // Requirement is annotated, owned is the base name.
  assert.equal(checkPrerequisites("Protean (Elder) (2)", [disc("Protean", 3)]).met, true);
});
