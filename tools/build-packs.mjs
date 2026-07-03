import { compilePack } from "@foundryvtt/foundryvtt-cli";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.resolve(fileURLToPath(import.meta.url), "../..");
const system = JSON.parse(readFileSync(path.join(rootDir, "system.json"), "utf8"));

for (const pack of system.packs) {
  const sourceDir = path.join(rootDir, "packs", "_source", pack.name);
  const destDir = path.join(rootDir, pack.path);
  const fileCount = readdirSync(sourceDir).filter(f => f.endsWith(".json")).length;
  console.log(`Compiling ${pack.name} (${fileCount} documents) -> ${pack.path}`);
  await compilePack(sourceDir, destDir, { yaml: false, log: false });
}

console.log(`Done. Compiled ${system.packs.length} packs.`);
