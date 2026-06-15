import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  AnimState,
  nextRevealState,
  scheduledRevealState,
} from "./scrollReveal";

// Feature: photos-page-and-content-templates, Property 4: Scroll-reveal transitions are correct
// Validates: Requirements 1.4, 1.5, 1.6

const animState: fc.Arbitrary<AnimState> = fc.constantFrom(
  "hidden",
  "entering",
  "visible",
  "exiting"
);

describe("Property 4: Scroll-reveal transitions are correct", () => {
  it("nextRevealState intersecting → entering; non-hidden not-intersecting → exiting; scheduled successors are visible/hidden", () => {
    fc.assert(
      fc.property(animState, (s) => {
        // 1.4 / 1.6: a set scrolling into view always plays its entry animation,
        // regardless of current state (including re-entry from "exiting").
        expect(nextRevealState(s, true)).toBe("entering");

        // 1.5: a non-hidden set scrolling out of view transitions to "exiting".
        if (s !== "hidden") {
          expect(nextRevealState(s, false)).toBe("exiting");
        } else {
          // already hidden stays hidden (no work)
          expect(nextRevealState(s, false)).toBe("hidden");
        }

        // Scheduled successors: entering advances to visible, exiting advances to hidden.
        expect(scheduledRevealState("entering")).toBe("visible");
        expect(scheduledRevealState("exiting")).toBe("hidden");
      }),
      { numRuns: 200 }
    );
  });
});
