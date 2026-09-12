#!/usr/bin/env node
/**
 * validate-sheet-fields — guards the `submitOnChange: false` manual-save pattern.
 *
 * Every VTMLARP document sheet turns OFF ApplicationV2's built-in form
 * auto-submit (Foundry's auto-submit does not reliably persist on the user's
 * hosting) and instead saves via an explicit delegated `change` listener. Two
 * save mechanisms are in use:
 *
 *   - NAME sheets (actor / item / vehicle) bind
 *       querySelectorAll("input[name], select[name], textarea[name], prose-mirror[name]")
 *     and write `document.update({ [el.name]: value })`. A persistent control
 *     on one of these sheets MUST carry a `name` attribute or it silently never
 *     saves.
 *   - DATAFIELD sheets (shop) bind `[data-field]` and write from that. A
 *     persistent control there MUST carry `data-field`.
 *
 * The footgun the audit flagged: add a field to a sheet template using the
 * WRONG mechanism (a bare `name="system.x"` on the shop sheet, or a control
 * with no save identifier at all) and it renders fine but never persists — a
 * bug you only discover mid-session. This validator reads each sheet class to
 * learn its template and mechanism, then checks every form control in that
 * template is covered. It fails the build if any control is mis-wired.
 *
 * Escape hatch: a genuinely transient control (a search/filter box that should
 * NOT persist) can opt out with `data-transient` (or a `data-action`, since
 * action-driven controls are handled by the actions map, not the form).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHEETS_DIR = path.join(root, "scripts", "sheets");

/** Detect a sheet's save mechanism and its top-level template path(s). */
function inspectSheet(src) {
  // Only sheets that explicitly disable submitOnChange rely on manual saving.
  if (!/submitOnChange:\s*false/.test(src)) return null;
  const templates = [...src.matchAll(/template:\s*"systems\/vtmlarp\/(templates\/[^"]+)"/g)].map(m => m[1]);
  if (!templates.length) return null;
  // NAME mechanism: a delegated change listener keyed off `input[name]...`.
  const usesName = /input\[name\][^"]*"[^)]*?change/s.test(src) || /querySelectorAll\("input\[name\]/.test(src);
  // DATAFIELD mechanism: a change listener bound to `[data-field]` elements.
  const usesDataField = /\[data-field\]/.test(src);
  let mechanism = null;
  if (usesName) mechanism = "name";
  else if (usesDataField) mechanism = "data-field";
  if (!mechanism) return null;
  return { templates, mechanism };
}

/** Pull the form controls out of a template's raw text. */
function controlsIn(html) {
  return [...html.matchAll(/<(input|select|textarea)\b([^>]*)>/g)].map(m => ({
    tag: m[1],
    attrs: m[2],
    raw: m[0]
  }));
}

const attr = (attrs, name) => new RegExp(`\\b${name}=`).test(attrs);
const typeOf = (attrs) => (attrs.match(/\btype="([^"]+)"/) || [])[1] || "";

const problems = [];
let checked = 0;

for (const file of fs.readdirSync(SHEETS_DIR).filter(f => f.endsWith(".mjs"))) {
  const src = fs.readFileSync(path.join(SHEETS_DIR, file), "utf8");
  const info = inspectSheet(src);
  if (!info) continue;

  for (const tplRel of info.templates) {
    const tplPath = path.join(root, tplRel);
    if (!fs.existsSync(tplPath)) continue;
    const html = fs.readFileSync(tplPath, "utf8");

    for (const c of controlsIn(html)) {
      const t = typeOf(c.attrs);
      // Buttons and action-driven controls never persist through the form.
      if (["button", "submit", "reset"].includes(t)) continue;
      if (attr(c.attrs, "data-action")) continue;
      // Explicit opt-out for legitimately transient UI controls.
      if (attr(c.attrs, "data-transient")) continue;

      const hasName = attr(c.attrs, "name");
      const hasDataField = attr(c.attrs, "data-field");

      if (info.mechanism === "name") {
        if (!hasName) {
          problems.push(`${tplRel}: <${c.tag}> has no name= (this sheet saves by name; it will not persist). Add name="system.…" or data-transient. → ${c.raw.trim()}`);
        } else if (hasDataField) {
          problems.push(`${tplRel}: <${c.tag}> uses data-field but this sheet saves by name= (data-field is ignored here). → ${c.raw.trim()}`);
        }
      } else if (info.mechanism === "data-field") {
        if (!hasDataField) {
          problems.push(`${tplRel}: <${c.tag}> has no data-field (this sheet saves by data-field; a bare name= will NOT persist). Add data-field or data-transient. → ${c.raw.trim()}`);
        }
      }
      checked++;
    }
  }
}

if (problems.length) {
  console.error(`✗ validate-sheet-fields: ${problems.length} mis-wired form control(s):`);
  for (const p of problems) console.error(`  - ${p}`);
  console.error("\nThese controls render but silently never save under the sheet's manual-save wiring.");
  process.exit(1);
}

console.log(`✓ validate-sheet-fields: ${checked} persistent control(s) across all manual-save sheets are correctly wired.`);
