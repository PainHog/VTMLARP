// Validates localization keys: every key referenced by a `{{localize "KEY"}}`
// / `{{localize 'KEY'}}` in a template, or by `game.i18n.localize("KEY")` /
// `game.i18n.format("KEY", ...)` in a script, must exist in lang/en.json.
// This makes the i18n conversion safe — a typo'd or missing key would otherwise
// render as the raw key at runtime with no compile error. Run in CI.
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(import.meta.url), "../..");
const lang = JSON.parse(readFileSync(path.join(root, "lang/en.json"), "utf8"));
const known = new Set(Object.keys(lang));

/** Recursively list files under dir with one of the given extensions. */
function walk(dir, exts) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full, exts));
    else if (exts.some(e => name.endsWith(e))) out.push(full);
  }
  return out;
}

const missing = [];
const seen = new Set();
const record = (key, file) => { seen.add(key); if (!known.has(key)) missing.push({ key, file: path.relative(root, file) }); };

// Templates: {{localize "KEY"}} / {{localize 'KEY'}} and (localize "KEY").
for (const file of walk(path.join(root, "templates"), [".hbs"])) {
  const src = readFileSync(file, "utf8");
  for (const m of src.matchAll(/\blocalize\s+["']([^"']+)["']/g)) record(m[1], file);
}

// Scripts: game.i18n.localize("KEY") / game.i18n.format("KEY", ...).
for (const file of walk(path.join(root, "scripts"), [".mjs"])) {
  const src = readFileSync(file, "utf8");
  for (const m of src.matchAll(/i18n\.(?:localize|format)\(\s*["'`]([^"'`]+)["'`]/g)) record(m[1], file);
}

if (missing.length) {
  console.error(`✗ validate-i18n: ${missing.length} localization key(s) referenced but missing from lang/en.json:`);
  for (const m of missing) console.error(`  - "${m.key}"  (${m.file})`);
  process.exit(1);
}

// Report unused VTMLARP.* keys as a non-failing hint (TYPES.* are used by core).
const unused = [...known].filter(k => k.startsWith("VTMLARP.") && !seen.has(k));
console.log(`✓ validate-i18n: ${seen.size} referenced key(s) all present in lang/en.json (${known.size} defined).`);
if (unused.length) console.log(`  note: ${unused.length} defined VTMLARP.* key(s) not yet referenced (fine during a phased conversion).`);
