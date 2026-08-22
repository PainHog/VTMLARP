/**
 * Shared, pure character-creation cost math — the single source of truth used
 * by BOTH the Character Builder (`character-builder.mjs`) and the actor sheet's
 * creation tracker (`actor-sheet.mjs`), so the two can never drift apart.
 *
 * Laws of the Night creation rules for Disciplines:
 *  - The free-dot allotment can raise a Discipline to 3 (Basic/Intermediate/
 *    Advanced), no more. Each of those free-tier dots, if it overruns the
 *    allotment, is paid from Freebies at its tier cost: 1st dot 3, 2nd 6, 3rd 9
 *    (cheapest charged first across all Disciplines).
 *  - Dots 4 and 5 can never come from the free allotment; they are always
 *    Freebie-bought at 6 (4th) and 9 (5th).
 */

const TIER_COST = [3, 6, 9]; // freebie cost of the 1st/2nd/3rd free-tier dot

/** Total free-allotment dots a set of Discipline ratings consumes (each capped
 * at 3 — dots 4/5 are freebie-only and never draw from the allotment). */
export function disciplineFreeDots(ratings) {
  return ratings.reduce((n, r) => n + Math.min(Math.max(0, r), 3), 0);
}

/** Freebie cost for a set of Discipline ratings given the free-dot allotment:
 * the mandatory 4th/5th-dot costs, plus any free-tier dots that overran the
 * allotment (cheapest charged first). */
export function disciplineFreebieCost(ratings, budget) {
  let extra = 0;
  for (const r of ratings) {
    if (r >= 4) extra += 6;
    if (r >= 5) extra += 9;
  }
  const freeDotCosts = ratings.flatMap(r => Array.from({ length: Math.min(Math.max(0, r), 3) }, (_, i) => TIER_COST[i]));
  const over = disciplineFreeDots(ratings) - budget;
  if (over > 0) {
    const ascending = [...freeDotCosts].sort((a, b) => a - b);
    extra += ascending.slice(0, over).reduce((n, c) => n + c, 0);
  }
  return extra;
}
