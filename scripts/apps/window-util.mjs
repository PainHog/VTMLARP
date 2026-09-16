/**
 * Clamp an ApplicationV2's initial height to the current viewport so its bottom
 * (and any action button pinned there) stays on-screen on short/tablet
 * displays. Apps that use this must scroll their body internally, so a shorter
 * window just shows less at once rather than hiding controls. Call from the app
 * constructor after super(). Safe/no-op if position/viewport aren't available.
 */
export function clampWindowHeight(app, margin = 80) {
  try {
    const pos = app?.options?.position;
    const vh = globalThis.innerHeight;
    if (pos && typeof pos.height === "number" && typeof vh === "number" && vh > 0) {
      pos.height = Math.min(pos.height, Math.max(320, vh - margin));
    }
  } catch { /* keep the default height */ }
}
