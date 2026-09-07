# Proving a change

There is no test suite. `bun run build` proves the bundle is one file and the copy
is covered; `bun run check:layout` proves nothing overflows. Everything else is
proved by looking at rendered output, and these are the checks that have caught
real bugs.

## Diff rendered output, not the bundle

Minified bundles are useless to diff. Load the built HTML in Chrome (playwright-core,
`executablePath` = system Chrome), emulate print media, and compare the print sheet's
`innerText` and per-page screenshots against a build from before the change. Expect
sub-pixel text-shaping noise when a DOM change merges text nodes; identical
`innerText` means cosmetic.

The print sheet is `display:none` until print media is emulated:
`waitForSelector(".printsheet .slide", { state: "attached" })` → `emulateMedia({ media: "print" })`
→ wait for non-zero height. Waiting for visibility first just times out.

## A slide that changed what it draws

Look at the printed page, not just the screen — the two trees are independent, so a
slide can be right in the room and wrong in the handout for months.
`pdftoppm -png -r 60 -f N -l N layout-check/<file>.pdf out`; slide N is page N when
`numberFrom` is 1 (or when 0 and slide 0 prints nothing).

## A theme change

`getComputedStyle(el)` on the real element under each `data-theme`; a fix in one
theme is done when the other reads back unchanged. A transparent asset must be
checked against both grounds: `magick f.png -alpha extract -format "%[fx:mean]" info:`
returns 1 when every pixel is opaque — compare as a number.

## A flow-mode (phone) change — `check:layout` never renders it

Its page box is landscape, so it matches neither half of flow's condition. Probe with
playwright at 320 / 360 / 390 / 430 × every language:

- the chrome is **one row**: `new Set(rows.map(r => Math.round(r.top))).size === 1`,
  `chrome-left.left >= 0`, `chrome-right.right <= innerWidth` (overflow alone proves
  nothing — a wrapped bar has zero overflow);
- press the next button N times and assert the hash's slide number rises by one each
  time (the six-dead-taps bug);
- tap the emptiest region of every slide: `elementFromPoint` is inside `#stage` and
  the hash moved;
- hit-test the bar: `elementFromPoint` at its centre is inside `.chrome`, with any
  overlay closed; with it open, the overlay wins;
- cycle the language button in one session and assert its width and its neighbours'
  left edges never change;
- tap the gaps between chrome buttons: the hash must not move.

Set language via `?lang=` per load so each combination starts clean.

## A guard

Induce the failure it protects against, **confirm the bad state exists**, then read
the verdict. Two of the first attempts at breaking the layout checker were invalid —
one restored the file before measuring, one used a size that still fitted — and both
looked like the guard was broken. Never test a mutating step against real data.

## A perpetual animation

Anything that loops needs a headless proof it terminates or a static render that
sidesteps it. Keep the world in a pure module (seeded RNG, fixed timestep, no DOM) so
a script can run hundreds of rounds in bun; draw it in the component; return the
still under `useStatic()`.
