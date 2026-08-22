import { test } from "node:test";
import assert from "node:assert/strict";
import { GESTURES, beats } from "../scripts/apps/gesture.mjs";

test("identical gestures tie", () => {
  for (const g of GESTURES) assert.equal(beats(g, g), "tie");
});

test("standard rock-paper-scissors", () => {
  assert.equal(beats("rock", "scissors"), "win");
  assert.equal(beats("scissors", "paper"), "win");
  assert.equal(beats("paper", "rock"), "win");
  assert.equal(beats("scissors", "rock"), "lose");
  assert.equal(beats("paper", "scissors"), "lose");
  assert.equal(beats("rock", "paper"), "lose");
});

test("bomb beats rock and paper, loses to scissors", () => {
  assert.equal(beats("bomb", "rock"), "win");
  assert.equal(beats("bomb", "paper"), "win");
  assert.equal(beats("bomb", "scissors"), "lose");
  // Symmetry: the opponent's view is the inverse.
  assert.equal(beats("rock", "bomb"), "lose");
  assert.equal(beats("paper", "bomb"), "lose");
  assert.equal(beats("scissors", "bomb"), "win");
});

test("every non-tie pairing is win for exactly one side", () => {
  for (const a of GESTURES) {
    for (const b of GESTURES) {
      if (a === b) continue;
      const ab = beats(a, b);
      const ba = beats(b, a);
      assert.notEqual(ab, "tie", `${a} vs ${b} should not tie`);
      assert.equal(ab === "win" ? "lose" : "win", ba, `${a} vs ${b} not symmetric`);
    }
  }
});
