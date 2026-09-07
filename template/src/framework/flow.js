/**
 * FLOW MODE — the deck read on a phone.
 *
 * A phone held upright gets a scrolling column instead of a scaled canvas. A 1920x1080 canvas scaled into a 390px-wide window puts body
 * text at 11px, so "responsive" cannot mean scaling harder: in portrait the
 * deck stops being a fixed canvas and becomes a scrolling document column.
 * That is `data-layout="flow"`, mirrored onto <html> here and acted on by
 * the flow section of framework/base.css.
 *
 * LANDSCAPE IS UNTOUCHED, BY CONSTRUCTION. The attribute is only ever set
 * while the viewport is portrait, and every rule that reads it is also inside
 * `@media screen and (orientation: portrait)`. A projector, a laptop, and the
 * print sheet (whose page box is 1920x1080, i.e. landscape) can never match.
 *
 * Why an attribute at all, rather than the media query alone: specificity.
 * The per-language metric overrides in styles.css are written as
 * `:root[lang="th"] .cover .title` — (0,4,0). A bare `.cover .title` inside a
 * media query is (0,2,0) and loses to it, so flow's type sizes would silently
 * not apply in Thai. Prefixing every flow rule with `:root[data-layout="flow"]`
 * ties those selectors, and the deck stylesheet is injected after styles.css,
 * so order settles the tie. React also needs the same signal (a slide can swap
 * a heavy figure for a flat one on a phone), and one source of truth beats two
 * evaluations of the same condition drifting apart.
 *
 * Not a preference: there is no ?layout= and nothing is stored. The device
 * decides, and it can change its mind mid-talk by being turned sideways.
 *
 * Safe to import at build time — every DOM access is guarded, exactly as in
 * ./prefs.js.
 */
import { useSyncExternalStore } from "react";

const QUERY = "(orientation: portrait)";
const hasDOM = typeof document !== "undefined";
const mq = hasDOM && typeof window.matchMedia === "function" ? window.matchMedia(QUERY) : null;

let flow = mq ? mq.matches : false;
const listeners = new Set();

function reflect() {
  if (!hasDOM) return;
  /* Set and REMOVED, never set to "fixed": a stale attribute on a landscape
     window is the one way flow rules could reach the presentation. */
  if (flow) document.documentElement.setAttribute("data-layout", "flow");
  else document.documentElement.removeAttribute("data-layout");
}

/* Before React mounts, like prefs.js — a phone must not paint the 1920px
   canvas for a frame and then reflow. */
reflect();

if (mq) {
  const onChange = () => {
    if (mq.matches === flow) return;
    flow = mq.matches;
    reflect();
    listeners.forEach((f) => f());
  };
  /* addListener is the Safari < 14 spelling; a phone is exactly where an old
     WebKit shows up. */
  if (mq.addEventListener) mq.addEventListener("change", onChange);
  else if (mq.addListener) mq.addListener(onChange);
}

export const isFlow = () => flow;

export function useFlow() {
  return useSyncExternalStore(
    (f) => { listeners.add(f); return () => listeners.delete(f); },
    () => flow,
    () => false   /* server/static: always the fixed canvas */
  );
}
