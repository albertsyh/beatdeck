/**
 * BEATDECK PRIMITIVES — the framework. A deck imports from here, defines its
 * slide components and a SLIDES manifest, and ends with mountDeck(...).
 *
 * Deck state is a pair, { s, k }: slide index and step ("beat") index.
 * Forward navigation spends a slide's beats before moving on, so points land
 * one at a time while you talk. Shared elements (Morph) carry arguments
 * across slide boundaries.
 *
 * Two render trees: Deck (interactive) and PrintSheet (every slide at its
 * final beat, under StaticCtx, no motion). CSS swaps which is visible under
 * @media print, so Cmd/Ctrl+P exports the whole deck with nothing hidden.
 *
 * mountDeck options:
 *   slides      the manifest: [{ id, label, steps, view, transition?, group? }]
 *   dock        { id, from, release, chip } — a Morph parked in the chrome
 *   meta        { title }
 *   controls    a deck-supplied element rendered into the chrome
 *   menu        { title, hint, openLabel, closeLabel } as nodes
 *   numberFrom  what the FIRST slide is called (1 default; 0 for a landing)
 *   useFlat     a HOOK returning true while slides render fully revealed —
 *               pass `useFlow` so a phone in portrait navigates one press
 *               per slide (see flow.js)
 */
import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { createRoot } from "react-dom/client";
import { motion, AnimatePresence, LayoutGroup, useReducedMotion } from "motion/react";

/* ============================================================
   MOTION TOKENS
   ============================================================ */
export const EASE_OUT = [0.22, 0.61, 0.36, 1];
export const REVEAL   = { duration: 0.30, ease: EASE_OUT };
export const SLIDE_IN = { duration: 0.26, ease: EASE_OUT };
export const MORPH    = { type: "spring", stiffness: 150, damping: 26, mass: 1 };

/* Static mode drives the print sheet: no motion components at all,
   everything rendered at its final state. */
export const StaticCtx = createContext(false);
export const useStatic = () => useContext(StaticCtx);

/* ============================================================
   BEAT EFFECTS — how content arrives on a beat.
   Every effect keeps the layout box (only transform/opacity/filter
   change) so nothing on the slide shifts when a beat lands.
   ============================================================ */
const EFFECTS = {
  rise:  { hidden: { opacity: 0, y: 14 },              shown: { opacity: 1, y: 0 } },
  fade:  { hidden: { opacity: 0 },                     shown: { opacity: 1 } },
  drop:  { hidden: { opacity: 0, y: -14 },             shown: { opacity: 1, y: 0 } },
  slide: { hidden: { opacity: 0, x: -24 },             shown: { opacity: 1, x: 0 } },
  scale: { hidden: { opacity: 0, scale: 0.94 },        shown: { opacity: 1, scale: 1 } },
  blur:  { hidden: { opacity: 0, filter: "blur(8px)" }, shown: { opacity: 1, filter: "blur(0px)" } }
};
export const EFFECT_NAMES = Object.keys(EFFECTS);

/**
 * Reveal — content that arrives on a beat.
 *   <Reveal show={step >= 1} effect="slide" delay={0.1}>…</Reveal>
 * Hidden content stays IN LAYOUT (opacity/transform only), so the slide is
 * still on every keypress. Under StaticCtx it renders a plain div; under
 * reduced motion it cuts instead of moving.
 */
