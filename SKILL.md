---
name: beatdeck
description: >
  Use when asked to "make a slide deck", "build a presentation", "create slides",
  "turn this into a talk", "HTML slides", "multilingual deck", "publish my deck", or
  to edit/extend an existing beatdeck project (one with deck.config.js and
  src/framework/primitives.jsx). Builds decks as React + Motion apps that compile to
  ONE self-contained HTML file (opens by double-click, no server, no network) with
  beat-by-beat reveals, shared-element morphs, a contents menu, keyboard shortcuts,
  runtime language and light/dark switching, a phone-friendly portrait reflow,
  pixel-identical PDF export per language x theme, user-defined fonts and theme
  tokens, and one-command publishing to here.now.
---

# beatdeck

*Presentations, beat by beat.*

**Skill version: 0.4.2** · source: [github.com/albertsyh/beatdeck](https://github.com/albertsyh/beatdeck) · install or refresh: `npx skills add albertsyh/beatdeck`

A deck is a small React app: slide components + a manifest of `{ id, label, steps, view }`.
`bun run build` compiles it to `<name>.html`, one file with React, Motion, fonts and
images inlined. A **beat** is one keypress inside a slide; a slide declares how many it
has, and forward navigation spends them before moving on.

The framework ships in `template/` and is copied into every project. Everything below
assumes you are inside a project (there is a `deck.config.js`).

## 0. Start a project

```bash
bun <this-skill>/scripts/init.mjs ../my-talk --name my-talk --title "My talk"
cd ../my-talk && bun run build        # → my-talk.html; open it
```

`init.mjs` copies `template/`, stamps the name, installs deps, writes `AGENTS.md`
(plus a `CLAUDE.md` that imports it), and copies this file and `reference/` into
`<project>/docs/beatdeck`, so an agent opening
the folder later has the conventions even where beatdeck is not installed.
Requires [bun](https://bun.sh). Chrome is needed only for `check:layout`/handouts.

## 1. The workflow

1. **Settle the look — do not default into it.** Palette and typefaces are the user's
   call, and the template's defaults are a choice nobody made.
   - Told which (a brand, a hex, a face): use it, say what you used.
   - Told nothing: **ask, before writing code** — one `AskUserQuestion` with both
     questions, offering the named palettes and pairings in `reference/looks.md`
     (Paper / Slate / Signal / Oxblood; Syne+DM Sans / Fraunces+Inter / Space
     Grotesk+IBM Plex / a system stack that embeds nothing). Name the default.
   - **Asked to follow an existing deck, PDF or site: extract, then CONFIRM before
     building.** You are inventing most of it — a PDF has one ground, the deck needs
     two plus the whole `fig-*` ramp — and a licensed corporate face can only be
     matched by a near substitute, which the user should get to reject. Put the
     colours, the accent and the proposed faces back to them in one message.
2. **Copy first.** Write `src/strings/en.js`: `meta`, `ui`, `labels` (one per slide id),
   then one key per slide. Arrays are beats: three `items` = a three-beat slide.
3. **Structure.** In `src/deck.jsx` write one component per slide and list it in
   `MANIFEST` with `steps` equal to the highest `step >= n` used, plus one. Add an
   assertion that array lengths match `steps` (the template shows how).
4. **Look.** Apply what step 1 settled: tokens in `src/theme.css` (two palettes, type
   scale, spacing, radius); typefaces in `deck.config.js` → `bun run fonts` (network,
   once, commit the result). Deck-only CSS goes in `src/deck.css` (auto-appended if
   present). Never viewport units, never per-slide magic sizes.
5. **Build.** `bun run build`. The build refuses: duplicate/missing ids, a code-split
   bundle, an image > 1 MB or > 4 MB total, HEVC video, a character no embedded font
   covers, a language whose shape differs from the default.
6. **Check.** `bun run check:layout` writes `layout-check/<name>-<lang>-<theme>.pdf`
   and fails on overflow, and on copy that lands on the chrome. Look at the PDF;
   passing means nothing spilled, not that the right thing is on the page.
7. **Publish.** `bun run publish` = build → handouts → `dist/` → here.now. Then pin the
   printed slug in `deck.config.js publish.slug` so later publishes update the same URL.

Hand the user the commands to run; a build on your side is the verify step.

## 2. What a slide looks like

```jsx
function Why({ step }) {
  const t = useStrings().why;                       // copy for the language on screen
  return (
    <div className="slide">
      <Signal />                                      {/* the accent mark, morphs between slides */}
      <p className="kicker">{t.kicker}</p>
      <h2 className="title title--wide">{rich(t.title)}</h2>
      <hr className="rule" />
      <Reveal show={step >= 0} effect="slide"><p className="body">{rich(t.a)}</p></Reveal>
      <Reveal show={step >= 1} effect="blur"><p className="takeaway">{rich(t.b)}</p></Reveal>
    </div>
  );
}
// manifest: { id: "why", label: <Label id="why" />, steps: 2, view: Why, transition: "fade" }
```

- `Reveal` effects: `rise` (default) `fade` `drop` `slide` `scale` `blur`. `Stagger`
  reveals children one after another on one beat. `Bar` grows a comparison bar.
- Slide `transition`: `rise` (default) `fade` `slide` `zoom` `none`.
- `Morph id="x"` on two **consecutive** slides flies the element between them. For a
  gap, use `DOCK = { id, from, release, chip }` — the chip rides the chrome between.
- `rich()` handles `**bold**`, `_italic_`, `[[slot for the speaker]]`, `\n`. Nothing else.
- Pattern classes (all token-driven): `.cover`, `.stack/.item`, `.split/.panel-list`,
  `.grid-2/3/4 .card`, `.giant`, `.quote`, `.bars`, `.chips`, `.takeaway`, `.btn`, `kbd`.
- `group: <node>` on a manifest entry starts a section in the contents menu.
- `numberFrom: 0` on `mountDeck` if slide 1 is front matter that should not be page 1.

## 3. Rules that keep it working

- **`<name>.html` is generated. Never edit it.**
- **Strings are never identifiers.** No value from `src/strings/` as a key, id, layoutId
  or manifest id. Structure lives in code so switching language cannot break a morph.
- **Reveals keep their box.** Hidden content stays in layout. Don't mount/unmount.
- **Both trees.** Anything animated must honour `useStatic()` (plain render for the
  print sheet) and `useReducedMotion()`. Canvas/WebGL needs a DOM fallback, and the
  fallback must be *generated* from the live thing, not drawn beside it.
- **Everything inline.** No external scripts, styles, fonts, images, `import()`. Images
  and `.mp4` (H.264 only) are imported from JSX and inlined. Links the viewer chooses
  to follow (a PDF, an email) are the only allowed URLs.
- **In-slide controls stop the click** (`e.stopPropagation()`), or a press also
  advances a beat. Native `a`/`button` and `.no-advance` are already ignored.
- **The look is asked for, never assumed.** No palette or typeface in the request means
  one `AskUserQuestion` before code; a deck to follow means confirming what you read out
  of it before code. `reference/looks.md` carries the options and the contrast floors.
- **The chrome is not part of the slide.** The bar (label, dots, controls, counter,
  arrows) is drawn over every slide across roughly `y 990–1040`, and the left cluster
  gets wider with a longer label or more beats. A source line or footnote goes at the
  END OF THE FLOW after a `.spacer`, never absolutely positioned into the bottom
  padding; `check:layout` fails on a hit, and `.over-chrome` is the opt-out.
- **A control that shows something also hides it**, from the target's live state.
- **A control whose label changes keeps one width** (stack labels in one grid cell,
  `visibility: hidden` the rest — never `min-width`).
- **After editing non-Latin copy run `bun run fonts:subset`**; list the script in
  `deck.config.js fonts.scripts` (`sc`, `tc`, `jp`, `kr`, `thai`, `arabic`, `devanagari`).
- **A phone change is not done until it is probed**: one chrome row at 320px in every
  language, a tap in the emptiest region advances, nothing paints over the fixed bar
  (`z-index` > 5 must reset under `:root[data-layout="flow"]`).
- Don't add speculative per-language CSS for languages the deck does not have.

## 4. Keys the deck answers to

`→ Space Enter PageDown` next beat · `← Backspace PageUp` back · `Home`/`End` ·
`M` contents · `F` fullscreen · `L` language · `T` theme · click left/right half ·
`#12.3` = slide 12 beat 3 · `?lang=th&theme=dark`.

## 5. References (read when the task touches them)

- `reference/authoring.md` — slides, beats, effects, morphs, dock, manifest, print tree
- `reference/looks.md` — **choosing** the palette and typefaces: the ask/confirm
  protocol, four palettes with measured contrast, four pairings incl. a system stack
- `reference/theming.md` — tokens, palettes, fonts, deck.css, contrast
- `reference/i18n.md` — adding a language, strings shape, fonts:subset, per-language metrics
- `reference/publishing.md` — check:layout, dist, here.now, slugs and handouts
- `reference/checks.md` — how to prove a change (print diff, flow probes, guard tests)
