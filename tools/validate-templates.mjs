import Handlebars from "handlebars";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Precompile every Handlebars template so a syntax error (an unclosed block, a
// mismatched {{#each}}/{{/each}}, a stray token) is caught in CI instead of as
// a blank/broken sheet in Foundry. Foundry-specific helpers are registered as
// no-ops so their USE doesn't trip the parser; this checks template SYNTAX, not
// helper behavior.

const rootDir = path.resolve(fileURLToPath(import.meta.url), "../..");
const templatesDir = path.join(rootDir, "templates");

// Register the custom helpers this system uses, plus common built-ins, as
// no-ops so `{{vtmDots ...}}` etc. parse. (Handlebars only needs them defined
// to compile calls that use block form; inline calls compile regardless, but
// registering keeps precompile warnings quiet.)
for (const h of [
  "vtmCapitalize", "vtmDots", "vtmDotsMax", "vtmGestureIcon",
  "vtmParseDisciplineNames", "eq", "gt", "lt", "and", "or", "not",
  "concat", "json", "times", "ifEquals"
]) {
  if (!Handlebars.helpers[h]) Handlebars.registerHelper(h, () => "");
}

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (entry.endsWith(".hbs")) out.push(full);
  }
  return out;
}

const files = walk(templatesDir);
const errors = [];

for (const file of files) {
  const rel = path.relative(rootDir, file);
  try {
    Handlebars.precompile(readFileSync(file, "utf8"));
  } catch (e) {
    errors.push(`${rel}: ${e.message.split("\n")[0]}`);
  }
}

if (errors.length) {
  console.error(`✗ validate-templates: ${errors.length} template(s) failed to compile:\n`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(`✓ validate-templates: ${files.length} Handlebars templates compile cleanly.`);
