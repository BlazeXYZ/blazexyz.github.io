/**
 * Gallery.observer.test.tsx
 * ──────────────────────────────────────────────────────────────────────────────
 * INTEGRATION tests for the `useScrollReveal` observer/timer wiring inside the
 * `Gallery` component (the hook is internal, so it is exercised through the
 * default `Gallery` export). These tests verify the DOM-side glue that the pure
 * `scrollReveal.ts` helpers are wired into:
 *
 *   1. TEARDOWN (Req 6.4) — when a gallery island is unmounted, the hook calls
 *      `io.disconnect()` on its IntersectionObserver AND `cancelTimers()` clears
 *      any pending scheduled timer (so a stale `setTimeout` can never fire after
 *      unmount and corrupt state).
 *
 *   2. ENTRY/EXIT WIRING (Req 1.4, 1.5) — the IntersectionObserver callback drives
 *      the reveal state machine THROUGH the pure helpers: an intersecting entry
 *      moves the island to `entering` (fly-in class) then, after the scheduled
 *      timer, to `visible` (resting); a non-intersecting entry moves it to
 *      `exiting` (fly-out class) then, after the scheduled timer, to `hidden`
 *      (gone). This confirms `nextRevealState` / `scheduledRevealState` decisions
 *      are actually applied to the rendered island.
 *
 * Test approach: a CONTROLLABLE IntersectionObserver mock captures each
 * constructed instance, its callback, and spies on `observe()` / `disconnect()`.
 * A harness sets `scrollRoot.current` to a real wrapper element (via a callback
 * ref) that contains the rendered island, so the hook wires up its observer. The
 * tests then invoke the captured callback to simulate scroll intersection and use
 * fake timers to advance the scheduled `entering → visible` (2000ms) and
 * `exiting → hidden` (1200ms) transitions.
 *
 * Feature: photos-page-and-content-templates
 * _Requirements: 6.1, 6.4, 1.4, 1.5_
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
} from "vitest";
import { useRef, type RefObject } from "react";
import { render, cleanup, act } from "@testing-library/react";
import Gallery from "./Gallery";
import styles from "./Gallery.module.css";
import { type GallerySet } from "./galleryData";

// ── Controllable IntersectionObserver mock ────────────────────
type IOEntry = Pick<IntersectionObserverEntry, "isIntersecting">;

const realIO = (globalThis as any).IntersectionObserver;
const realMatchMedia = (window as any).matchMedia;

/** Every IO constructed during a test is captured here for inspection/driving. */
let ioInstances: MockIO[] = [];

class MockIO {
  cb: IntersectionObserverCallback;
  opts?: IntersectionObserverInit;
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
  takeRecords = vi.fn(() => []);
  root = null;
  rootMargin = "";
  thresholds = [];

  constructor(cb: IntersectionObserverCallback, opts?: IntersectionObserverInit) {
    this.cb = cb;
    this.opts = opts;
    ioInstances.push(this);
  }

  /** Simulate the browser firing the callback with the given intersection. */
  fire(isIntersecting: boolean) {
    const entry = { isIntersecting } as IOEntry as IntersectionObserverEntry;
    this.cb([entry], this as unknown as IntersectionObserver);
  }
}

/** Install a matchMedia mock (reduced motion NOT requested → motion enabled). */
function installMatchMedia(matches: boolean) {
  const mql = {
    matches,
    media: "(prefers-reduced-motion: reduce)",
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  };
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockReturnValue(mql),
  });
}

beforeEach(() => {
  ioInstances = [];
  (globalThis as any).IntersectionObserver =
    MockIO as unknown as typeof IntersectionObserver;
  installMatchMedia(false);
});

afterEach(() => {
  cleanup();
  (globalThis as any).IntersectionObserver = realIO;
  if (realMatchMedia === undefined) {
    delete (window as any).matchMedia;
  } else {
    (window as any).matchMedia = realMatchMedia;
  }
  vi.useRealTimers();
});

// ── Test harness ──────────────────────────────────────────────
/*
 * Creates the scrollRoot ref and attaches it to a wrapper <div> via a callback
 * ref, so `scrollRoot.current` points at a real element that CONTAINS the
 * rendered gallery island — mirroring how page.tsx mounts the gallery inside a
 * scroll container. The wrapper's ref runs at commit time, before child effects,
 * so `useScrollReveal`'s effect sees a non-null root and constructs its observer.
 */
function Harness({ sets }: { sets: GallerySet[] }) {
  const scrollRoot = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={(el) => {
        if (el) {
          (scrollRoot as { current: HTMLDivElement | null }).current = el;
        }
      }}
    >
      <Gallery sets={sets} scrollRoot={scrollRoot as RefObject<HTMLDivElement>} />
    </div>
  );
}

