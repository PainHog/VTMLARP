import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Cheap structural checks on system.json so a typo in the manifest (a pack with
// no source dir, a referenced esmodule/style/lang file that doesn't exist, a
// packFolder pointing at an unknown pack, a bad version string) is caught in CI
// rather than as a silent load failure in Foundry.

const rootDir = path.resolve(fileURLToPath(import.meta.url), "../..");
const errors = [];

let system;
try {
  system = JSON.parse(readFileSync(path.join(rootDir, "system.json"), "utf8"));
} catch (e) {
  console.error(`✗ system.json is not valid JSON: ${e.message}`);
  process.exit(1);
}

const need = (cond, msg) => { if (!cond) errors.push(msg); };
const fileExists = (p) => existsSync(path.join(rootDir, p));

need(system.id === "vtmlarp", `id should be "vtmlarp" (got "${system.id}")`);
need(/^\d+\.\d+\.\d+$/.test(system.version ?? ""), `version "${system.version}" is not semver (major.minor.patch)`);

for (const rel of system.esmodules ?? []) need(fileExists(rel), `esmodule not found: ${rel}`);
for (const rel of system.styles ?? []) need(fileExists(rel), `style not found: ${rel}`);
for (const l of system.languages ?? []) need(fileExists(l.path), `language file not found: ${l.path}`);

const packNames = new Set();
for (const pack of system.packs ?? []) {
  if (packNames.has(pack.name)) errors.push(`duplicate pack name: ${pack.name}`);
  packNames.add(pack.name);
  need(fileExists(path.join("packs", "_source", pack.name)), `pack "${pack.name}": missing source dir packs/_source/${pack.name}`);
  need(!!pack.path, `pack "${pack.name}": missing "path"`);
  need(["Item", "Actor", "JournalEntry"].includes(pack.type), `pack "${pack.name}": unexpected type "${pack.type}"`);
}

// Every pack referenced by a packFolder (nested or flat) must exist.
const walkFolders = (folders) => {
  for (const f of folders ?? []) {
    for (const name of f.packs ?? []) need(packNames.has(name), `packFolder "${f.name}" references unknown pack "${name}"`);
    walkFolders(f.folders);
  }
};
walkFolders(system.packFolders);

if (errors.length) {
  console.error(`✗ validate-manifest: ${errors.length} problem(s):\n`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(`✓ validate-manifest: system.json OK (${system.packs?.length ?? 0} packs, version ${system.version}).`);
