import { test } from "node:test";
import assert from "node:assert/strict";
import { compareVersions, remapHealthTrack } from "../scripts/migrations.mjs";

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

test("remapHealthTrack bottom-aligns old wound track onto the MET track", () => {
  // Fully undamaged old track -> fully undamaged new track (8 keys).
  const clean = remapHealthTrack({ bruised: "ok", hurt: "ok", injured: "ok", wounded: "ok", mauled: "ok", crippled: "ok", incapacitated: "ok" });
  assert.deepEqual(clean, {
    healthy1: "ok", healthy2: "ok", bruised1: "ok", bruised2: "ok",
    bruised3: "ok", wounded1: "ok", wounded2: "ok", incapacitated: "ok"
  });
});

test("remapHealthTrack preserves damage severity (Incapacitated maps straight across)", () => {
  const out = remapHealthTrack({
    bruised: "bashing", hurt: "bashing", injured: "lethal", wounded: "ok",
    mauled: "ok", crippled: "ok", incapacitated: "aggravated"
  });
  assert.equal(out.healthy1, "ok");            // fresh top box
  assert.equal(out.healthy2, "bashing");       // was bruised
  assert.equal(out.bruised1, "bashing");       // was hurt
  assert.equal(out.bruised2, "lethal");        // was injured
  assert.equal(out.incapacitated, "aggravated"); // straight across, severity kept
});

test("remapHealthTrack is idempotent / skips non-old shapes", () => {
  assert.equal(remapHealthTrack({ healthy1: "ok", incapacitated: "ok" }), null); // already new
  assert.equal(remapHealthTrack(null), null);
  assert.equal(remapHealthTrack(undefined), null);
  assert.equal(remapHealthTrack([]), null);
  // Unknown state strings coerce to "ok".
  assert.equal(remapHealthTrack({ bruised: "garbage" }).healthy2, "ok");
});
