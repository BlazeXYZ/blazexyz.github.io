"use client";

import { useRef, useEffect, useState, RefObject } from "react";
import styles from "./Gallery.module.css";
import {
  GallerySet,
  ResolvedGallerySet,
  resolveSet,
} from "./galleryData";
import {
  AnimState,
  nextRevealState,
  scheduledRevealState,
} from "./scrollReveal";

// ── Scroll-reveal hook ────────────────────────────────────────
/*
 * IntersectionObserver-driven entry/exit state machine. The transition
 * DECISIONS are delegated to the pure helpers `nextRevealState` /
 * `scheduledRevealState` (app/scrollReveal.ts) so the logic is property-tested
 * in isolation; this hook only owns the DOM wiring (observer + timers).
 *
 * Preserved invariants from the former CodePage implementation:
 *   - threshold: 0.10, rootMargin: "0px 0px -40px 0px"
 *   - cancelTimers() at the top of every callback
 *   - io.disconnect() + cancelTimers() on unmount
 */
function useScrollReveal(
  scrollRoot: RefObject<HTMLDivElement | null>
): [RefObject<HTMLDivElement>, AnimState] {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<AnimState>("hidden");
  const stateRef = useRef<AnimState>("hidden");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  function cancelTimers() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }
  function set(s: AnimState) {
    stateRef.current = s;
    setState(s);
  }
  function after(ms: number, fn: () => void) {
    timers.current.push(setTimeout(fn, ms));
  }

  // Duration (ms) of each scheduled timer, matched to the CSS animation length:
  //   entering → visible after the 2s fly-in; exiting → hidden after the 1.2s fly-out.
  function scheduledDelay(immediate: AnimState): number {
    return immediate === "entering" ? 2000 : 1200;
  }

  useEffect(() => {
    const root = scrollRoot.current;
    const el = ref.current;
    if (!root || !el) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        cancelTimers();

        const immediate = nextRevealState(
          stateRef.current,
          entry.isIntersecting
        );

        // No transition needed when the next immediate state matches the
        // current one (e.g. staying hidden while off-screen) — avoids
        // restarting a CSS animation that is already in the right state.
        if (immediate === stateRef.current) return;

        set(immediate);

        const scheduled = scheduledRevealState(immediate);
        if (scheduled !== null) {
          after(scheduledDelay(immediate), () => set(scheduled));
        }
      },
      { root, threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
    );

    io.observe(el);
    return () => {
      io.disconnect();
      cancelTimers();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return [ref, state];
}

// ── Scroll-progress hook ──────────────────────────────────────
/*
 * Drives the thin glass-tinted scroll-progress bar (Req 9.7). Attaches a single
 * `scroll` listener to the gallery scroll root and computes
 *   progress = scrollTop / (scrollHeight - clientHeight)
 * clamped to 0..1 (divide-by-zero guarded: a non-scrollable container reports 0).
 *
 * The listener fires often, so the actual write is THROTTLED by coalescing a
 * single pending `requestAnimationFrame` — never an unbounded per-frame loop:
 * the pending rAF id is stored and scheduling is skipped while one is pending,
 * so at most one frame is queued per paint regardless of scroll-event volume.
 *
 * The computed value is written to the `--scroll-progress` custom property on
 * the supplied bar element; the CSS scales the bar by that property, so no
 * layout is forced. SSR-safe: all DOM access happens inside the effect.
 */
function useScrollProgress(
  scrollRoot: RefObject<HTMLDivElement | null>,
  barRef: RefObject<HTMLDivElement | null>
): void {
  useEffect(() => {
    const root = scrollRoot.current;
    const bar = barRef.current;
    if (!root || !bar) return;

    let rafId: number | null = null;

    function apply() {
      rafId = null;
      const max = root!.scrollHeight - root!.clientHeight;
      const progress = max > 0 ? root!.scrollTop / max : 0;
      const clamped = progress < 0 ? 0 : progress > 1 ? 1 : progress;
      bar!.style.setProperty("--scroll-progress", clamped.toFixed(4));
    }

    function onScroll() {
      // Coalesce: skip scheduling if a frame is already pending.
      if (rafId !== null) return;
      rafId = requestAnimationFrame(apply);
    }

    // Initialize once so the bar reflects the starting position.
    apply();
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      root.removeEventListener("scroll", onScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [scrollRoot, barRef]);
}

// ── Single gallery set ────────────────────────────────────────
/*
 * Renders one resolved content island: an image card (.mainIsland — border-radius
 * shaping, NO backdrop-filter) optionally wrapped in <a href>, paired with a
 * glass caption card (.secIsland.glass) that carries backdrop-filter.
 *
 * The scroll-reveal animation class is applied DIRECTLY to each child — never to
 * the transform-free .setWrap — so that backdrop-filter and the CSS transform
 * live on the SAME element (Req 1.7 / 9.3): the only reliable pattern for the
 * blur to apply throughout the fly-in/out animation.
 */
function GallerySetView(
  props: ResolvedGallerySet & {
    scrollRoot: RefObject<HTMLDivElement | null>;
  }
) {
  const { x, y, dir, secAlign, title, caption, image, href, orientation, scrollRoot } =
    props;
  const [ref, state] = useScrollReveal(scrollRoot);

  const animClass = {
    hidden: styles.gone,
    entering: dir === "left" ? styles.flyInLeft : styles.flyInRight,
    visible: styles.resting,
    exiting: dir === "left" ? styles.flyOutLeft : styles.flyOutRight,
  }[state];

  const alignClass = {
    left: styles.secLeft,
    center: styles.secCenter,
    right: styles.secRight,
  }[secAlign];

  // Orientation drives both the CSS aspect class and the <img> intrinsic
  // dimensions, so layout space is reserved correctly (no CLS) for either a
  // 16:9 landscape or a 4:5 portrait frame.
  const isVertical = orientation === "vertical";
  const imgClass = isVertical
    ? `${styles.projectImg} ${styles.projectImgVertical}`
    : styles.projectImg;
  const imgW = isVertical ? 512 : 640;
  const imgH = isVertical ? 640 : 360;

  const img = (
    // Plain <img> (NOT next/image): explicit intrinsic dimensions reserve layout
    // space (no CLS) and match the CSS `aspect-ratio` (16:9 landscape or 4:5
    // portrait per `orientation`); lazy loading + async decode keep below-the-fold
    // island images off the critical path. `image` resolves via galleryData (Req 3.9).
    <img
      src={image}
      alt={`${title} preview`}
      className={imgClass}
      width={imgW}
      height={imgH}
      loading="lazy"
      decoding="async"
    />
  );

  return (
    <div ref={ref} className={styles.setWrap} style={{ left: x, top: `${y}px` }}>
      {/* Animation applied directly to the image card (no backdrop-filter here). */}
      <div className={`${styles.mainIsland} ${animClass}`}>
        {href ? (
          <a href={href} target="_blank" rel="noopener">
            {img}
          </a>
        ) : (
          img
        )}
      </div>

      {/* backdrop-filter AND the animation transform are on this same element. */}
      <div className={`${styles.secIsland} ${alignClass} glass ${animClass}`}>
        <p className={styles.projTitle}>{title}</p>
        {caption ? <p className={styles.projCaption}>{caption}</p> : null}
      </div>
    </div>
  );
}

// ── Gallery ──────────────────────────────────────────────────
/*
 * Data-driven gallery: renders exactly one GallerySetView per entry in `sets`
 * (Req 2.3) with no per-page branching — the same component drives both the
 * Photos and Projects pages. Defaults are applied here via `resolveSet` so the
 * rendering code never contains default literals.
 */
export default function Gallery({
  sets,
  scrollRoot,
}: {
  sets: GallerySet[];
  scrollRoot: RefObject<HTMLDivElement | null>;
}) {
  // Thin glass-tinted scroll-progress affordance (Req 9.7). The bar element is
  // ref'd so the hook can write the `--scroll-progress` custom property onto it.
  const progressRef = useRef<HTMLDivElement>(null);
  useScrollProgress(scrollRoot, progressRef);

  return (
    <div className={styles.galleryContent}>
      <div ref={progressRef} className={styles.scrollProgress} aria-hidden="true" />
      {sets.map((s) => {
        const resolved = resolveSet(s);
        return (
          <GallerySetView key={resolved.id} {...resolved} scrollRoot={scrollRoot} />
        );
      })}
    </div>
  );
}
