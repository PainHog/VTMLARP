// Flat ESLint config for the VTMLARP Foundry system. Focuses on catching real
// bugs (undeclared/undefined variables, unreachable code, obvious mistakes)
// rather than style. Foundry injects a large set of globals at runtime, so
// those are declared as readonly to avoid false "no-undef" reports.

const foundryGlobals = [
  // Core namespaces & app
  "foundry", "game", "ui", "canvas", "CONFIG", "CONST", "Hooks", "Roll",
  "socketlib", "fromUuid", "fromUuidSync", "loadTemplates", "renderTemplate",
  "getTemplate", "Handlebars",
  // Document classes
  "Actor", "Actors", "Item", "Items", "ActorSheet", "ItemSheet", "JournalEntry",
  "Scene", "ChatMessage", "Macro", "Folder", "User", "Combat", "Combatant",
  "ActiveEffect", "TokenDocument", "Token",
  // Dialog / application
  "Dialog", "FormApplication", "Application", "DocumentSheetConfig",
  "FilePicker", "ImageHelper", "Ray", "PIXI", "ChatPopout",
  // Utilities
  "duplicate", "mergeObject", "setProperty", "getProperty", "hasProperty",
  "expandObject", "flattenObject", "isNewerVersion", "randomID", "TextEditor"
];

const browserGlobals = [
  "window", "document", "navigator", "console", "setTimeout", "clearTimeout",
  "setInterval", "clearInterval", "requestAnimationFrame", "fetch",
  "FormData", "Event", "CustomEvent", "HTMLElement", "Node", "DOMParser",
  "localStorage", "sessionStorage", "structuredClone", "URL", "Blob"
];

const globals = {};
for (const g of foundryGlobals) globals[g] = "readonly";
for (const g of browserGlobals) globals[g] = "readonly";

export default [
  {
    ignores: ["node_modules/**", "packs/**", "reference/**"]
  },
  {
    files: ["scripts/**/*.mjs", "tools/**/*.mjs", "test/**/*.mjs", "*.mjs"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals
    },
    linterOptions: {
      reportUnusedDisableDirectives: true
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": ["warn", { args: "none", ignoreRestSiblings: true }],
      "no-const-assign": "error",
      "no-dupe-keys": "error",
      "no-dupe-args": "error",
      "no-unreachable": "error",
      "no-cond-assign": ["error", "except-parens"],
      "no-constant-condition": ["error", { checkLoops: false }],
      "no-self-assign": "error",
      "no-fallthrough": "error",
      "valid-typeof": "error",
      "use-isnan": "error",
      "no-empty": ["warn", { allowEmptyCatch: true }]
    }
  },
  {
    // Node tooling scripts also get Node globals.
    files: ["tools/**/*.mjs"],
    languageOptions: {
      globals: { process: "readonly", console: "readonly" }
    }
  }
];
