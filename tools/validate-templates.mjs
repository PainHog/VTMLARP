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

// Known helper names, so we can flag a template invoking a helper that was
// never registered (a classic cause of a blank/throwing sheet in Foundry).
const HANDLEBARS_BUILTINS = new Set(["if", "unless", "each", "with", "lookup", "log", "blockHelperMissing", "helperMissing"]);
// Helpers Foundry core registers globally (v11–v14). Kept generous so we don't
// false-positive on a real Foundry helper.
const FOUNDRY_HELPERS = new Set([
  "eq", "ne", "lt", "gt", "lte", "gte", "not", "and", "or", "concat", "object",
  "json", "range", "includes", "localize", "numberFormat", "numberInput",
  "filePicker", "colorPicker", "editor", "radioBoxes", "checked", "disabled",
  "select", "selectOptions", "rangePicker", "timeSince", "ifThen", "unlessThen",
  "formInput", "formGroup", "formField", "prosemirror"
]);
// Helpers this system registers, scraped from the source.
const OWN_HELPERS = new Set();
for (const f of readdirSync(path.join(rootDir, "scripts")).flatMap(function all(e) {
  const full = path.join(rootDir, "scripts", e);
  return statSync(full).isDirectory() ? readdirSync(full).map(x => path.join(e, x)) : [e];
})) {
  const full = path.join(rootDir, "scripts", f);
  if (!full.endsWith(".mjs")) continue;
  const src = readFileSync(full, "utf8");
  for (const m of src.matchAll(/registerHelper\(\s*["'`]([\w-]+)["'`]/g)) OWN_HELPERS.add(m[1]);
}
const KNOWN = new Set([...HANDLEBARS_BUILTINS, ...FOUNDRY_HELPERS, ...OWN_HELPERS]);

// Extract helper-name invocations from a template. To avoid matching English
// words in plain text or in comments, we ONLY look inside mustache expressions
// `{{ ... }}` (comments and triple-stache raw blocks stripped first), and
// within each: the leading token when it's a bare identifier followed by an
// argument (a helper call, vs. `{{variable}}`/`{{path.to.value}}`), plus any
// `(name ...)` subexpressions.
function usedHelpers(src) {
  const names = new Set();
  // Strip comments: {{!-- --}} and {{! }}.
  const clean = src.replace(/\{\{!--[\s\S]*?--\}\}/g, "").replace(/\{\{![^}]*\}\}/g, "");
  // Each mustache body (not triple-stache {{{ }}}, not partials {{> }}).
  for (const m of clean.matchAll(/\{\{(?!\{)(~?[#^/]?)\s*([^}]*?)\s*~?\}\}/g)) {
    const sigil = m[1].replace("~", "");
    let body = m[2];
    if (sigil === "/" || body.startsWith(">") || body.startsWith("@") || body === "") continue;
    // Block opener {{#name ...}} / {{^name}}: first token is always a helper
    // unless it's a built-in block.
    const head = body.match(/^([A-Za-z][\w-]*)(\s|$)/);
    if ((sigil === "#" || sigil === "^") && head && !head[1].includes(".")) {
      if (!["if", "unless", "each", "with"].includes(head[1])) names.add(head[1]);
    } else if (!sigil && head && head[2] && !head[1].includes(".") && head[1] !== "else") {
      // Inline `{{name arg}}` — has a following token → helper call.
      names.add(head[1]);
    }
    // Subexpressions `(name ...)` anywhere in the body.
    for (const s of body.matchAll(/\(\s*([A-Za-z][\w-]*)\s+/g)) if (!s[1].includes(".")) names.add(s[1]);
  }
  return names;
}

const files = walk(templatesDir);
const errors = [];

for (const file of files) {
  const rel = path.relative(rootDir, file);
  const src = readFileSync(file, "utf8");
  try {
    Handlebars.precompile(src);
  } catch (e) {
    errors.push(`${rel}: ${e.message.split("\n")[0]}`);
    continue;
  }
  for (const name of usedHelpers(src)) {
    // Skip block-param names and common inline keywords that aren't helpers.
    if (["else", "this", "true", "false", "null"].includes(name)) continue;
    if (!KNOWN.has(name)) errors.push(`${rel}: uses unregistered helper "${name}"`);
  }
}

if (errors.length) {
  console.error(`✗ validate-templates: ${errors.length} problem(s):\n`);
  for (const e of errors) console.error(`  - ${e}`);
  console.error(`\n(If a name is a real Foundry/own helper, add it to tools/validate-templates.mjs.)`);
  process.exit(1);
}

console.log(`✓ validate-templates: ${files.length} templates compile; all helper calls are registered (${OWN_HELPERS.size} own helpers).`);
