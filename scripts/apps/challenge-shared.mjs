import { logAction } from "./action-log.mjs";
import { GESTURES, beats } from "./gesture.mjs";

const { renderTemplate } = foundry.applications.handlebars;

// Re-exported so existing importers (challenge.mjs, challenge-response.mjs) can
// keep importing GESTURES from here; the definitions now live in gesture.mjs.
export { GESTURES, beats };

// A responder can have TWO answer surfaces open at once for the same Challenge:
// the instant ChallengeResponseApp popup (pushed over the socket) AND the
// clickable chat-card prompt. Both live on the responder's own client, and
// neither disables the other, so without a guard the responder could resolve
// the same Challenge twice (two contradictory result cards + duplicate log
// entries). This client-local claim, keyed by requestId and set synchronously,
// lets exactly one surface resolve a given Challenge. (Cross-client double
// resolution - a GM and the owner both clicking - is a separate concern.)
const _claimedChallenges = new Set();
/** Try to claim a Challenge for resolution on this client. Returns false if it
 * was already claimed here (so the caller should abort). A missing requestId
 * (legacy prompts) is never blocked. */
export function claimChallenge(requestId) {
  if (!requestId) return true;
  if (_claimedChallenges.has(requestId)) return false;
  _claimedChallenges.add(requestId);
  return true;
}
/** Release a claim so a failed resolution can be retried. */
export function releaseChallenge(requestId) {
  if (requestId) _claimedChallenges.delete(requestId);
}
/** True if a result card for this requestId already exists in chat. Unlike the
 * client-local claim Set, a posted result message is visible to EVERY client, so
 * this catches a cross-client double-resolution (two GMs, or a GM and the owner,
 * both answering) that the local claim can't. */
export function isChallengeResolved(requestId) {
  if (!requestId) return false;
  return !!game.messages?.find(m => m.getFlag?.("vtmlarp", "resolvedRequestId") === requestId);
}
/** Close any open ChallengeResponseApp answering this requestId - used when the
 * OTHER surface (the chat card) resolved it, so a stale popup doesn't linger. */
export function closeResponseApps(requestId) {
  if (!requestId) return;
  for (const app of foundry.applications.instances.values()) {
    if (app?.constructor?.name === "ChallengeResponseApp" && app.request?.requestId === requestId) {
      app.close().catch(() => {});
    }
  }
}

/**
 * Traits an actor can bid in one attribute category (Physical/Social/Mental).
 * The bid pool is the category's Total (what players actually fill in: 7/5/3),
 * reduced by any named Trait chips already marked spent. Named chips are
 * optional flavor, so an actor with a Total of 7 and no chips bids 7 - earlier
 * this only counted chips, so those characters bid 0.
 */
export function unspentCount(actor, category) {
  const cat = actor?.system?.attributes?.[category];
  if (!cat) return 0;
  const total = Number(cat.total) || 0;
  const spentChips = (cat.traits ?? []).filter(t => t.spent).length;
  const available = total - spentChips;
  return available > 0 ? available : 0;
}

/**
 * Resolve a Physical/Social/Mental Challenge and post the result to chat.
 * Always bids each side's full remaining trait pool of the matching
 * category (no manual Traits Bid entry) - simplest to play out online,
 * where the two sides can't just glance at each other's trait cards
 * across a table the way they could face to face.
 */
