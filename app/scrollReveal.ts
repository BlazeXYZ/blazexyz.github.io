// Pure, DOM-free / React-free scroll-reveal state machine helpers.
//
// These functions capture the transition logic of the gallery scroll-reveal
// animation so it can be property-tested in isolation (see Properties P4/P5).
// They contain no browser, DOM, or React dependencies.

/** The four animation states an island can occupy. */
export type AnimState = "hidden" | "entering" | "visible" | "exiting";

/**
 * Given the current state and whether the element is intersecting the
 * viewport, return the immediate next state (before any scheduled timer fires).
 *
 * Rules:
 * - Intersecting → always `"entering"`, regardless of the current state. This
 *   is what makes re-entry from `"exiting"` restart the entry animation and
 *   cancel the pending removal (Req 1.6).
 * - Not intersecting and not already hidden → `"exiting"` (Req 1.5).
 * - Not intersecting and already hidden → stays `"hidden"` (no work).
 */
export function nextRevealState(
  current: AnimState,
  isIntersecting: boolean
): AnimState {
  if (isIntersecting) return "entering";
  if (current !== "hidden") return "exiting";
  return "hidden";
}

/**
 * The state a scheduled timer advances to once it fires, or `null` when no
 * timer is scheduled for the given immediate state.
 *
 * - `"entering"` → `"visible"`
 * - `"exiting"`  → `"hidden"`
 * - `"visible"` / `"hidden"` → `null` (terminal; nothing scheduled)
 */
export function scheduledRevealState(immediate: AnimState): AnimState | null {
  switch (immediate) {
    case "entering":
      return "visible";
    case "exiting":
      return "hidden";
    default:
      return null;
  }
}
