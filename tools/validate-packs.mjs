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
const folderIdsByPack = {}; // pack -> Set of folder _ids
const folderRefs = []; // { rel, pack, folderId } for non-folder docs with a folder
const namesByPack = {}; // pack -> Map(name -> [rel,...])
// Packs whose entries are opened by NAME (sheet/builder lore links); a
// duplicate name here silently resolves to the wrong entry, so it's an error.
const NAME_RESOLVED_PACKS = new Set(["clans", "antitribu", "revenants", "sects", "paths-of-enlightenment", "derangements"]);
const warnings = [];
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
      (folderIdsByPack[pack.name] ??= new Set()).add(doc._id);
    } else {
      // Record any folder reference to validate once all folders are known.
      if (doc.folder) folderRefs.push({ rel, pack: pack.name, folderId: doc.folder });
      if (doc.name) {
        const map = (namesByPack[pack.name] ??= new Map());
        map.set(doc.name, [...(map.get(doc.name) ?? []), rel]);
      }

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

// A document's "folder" must reference a folder that exists in the same pack,
// or it points at nothing and the entry lands at the pack root (a common
// copy-paste bug that leaves entries mysteriously outside their subfolder).
for (const ref of folderRefs) {
  const folders = folderIdsByPack[ref.pack];
  if (!folders || !folders.has(ref.folderId)) {
    errors.push(`${ref.rel}: folder "${ref.folderId}" does not exist in pack "${ref.pack}"`);
  }
}

// Duplicate names: an ERROR in name-resolved lore packs (breaks the sheet's
// lore links), a non-failing WARNING elsewhere (often intentional variants
// across folders).
for (const [pack, map] of Object.entries(namesByPack)) {
  for (const [name, rels] of map) {
    if (rels.length < 2) continue;
    const msg = `pack "${pack}": duplicate name "${name}" in ${rels.length} entries (${rels.map(r => r.split("/")[1]).join(", ")})`;
    if (NAME_RESOLVED_PACKS.has(pack)) errors.push(msg);
    else warnings.push(msg);
  }
}

if (errors.length) {
  console.error(`✗ validate-packs: ${errors.length} problem(s) across ${fileCount} source file(s):\n`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

if (warnings.length) {
  console.warn(`⚠ validate-packs: ${warnings.length} warning(s) (not failing):`);
  for (const w of warnings) console.warn(`  - ${w}`);
}

console.log(`✓ validate-packs: ${fileCount} source files OK, ${seenIds.size} unique _ids, no duplicates or malformed IDs.`);
