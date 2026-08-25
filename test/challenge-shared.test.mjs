import { test } from "node:test";
import assert from "node:assert/strict";

// challenge-shared.mjs destructures `foundry.applications.handlebars` at import
// time; stub the global so the module loads in a plain Node context. We only
// exercise unspentCount, which is pure and touches none of it.
globalThis.foundry ??= {};
globalThis.foundry.applications ??= {};
globalThis.foundry.applications.handlebars ??= {};

const { unspentCount } = await import("../scripts/apps/challenge-shared.mjs");

const actor = (total, traits) => ({ system: { attributes: { physical: { total, traits } } } });

test("unspentCount: no attribute block returns 0", () => {
  assert.equal(unspentCount({ system: { attributes: {} } }, "physical"), 0);
  assert.equal(unspentCount(null, "physical"), 0);
});

test("unspentCount: full Total with no chips bids the whole pool", () => {
  // The regression this guards: previously counted chips only, so a 7-Total
  // character with no named chips bid 0.
  assert.equal(unspentCount(actor(7, []), "physical"), 7);
  assert.equal(unspentCount(actor(7, undefined), "physical"), 7);
});

test("unspentCount: spent named chips reduce the available pool", () => {
  const traits = [{ spent: true }, { spent: false }, { spent: true }];
  assert.equal(unspentCount(actor(5, traits), "physical"), 3);
});

test("unspentCount: never returns negative when more chips are spent than Total", () => {
  const traits = [{ spent: true }, { spent: true }, { spent: true }];
  assert.equal(unspentCount(actor(2, traits), "physical"), 0);
});