export async function resolveAndPostGestureChallenge({
  challengerActor, challengeType, challengerGesture, opponentActor, opponentGesture, retest,
  // Overrides for a fake/no-document opponent (e.g. the "TEST" practice
  // opponent) where there's no real Actor to derive a name/pool from.
  opponentName: opponentNameOverride, opponentTraitsBid: opponentTraitsBidOverride, opponentActorId: opponentActorIdOverride,
  // True when this resolution IS itself a Retest throw (opened via the
  // "Re-throw Retest" button) rather than an original Challenge. Retests can be
  // chained without limit - each one is a fresh Challenge - so this flag is
  // carried for context/labelling but no longer disables the next retest.
  isRetestThrow = false,
  // A Storyteller "coin toss": pure gesture, no trait pools behind either side.
  // Ties stand as ties (no overbid), and no trait counts are shown.
  coinToss = false,
  // Flat bonus/penalty Traits each side adds to their bid (equipment, powers,
  // situational modifiers) - entered on the Challenge form / response card.
  challengerMod = 0,
  opponentMod = 0,
  // The originating request's id, stamped onto the result card's flags so any
  // client can detect "this Challenge already produced a result" and refuse a
  // second resolution (cross-client double-resolve guard).
  requestId = ""
}) {
  const challengerName = challengerActor.name;
  const opponentName = opponentNameOverride ?? opponentActor?.name ?? "Opponent";
  const traitsBid = coinToss ? null : unspentCount(challengerActor, challengeType) + (Number(challengerMod) || 0);
  const opponentTraitsBid = coinToss
    ? null
    : (opponentTraitsBidOverride ?? (opponentActor ? unspentCount(opponentActor, challengeType) + (Number(opponentMod) || 0) : null));

  let result = "";
  let resultLabel = "";
  if (opponentGesture) {
    const outcome = beats(challengerGesture, opponentGesture);
    if (outcome === "tie") {
      // A coin toss has no traits, so a matched gesture is simply a tie.
      if (coinToss) {
        result = "Tied";
        resultLabel = "Tied — throw again";
      }
      // If either side has no resolvable Trait pool (e.g. an actorless opponent
      // with no bid override), there's nothing to overbid with, so a matched
      // gesture just stands as a tie rather than letting a null pool coerce to 0
      // and hand the challenger a spurious win.
      else if (traitsBid == null || opponentTraitsBid == null) {
        result = "Tied";
        resultLabel = "Tied";
      }
      // Playing remotely, not face to face, so there's no table to visibly
      // compare trait piles - per the rulebook, a matched gesture is broken
      // by whoever bid more Traits; a genuine tie (equal gesture AND equal
      // pool size) stands as a tie with no winner.
      else if (traitsBid > opponentTraitsBid) {
        result = "Won";
        resultLabel = `${challengerName} Wins (overbid on tied gesture)!`;
      } else if (opponentTraitsBid > traitsBid) {
        result = "Lost";
        resultLabel = `${opponentName} Wins (overbid on tied gesture)!`;
      } else {
        result = "Tied";
        resultLabel = "Tied";
      }
    } else {
      result = outcome === "win" ? "Won" : "Lost";
      resultLabel = result === "Won" ? `${challengerName} Wins!` : `${opponentName} Wins!`;
    }
  }

  const content = await renderTemplate("systems/vtmlarp/templates/apps/challenge-card.hbs", {
    actorName: challengerName,
    challengerActorId: challengerActor.id,
    challengeType,
    traitsBid,
    coinToss,
    isStatic: false,
    gesture: challengerGesture,
    opponentName,
    opponentActorId: opponentActorIdOverride ?? opponentActor?.id ?? "",
    opponentGesture,
    opponentTraitsBid,
    result,
    resultLabel,
    retest,
    // Offer the retest button whenever a retest ability exists, even on a card
    // that was itself a retest throw - retests can be re-thrown indefinitely,
    // each as a new Challenge.
    retestAvailable: !!retest
  });

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: challengerActor }),
    content,
    flags: requestId ? { vtmlarp: { resolvedRequestId: requestId } } : {}
  });

  if (result) {
    await logAction(challengerActor, `${challengeType} Challenge vs ${opponentName}: ${resultLabel}`);
    if (opponentActor) await logAction(opponentActor, `${challengeType} Challenge vs ${challengerName}: ${resultLabel}`);
  }
}

/**
 * Users eligible to respond on behalf of `actor`: its player owners, or
 * (if it has none, e.g. a Storyteller-run NPC) every GM. Not gated on
 * "currently active" - the response now happens via a persistent chat
 * message (see postGestureChallengePrompt) rather than a live popup, so an
 * offline player can still respond whenever they next log in and load chat.
 */
export function respondingUsers(actor) {
  const owners = game.users.filter(u => !u.isGM && actor.testUserPermission(u, "OWNER"));
  if (owners.length) return owners;
  // For an unowned NPC the GM answers. Prefer ONLINE GMs so the first designated
  // responder (targetUserIds[0], which the auto-answer keys on) is a live client
  // that can actually throw - otherwise, in a multi-GM game, an offline GM at
  // index 0 would leave the auto-answer to no one. Fall back to all GMs only if
  // none are online (the persistent chat card still waits for one to log in).
  const activeGMs = game.users.filter(u => u.isGM && u.active);
  return activeGMs.length ? activeGMs : game.users.filter(u => u.isGM);
}

/**
 * Post a public chat message with clickable gesture buttons the opponent
 * (or a GM, for an unowned NPC) can respond to whenever they next load
 * chat - this doesn't depend on a live socket push to work at all, only on
 * normal chat history loading, which happens regardless of real-time
 * connectivity between clients. The challenger's own gesture is stored in
 * a SEPARATE sealed whisper (see sealChallengerGesture) that the opponent never
 * receives - anyone can see that a Challenge is happening, but only the
 * opponent's owner (or a GM) is permitted to actually click a response, and the
 * challenger's gesture is never carried on this public card.
 */
