// The core Challenge resolution primitive: the Rock-Paper-Scissors-Bomb throw.
// Pure (no Foundry globals) so it can be unit-tested — it's the heart of the
// whole system, so it's the thing most worth having tests around.

export const GESTURES = ["rock", "paper", "scissors", "bomb"];

/**
 * Result of `a`'s throw against `b`'s: "win", "lose", or "tie" (from a's view).
 * Standard RPS, plus the common MET Bomb variant: Bomb beats Rock and Paper
 * but loses to Scissors (scissors cut the fuse).
 */
export function beats(a, b) {
  if (a === b) return "tie";
  const wins = { rock: "scissors", paper: "rock", scissors: "paper", bomb: "rock" };
  if (a === "bomb") return (b === "scissors") ? "lose" : "win";
  if (b === "bomb") return (a === "scissors") ? "win" : "lose";
  return (wins[a] === b) ? "win" : "lose";
}
