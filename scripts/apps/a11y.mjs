/**
 * Post-render accessibility enhancement, applied to every VTMLARP sheet and
 * dialog via render hooks (see vtmlarp.mjs). Two safe, behavior-preserving
 * improvements:
 *
 *  1. Mirror each control's existing `title` into `aria-label` when it has none,
 *     so the many icon-only buttons (a bare Font Awesome <i> with a tooltip)
 *     get an accessible name screen readers can announce.
 *  2. Make icon-only anchor "buttons" (an <a data-action>/<a data-pack> with no
 *     href) keyboard-focusable and operable with Enter/Space, matching the
 *     mouse click — without changing any existing click behavior.
 *
 * The attribute mirroring is idempotent and runs on every render (V2 replaces
 * child nodes). The keydown handler is bound once per persistent root (guarded
 * by a data flag) to avoid the listener-accumulation problem V2's persistent
 * root element otherwise causes.
 */
export function enhanceAccessibility(root) {
  const el = root?.jquery ? root[0] : root;
  if (!el || typeof el.querySelectorAll !== "function") return;

  // 1. title -> aria-label for anything lacking an accessible name.
  for (const node of el.querySelectorAll("[title]:not([aria-label])")) {
    const title = node.getAttribute("title");
    if (title && title.trim()) node.setAttribute("aria-label", title.trim());
  }

  // 2. Icon-only anchor buttons: focusable + role, so keyboard users reach them.
  for (const a of el.querySelectorAll("a[data-action]:not([href]), a[data-pack]:not([href])")) {
    if (a.children.length === 1 && a.firstElementChild?.tagName === "I") {
      if (!a.hasAttribute("tabindex")) a.setAttribute("tabindex", "0");
      if (!a.hasAttribute("role")) a.setAttribute("role", "button");
    }
  }

  // Enter/Space activation for those role=button anchors — bound once per root.
  if (!el.dataset.vtmA11yKeydown) {
    el.dataset.vtmA11yKeydown = "1";
    el.addEventListener("keydown", (ev) => {
      if (ev.key !== "Enter" && ev.key !== " ") return;
      const target = ev.target?.closest?.("a[role='button'][data-action]:not([href]), a[role='button'][data-pack]:not([href])");
      if (!target || !el.contains(target)) return;
      ev.preventDefault();
      target.click();
    });
  }
}
