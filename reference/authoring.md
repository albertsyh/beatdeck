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

## Images and video

```js
import photo from "./assets/photo.jpg";   // inlined as a data URI by the build
<img className="shot" src={photo} alt="…" />
```

Limits: 300 KB warns, 1 MB fails, 4 MB per deck fails. Video: `.mp4` H.264 only
(`ffmpeg -vf scale=540:-2 -c:v libx264 -crf 32 -c:a aac -b:a 48k -ac 1`), 3 MB per file.

## In-slide controls

The stage advances a beat on any click it does not recognise. It ignores `.chrome`,
`.navbtn`, `.chrome-controls`, `a`, `button` and `.no-advance`; for anything else call
`e.stopPropagation()`. A control that opens an overlay must also close it (toggle from
the overlay's live state), the overlay needs its own close control, and Escape should
dismiss it. Canvas-only `z-index` lifts above 5 must be reset in flow.

## Keyboard

`→ ↓ Space Enter PageDown` next beat · `← ↑ Backspace PageUp` previous ·
`Home`/`R` first · `End` last · `M` contents · `F` fullscreen · `L` language · `T` theme.
Keys are ignored while an input is focused and when a modifier is held.
