import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Pre-build sanity checks on the hand-authored compendium source under
// packs/_source/. Run in CI (and locally before a build) so a bad _id, a
// duplicate, or a type mismatch is caught before it ships as a broken/dead
// compendium entry. Exits non-zero (and prints every problem) on failure.

const rootDir = path.resolve(fileURLToPath(import.meta.url), "../..");
const system = JSON.parse(readFileSync(path.join(rootDir, "system.json"), "utf8"));

// pack name -> declared Document type, from the manifest.
const packType = Object.fromEntries(system.packs.map(p => [p.name, p.type]));
const ID_RE = /^[A-Za-z0-9]{16}$/;

const errors = [];
const seenIds = new Map(); // _id -> "pack/file" where first seen
let fileCount = 0;

for (const pack of system.packs) {
  const sourceDir = path.join(rootDir, "packs", "_source", pack.name);
  if (!existsSync(sourceDir)) {
    errors.push(`pack "${pack.name}": no source directory at packs/_source/${pack.name}`);
    continue;
  }
  const files = readdirSync(sourceDir).filter(f => f.endsWith(".json"));
  for (const file of files) {
    const rel = `${pack.name}/${file}`;
    fileCount++;
    let doc;
    try {
      doc = JSON.parse(readFileSync(path.join(sourceDir, file), "utf8"));
    } catch (e) {
      errors.push(`${rel}: invalid JSON — ${e.message}`);
      continue;
    }

    // _id: present, well-formed (exactly 16 alphanumerics), globally unique.
    if (!doc._id) {
      errors.push(`${rel}: missing _id`);
    } else if (!ID_RE.test(doc._id)) {
      errors.push(`${rel}: malformed _id "${doc._id}" (must be 16 alphanumeric chars)`);
    } else if (seenIds.has(doc._id)) {
      errors.push(`${rel}: duplicate _id "${doc._id}" (also in ${seenIds.get(doc._id)})`);
    } else {
      seenIds.set(doc._id, rel);
    }

    if (!doc.name || typeof doc.name !== "string" || !doc.name.trim()) {
      errors.push(`${rel}: missing or empty name`);
    }

    const isFolder = file.startsWith("_folder-");
    if (isFolder) {
      // Folder docs organize the sidebar tree; the compiler keys them off the
      // filename convention, and Foundry needs a sorting mode on each.
      if (!doc.sorting) errors.push(`${rel}: folder is missing a "sorting" value (e.g. "a" or "m")`);
    } else {
      // A non-folder document's top-level "type" must match the pack's type:
      // Item/Actor packs store a subtype string in "type"; JournalEntry docs
      // legitimately carry no "type" (or "base"), so only validate the
      // subtype-bearing pack kinds against the manifest's document types.
      const declared = packType[pack.name];
      const allowedSubtypes = system.documentTypes?.[declared]
        ? Object.keys(system.documentTypes[declared])
        : null;
      if (allowedSubtypes && doc.type && !allowedSubtypes.includes(doc.type)) {
        errors.push(`${rel}: type "${doc.type}" is not a declared ${declared} subtype (${allowedSubtypes.join(", ")})`);
      }
    }
  }
}

if (errors.length) {
  console.error(`✗ validate-packs: ${errors.length} problem(s) across ${fileCount} source file(s):\n`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(`✓ validate-packs: ${fileCount} source files OK, ${seenIds.size} unique _ids, no duplicates or malformed IDs.`);
