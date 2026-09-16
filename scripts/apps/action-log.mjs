// A running per-actor record of Challenges resolved, Frenzy checks, and
// Discipline toggles - since this system is played online, not face to
// face, a Storyteller can't just glance across the table afterward to
// reconstruct what happened in a busy session. Capped so it doesn't grow
// unbounded across a long-running campaign.
const MAX_ENTRIES = 200;

export async function logAction(actor, summary) {
  if (!actor) return;
  // This must NEVER throw: it's called mid-resolution (e.g. right after a
  // Challenge result is posted), and an exception here would abort the caller's
  // remaining cleanup - leaving the Challenge prompt live and re-clickable. In
  // a multiplayer game the resolving client often does NOT own one side of the
  // Challenge (a player resolving vs. another player's actor), so a direct
  // actor.update() on the un-owned actor would be rejected for lack of
  // permission. When we don't own the actor, hand the append to the GM (who
  // owns every actor) over the socket instead.
  try {
    if (actor.isOwner) {
      const current = actor.system.actionLog ?? [];
      const updated = [{ timestamp: Date.now(), summary }, ...current].slice(0, MAX_ENTRIES);
      await actor.update({ "system.actionLog": updated });
    } else if (game.users?.activeGM) {
      game.socket.emit("system.vtmlarp", { action: "logActorAction", actorId: actor.id, summary });
    } else {
      // We don't own the actor and no GM is online to append on our behalf, so
      // the per-actor log entry can't be written. Rather than silently drop the
      // record, persist it as a GM-whispered chat message so it survives in the
      // chat log for the Storyteller to see whenever they next connect.
      await ChatMessage.create({
        whisper: game.users.filter(u => u.isGM).map(u => u.id),
        speaker: { alias: "Action Log" },
        content: `<div class="vtmlarp-shared-entry"><p><em>(no Storyteller online to log to ${actor.name}'s sheet)</em> ${summary}</p></div>`
      });
    }
  } catch (err) {
    console.warn("VTMLARP | logAction failed (non-fatal):", err);
  }
}
