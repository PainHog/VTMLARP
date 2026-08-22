import { test } from "node:test";
import assert from "node:assert/strict";
import { compareVersions } from "../scripts/migrations.mjs";

test("compareVersions orders standard semver", () => {
  assert.ok(compareVersions("1.14.0", "1.13.9") > 0);
  assert.ok(compareVersions("1.13.9", "1.14.0") < 0);
  assert.equal(compareVersions("1.14.2", "1.14.2"), 0);
});

test("compareVersions compares each segment numerically, not lexically", () => {
  // Lexical string compare would put "1.9.0" after "1.14.0"; numeric must not.
  assert.ok(compareVersions("1.14.0", "1.9.0") > 0);
  assert.ok(compareVersions("1.2.0", "1.10.0") < 0);
});

test("compareVersions handles missing/short/junk versions as zeros", () => {
  assert.ok(compareVersions("1.0.0", "") > 0);
  assert.equal(compareVersions("", ""), 0);
  assert.equal(compareVersions("1.0", "1.0.0"), 0);
  assert.ok(compareVersions("1.0.1", "1.0") > 0);
  assert.equal(compareVersions(undefined, undefined), 0);
});
