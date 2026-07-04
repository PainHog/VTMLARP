import { compilePack } from "@foundryvtt/foundryvtt-cli";
import { readFileSync, readdirSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import path from "node:path";

const rootDir = path.resolve(fileURLToPath(import.meta.url), "../..");
const system = JSON.parse(readFileSync(path.join(rootDir, "system.json"), "utf8"));

// Maps a manifest pack's Document type to the internal LevelDB collection
// prefix Foundry's compendium adapter expects in each entry's "_key" field
// (e.g. "!items!<id>", or "!journal.pages!<parentId>.<id>" for embedded
// documents). Foundry itself writes this field when a compendium is
// created/exported from within the app; since our source JSON is
// hand-authored outside Foundry, it never has one, so the compiler silently
// skips any entry without it (no _key => no error, no document written).
const TYPE_COLLECTION_MAP = {
  Actor: "actors",
  Item: "items",
  JournalEntry: "journal"
};

// Embedded-collection field names to recurse into, per parent collection,
// mirroring @foundryvtt/foundryvtt-cli's internal HIERARCHY map.
const HIERARCHY = {
  actors: { items: "items", effects: "effects" },
  items: { effects: "effects" },
  journal: { pages: "pages", categories: "categories" }
};

/** Recursively assign "_key" to a document and any embedded documents it carries. */
function assignKeys(doc, collection, idPrefix) {
  const id = idPrefix ? `${idPrefix}.${doc._id}` : doc._id;
  doc._key = `!${collection}!${id}`;
  const embeds = HIERARCHY[collection];
  if (!embeds) return;
  for (const [field, embeddedCollectionName] of Object.entries(embeds)) {
    const value = doc[field];
    if (!Array.isArray(value)) continue;
    for (const embedded of value) {
      assignKeys(embedded, `${collection}.${embeddedCollectionName}`, id);
    }
  }
}

for (const pack of system.packs) {
  const sourceDir = path.join(rootDir, "packs", "_source", pack.name);
  const destDir = path.join(rootDir, pack.path);
  const collection = TYPE_COLLECTION_MAP[pack.type];
  if (!collection) throw new Error(`Unknown pack type "${pack.type}" for pack "${pack.name}"`);

  const sourceFiles = readdirSync(sourceDir).filter(f => f.endsWith(".json"));
  const stagingDir = mkdtempSync(path.join(tmpdir(), `vtmlarp-pack-${pack.name}-`));

  for (const file of sourceFiles) {
    const doc = JSON.parse(readFileSync(path.join(sourceDir, file), "utf8"));
    // Folder documents (used to organize a pack's entries into an expandable
    // tree in the compendium sidebar) live in their own top-level "folders"
    // collection regardless of what type of pack they organize. There's no
    // data field that marks a document as a Folder (its own "type" field
    // instead names which kind of document it *contains*, e.g. "Item"), so
    // this relies on the "_folder-" source filename convention instead.
    assignKeys(doc, file.startsWith("_folder-") ? "folders" : collection, null);
    writeFileSync(path.join(stagingDir, file), JSON.stringify(doc));
  }

  console.log(`Compiling ${pack.name} (${sourceFiles.length} documents) -> ${pack.path}`);
  await compilePack(stagingDir, destDir, { yaml: false, log: false });
  rmSync(stagingDir, { recursive: true, force: true });
}

console.log(`Done. Compiled ${system.packs.length} packs.`);
