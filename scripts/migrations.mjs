/**
 * World data migration framework.
 *
 * When a system update changes the shape of stored data (renames a field,
 * restructures a SchemaField, drops a value), existing worlds that players have
 * already built characters in need their documents rewritten to match — Foundry
 * does NOT do this for you. This module runs, once per world on load, any
 * registered migration whose version is newer than the last version this world
 * was migrated to, then records the new version.
 *
 * HOW TO ADD A MIGRATION
 * ----------------------
 * Append an entry to MIGRATIONS with the system version it ships in and an
 * async `migrate(ctx)` that returns update objects. Use the ctx helpers so you
 * don't hand-roll the "iterate every actor/item/scene/compendium" loops:
 *
 *   {
 *     version: "1.14.0",
 *     async migrate({ updateActors }) {
 *       // Give every character the new system.foo field.
 *       await updateActors(actor => {
 *         if (actor.system.foo === undefined) return { "system.foo": 0 };
 *       });
 *     }
 *   }
 *
 * A migrate function should be idempotent (safe to re-run) and return
 * `undefined`/`null` for documents that need no change.
 */

const SETTING_KEY = "systemMigrationVersion";

// Ordered list of migrations. Empty at 1.13.x: the framework is being
// introduced with no pending data changes, so the first load simply stamps the
// world with the current version as a baseline for future migrations.
const MIGRATIONS = [
  {
    // Abilities moved from the tabletop Talents/Skills/Knowledges split to a
    // single flat, alphabetical MET Ability list. Merge any character's three
    // old arrays into system.abilities. Read _source (the raw stored data),
    // because the new ArrayField schema coerces the old {talents,skills,
    // knowledges} object away in the prepared data before this runs.
    version: "1.17.1",
    async migrate({ updateActors, updateTokenActors }) {
      await updateActors(actor => {
        const src = actor._source?.system?.abilities;
        const merged = flattenAbilities(src);
        return merged ? { "system.abilities": merged } : null;
      });
      // Unlinked token actors carry their own delta; if it overrides the old
      // {talents,skills,knowledges} shape, flatten that too — the new schema
      // would otherwise coerce it away and the token would lose its abilities.
      await updateTokenActors(token => {
        const src = token.delta?._source?.system?.abilities;
        const merged = flattenAbilities(src);
        return merged ? { "delta.system.abilities": merged } : null;
      });
    }
  },
  {
    // Shops became first-class Actors (type "shop") instead of a world-setting
    // blob, so they can live in compendiums and be dragged in/out of games.
    // Convert any shops stored in the old setting into shop Actors, once.
    version: "1.25.0",
    async migrate() {
      // Dynamic import so this module stays loadable in a plain-Node test
      // context (shops.mjs touches the foundry global at import time).
      const { migrateSettingShopsToActors } = await import("./apps/shops.mjs");
      const n = await migrateSettingShopsToActors();
      if (n) console.log(`VTMLARP | Migrated ${n} shop(s) from the legacy setting to Actors.`);
    }
  },
  {
    // NPC "Auto-answer challenges" now defaults ON. Enable it on every existing
    // NPC that doesn't already have it set, so old NPCs auto-respond too. (A GM
    // can still toggle it off per-NPC afterward; this migration runs once.)
    version: "1.26.0",
    async migrate({ updateActors }) {
      await updateActors(actor => {
        if (actor.type !== "npc") return null;
        return actor._source?.system?.autoChallenge ? null : { "system.autoChallenge": true };
      });
    }
  }
];

/**
 * Merge the legacy {talents,skills,knowledges} ability object into one flat,
 * alphabetical array. Returns null when the input is already flat (an array),
 * missing, or otherwise not the old shape — i.e. nothing to migrate.
 */
