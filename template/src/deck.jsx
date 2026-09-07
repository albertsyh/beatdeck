/**
 * THE DECK — slide components, the manifest, and the mount.
 *
 * Copy lives in src/strings/<lang>.js and comes in through useStrings(),
 * so one file serves every language. Structure (slide ids, step counts,
 * morph ids) stays here, in code, so switching language cannot break it.
 *
 * Build: `bun run build` → <name>.html (name from deck.config.js).
 */
import { Reveal, Stagger, Morph, Signal, Bar, mountDeck, withFlat, useStatic } from "./framework/primitives.jsx";
import { createDeckControls } from "./framework/controls.jsx";
import { rich } from "./framework/rich.jsx";
import { useFlow } from "./framework/flow.js";
import * as strings from "./strings/index.js";
import config from "../deck.config.js";

/* Language + theme prefs, the switches in the chrome, and the hooks. */
const deck = createDeckControls({
  ns: config.name,
  strings,
  themes: config.theme.options,
  defaultTheme: config.theme.default,
  useFlow
});
const { useStrings, Label, LangTheme, MENU_TEXT, lang, theme } = deck;

/* The PDF handout for the language and theme on screen, relative to the
   published site (tools/publish.mjs ships them under pdf/). When the config
   pins a print palette there is one handout per language. */
const pdfHref = (l, t) => `pdf/${config.name}-${l}-${config.theme.print || t}.pdf`;

/* ============================================================
   SLIDES — each receives `step`, the current beat (0-based)
   ============================================================ */
function Cover({ step }) {
  const t = useStrings().cover;
  return (
    <div className="slide cover">
      <Signal w={64} h={10} />
      <p className="kicker">{t.kicker}</p>
      <h1 className="title">{rich(t.title)}</h1>
      <Reveal show={step >= 1} effect="fade">
        <p className="subhead">{rich(t.sub)}</p>
      </Reveal>
      <div className="cover-meta">
        <span className="cover-slot">{rich(t.by)}</span>
        <span className="cover-slot">{rich(t.where)}</span>
      </div>
    </div>
  );
}

function Points({ step }) {
  const t = useStrings().points;
  return (
    <div className="slide">
      <Signal />
      <p className="kicker">{t.kicker}</p>
      <h2 className="title title--wide">{rich(t.title)}</h2>
      <hr className="rule" />
      <div className="stack">
        {t.items.map((it, i) => (
          <Reveal key={i} show={step >= i} effect="slide">
            <div className="item">
              <span className="item-n">{i + 1}</span>
              <p className="item-t">{rich(it.h)}<span className="note">{rich(it.note)}</span></p>
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  );
}

function Close({ step }) {
  const t = useStrings();
  const l = lang.use(), th = theme.use();
  const isStatic = useStatic();
  return (
    <div className="slide">
      <Signal w={120} h={10} />
      <p className="kicker">{t.close.kicker}</p>
      <h2 className="title">{rich(t.close.title)}</h2>
      <p className="subhead">{rich(t.close.body)}</p>
      <div className="spacer" />
      <Reveal show={step >= 1} effect="scale">
        <p className="takeaway">{rich(t.close.takeaway)}</p>
      </Reveal>
      {/* the link is screen-only: a PDF offering a download of itself is noise */}
      {!isStatic && config.publish?.pdf && (
        <p style={{ marginTop: "var(--s5)" }}>
          <a className="btn" href={pdfHref(l, th)} download onClick={(e) => e.stopPropagation()}>{t.ui.download}</a>
        </p>
      )}
    </div>
  );
}

/* ============================================================
   MANIFEST — order, step counts, transitions, menu groups.
   `steps` must equal the highest `step >= n` used, plus one; for a slide
   driven by an array in the strings, that is the array's length.
   ============================================================ */
const MANIFEST = [
  { id: "cover",  label: <Label id="cover" />,  steps: 2, view: Cover },
  { id: "points", label: <Label id="points" />, steps: 3, view: Points, transition: "slide" },
  { id: "close",  label: <Label id="close" />,  steps: 2, view: Close,  transition: "fade" }
];

/* Manifest vs copy: an array length IS a step count. Checked at import, so
   build.mjs fails on a mismatch. */
for (const [tag, s] of Object.entries(strings.LANGS)) {
  const expect = { points: s.points.items.length };
  for (const m of MANIFEST) {
    if (expect[m.id] !== undefined && expect[m.id] !== m.steps) {
      throw new Error(`[${tag}] slide "${m.id}" has ${m.steps} steps but its copy has ${expect[m.id]} entries`);
    }
  }
}

/* On a phone in portrait every slide arrives whole and one press is one slide. */
export const SLIDES = withFlat(MANIFEST, useFlow);
export const DOCK = null;
export const meta = { title: config.title };

if (typeof document !== "undefined") {
  mountDeck({ slides: SLIDES, dock: DOCK, meta, controls: <LangTheme />, menu: MENU_TEXT, numberFrom: 1, useFlat: useFlow });
}
