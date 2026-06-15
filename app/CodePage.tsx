"use client";

import { RefObject } from "react";
import Gallery from "./Gallery";
import { PROJECT_SETS } from "./galleryData";

/*
 * Compatibility wrapper — `CodePage` has been generalized into the shared,
 * data-driven `Gallery` component (app/Gallery.tsx). This thin wrapper keeps
 * page.tsx compiling until task 5 rewires it to mount `Gallery` directly with
 * `PROJECT_SETS` / `PHOTO_SETS`. It simply renders the Projects gallery.
 */
export default function CodePage({
  scrollRoot,
}: {
  scrollRoot: RefObject<HTMLDivElement | null>;
}) {
  return <Gallery sets={PROJECT_SETS} scrollRoot={scrollRoot} />;
}
