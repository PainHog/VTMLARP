import { test } from "node:test";
import assert from "node:assert/strict";
import { flattenAbilities } from "../scripts/migrations.mjs";

test("merges the three ability lists into one alphabetical array", () => {
  const src = {
    talents: [{ name: "Intimidation", rating: 2 }, { name: "Alertness", rating: 1 }],
    skills: [{ name: "Melee", rating: 3, max: 3 }],
    knowledges: [{ name: "Occult", rating: 2, notes: "rituals" }]
  };
  const out = flattenAbilities(src);
  assert.deepEqual(out.map(a => a.name), ["Alertness", "Intimidation", "Melee", "Occult"]);
  assert.deepEqual(out[2], { name: "Melee", rating: 3, max: 3, notes: "" });
  assert.equal(out[3].notes, "rituals");
  // max defaults to rating when absent
  assert.equal(out[0].max, 1);
});

test("returns null for already-flat or missing input (nothing to migrate)", () => {
  assert.equal(flattenAbilities([{ name: "Brawl", rating: 1 }]), null);
  assert.equal(flattenAbilities(undefined), null);
  assert.equal(flattenAbilities(null), null);
});

test("tolerates empty/partial old shapes", () => {
  assert.deepEqual(flattenAbilities({}), []);
  assert.deepEqual(flattenAbilities({ talents: [] }), []);
  assert.deepEqual(flattenAbilities({ skills: [{ name: "Drive", rating: 0 }] }), [{ name: "Drive", rating: 0, max: 0, notes: "" }]);
});
