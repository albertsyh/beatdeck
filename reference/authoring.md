# Authoring slides

## State is a pair

```js
{ s: slideIndex, k: beatIndex }
```

`step(slides, pos, dir, flat)` in `primitives.jsx` owns navigation. Forward spends a
slide's beats, then advances. **Backward lands on the last beat of the previous
slide**, so `←` then `→` is a round trip. The URL hash `#12.3` (1-based) is synced
both ways. `numberFrom` is what the first slide is called (default 1; pass 0 when
slide 1 is a landing page that should not be page 1 of the PDF).

## A slide component

Receives `step` (0-based). Returns `<div className="slide">…</div>`. Reads copy through
`useStrings()` — both render trees subscribe, so the PDF exports in the language on
screen.

```jsx
function Compare({ step }) {
  const t = useStrings().compare;
  return (
    <div className="slide">
      <Signal />
      <p className="kicker">{t.kicker}</p>
      <h2 className="title">{rich(t.title)}</h2>
      <hr className="rule" />
      <div className="split">
        <div>
          <h3 className="panel-h">{t.left.h}</h3>
          <ul className="panel-list">
            {t.left.items.map((s, i) => <Reveal key={i} show={step >= i}><li>{rich(s)}</li></Reveal>)}
          </ul>
        </div>
        <div>
          <h3 className="panel-h is-accent">{t.right.h}</h3>
          <Reveal show={step >= t.left.items.length} effect="scale">
            <p className="takeaway">{rich(t.right.body)}</p>
          </Reveal>
        </div>
      </div>
    </div>
  );
}
```

Manifest: `{ id: "compare", label: <Label id="compare" />, steps: t.left.items.length + 1, view: Compare }`
— and write the assertion that keeps `steps` equal to that length in every language.

## Beats

- `<Reveal show={step >= n} effect="…" delay={s}>` — keeps its layout box. Effects:
  `rise` `fade` `drop` `slide` `scale` `blur`. Under `StaticCtx` it renders a plain
  div; under reduced motion it cuts.
- `<Stagger show gap={0.08} effect>` — children arrive one after another on one beat.
- `<Bar w={px} accent show />` — a comparison bar that grows.
- Keep it to what the talk needs: one idea per slide, beats that land as you say them.
  A slide with six beats that reveal nothing new reads as a dead keyboard.

## Slide transitions

Per manifest entry: `transition: "rise" | "fade" | "slide" | "zoom" | "none"`.
Reduced motion collapses all of them to a cut.

## Shared elements

`<Morph id="panel">` on two **consecutive** slides flies the element between them
(Motion `layoutId`). Hard rule: back-to-back. The `signal` mark already does this on
every slide.

For a gap, dock it:

```js
export const DOCK = { id: "figure", from: "intro", release: "payoff", chip: <Chip /> };
```

The chip rides the chrome from `from` up to `release`, whose own `Morph id="figure"`
takes it on its first beat. Ids, not indices — a reorder fails at mount, not silently.
Never insert a slide between `from` and `release` unless it should also show the chip.
In flow mode (phone) the chip is not rendered: `useFlat` says there are no beats to
carry it across.

## The manifest

```js
const MANIFEST = [
  { id: "cover", label: <Label id="cover" />, steps: 2, view: Cover },
  { id: "why",   label: <Label id="why" />,   steps: 3, view: Why, transition: "fade",
    group: <Heading id="part1" /> },            // starts a group in the contents menu
];
export const SLIDES = withFlat(MANIFEST, useFlow);
```

- `id` unique, code only. It keys the slide transition and the dock.
- `steps` = highest `step >= n` + 1. Forgetting to bump it makes content unreachable.
- `label` is a node (`<Label id>`), so the chrome and the contents menu follow the
  language for free.
- `withFlat` wraps multi-beat views so they render whole in flow mode.
- `menuMark: ({ go }) => node` (optional) puts a small control at the right end of the
  entry in the contents menu, beside the item button (never inside it). `go()` jumps
  to that slide and closes the menu. The menu's arrow keys move between entries only;
  Tab and click reach the mark. `quizMark(id, label)` is the ready-made one: a `?` that
  jumps there and opens the slide's `<Quiz id>`.

## The chrome band

The bar at the foot of every slide — menu button, label, beat dots, controls, counter,
arrows — is **not part of the slide**. It is one `.chrome` inside `.stage`, drawn over
whichever slide is showing, `left/right: var(--margin)`, `bottom: 40px`, 44px tall. The
canvas is 1080 tall, so it occupies roughly **y 990–1040**, and it is *wider on some
slides than others*: the left cluster grows with the slide's label (per language) and
with one dot per `step`.

A slide's own bottom padding is `var(--margin)` (96px), which stops flowed content at
y 984 — six pixels clear. So **normally flowed copy can never reach the bar**, and copy
that does is always copy that left the flow:

```jsx
/* wrong — the source line lands on the label and the dots */
<p className="src" style={{ position: "absolute", left: 96, bottom: 52 }}>Source: …</p>

/* right — a footnote is the last thing in the flow */
<div className="spacer" />
<p className="src">Source: …</p>
```

