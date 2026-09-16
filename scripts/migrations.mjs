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
  },
  {
    // Player characters should use LINKED tokens so sheet edits (damage, blood,
    // diablerie gains) persist instead of living in a token's delta and being
    // lost on a scene switch. Link every character actor's prototype token.
    version: "1.31.0",
    async migrate({ updateActors }) {
      await updateActors(actor => {
        if (actor.type !== "character") return null;
        return actor.prototypeToken?.actorLink ? null : { "prototypeToken.actorLink": true };
      });
    }
  },
  {
    // Shops created before 1.36.1 have default ownership NONE, which hides them
    // from every non-GM client — players open the shop browser and see nothing.
    // Grant OBSERVER by default so players can browse and buy (purchases stay
    // GM-fulfilled). Only touch shops still at NONE, so a GM's deliberate
    // per-shop restriction isn't clobbered.
    version: "1.36.1",
    async migrate({ updateActors }) {
      const OBSERVER = CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER;
      await updateActors(actor => {
        if (actor.type !== "shop") return null;
        const cur = actor.ownership?.default ?? CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE;
        return cur >= OBSERVER ? null : { "ownership.default": OBSERVER };
      });
    }
  },
  {
    // Health track moved from the tabletop 7-level wound names (bruised, hurt,
    // injured, wounded, mauled, crippled, incapacitated) to the Laws of the
    // Night Revised 8-level MET track (healthy1/2, bruised1-3, wounded1/2,
    // incapacitated). Remap existing damage, BOTTOM-ALIGNED so severity is
    // preserved (the Incapacitated box maps straight across); the new top
    // Healthy box starts undamaged. Reads _source because the new schema coerces
    // the old keys away in prepared data before this runs (same as 1.17.1).
    version: "1.36.9",
    async migrate({ updateActors, updateTokenActors }) {
      await updateActors(actor => {
        if (!["character", "npc"].includes(actor.type)) return null;
        const mapped = remapHealthTrack(actor._source?.system?.health);
        return mapped ? { "system.health": mapped } : null;
      });
      await updateTokenActors(token => {
        const mapped = remapHealthTrack(token.delta?._source?.system?.health);
        return mapped ? { "delta.system.health": mapped } : null;
      });
    }
  },
  {
    // Boon tiers changed from minor/major/blood to the canonical Prestation
    // ladder trivial/minor/major/life. Remap any stored "blood" boon to "life"
    // (the schema's choices would otherwise coerce the now-invalid value away).
    version: "1.39.0",
    async migrate({ updateActors }) {
      await updateActors(actor => {
        if (actor.type !== "character") return null;
        const boons = actor._source?.system?.boons;
        if (!Array.isArray(boons) || !boons.some(b => b?.type === "blood")) return null;
        return { "system.boons": boons.map(b => (b?.type === "blood" ? { ...b, type: "life" } : b)) };
      });
    }
  },
  {
    // Companion to 1.39.0: shop stock stored the boon tier as boonLevel "blood",
    // which the new Prestation ladder renames to "life". Remap it on shop actors
    // so the stock editor shows the right tier (separate version so it runs even
    // on a world already stamped 1.39.0).
    version: "1.39.1",
    async migrate({ updateActors }) {
      await updateActors(actor => {
        if (actor.type !== "shop") return null;
        const stock = actor._source?.system?.stock;
        if (!Array.isArray(stock) || !stock.some(s => s?.boonLevel === "blood")) return null;
        return { "system.stock": stock.map(s => (s?.boonLevel === "blood" ? { ...s, boonLevel: "life" } : s)) };
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

/**
 * Remap the legacy 7-level tabletop wound track (bruised, hurt, injured,
 * wounded, mauled, crippled, incapacitated) onto the Laws of the Night Revised
 * 8-level MET track (healthy1/2, bruised1-3, wounded1/2, incapacitated).
 * BOTTOM-ALIGNED so severity is preserved: the old Incapacitated maps straight
 * to the new Incapacitated and the extra box appears as a fresh undamaged
 * Healthy line at the top. Returns null when the input isn't the old shape
 * (already migrated, missing, or junk) so the migration is idempotent.
 */
export function remapHealthTrack(src) {
  const STATES = ["ok", "bashing", "lethal", "aggravated"];
  if (!src || typeof src !== "object" || Array.isArray(src)) return null;
  // Detect the OLD shape by a key that exists ONLY on the old track - note
  // "incapacitated" is shared with the new track, so it can't be the tell, or a
  // freshly-migrated actor would look old and get re-remapped (wiping damage).
  const OLD_ONLY = ["bruised", "hurt", "injured", "wounded", "mauled", "crippled"];
  if (!OLD_ONLY.some(k => k in src)) return null;
  const v = (k) => (STATES.includes(src[k]) ? src[k] : "ok");
  return {
    healthy1: "ok",
    healthy2: v("bruised"),
    bruised1: v("hurt"),
    bruised2: v("injured"),
    bruised3: v("wounded"),
    wounded1: v("mauled"),
    wounded2: v("crippled"),
    incapacitated: v("incapacitated")
  };
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
  // Collect {_id, ...update} objects. If any per-doc callback THROWS, apply the
  // good updates but record the failure so the caller can raise — otherwise the
  // enclosing migration would resolve "successfully", its version would get
  // stamped, and the failed document would be permanently stranded on the old
  // schema (the migration never runs again). Re-running from the unstamped
  // version is safe because every migrate() is idempotent.
  const applyDocUpdates = async (collection, fn, label) => {
    const updates = [];
    const failed = [];
    for (const doc of collection) {
      let change;
      try { change = await fn(doc); }
      catch (e) { console.error(`VTMLARP | migration error on ${label} ${doc.id}`, e); failed.push(doc.id); }
      if (change && Object.keys(change).length) updates.push({ _id: doc.id, ...change });
    }
    return { updates, failed };
  };
  const failIfAny = (failed, label) => {
    if (failed.length) throw new Error(`${failed.length} ${label}(s) failed to migrate (${failed.join(", ")}) — halting so the migration re-runs on next load.`);
  };

  return {
    /** Update world Actors. */
    async updateActors(fn) {
      const { updates, failed } = await applyDocUpdates(game.actors, fn, "actor");
      if (updates.length) await Actor.updateDocuments(updates);
      failIfAny(failed, "actor");
      return updates.length;
    },
    /** Update world-level Items (items in the Items sidebar, not owned items). */
    async updateItems(fn) {
      const { updates, failed } = await applyDocUpdates(game.items, fn, "item");
      if (updates.length) await Item.updateDocuments(updates);
      failIfAny(failed, "item");
      return updates.length;
    },
    /** Update owned items across every world Actor. */
    async updateOwnedItems(fn) {
      let count = 0;
      const allFailed = [];
      for (const actor of game.actors) {
        const { updates, failed } = await applyDocUpdates(actor.items, fn, "owned-item");
        if (updates.length) { await actor.updateEmbeddedDocuments("Item", updates); count += updates.length; }
        allFailed.push(...failed);
      }
      failIfAny(allFailed, "owned-item");
      return count;
    },
    /** Update Scenes (e.g. token/prototype data). */
    async updateScenes(fn) {
      const { updates, failed } = await applyDocUpdates(game.scenes, fn, "scene");
      if (updates.length) await Scene.updateDocuments(updates);
      failIfAny(failed, "scene");
      return updates.length;
    },
    /** Update the synthetic actor deltas of UNLINKED tokens across every scene.
     * `fn(token)` returns an update object keyed under "delta.…" (or null).
     * Linked tokens share the world Actor (handled by updateActors), so only
     * unlinked tokens — which carry their own overridden data — are visited. */
    async updateTokenActors(fn) {
      let count = 0;
      const allFailed = [];
      for (const scene of game.scenes) {
        const tokenUpdates = [];
        for (const token of scene.tokens) {
          if (token.actorLink) continue;
          let change;
          try { change = await fn(token); } catch (e) { console.error(`VTMLARP | migration error on token ${token.id}`, e); allFailed.push(token.id); }
          if (change && Object.keys(change).length) tokenUpdates.push({ _id: token.id, ...change });
        }
        if (tokenUpdates.length) { await scene.updateEmbeddedDocuments("Token", tokenUpdates); count += tokenUpdates.length; }
      }
      failIfAny(allFailed, "token");
      return count;
    }
  };
}

/**
 * Run any pending migrations for this world. Only the single ACTIVE GM performs
 * migrations (they write to shared world data); other clients no-op. Safe to
 * call on every load — nothing runs once the world is at the current version.
 *
 * The active-GM guard (not merely isGM) matches every mutating socket path in
 * vtmlarp.mjs and is load-bearing here: with two GM clients loading at once,
 * an unguarded runner would run the pending set on both concurrently. The
 * field-remap migrations are idempotent, but a document-CREATING migration
 * (e.g. the 1.25.0 shop conversion) is not — both GMs would read the legacy
 * source before either cleared it and each create a duplicate set. Gating on
 * activeGM elects exactly one runner.
 */
export async function migrateWorldIfNeeded() {
  if (!game.user?.isGM || game.users?.activeGM?.id !== game.user.id) return;

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