export function Reveal({ show, effect = "rise", delay = 0, className = "", style, children }) {
  const isStatic = useStatic();
  const reduced = useReducedMotion();
  if (isStatic) return <div className={className} style={style}>{children}</div>;
  const fx = EFFECTS[effect] || EFFECTS.rise;
  const hidden = reduced ? { opacity: 0 } : fx.hidden;
  const shown = reduced ? { opacity: 1 } : fx.shown;
  return (
    <motion.div
      className={className}
      style={style}
      initial={hidden}
      animate={show ? shown : hidden}
      transition={{ ...REVEAL, duration: reduced ? 0 : REVEAL.duration, delay: show ? delay : 0 }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Stagger — a list whose children arrive one after another on one beat.
 *   <Stagger show={step >= 0} gap={0.08} effect="rise">{items}</Stagger>
 */
export function Stagger({ show, gap = 0.08, effect = "rise", className = "", children }) {
  const kids = Array.isArray(children) ? children : [children];
  return (
    <div className={className}>
      {kids.map((child, i) => (
        <Reveal key={i} show={show} effect={effect} delay={i * gap}>{child}</Reveal>
      ))}
    </div>
  );
}

/**
 * Morph — a shared element. The same `id` on two CONSECUTIVE slides makes
 * Motion fly the element between them instead of crossfading. The two
 * elements must be mounted back-to-back; use a dock for a gap.
 */
export function Morph({ id, className = "", style, children }) {
  const isStatic = useStatic();
  const reduced = useReducedMotion();
  if (isStatic || reduced) return <div className={className} style={style}>{children}</div>;
  return (
    <motion.div layoutId={id} className={className} style={style} transition={MORPH}>
      {children}
    </motion.div>
  );
}

/* The accent mark. One element for the whole deck — it slides and resizes
   from slide to slide rather than reappearing. */
export function Signal({ w = 40, h = 8 }) {
  return <Morph id="signal" className="signal" style={{ width: w + "px", height: h + "px" }} />;
}

/* A bar that grows to `w` px when `show` — for simple comparisons. */
export function Bar({ w, accent, show }) {
  const isStatic = useStatic();
  const reduced = useReducedMotion();
  const cls = "bar-fill" + (accent ? " is-accent" : "");
  if (isStatic || reduced) return <div className={cls} style={{ width: (show ? w : 0) + "px" }} />;
  return (
    <motion.div
      className={cls}
      initial={{ width: 0 }}
      animate={{ width: (show ? w : 0) + "px" }}
      transition={{ duration: 0.55, ease: EASE_OUT }}
    />
  );
}

/* ============================================================
   SLIDE TRANSITIONS — how a whole slide enters and leaves.
   Picked per manifest entry: { …, transition: "fade" }.
   ============================================================ */
const TRANSITIONS = {
  rise:  { from: { opacity: 0, y: 18 },        enter: { opacity: 1, y: 0 },        exit: { opacity: 0, y: -12 } },
  fade:  { from: { opacity: 0 },               enter: { opacity: 1 },              exit: { opacity: 0 } },
  slide: { from: { opacity: 0, x: 80 },        enter: { opacity: 1, x: 0 },        exit: { opacity: 0, x: -80 } },
  zoom:  { from: { opacity: 0, scale: 1.04 },  enter: { opacity: 1, scale: 1 },    exit: { opacity: 0, scale: 0.98 } },
  none:  { from: { opacity: 1 },               enter: { opacity: 1 },              exit: { opacity: 1 } }
};
export const TRANSITION_NAMES = Object.keys(TRANSITIONS);

/* ============================================================
   NAVIGATION — pure functions over a manifest
   ============================================================ */
export function step(slides, pos, dir, flat = false) {
  if (flat) {
    if (dir > 0) return pos.s < slides.length - 1 ? { s: pos.s + 1, k: 0 } : pos;
    return pos.s > 0 ? { s: pos.s - 1, k: 0 } : pos;
  }
  const cur = slides[pos.s];
  if (dir > 0) {
    if (pos.k < cur.steps - 1) return { s: pos.s, k: pos.k + 1 };
    if (pos.s < slides.length - 1) return { s: pos.s + 1, k: 0 };
    return pos;
  }
  if (pos.k > 0) return { s: pos.s, k: pos.k - 1 };
  /* backward lands on the LAST beat of the previous slide, so ← then → is a
     round trip */
  if (pos.s > 0) return { s: pos.s - 1, k: slides[pos.s - 1].steps - 1 };
  return pos;
}

export function readHash(slides, numberFrom = 1) {
  const m = /^#(\d+)(?:\.(\d+))?$/.exec(window.location.hash || "");
  if (!m) return { s: 0, k: 0 };
  const s = Math.min(slides.length - 1, Math.max(0, parseInt(m[1], 10) - numberFrom));
  const k = Math.min(slides[s].steps - 1, Math.max(0, parseInt(m[2] || "1", 10) - 1));
  return { s, k };
}

const pad = (n) => (n < 10 ? "0" : "") + n;
const FIXED = () => false;

/**
 * withFlat — wrap every multi-beat view so it renders at its FINAL beat
 * while `useFlat()` is true. Pair with `mountDeck({ useFlat })`: a layout
 * that shows every slide whole must also navigate one press per slide, or
 * presses do nothing visible.
 *   export const SLIDES = withFlat(MANIFEST, useFlow);
 */
export function withFlat(slides, useFlat) {
  return slides.map((s) => {
    if (s.steps <= 1) return s;
    const View = s.view;
    const Flat = ({ step }) => <View step={useFlat() ? s.steps - 1 : step} />;
    Flat.displayName = `Flat(${View.name || s.id})`;
    return { ...s, view: Flat };
  });
}

/* ============================================================
   DOCK — a shared element parked in the chrome between two slides
   ============================================================ */
function resolveDock(slides, dock) {
  if (!dock) return null;
  const idx = (id) => {
    const i = slides.findIndex((s) => s.id === id);
    if (i < 0) throw new Error(`dock "${dock.id}": slide id "${id}" is not in the manifest`);
    return i;
  };
  const from = idx(dock.from);
  const release = idx(dock.release);
  if (release <= from) throw new Error(`dock "${dock.id}": release "${dock.release}" must come after from "${dock.from}"`);
  return { ...dock, from, release };
}

/* ============================================================
   CONTENTS MENU — `m`, or the ☰ button in the chrome
   ============================================================ */
function groupSlides(slides) {
  const groups = [];
  slides.forEach((s, i) => {
    if (!groups.length || s.group !== undefined) groups.push({ heading: s.group, items: [] });
    groups[groups.length - 1].items.push({ slide: s, i });
  });
  return groups;
}

const MENU_TEXT = {
  title: "Contents",
  hint: "M or Esc to close",
  openLabel: "Contents",
  closeLabel: "Close contents"
};

function Menu({ slides, numberFrom, current, cursor, setCursor, onPick, onClose, text }) {
  const groups = groupSlides(slides);
  const refs = useRef([]);
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = refs.current[cursor];
    if (el) el.focus({ preventScroll: false });
  }, [cursor]);

  const from  = reduced ? { opacity: 0 } : { opacity: 0, y: 10 };
  const enter = { opacity: 1, y: 0 };

  return (
    <motion.div
      className="deck-menu"
      role="dialog"
      aria-modal="true"
      aria-labelledby="deck-menu-title"
      initial={from}
      animate={enter}
      exit={reduced ? { opacity: 0 } : { opacity: 0, y: 10 }}
      transition={reduced ? { duration: 0 } : SLIDE_IN}
      onClick={(e) => { e.stopPropagation(); onClose(); }}
    >
      <div className="deck-menu-head">
        <h2 className="deck-menu-title" id="deck-menu-title">{text.title}</h2>
        <span className="deck-menu-hint" aria-hidden="true">{text.hint}</span>
        <button type="button" className="navbtn" onClick={(e) => { e.stopPropagation(); onClose(); }}>
          <span aria-hidden="true">&#215;</span>
          <span className="sr-only">{text.closeLabel}</span>
        </button>
      </div>

      <div className="deck-menu-body" onClick={(e) => e.stopPropagation()}>
        {groups.map((g, gi) => (
          <section className="deck-menu-group" key={gi}>
            {g.heading !== undefined && <h3 className="deck-menu-heading">{g.heading}</h3>}
            <ul className="deck-menu-list">
              {g.items.map(({ slide, i }) => (
                <li key={slide.id}>
                  <button
                    type="button"
                    className={"deck-menu-item" + (i === current ? " is-current" : "") + (i === cursor ? " is-cursor" : "")}
                    ref={(el) => { refs.current[i] = el; }}
                    aria-current={i === current ? "true" : undefined}
                    onMouseEnter={() => setCursor(i)}
                    onClick={(e) => { e.stopPropagation(); onPick(i); }}
                  >
                    <span className="deck-menu-n">{pad(i + numberFrom)}</span>
                    <span className="deck-menu-label">{slide.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </motion.div>
  );
}

/* ============================================================
   DECK
   ============================================================ */
function Deck({ slides, dock, totalBeats, controls, menu, numberFrom = 1, useFlat = FIXED }) {
  const flat = useFlat();
  const [pos, setPos] = useState(() => readHash(slides, numberFrom));
  const menuText = { ...MENU_TEXT, ...(menu || {}) };
  const [menuOpen, setMenuOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const lastNumber = slides.length - 1 + numberFrom;
  const reduced = useReducedMotion();
  const slide = slides[pos.s];
  const View = slide.view;

  const go = useCallback((dir) => setPos((p) => step(slides, p, dir, flat)), [slides, flat]);
  const jump = useCallback((s) => setPos({ s, k: 0 }), []);

  const posRef = useRef(pos);
  posRef.current = pos;
  const toggleMenu = useCallback(() => {
    setCursor(posRef.current.s);
    setMenuOpen((open) => !open);
  }, []);

  /* scale the fixed canvas into the window */
  useEffect(() => {
    const fit = () => {
      const el = document.getElementById("stage");
      if (!el) return;
      const cs = getComputedStyle(document.documentElement);
      const w = parseFloat(cs.getPropertyValue("--canvas-w")) || 1920;
      const h = parseFloat(cs.getPropertyValue("--canvas-h")) || 1080;
      el.style.setProperty("--scale", Math.min(window.innerWidth / w, window.innerHeight / h));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  /* keyboard */
  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;

      if (menuOpen) {
        const last = slides.length - 1;
        switch (e.key) {
          case "Escape": case "m": case "M":
            setMenuOpen(false); e.preventDefault(); break;
          case "ArrowDown": case "ArrowRight": case "PageDown":
            setCursor((c) => Math.min(last, c + 1)); e.preventDefault(); break;
          case "ArrowUp": case "ArrowLeft": case "PageUp":
            setCursor((c) => Math.max(0, c - 1)); e.preventDefault(); break;
          case "Home": setCursor(0); e.preventDefault(); break;
          case "End": setCursor(last); e.preventDefault(); break;
          case "Enter": case " ":
            jump(cursor); setMenuOpen(false); e.preventDefault(); break;
          default: break;
        }
        return;
      }

      switch (e.key) {
        case "ArrowRight": case "ArrowDown": case "PageDown": case " ": case "Enter":
          go(1); e.preventDefault(); break;
        case "ArrowLeft": case "ArrowUp": case "PageUp": case "Backspace":
          go(-1); e.preventDefault(); break;
        case "Home": case "r": case "R": jump(0); e.preventDefault(); break;
        case "End": jump(slides.length - 1); e.preventDefault(); break;
        case "m": case "M": toggleMenu(); e.preventDefault(); break;
        case "f": case "F":
          if (document.fullscreenElement) document.exitFullscreen?.();
          else document.documentElement.requestFullscreen?.();
          e.preventDefault(); break;
        default: break;
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [go, jump, slides, menuOpen, cursor, toggleMenu]);

  /* hash sync, both ways */
  useEffect(() => {
    const want = "#" + (pos.s + numberFrom) + "." + (pos.k + 1);
    if (window.location.hash !== want) window.history.replaceState(null, "", want);
  }, [pos, numberFrom]);

  useEffect(() => {
    const onHash = () => setPos(readHash(slides, numberFrom));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [slides, numberFrom]);

  const progress = flat
    ? (pos.s + 1) / slides.length
    : (slides.slice(0, pos.s).reduce((n, x) => n + x.steps, 0) + pos.k + 1) / totalBeats;
  const showDock = !!dock && !flat && (
    (pos.s >= dock.from && pos.s < dock.release) ||
    (pos.s === dock.release && pos.k === 0)
  );
  const atStart = pos.s === 0 && (flat || pos.k === 0);
  const atEnd = pos.s === slides.length - 1 && (flat || pos.k === slide.steps - 1);

  const tr = TRANSITIONS[slide.transition] || TRANSITIONS.rise;
  const from  = reduced ? { opacity: 0 } : tr.from;
  const enter = reduced ? { opacity: 1 } : tr.enter;
  const exit  = reduced ? { opacity: 0 } : tr.exit;

  return (
    <div className={"deck" + (menuOpen ? " is-menu" : "")}>
      <div
        className="stage"
        id="stage"
        onClick={(e) => {
          if (!e.target.closest(".chrome, .navbtn, .chrome-controls, a, button, .no-advance")) {
            go(e.clientX < window.innerWidth / 2 ? -1 : 1);
          }
        }}
      >
        <LayoutGroup>
          <AnimatePresence initial={false}>
            <motion.div
              key={slide.id}
              className="slide-layer"
              style={{ position: "absolute", inset: 0 }}
              initial={from}
              animate={enter}
              exit={exit}
              transition={reduced ? { duration: 0 } : SLIDE_IN}
            >
              <View step={pos.k} />
            </motion.div>
          </AnimatePresence>

          <div className="chrome">
            <div className="chrome-left">
              <button
                className="navbtn navbtn--menu"
                type="button"
                aria-expanded={menuOpen}
                aria-haspopup="dialog"
                onClick={(e) => { e.stopPropagation(); toggleMenu(); }}
              >
                <span aria-hidden="true">☰</span>
                <span className="sr-only">{menuOpen ? menuText.closeLabel : menuText.openLabel}</span>
              </button>
              <span className="chrome-label">{slide.label}</span>
              {showDock && (
                <Morph id={dock.id} style={{ display: "inline-block" }}>
                  {dock.chip}
                </Morph>
              )}
              {/* Beat dots live in the LEFT cluster: it grows rightward into
                  empty canvas, so a changing dot count moves nothing else. */}
              {slide.steps > 1 && !flat && (
                <span className="dots" aria-hidden="true">
                  {Array.from({ length: slide.steps }, (_, i) => (
                    <span key={i} className={"dot" + (i <= pos.k ? " is-on" : "")} />
                  ))}
                </span>
              )}
            </div>
            <div className="chrome-right">
              {controls && <span className="chrome-controls">{controls}</span>}
              <span className="counter">{pad(pos.s + numberFrom)} / {pad(lastNumber)}</span>
              <span className="sr-only" role="status">
                Slide {pos.s + numberFrom} of {lastNumber}
                {flat ? "" : `, step ${pos.k + 1} of ${slide.steps}`}. {slide.label}.
              </span>
              <button className="navbtn" type="button" aria-label="Previous beat"
                disabled={menuOpen || atStart}
                onClick={(e) => { e.stopPropagation(); go(-1); }}>‹</button>
              <button className="navbtn" type="button" aria-label="Next beat"
                disabled={menuOpen || atEnd}
                onClick={(e) => { e.stopPropagation(); go(1); }}>›</button>
            </div>
          </div>
        </LayoutGroup>

        <AnimatePresence>
          {menuOpen && (
            <Menu
              slides={slides}
              numberFrom={numberFrom}
              current={pos.s}
              cursor={cursor}
              setCursor={setCursor}
              text={menuText}
              onPick={(i) => { jump(i); setMenuOpen(false); }}
              onClose={() => setMenuOpen(false)}
            />
          )}
        </AnimatePresence>

        <div className="progress" aria-hidden="true">
          <div className="progress-fill" style={{ width: (progress * 100) + "%" }} />
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   PRINT SHEET — every slide, statically, at its final beat
   ============================================================ */
function PrintSheet({ slides }) {
  return (
    <StaticCtx.Provider value={true}>
      <div className="printsheet">
        {slides.map((s) => {
          const View = s.view;
          return <View key={s.id} step={s.steps - 1} />;
        })}
      </div>
    </StaticCtx.Provider>
  );
}

/* ============================================================
   MOUNT
   ============================================================ */
export function validateManifest(slides) {
  const ids = new Set();
  for (const s of slides) {
    if (!s.id || !s.view || !(s.steps >= 1)) throw new Error(`manifest entry ${JSON.stringify(s.id)} needs id, view and steps >= 1`);
    if (ids.has(s.id)) throw new Error(`manifest has duplicate slide id "${s.id}"`);
    if (s.transition && !TRANSITIONS[s.transition]) throw new Error(`slide "${s.id}": unknown transition "${s.transition}" (one of ${TRANSITION_NAMES.join(", ")})`);
    ids.add(s.id);
  }
}

export function mountDeck({ slides, dock = null, meta = {}, controls = null, menu = null, numberFrom = 1, useFlat = FIXED }) {
  validateManifest(slides);
  const resolved = resolveDock(slides, dock);
  const totalBeats = slides.reduce((n, s) => n + s.steps, 0);
  if (meta.title) document.title = meta.title;

  const App = () => (
    <>
      <Deck slides={slides} dock={resolved} totalBeats={totalBeats} controls={controls} menu={menu} numberFrom={numberFrom} useFlat={useFlat} />
      <PrintSheet slides={slides} />
    </>
  );
  createRoot(document.getElementById("root")).render(<App />);
}
