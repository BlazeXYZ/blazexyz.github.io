// Property-based test for the pure scroll-reveal state machine over sequences.
//
// Feature: photos-page-and-content-templates, Property 5: No orphaned islands
// across arbitrary scroll sequences — for any finite sequence of
// intersecting/non-intersecting events applied to the reveal state machine, the
// resulting state is always one of the four defined states with a defined
// successor, and the rendered-presence invariant holds (hidden ⇒ absent,
// visible ⇒ present) — never an orphaned visible-but-removed or
// present-but-permanently-invisible island.
//
// Validates: Requirements 6.3, 1.5, 1.8

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  AnimState,
  nextRevealState,
  scheduledRevealState,
} from "./scrollReveal";

const ALL_STATES: readonly AnimState[] = [
  "hidden",
  "entering",
  "visible",
  "exiting",
];

const isDefinedState = (s: unknown): s is AnimState =>
  typeof s === "string" && (ALL_STATES as readonly string[]).includes(s);

/**
 * Rendered presence of an island for a given animation state.
 * - `hidden`  → removed from the DOM (absent).
 * - everything else (`entering` / `visible` / `exiting`) → rendered/present,
 *   since exit content is only removed once the timer settles it to `hidden`.
 */
const isPresent = (s: AnimState): boolean => s !== "hidden";

describe("scrollReveal sequence folding (Property 5)", () => {
  it("never produces an orphaned island for any scroll-event sequence", () => {
    fc.assert(
      fc.property(
        fc.array(fc.boolean(), { maxLength: 50 }),
        (events) => {
          // Start from the resting "hidden" state, as a freshly observed
          // island would before any intersection event.
          let current: AnimState = "hidden";

          for (const isIntersecting of events) {
            // Immediate transition decided by the observer callback.
            const immediate = nextRevealState(current, isIntersecting);

            // The immediate state must be one of the four defined states.
            expect(isDefinedState(immediate)).toBe(true);

            // The presence invariant must hold for the immediate state.
            if (immediate === "hidden") {
              expect(isPresent(immediate)).toBe(false);
            }
            if (immediate === "visible") {
              expect(isPresent(immediate)).toBe(true);
            }

            // The scheduled successor (if any) must itself be a defined state,
            // and there must always be a "defined successor" for re-application
            // of either intersection value from the immediate state.
            const scheduled = scheduledRevealState(immediate);
            if (scheduled !== null) {
              expect(isDefinedState(scheduled)).toBe(true);
            }
            expect(isDefinedState(nextRevealState(immediate, true))).toBe(true);
            expect(isDefinedState(nextRevealState(immediate, false))).toBe(true);

            // Settle the island the way a fired timer would: entering→visible,
            // exiting→hidden, otherwise stay put. This is the state the island
            // rests in until the next event.
            const settled = scheduled ?? immediate;

            expect(isDefinedState(settled)).toBe(true);

            // A settled island is always terminal (never mid-flight), so the
            // presence invariant must hold strictly: hidden ⇒ absent,
            // visible ⇒ present, and there are no other settled states.
            expect(settled === "hidden" || settled === "visible").toBe(true);
            if (settled === "hidden") {
              expect(isPresent(settled)).toBe(false);
            } else {
              expect(isPresent(settled)).toBe(true);
            }

            current = settled;
          }

          // After the whole sequence the island rests in a defined,
          // non-orphaned state.
          expect(isDefinedState(current)).toBe(true);
          expect(current === "hidden" || current === "visible").toBe(true);
        }
      ),
      { numRuns: 200 }
    );
  });
});