export function flattenAbilities(src) {
  if (!src || Array.isArray(src) || typeof src !== "object") return null;
  return [...(src.talents ?? []), ...(src.skills ?? []), ...(src.knowledges ?? [])]
    .filter(a => a && typeof a === "object")
    .map(a => ({
      name: a.name ?? "",
      rating: Number(a.rating) || 0,
      max: Number(a.max ?? a.rating) || 0,
      notes: a.notes ?? ""
    }))
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

/** Semver-ish compare: returns <0, 0, >0. Non-numeric/junk segments sort as 0. */
export function compareVersions(a, b) {
  const pa = String(a ?? "0").split(".").map(n => parseInt(n, 10) || 0);
  const pb = String(b ?? "0").split(".").map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

export function registerMigrationSettings() {
  game.settings.register("vtmlarp", SETTING_KEY, {
    name: "System Migration Version",
    scope: "world",
    config: false,
    type: String,
    default: ""
  });
}

/** Batched helper factory: collect {_id, ...update} objects and apply them via
 * one embedded/document updateAll per collection. */
function makeContext() {
  const applyDocUpdates = async (collection, fn, label) => {
    const updates = [];
    for (const doc of collection) {
      let change;
      try { change = await fn(doc); } catch (e) { console.error(`VTMLARP | migration error on ${label} ${doc.id}`, e); }
      if (change && Object.keys(change).length) updates.push({ _id: doc.id, ...change });
    }
    return updates;
  };

  return {
    /** Update world Actors (and, if your fn returns embedded item updates via
     * the `items` key, those are applied too). */
    async updateActors(fn) {
      const updates = await applyDocUpdates(game.actors, fn, "actor");
      if (updates.length) await Actor.updateDocuments(updates);
      return updates.length;
    },
    /** Update world-level Items (items in the Items sidebar, not owned items). */
    async updateItems(fn) {
      const updates = await applyDocUpdates(game.items, fn, "item");
      if (updates.length) await Item.updateDocuments(updates);
      return updates.length;
    },
    /** Update owned items across every world Actor. */
    async updateOwnedItems(fn) {
      let count = 0;
      for (const actor of game.actors) {
        const updates = await applyDocUpdates(actor.items, fn, "owned-item");
        if (updates.length) { await actor.updateEmbeddedDocuments("Item", updates); count += updates.length; }
      }
      return count;
    },
    /** Update Scenes (e.g. token/prototype data). */
    async updateScenes(fn) {
      const updates = await applyDocUpdates(game.scenes, fn, "scene");
      if (updates.length) await Scene.updateDocuments(updates);
      return updates.length;
    },
    /** Update the synthetic actor deltas of UNLINKED tokens across every scene.
     * `fn(token)` returns an update object keyed under "delta.…" (or null).
     * Linked tokens share the world Actor (handled by updateActors), so only
     * unlinked tokens — which carry their own overridden data — are visited. */
    async updateTokenActors(fn) {
      let count = 0;
      for (const scene of game.scenes) {
        const tokenUpdates = [];
        for (const token of scene.tokens) {
          if (token.actorLink) continue;
          let change;
          try { change = await fn(token); } catch (e) { console.error(`VTMLARP | migration error on token ${token.id}`, e); }
          if (change && Object.keys(change).length) tokenUpdates.push({ _id: token.id, ...change });
        }
        if (tokenUpdates.length) { await scene.updateEmbeddedDocuments("Token", tokenUpdates); count += tokenUpdates.length; }
      }
      return count;
    }
  };
}

/**
 * Run any pending migrations for this world. Only a GM performs migrations
 * (they write to shared world data); other clients no-op. Safe to call on every
 * load — nothing runs once the world is at the current version.
 */
export async function migrateWorldIfNeeded() {
  if (!game.user?.isGM) return;

  const current = game.system.version;
  const last = game.settings.get("vtmlarp", SETTING_KEY) || "";

  // First-ever load under the framework: baseline the world without running
  // historical migrations against data that was authored under the current
  // shape anyway.
  if (!last) {
    await game.settings.set("vtmlarp", SETTING_KEY, current);
    console.log(`VTMLARP | Migration baseline set to ${current}.`);
    return;
  }

  const pending = MIGRATIONS
    .filter(m => compareVersions(m.version, last) > 0)
    .sort((a, b) => compareVersions(a.version, b.version));

  if (!pending.length) {
    if (compareVersions(current, last) > 0) await game.settings.set("vtmlarp", SETTING_KEY, current);
    return;
  }

  ui.notifications?.info(`VTMLARP: migrating world data to ${current}. Please don't close the game…`, { permanent: false });
  console.log(`VTMLARP | Running ${pending.length} migration(s): ${pending.map(m => m.version).join(", ")}`);

  const ctx = makeContext();
  for (const m of pending) {
    try {
      console.log(`VTMLARP | Migration ${m.version} …`);
      await m.migrate(ctx);
      await game.settings.set("vtmlarp", SETTING_KEY, m.version);
    } catch (e) {
      console.error(`VTMLARP | Migration ${m.version} FAILED — halting so it can be re-run.`, e);
      ui.notifications?.error(`VTMLARP: migration ${m.version} failed — see the console (F12). Data was left as-is.`, { permanent: true });
      return;
    }
  }

  await game.settings.set("vtmlarp", SETTING_KEY, current);
  ui.notifications?.info(`VTMLARP: world migrated to ${current}.`);
  console.log(`VTMLARP | Migration complete → ${current}.`);
}
