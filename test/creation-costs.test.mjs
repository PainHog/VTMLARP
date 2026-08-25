import { test } from "node:test";
import assert from "node:assert/strict";
import { disciplineFreeDots, disciplineFreebieCost } from "../scripts/apps/creation-costs.mjs";

const BUDGET = 5; // custom-rules free-dot allotment

test("free dots cap each Discipline at 3", () => {
  assert.equal(disciplineFreeDots([1, 2, 3]), 6);
  assert.equal(disciplineFreeDots([5]), 3);      // 4th/5th don't count as free dots
  assert.equal(disciplineFreeDots([4, 4]), 6);
  assert.equal(disciplineFreeDots([]), 0);
});

test("within allotment costs no freebies", () => {
  // 2 + 2 + 1 = 5 free dots, exactly the budget, all tier-3-or-less.
  assert.equal(disciplineFreebieCost([2, 2, 1], BUDGET), 0);
});

test("free-tier dots over the allotment are charged cheapest-first", () => {
  // 3 + 3 = 6 free dots, budget 5 → 1 dot overruns; cheapest free-dot cost is 3.
  assert.equal(disciplineFreebieCost([3, 3], BUDGET), 3);
  // 3 + 3 + 1 = 7 free dots, budget 5 → 2 overrun; two cheapest costs are 3 + 3.
  assert.equal(disciplineFreebieCost([3, 3, 1], BUDGET), 6);
});

test("4th and 5th dots are always freebie-bought at 6 and 9", () => {
  // One Discipline at 5: free dots = 3 (within budget) + 4th(6) + 5th(9) = 15.
  assert.equal(disciplineFreebieCost([5], BUDGET), 15);
  // One at 4: 3 free dots within budget + 4th(6) = 6.
  assert.equal(disciplineFreebieCost([4], BUDGET), 6);
});

test("combined: a 5-dot plus other Disciplines overrunning the allotment", () => {
  // Ratings [5, 2]: free dots = 3 + 2 = 5 (== budget, no overrun) + 4th(6) + 5th(9) = 15.
  assert.equal(disciplineFreebieCost([5, 2], BUDGET), 15);
  // Ratings [5, 3]: free dots = 3 + 3 = 6, budget 5 → 1 overrun cheapest = 3;
  // plus 4th(6) + 5th(9) = 18.
  assert.equal(disciplineFreebieCost([5, 3], BUDGET), 18);
});

test("edge cases: empty ratings, zeros, and negatives", () => {
  // No Disciplines: nothing spent.
  assert.equal(disciplineFreebieCost([], BUDGET), 0);
  assert.equal(disciplineFreeDots([]), 0);
  // A 0 rating consumes no free dots and costs nothing.
  assert.equal(disciplineFreeDots([0, 0]), 0);
  assert.equal(disciplineFreebieCost([0, 0], BUDGET), 0);
  // Defensive: a negative rating is clamped to 0, not treated as a credit.
  assert.equal(disciplineFreeDots([-2]), 0);
  assert.equal(disciplineFreebieCost([-2], BUDGET), 0);
});

test("edge case: budget of 0 charges every free-tier dot", () => {
  // Ratings [3]: 3 free dots, budget 0 → all 3 overrun at 3+6+9 = 18.
  assert.equal(disciplineFreebieCost([3], 0), 18);
});

test("edge case: a 5-dot Discipline with zero budget charges all three free-tier dots too", () => {
  // Ratings [5]: 3 free-tier dots (3+6+9=18) all overrun at budget 0, on top of
  // the mandatory 4th(6)+5th(9)=15 → 33.
  assert.equal(disciplineFreebieCost([5], 0), 33);
});
