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
