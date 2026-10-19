import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateRoll, compareOpposed, rollPool } from "../scripts/apps/dice.mjs";

test("each die 6+ is one success", () => {
  const r = evaluateRoll([5, 6, 7, 9, 2], [], 1);
  assert.equal(r.successes, 3);  // 6,7,9
  assert.equal(r.critical, false);
  assert.equal(r.win, true);
});

test("a pair of 10s counts as 4 successes (critical)", () => {
  const r = evaluateRoll([10, 10], [], 1);
  // two 10s = 2 base + 2 bonus = 4
  assert.equal(r.successes, 4);
  assert.equal(r.critical, true);
  assert.equal(r.critPairs, 1);
});

test("a single 10 is just one success, no critical", () => {
  const r = evaluateRoll([10, 3], [], 1);
  assert.equal(r.successes, 1);
  assert.equal(r.critical, false);
});

test("four 10s = two pairs = 8 successes", () => {
  const r = evaluateRoll([10, 10, 10, 10], [], 1);
  assert.equal(r.successes, 8);
  assert.equal(r.critPairs, 2);
});

test("three 10s = one pair (4) + one leftover 10 (1) = 5", () => {
  const r = evaluateRoll([10, 10, 10], [], 1);
  assert.equal(r.successes, 5);
  assert.equal(r.critPairs, 1);
});

test("messy critical when a 10 is on a Hunger die", () => {
  const r = evaluateRoll([10], [10], 1);  // pair across regular+hunger, one is hunger
  assert.equal(r.critical, true);
  assert.equal(r.messy, true);
});

test("critical with no Hunger 10 is not messy", () => {
  const r = evaluateRoll([10, 10], [2], 1);
  assert.equal(r.critical, true);
  assert.equal(r.messy, false);
});

test("bestial failure: failed difficulty with a Hunger 1", () => {
  const r = evaluateRoll([2, 3], [1], 5);
  assert.equal(r.win, false);
  assert.equal(r.bestial, true);
});

test("a Hunger 1 on a SUCCESSFUL roll is not bestial", () => {
  const r = evaluateRoll([6, 7, 8], [1], 2);
  assert.equal(r.win, true);
  assert.equal(r.bestial, false);
});

test("zero successes is a total failure", () => {
  const r = evaluateRoll([1, 2, 3, 4, 5], [], 1);
  assert.equal(r.successes, 0);
  assert.equal(r.totalFailure, true);
  assert.equal(r.win, false);
});

test("difficulty met exactly is a win (meet or beat)", () => {
  assert.equal(evaluateRoll([6, 6, 6], [], 3).win, true);
  assert.equal(evaluateRoll([6, 6], [], 3).win, false);
});

test("null difficulty counts successes without a win verdict", () => {
  const r = evaluateRoll([6, 7], [], null);
  assert.equal(r.successes, 2);
  assert.equal(r.win, null);
  assert.equal(r.bestial, false);  // no verdict => not bestial here
});

test("compareOpposed picks the higher successes and margin", () => {
  assert.deepEqual(compareOpposed(5, 3), { winner: "challenger", margin: 2 });
  assert.deepEqual(compareOpposed(2, 6), { winner: "opponent", margin: 4 });
  assert.deepEqual(compareOpposed(4, 4), { winner: "tie", margin: 0 });
});

test("rollPool splits hunger dice out of the pool and stays in range", () => {
  for (let i = 0; i < 200; i++) {
    const { regularDice, hungerDice } = rollPool(7, 3);
    assert.equal(regularDice.length, 4);
    assert.equal(hungerDice.length, 3);
    for (const d of [...regularDice, ...hungerDice]) {
      assert.ok(d >= 1 && d <= 10 && Number.isInteger(d));
    }
  }
});

test("rollPool clamps hunger to the pool size and handles empty pools", () => {
  const big = rollPool(2, 9);
  assert.equal(big.hungerDice.length, 2);
  assert.equal(big.regularDice.length, 0);
  const empty = rollPool(0, 3);
  assert.equal(empty.regularDice.length, 0);
  assert.equal(empty.hungerDice.length, 0);
});