/** A single, fully-specified set with a known fly direction (left). */
const SINGLE_SET: GallerySet[] = [
  {
    id: "obs-1",
    x: "10vw",
    y: 100,
    dir: "left",
    secAlign: "center",
    title: "Observer Island",
    caption: "caption text",
    image: "/test-island.webp",
  },
];

/** Locate the glass caption card (the element that carries the anim class). */
function glassCard(container: HTMLElement): HTMLElement {
  const el = container.querySelector<HTMLElement>(".glass");
  if (!el) throw new Error("glass caption card not found");
  return el;
}

// ── Req 6.4 — disconnect() + cancelTimers() on unmount ─────────
describe("useScrollReveal teardown on unmount (Req 6.4)", () => {
  it("calls io.disconnect() and clears the pending scheduled timer when the island unmounts", () => {
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");

    const { unmount, container } = render(<Harness sets={SINGLE_SET} />);

    // Exactly one observer wired for the single island, observing the .setWrap.
    expect(ioInstances.length).toBe(1);
    const io = ioInstances[0];
    expect(io.observe).toHaveBeenCalledTimes(1);

    // Drive an intersecting event: state → "entering" and a `entering → visible`
    // timer (2000ms) is SCHEDULED but not yet fired (a pending timer exists).
    act(() => {
      io.fire(true);
    });

    // Identify the handle of the scheduled reveal timer (the 2000ms one our hook
    // queues for entering → visible) so we can assert it gets cleared on unmount.
    const scheduledCall = setTimeoutSpy.mock.results.find(
      (_r, i) => setTimeoutSpy.mock.calls[i][1] === 2000,
    );
    expect(scheduledCall, "expected a 2000ms reveal timer to be scheduled").toBeDefined();
    const pendingHandle = scheduledCall!.value;

    // Glass card is mid-entry (proves a timer is genuinely pending).
    expect(glassCard(container).classList.contains(styles.flyInLeft)).toBe(true);

    clearTimeoutSpy.mockClear();

    // Unmount — cleanup must disconnect the observer AND cancel pending timers.
    act(() => {
      unmount();
    });

    expect(io.disconnect).toHaveBeenCalledTimes(1);
    // The hook clears pending timers via `timers.forEach(clearTimeout)`, which
    // passes (handle, index, array); assert the FIRST arg of some call matches.
    const clearedPending = clearTimeoutSpy.mock.calls.some(
      (call) => call[0] === pendingHandle,
    );
    expect(clearedPending, "expected the pending reveal timer to be cleared on unmount").toBe(true);

    setTimeoutSpy.mockRestore();
    clearTimeoutSpy.mockRestore();
  });
});

// ── Req 1.4 / 1.5 — IO callback drives entry/exit via the pure helper ─────────
describe("IntersectionObserver wiring drives entry/exit through the pure helper (Req 1.4, 1.5)", () => {
  it("entry → entering → visible, then exit → exiting → hidden, applied to the glass card", () => {
    vi.useFakeTimers();

    let container!: HTMLElement;
    act(() => {
      ({ container } = render(<Harness sets={SINGLE_SET} />));
    });

    const io = ioInstances[0];
    const card = () => glassCard(container);

    // Initial state is "hidden" → the `gone` class is applied.
    expect(card().classList.contains(styles.gone)).toBe(true);

    // Req 1.4 — scrolling INTO view: nextRevealState(_, true) === "entering".
    act(() => {
      io.fire(true);
    });
    expect(card().classList.contains(styles.flyInLeft)).toBe(true);
    expect(card().classList.contains(styles.gone)).toBe(false);

    // scheduledRevealState("entering") === "visible": after the 2000ms timer the
    // island settles into the resting (visible) state.
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(card().classList.contains(styles.resting)).toBe(true);
    expect(card().classList.contains(styles.flyInLeft)).toBe(false);

    // Req 1.5 — scrolling OUT of view: nextRevealState("visible", false) === "exiting".
    act(() => {
      io.fire(false);
    });
    expect(card().classList.contains(styles.flyOutLeft)).toBe(true);
    expect(card().classList.contains(styles.resting)).toBe(false);

    // scheduledRevealState("exiting") === "hidden": after the 1200ms timer the
    // island returns to the hidden (gone) state.
    act(() => {
      vi.advanceTimersByTime(1200);
    });
    expect(card().classList.contains(styles.gone)).toBe(true);
    expect(card().classList.contains(styles.flyOutLeft)).toBe(false);
  });
});