- Put a source line, a footnote or a credit **in the flow**, at the end of the slide,
  after a `.spacer`. It then sits above the padding edge by construction.
- Absolute positioning inside a slide is for figures, not for copy. If you must, keep
  it above `y 940` or outside the label's reach — and remember the label is longer in
  some languages than in the one you are looking at.
- Anything that deliberately runs under the bar (a full-bleed `.ground`, a hero image)
  is fine and is not flagged. Deliberate *copy* under the bar gets `.over-chrome`,
  which is the opt-out `check:layout` honours.
- `bun run check:layout` measures the real bar on the live deck and fails on a hit;
  see `reference/publishing.md`.

## The print tree

`PrintSheet` renders every slide at `steps - 1` under `StaticCtx.Provider value={true}`.
`Reveal`/`Morph`/`Bar` render plain elements there. CSS shows it under `@media print`
with `@page { size: 1920px 1080px }`, so print is pixel-identical to screen.

- A view that returns `null` under `useStatic()` produces **no page** (a landing slide
  with only switches and a download button should).
- Anything that loops or simulates (video, canvas, WebGL) needs a static alternative
  under `useStatic()`; prefer *not printing it* (return the still) over freezing it.
- `useStatic()` is also how a screen-only control (a download button) stays out of
  the handout.
- **The print sheet is always mounted**, not only while printing: every slide exists
  twice, once hidden under `StaticCtx`. A component that listens for a global event
  (`window` listener, custom event) or takes a module-level request ("open the quiz
  once we land") must bail out when `useStatic()` is true. Otherwise the hidden print
  copy takes the request first and the visible slide never sees it.

## Images and video

```js
import photo from "./assets/photo.jpg";   // inlined as a data URI by the build
<img className="shot" src={photo} alt="…" />
```

Limits: 300 KB warns, 1 MB fails, 4 MB per deck fails. Video: `.mp4` H.264 only
(`ffmpeg -vf scale=540:-2 -c:v libx264 -crf 32 -c:a aac -b:a 48k -ac 1`), 3 MB per file.

**No `mix-blend-mode` to drop a white background.** `multiply` on an image flickers on
slide transitions: while the slide layer animates, the image blends against the
transparent layer and the white shows, then snaps away once it settles. Use an asset
with a transparent background instead.

## In-slide controls

The stage advances a beat on any click it does not recognise. It ignores `.chrome`,
`.navbtn`, `.chrome-controls`, `a`, `button` and `.no-advance`; for anything else call
`e.stopPropagation()`. A control that opens an overlay must also close it (toggle from
the overlay's live state), the overlay needs its own close control, and Escape should
dismiss it. Canvas-only `z-index` lifts above 5 must be reset in flow.

## Quiz

`<Quiz>` is a ready-made in-slide overlay: a button on the slide toggles a quiz over
it, one question at a time, the answer behind a tap. The room calls it out, then you
check.

```jsx
function Paste({ step }) {
  const t = useStrings().paste;
  return (
    <div className="slide">
      …
      <Quiz id="paste" text={t.quiz.text}
        questions={QUIZ_ORDER.map(([kind, i]) => ({
          q: rich(t.quiz[kind][i].q),
          a: <><b>{t.quiz.verdicts[kind]}</b> {rich(t.quiz[kind][i].why)}</>,
          kind
        }))} />
    </div>
  );
}
// manifest: { id: "paste", …, menuMark: quizMark("paste", <Label id="pasteQuiz" />) }
```

- `questions`: `[{ q, a, kind? }]`, shown in the given order. `q` and `a` are nodes.
  `kind` is code (never copy) and adds `quiz-a--<kind>` to the answer for styling.
  Keep the order in code; if the copy groups cases, assert at import that the order
  lists each case exactly once, the same way `steps` is checked.
- `text`: `{ open, title, hint, tap, close }` as nodes from the strings. The defaults
  are English.
- `id` links it to `quizMark(id)` in the manifest and to `openQuiz(id)`. Unique per deck.
- Behaviour: the open button toggles; ×, Escape and the backdrop close. While it is
  open no key reaches the deck, so nothing changes slide behind it; ← → ↑ ↓ PageUp/Down
  Home End move between questions, and Space/Enter on the focused card reveal. The
  answer keeps its space, so the card never changes height. The number bar has equal
  columns, up to 10 in a row (5 on a phone).
- Not in print or the PDF (it renders nothing under `useStatic()`).
- The button sits top right of the slide (`.quiz-open`); move it in the deck's CSS if
  the title runs there. On a phone it joins the flow and the quiz is fixed to the screen.

## Keyboard

`→ ↓ Space Enter PageDown` next beat · `← ↑ Backspace PageUp` previous ·
`Home`/`R` first · `End` last · `M` contents · `F` fullscreen · `L` language · `T` theme.
Keys are ignored while an input is focused and when a modifier is held.