export async function postGestureChallengePrompt({
  challengerActor, challengeType, opponentActor, opponentName, retest, isRetestThrow, requestId,
  // Token UUIDs let resolution target a SPECIFIC unlinked token instance rather
  // than the shared base actor (so duplicate NPC tokens don't collapse together).
  challengerTokenUuid = "", opponentTokenUuid = "",
  // Storyteller-initiated flavours: a "surprise" note on the card, and a
  // no-traits coin toss (gesture decides, no pools).
  surprise = false, coinToss = false, challengerMod = 0
}) {
  const content = await renderTemplate("systems/vtmlarp/templates/apps/challenge-prompt-card.hbs", {
    challengerName: challengerActor.name,
    challengeType,
    opponentName,
    opponentActorId: opponentActor?.id ?? "",
    retest,
    surprise,
    coinToss,
    gestures: GESTURES
  });

  // The challenger's gesture is SEALED separately (see sealChallengerGesture) and
  // is NOT placed in this public prompt's flags — a public message document syncs
  // to every client, so storing the gesture here would leak it to the opponent
  // before they answer. This card is public only so the opponent can pick a
  // gesture; it carries no secret.
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: challengerActor }),
    content,
    flags: {
      vtmlarp: {
        promptCard: true,
        requestId,
        resolverUserId: game.user.id,
        challengerActorId: challengerActor.id,
        challengerTokenUuid,
        challengeType,
        opponentActorId: opponentActor?.id ?? "",
        opponentTokenUuid,
        opponentName,
        retest: retest ?? "",
        isRetestThrow: !!isRetestThrow,
        coinToss: !!coinToss,
        challengerMod: Number(challengerMod) || 0,
        responded: false
      }
    }
  });
}

// === Secret-throw protocol =================================================
// The challenger's gesture must never reach the opponent's client, so:
//  - it is SEALED in a whisper only the challenger's owners + GMs receive;
//  - the opponent's answer is sent to a RESOLVER (the challenger, else a GM)
//    who holds the sealed gesture and computes the result.
// The opponent's client never sees the challenger's gesture and never resolves.

/** Users allowed to hold the sealed throw / resolve: the challenger's own
 * owners plus every GM (never the opponent). */
export function challengeSealRecipients(challengerActor) {
  const gmIds = game.users.filter(u => u.isGM).map(u => u.id);
  const ownerIds = game.users.filter(u => !u.isGM && challengerActor?.testUserPermission?.(u, "OWNER")).map(u => u.id);
  return Array.from(new Set([game.user.id, ...ownerIds, ...gmIds]));
}

/** Store the challenger's gesture in a whisper only the challenger+GMs receive. */
export async function sealChallengerGesture({ requestId, challengerGesture, challengerActor }) {
  await ChatMessage.create({
    whisper: challengeSealRecipients(challengerActor),
    speaker: { alias: "Sealed Throw" },
    content: `<div class="vtmlarp-shared-entry hint"><i class="fas fa-lock"></i> Your sealed throw for a pending Challenge (revealed when it's answered).</div>`,
    flags: { vtmlarp: { sealedThrow: true, requestId, challengerGesture } }
  });
}

/** Read a sealed gesture on this client (only present if we're a recipient). */
export function readSealedGesture(requestId) {
  const msg = game.messages?.find(m => m.getFlag?.("vtmlarp", "sealedThrow") && m.getFlag("vtmlarp", "requestId") === requestId);
  return msg ? { gesture: msg.getFlag("vtmlarp", "challengerGesture"), messageId: msg.id } : null;
}

/** Elect the single client that resolves an answered challenge: the throwing
 * user if online, else the lowest-id active GM. Returns a userId or null. */
export function challengeResolverId(resolverUserId) {
  const thrower = game.users.get(resolverUserId);
  if (thrower?.active) return resolverUserId;
  const gm = game.users.filter(u => u.isGM && u.active).sort((a, b) => a.id.localeCompare(b.id))[0];
  return gm?.id ?? null;
}

/** Resolve an actor from a token UUID (specific instance) if given, else the
 * base actor by id. */
export async function resolveChallengeActor(actorId, tokenUuid) {
  if (tokenUuid) {
    const doc = await fromUuid(tokenUuid).catch(() => null);
    if (doc?.actor) return doc.actor;
  }
  return actorId ? game.actors.get(actorId) : null;
}

/** Opponent side: record + send an answer to the resolver. Persists the answer
 * as a whisper (so it survives the resolver being briefly offline) AND emits it
 * over the socket for instant resolution. Never resolves locally. */
export async function submitChallengeAnswer(answer, challengerActor) {
  const payload = { action: "challengeAnswer", ...answer };
  // Persist for reconciliation (whisper to the challenger's owners + GMs).
  await ChatMessage.create({
    whisper: challengeSealRecipients(challengerActor),
    speaker: { alias: "Challenge Answer" },
    content: `<div class="vtmlarp-shared-entry hint">Answer recorded for a pending Challenge.</div>`,
    flags: { vtmlarp: { challengeAnswer: true, ...answer } }
  });
  game.socket.emit("system.vtmlarp", payload);
}

