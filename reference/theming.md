# Theming and fonts

The look is two files: `src/theme.css` (tokens) and `deck.config.js` (typefaces).
`src/framework/base.css` reads only tokens, so a re-skin never touches it.

**Which** palette and typefaces to use is decided with the user, not here — the
options, the ask/confirm protocol and the contrast floors are in
`reference/looks.md`. This file is how the machinery works once they are chosen.

## Tokens (`src/theme.css`)

Two palettes, each a full set of `--light-*` / `--dark-*`:

| token | used for |
|---|---|
| `bg`, `bg-raised` | slide ground; cards, panels, chrome buttons |
| `line` | hairlines, dividers, the progress track |
| `fg`, `fg-dim`, `fg-muted` | primary, secondary, caption type |
| `accent`, `accent-dim`, `accent-wash` | the one signal colour; its hairline; its panel tint |
| `letterbox` | the ground around the scaled stage |
| `fig-ground`, `fig-panel`, `fig-line`, `fig-block` | the figure ramp for line art (3:1+ against `bg`) |

`base.css` maps them onto the live `--bg`, `--fg`, `--accent`… from `<html data-theme>`.
Inside `@media print` the `theme.print` palette from the config is mapped on top, so the
handout is one palette whatever is on screen.

Then the type scale (`--t-display … --t-giant`), line metrics (`--lh-*`, `--ls-*`),
weights (`--w-read/emph/ann`), spacing (`--s1 … --s8`, multiples of 8) and `--radius`.

Contrast: body type ≥ 4.5:1, accent on bg ≥ 3:1 for non-text (≥ 4.5:1 if it carries
words). Line art uses the `fig-*` ramp, never `line`/`bg-raised` — a divider-strength
hairline disappears on a projector.

## Typefaces (`deck.config.js`)

```js
fonts: {
  display: "Syne", text: "DM Sans", mono: null,
  families: [
    { family: "Syne",    google: "Syne:wght@500;700" },
    { family: "DM Sans", google: "DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700" },
    // or a licensed local file:
    // { family: "Söhne", file: "fonts/soehne.woff2", weights: "400 700" }
  ],
  scripts: []       // "sc" "tc" "jp" "kr" "thai" "arabic" "devanagari" — see i18n.md
}
```

`display`, `text` and `mono` each take one family name, a **list** of family names (a
system stack — `["Iowan Old Style", "Palatino", "Georgia"]`; CSS keywords such as
`system-ui` are emitted unquoted), or `null` for the built-in fallback. With
`families: []` nothing is embedded: `bun run fonts` writes an empty `src/fonts.css`,
the deck is ~330 KB smaller, and the build warns and skips the glyph-coverage check
because the faces now come from the viewer's OS — which also means the deck sets
differently on every machine. See `reference/looks.md`.

`bun run fonts` fetches the Latin subset of each Google family and embeds it in
`src/fonts.css` as base64 (needs network once; commit the result). The build injects
`--font-display / --font-text / --font-mono` from `display / text / mono`, each followed
by every `scripts` face and a system fallback — so Latin inside Chinese copy still sets
in the display face, because the Noto faces declare disjoint `unicode-range`s.

Why embedded: `@font-face` fetches are blocked over `file://` exactly like ES modules,
so a linked font silently falls back to Georgia in a room with no wifi. Check the
licence before embedding a non-Google face.

Default budget: the two default families are ~330 KB of base64. A variable family
with an `opsz` axis is the largest kind; static weights are smaller.

## Deck-only CSS

`src/deck.css` is appended after `theme.css` if it exists. Prefix classes (`.mt-…`)
so nothing collides with the pattern library. Any rule for flow mode goes inside
`@media screen and (orientation: portrait)` **and** is prefixed
`:root[data-layout="flow"]` — the attribute carries the specificity needed to beat the
per-language overrides.

## Per-language metrics

Tune tokens under `:root[lang="…"]` (in `deck.css`), never per-slide sizes and never
copy. `base.css` already loosens leading and zeroes tracking for `th`, `zh-Hans`,
`zh-Hant`, `ja`, `ko`.

## Proving a theme change

Read computed values back in both themes rather than reasoning about the cascade:
`getComputedStyle(el).backgroundColor` on the real element with `data-theme` set to
each option. A fix in one theme is not done until the other is proved unchanged.
