"use client";

import { useState, useEffect, useRef } from "react";
import styles from "./page.module.css";
import Gallery from "./Gallery";
import { PHOTO_SETS, PROJECT_SETS } from "./galleryData";

type Section = "bio" | "photos" | "code";
type IslandState = "entering" | "visible" | "exiting" | "hidden";

const WALLS: Record<Section, string> = {
  bio:    "/bioWallpaper.webp",
  photos: "/photosWallpaper.webp",
  code:   "/codingWallpaper.webp",
};

export default function Home() {
  const [active,       setActive]       = useState<Section>("bio");
  const [wallReady,    setWallReady]    = useState(false);
  const [centralFirst, setCentralFirst] = useState(true);
  const [bioState,     setBioState]     = useState<IslandState>("hidden");

  // Refs that mirror state for synchronous reads inside callbacks/navigate.
  // React state updates are async; these refs are always current.
  const activeRef      = useRef<Section>("bio");
  const bioStateRef    = useRef<IslandState>("hidden");
  const pendingTimers  = useRef<ReturnType<typeof setTimeout>[]>([]);
  const codeScrollRef  = useRef<HTMLDivElement>(null);
  const photosScrollRef = useRef<HTMLDivElement>(null);

  // Wrappers that keep ref and state in sync
  function go(s: Section)        { activeRef.current = s;   setActive(s);   }
  function setBio(s: IslandState){ bioStateRef.current = s; setBioState(s); }

  // Schedule a callback and track the ID so it can be cancelled
  function after(ms: number, fn: () => void) {
    const id = setTimeout(fn, ms);
    pendingTimers.current.push(id);
  }

  // Cancel every pending timer — called at the top of every navigate()
  function cancelAll() {
    pendingTimers.current.forEach(clearTimeout);
    pendingTimers.current = [];
  }

  // Preload wallpapers
  useEffect(() => {
    let loaded = 0;
    const srcs = Object.values(WALLS);
    srcs.forEach(src => {
      const img = new Image();
      img.onload = img.onerror = () => { if (++loaded === srcs.length) setWallReady(true); };
      img.src = src;
    });
  }, []);

  // First-load entry animations
  useEffect(() => {
    if (!wallReady) return;
    setBio("entering");
    after(2400, () => { setCentralFirst(false); setBio("visible"); });
    // Cleanup if the component unmounts mid-animation
    return cancelAll;
  }, [wallReady]); // eslint-disable-line react-hooks/exhaustive-deps

  function navigate(next: Section) {
    // Guard: no-op if already at the destination
    if (next === activeRef.current) return;

    // Cancel every stale timer before scheduling new ones.
    // This is the core fix: without this, an old timer from a previous
    // navigation fires later and corrupts state (e.g. sets bioState to
    // "hidden" while islands are mid-entry, or "visible" on the wrong page).
    cancelAll();
    setCentralFirst(false);

    const prev = activeRef.current;
    go(next);

    if (next === "bio") {
      // Arriving at bio: always (re)start the entry animation.
      // If islands were mid-exit, the class swap from "exiting" → "entering"
      // restarts the CSS animation cleanly from the current visual position.
      setBio("entering");
      after(2200, () => setBio("visible"));
    } else if (
      prev === "bio" ||
      bioStateRef.current === "visible" ||
      bioStateRef.current === "entering"
    ) {
      // Leaving bio (or interrupting an entry): trigger exit animation.
      // After 1.2s the islands are fully faded/slid out; remove from DOM.
      setBio("exiting");
      after(1200, () => setBio("hidden"));
    }
    // If prev !== "bio" and islands are already hidden/exiting: nothing to do.
  }

  const centralPos =
    active === "bio"    ? styles.centralBio    :
    active === "photos" ? styles.centralPhotos :
                          styles.centralCode;

  const leftClass  = `${styles.bioIsland} glass ${styles.bioLeft}  ${styles[`bioIsland_${bioState}`]}`;
  const rightClass = `${styles.bioIsland} glass ${styles.bioRight} ${styles[`bioIsland_${bioState}`]}`;
  const showBio    = bioState !== "hidden";

  return (
    <div className={`${styles.shell} ${wallReady ? styles.shellReady : ""}`}>
      <svg width="0" height="0" className={styles.svgDefs} aria-hidden="true">
        <defs>
          <filter id="glass-warp" x="-8%" y="-8%" width="116%" height="116%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.013 0.019" numOctaves="3" seed="1" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="18" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>

      <div className={styles.wallpaperWrap}>
        <div className={`${styles.wallpaper} ${styles.wallBio}    ${active === "bio"    ? styles.wallActive : ""}`} />
        <div className={`${styles.wallpaper} ${styles.wallPhotos} ${active === "photos" ? styles.wallActive : ""}`} />
        <div className={`${styles.wallpaper} ${styles.wallCode}   ${active === "code"   ? styles.wallActive : ""}`} />
        <div className={styles.vignette} />
      </div>

      {/* Central island */}
      <div className={`${styles.central} glass ${centralPos} ${centralFirst && wallReady ? styles.centralFirst : ""}`}>
        <div className={styles.avatar}><div className={styles.avatarInner} /></div>
        <p className={styles.name}>Your Name</p>
        <p className={styles.pronouns}>they / them</p>
        <nav className={styles.tabs}>
          {(["photos", "bio", "code"] as Section[]).map(s => (
            <button
              key={s}
              className={`${styles.tab} ${active === s ? styles.tabActive : ""}`}
              onClick={() => navigate(s)}
            >
              {s === "bio" ? "Bio" : s === "photos" ? "Photos" : "Projects"}
            </button>
          ))}
        </nav>
      </div>

      {showBio && (
        <>
          <div className={leftClass}>
            <h2 className={styles.islandHeading}>About Me</h2>
            <p className={styles.islandText}>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p>
            <p className={styles.islandText}>Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.</p>
            <p className={styles.islandText}>Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.</p>
            <p className={styles.islandText}>Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.</p>
          </div>
          <div className={rightClass}>
            <h2 className={styles.islandHeading}>Experience</h2>
            <p className={styles.islandText}>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p>
            <p className={styles.islandText}>Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.</p>
            <p className={styles.islandText}>Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta.</p>
            <p className={styles.islandText}>Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.</p>
          </div>
        </>
      )}

      {/* Photos page — scrollable gallery container */}
      {active === "photos" && (
        <div ref={photosScrollRef} className={styles.galleryScroll}>
          <Gallery sets={PHOTO_SETS} scrollRoot={photosScrollRef} />
        </div>
      )}

      {/* Projects page — scrollable gallery container */}
      {active === "code" && (
        <div ref={codeScrollRef} className={styles.galleryScroll}>
          <Gallery sets={PROJECT_SETS} scrollRoot={codeScrollRef} />
        </div>
      )}
    </div>
  );
}