/** Resolver side: given an answer (from socket or a reconciliation scan),
 * resolve the challenge if this client is the elected resolver and holds the
 * sealed gesture. Idempotent — guarded by the local claim and the result card. */
export async function tryResolveChallengeAnswer(answer) {
  const { requestId, resolverUserId } = answer;
  if (challengeResolverId(resolverUserId) !== game.user.id) return;
  if (isChallengeResolved(requestId)) { await cleanupChallengeArtifacts(requestId); return; }
  if (!claimChallenge(requestId)) return;
  const sealed = readSealedGesture(requestId);
  if (!sealed) { releaseChallenge(requestId); return; }

  try {
    const challengerActor = await resolveChallengeActor(answer.challengerActorId, answer.challengerTokenUuid);
    const opponentActor = await resolveChallengeActor(answer.opponentActorId, answer.opponentTokenUuid);
    if (!challengerActor) { releaseChallenge(requestId); return; }

    if (answer.block) {
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: challengerActor }),
        content: `<div class="vtmlarp-challenge-card"><div class="vtm-clash-header"><span>${answer.challengeType} Challenge - Retest Cancelled</span></div>`
          + `<p>${challengerActor.name}'s retest (<strong>${answer.retest || ""}</strong>) was cancelled by ${answer.opponentName || "the opponent"}`
          + (answer.blockSource ? ` giving up <strong>${answer.blockSource}</strong>` : "") + `.</p>`
          + `<div class="vtm-result-banner result-Tied">Retest cancelled — the previous result stands.</div></div>`,
        flags: { vtmlarp: { resolvedRequestId: requestId } }
      });
    } else {
      await resolveAndPostGestureChallenge({
        challengerActor,
        challengeType: answer.challengeType,
        challengerGesture: sealed.gesture,
        opponentActor,
        opponentGesture: answer.opponentGesture,
        retest: answer.retest,
        isRetestThrow: answer.isRetestThrow,
        coinToss: answer.coinToss,
        challengerMod: answer.challengerMod,
        opponentMod: answer.opponentMod,
        requestId
      });
    }
  } catch (err) {
    console.error("VTMLARP | challenge resolution failed:", err);
    releaseChallenge(requestId);
    return;
  }
  await cleanupChallengeArtifacts(requestId);
  // Clear the request from the GM dashboard (locally if we're a GM, and broadcast
  // so any GM tracking it drops it too).
  game.socket.emit("system.vtmlarp", { action: "challengeResolved", requestId });
}

/** Delete this challenge's leftover artifacts — the public prompt card, the
 * sealed-throw whisper, and the answer-record whisper — best effort. The resolver
 * authored the prompt/seal (if the challenger) or is a GM, so it removes those
 * directly; the answer whisper was authored by the opponent, so a player-resolver
 * asks a GM to delete it over the socket (if none is online it lingers harmlessly
 * as a whisper — the result card already blocks any re-resolve). */
export async function cleanupChallengeArtifacts(requestId) {
  for (const m of game.messages ?? []) {
    const f = m.getFlag?.("vtmlarp", "requestId");
    if (f !== requestId) continue;
    const isArtifact = m.getFlag("vtmlarp", "promptCard") || m.getFlag("vtmlarp", "sealedThrow") || m.getFlag("vtmlarp", "challengeAnswer");
    if (!isArtifact) continue;
    try {
      // The resolver authored the seal (if challenger) or is a GM, so it can
      // delete the prompt/seal directly; the answer record was authored by the
      // opponent, so a player-resolver can't delete it (a GM can) — ask a GM via
      // socket in that case. All best-effort; the result card is what matters.
      if (m.canUserModify(game.user, "delete")) await m.delete();
      else game.socket.emit("system.vtmlarp", { action: "deleteChallengePrompt", messageId: m.id });
    } catch { /* harmless */ }
  }
}

/** On load, the elected resolver resolves any answered-but-unresolved challenge
 * (e.g. the resolver was offline when the opponent answered). */
export async function reconcileAnsweredChallenges() {
  const answers = (game.messages ?? []).filter(m => m.getFlag?.("vtmlarp", "challengeAnswer"));
  const seen = new Set();
  for (const m of answers) {
    const data = m.flags?.vtmlarp;
    if (!data?.requestId || seen.has(data.requestId)) continue;
    seen.add(data.requestId);
    if (isChallengeResolved(data.requestId)) continue;
    await tryResolveChallengeAnswer(data);
  }
}
