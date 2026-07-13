// A running per-actor record of Challenges resolved, Frenzy checks, and
// Discipline toggles - since this system is played online, not face to
// face, a Storyteller can't just glance across the table afterward to
// reconstruct what happened in a busy session. Capped so it doesn't grow
// unbounded across a long-running campaign.
const MAX_ENTRIES = 200;

export async function logAction(actor, summary) {
  if (!actor) return;
  const current = actor.system.actionLog ?? [];
  const updated = [{ timestamp: Date.now(), summary }, ...current].slice(0, MAX_ENTRIES);
  await actor.update({ "system.actionLog": updated });
}
