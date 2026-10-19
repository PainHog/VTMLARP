// Vampire: The Masquerade 5th Edition d10 dice-pool resolution — the optional
// "Dice mode" alternative to this system's default Rock-Paper-Scissors
// Challenges. Kept pure (no Foundry globals) except the two tiny RNG helpers so
// the success/critical/messy/bestial math can be unit-tested — it's the heart
// of the mode, so it's the thing most worth tests around.
//
// Rules (confirmed against the V5 corebook / SRD):
//  - Dice pool = Attribute Trait total + associated Ability rating (+ modifier).
//  - Each die showing 6-10 is one success.
//  - Every PAIR of 10s counts as 4 successes instead of 2 (a critical win): the
//    two 10s already count as 2 successes, and the pair adds +2 more.
//  - Difficulty = the number of successes the roll must meet or beat.
//  - Hunger dice are a subset of the pool (equal to the roller's Hunger):
//      * a critical that includes at least one 10 on a Hunger die is a MESSY
//        critical;
//      * a roll that FAILS its difficulty with at least one 1 on a Hunger die
//        is a BESTIAL failure.
//  - A roll with zero successes is a total failure.

/** Evaluate already-rolled dice per V5. `difficulty` null = count successes only
 * (e.g. an opposed roll resolved by comparison). Pure. */
export function evaluateRoll(regularDice, hungerDice, difficulty = null) {
  const reg = regularDice ?? [];
  const hun = hungerDice ?? [];
  const all = [...reg, ...hun];
  const base = all.filter(d => d >= 6).length;            // every 6+ (10s included) = 1 success
  const tens = all.filter(d => d === 10).length;
  const critPairs = Math.floor(tens / 2);
  const successes = base + critPairs * 2;                 // each pair of 10s: +2 on top of the 2 they already add
  const critical = critPairs >= 1;
  const hungerTens = hun.filter(d => d === 10).length;
  const hungerOnes = hun.filter(d => d === 1).length;
  const messy = critical && hungerTens >= 1;
  const win = difficulty == null ? null : successes >= Number(difficulty);
  const bestial = win === false && hungerOnes >= 1;
  const totalFailure = successes === 0;
  return { successes, critical, critPairs, messy, bestial, totalFailure, win, tens };
}

/** Compare two evaluated sides for an opposed roll. Higher successes wins; equal
 * is a tie. Returns "challenger" | "opponent" | "tie" plus the margin. Pure. */
export function compareOpposed(aSuccesses, bSuccesses) {
  if (aSuccesses > bSuccesses) return { winner: "challenger", margin: aSuccesses - bSuccesses };
  if (bSuccesses > aSuccesses) return { winner: "opponent", margin: bSuccesses - aSuccesses };
  return { winner: "tie", margin: 0 };
}

export function rollD10() { return 1 + Math.floor(Math.random() * 10); }

/** Roll a pool, splitting off `hunger` of the dice as Hunger dice. Returns the
 * two arrays; evaluate with evaluateRoll. */
export function rollPool(pool, hunger = 0) {
  const n = Math.max(0, Math.trunc(Number(pool) || 0));
  const h = Math.max(0, Math.min(Math.trunc(Number(hunger) || 0), n));
  const roll = (count) => Array.from({ length: count }, rollD10);
  return { regularDice: roll(n - h), hungerDice: roll(h) };
}
