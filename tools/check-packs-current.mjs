import { extractPack } from "@foundryvtt/foundryvtt-cli";
import { readFileSync, readdirSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import path from "node:path";

// Verifies the committed compiled packs (LevelDB under packs/<name>) actually
// match the hand-authored source under packs/_source/<name>. Because compiling
// LevelDB is non-deterministic at the byte level, a raw `git diff` can't tell
// whether someone edited source but forgot to rebuild. Instead we extract each
// committed pack back to documents and compare them, by _id and by normalized
// content, against the source JSON. Exits non-zero with a clear "run
// npm run build:packs" message on any drift.

const rootDir = path.resolve(fileURLToPath(import.meta.url), "../..");
const system = JSON.parse(readFileSync(path.join(rootDir, "system.json"), "utf8"));

/** Normalize a document for content comparison: drop the compiler-injected
 * "_key" field, and drop keys whose value is empty (empty array/object, null,
 * undefined, or ""). The extract step re-adds schema defaults the source
 * legitimately omits (e.g. `effects: []`), so ignoring empties lets us catch
 * REAL content drift without tripping on those. */
function normalize(value) {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === "_key") continue;
      const nv = normalize(v);
      const empty = nv === null || nv === undefined || nv === ""
        || (Array.isArray(nv) && nv.length === 0)
        || (nv && typeof nv === "object" && !Array.isArray(nv) && Object.keys(nv).length === 0);
      if (!empty) out[k] = nv;
    }
    return out;
  }
  return value;
}
const stripKeys = normalize;

/** Canonical JSON (recursively sorted keys) for order-independent comparison. */
function canon(value) {
  if (Array.isArray(value)) return `[${value.map(canon).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canon(value[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

const problems = [];

for (const pack of system.packs) {
  const sourceDir = path.join(rootDir, "packs", "_source", pack.name);
  const compiledDir = path.join(rootDir, pack.path);
  if (!existsSync(compiledDir)) { problems.push(`pack "${pack.name}": compiled pack missing at ${pack.path} — run: npm run build:packs`); continue; }
  if (!existsSync(sourceDir)) { problems.push(`pack "${pack.name}": source missing at packs/_source/${pack.name}`); continue; }

  // Load source docs by _id.
  const source = new Map();
  for (const file of readdirSync(sourceDir).filter(f => f.endsWith(".json"))) {
    const doc = JSON.parse(readFileSync(path.join(sourceDir, file), "utf8"));
    if (doc._id) source.set(doc._id, canon(stripKeys(doc)));
  }

  // Extract the committed compiled pack to a temp dir and load its docs by _id.
  const staging = mkdtempSync(path.join(tmpdir(), `vtmlarp-check-${pack.name}-`));
  const extracted = new Map();
  try {
    await extractPack(compiledDir, staging, { yaml: false, log: false });
    for (const file of readdirSync(staging).filter(f => f.endsWith(".json"))) {
      const doc = JSON.parse(readFileSync(path.join(staging, file), "utf8"));
      if (doc._id) extracted.set(doc._id, canon(stripKeys(doc)));
    }
  } catch (e) {
    problems.push(`pack "${pack.name}": could not read compiled pack — ${e.message}`);
    rmSync(staging, { recursive: true, force: true });
    continue;
  }
  rmSync(staging, { recursive: true, force: true });

  for (const [id] of source) if (!extracted.has(id)) problems.push(`pack "${pack.name}": _id ${id} is in source but not in the compiled pack`);
  for (const [id] of extracted) if (!source.has(id)) problems.push(`pack "${pack.name}": _id ${id} is in the compiled pack but not in source`);
  for (const [id, s] of source) {
    const x = extracted.get(id);
    if (x && x !== s) problems.push(`pack "${pack.name}": _id ${id} differs between source and compiled pack`);
  }
}

if (problems.length) {
  console.error(`✗ check-packs-current: compiled packs are OUT OF DATE (${problems.length} difference(s)):\n`);
  for (const p of problems.slice(0, 50)) console.error(`  - ${p}`);
  if (problems.length > 50) console.error(`  ...and ${problems.length - 50} more`);
  console.error(`\nRun \`npm run build:packs\` and commit the packs/ output.`);
  process.exit(1);
}

console.log(`✓ check-packs-current: committed compiled packs match source.`);
