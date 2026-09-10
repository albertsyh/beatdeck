# Choosing the look

A deck's palette and typefaces are the two decisions the copy cannot make for you, and
the two the template silently makes if nobody asks. **Never ship the default just
because nobody named one.** Settle both before writing `src/deck.jsx`, using one of the
three paths below.

## 1. The user named a look

Brand colours, a hex, "something in green", a typeface, "match our website" — take it,
say what you took, and build. Run the palette through the contrast floors below before
you commit to it; a brand green is often fine for a heading and not for body copy.

## 2. The user named nothing — ask

One `AskUserQuestion` call, both questions together, before any code. Offer the
catalogue below (name + one-line character, not hex codes) and say what the default is.
Do not ask a third question about the look; anything finer is settled by looking at the
built deck.

## 3. The user pointed at an existing deck, PDF or site — extract, then CONFIRM

Read the source, write down what you found, and **put it back to the user before
building**:

> From the PDF: ground near-white `#FFFFFF`, body near-black, one accent `#B4430A`
> (orange-red, used on rules and figure numbers), display face a geometric sans
> (Futura-like), body a humanist sans. I'd set Space Grotesk + Inter, which are close
> and embeddable. Use these, or adjust?

Three reasons this is a confirmation and not an inference:

- **A PDF's colours are not a palette.** It has one ground; the deck needs two (light
  and dark), plus the whole `fig-*` ramp and `accent-dim`/`accent-wash` that the source
  never had. You are inventing most of it, so the part you did read should be agreed.
- **The face is usually unavailable.** A licensed corporate face cannot be embedded
  without the licence, so what you are actually proposing is a *near* face. Name the
  substitution rather than shipping it quietly.
- **A deck is not always meant to match.** "Follow this deck" often means the structure
  and the argument, not the brand.

## Palettes

Paste into `src/theme.css` over the `--light-*` / `--dark-*` block. Ratios are measured
against that palette's own `--bg`.

### Paper — warm off-white, teal signal (the template default)
Editorial and quiet; the accent reads as ink rather than as UI.
Already in `src/theme.css`. Light `bg #FBFAF7` · `accent #146C66` (5.98:1) ·
dark `bg #12151A` · `accent #5FD3C7` (10.13:1).

### Slate — cool grey, blue signal
Neutral and institutional. The safest choice for a room you have not seen.

```css
  --light-bg: #F7F8FA;  --light-bg-raised: #EBEEF3;  --light-line: #D3D8E0;
  --light-fg: #12161C;        /* 17.08:1 */
  --light-fg-dim: #3B434E;    /*  9.42:1 */
  --light-fg-muted: #666E7A;  /*  4.85:1 */
  --light-accent: #1D5FD0;    /*  5.49:1 */
  --light-accent-dim: #A9C2ED;  --light-accent-wash: #E4ECFB;  --light-letterbox: #E3E7ED;
  --light-fig-ground: #FFFFFF;  --light-fig-panel: #E7EBF1;
  --light-fig-line: #868F9C;  /*  3.08:1 */
  --light-fig-block: #6F7885; /*  4.20:1 */

  --dark-bg: #0F1319;   --dark-bg-raised: #191F27;   --dark-line: #2B333E;
  --dark-fg: #EEF1F5;         /* 16.44:1 */
  --dark-fg-dim: #C0C7D1;     /* 10.94:1 */
  --dark-fg-muted: #89919D;   /*  5.85:1 */
  --dark-accent: #77A9FF;     /*  7.90:1 */
  --dark-accent-dim: #2C4E86;   --dark-accent-wash: rgba(119,169,255,.10);  --dark-letterbox: #080A0E;
  --dark-fig-ground: #191F27;   --dark-fig-panel: #2A323C;
  --dark-fig-line: #5C6675;   /*  3.20:1 */
  --dark-fig-block: #7A8390;  /*  4.86:1 */
```

### Signal — pure white / near black, warm orange
High contrast and loud. Good on a bad projector; unforgiving of a busy slide.

```css
  --light-bg: #FFFFFF;  --light-bg-raised: #F2F2F0;  --light-line: #DCDCD8;
  --light-fg: #0B0B0A;        /* 19.69:1 */
  --light-fg-dim: #3A3A38;    /* 11.40:1 */
  --light-fg-muted: #66665F;  /*  5.78:1 */
  --light-accent: #B4430A;    /*  5.60:1 */
  --light-accent-dim: #EFB48F;  --light-accent-wash: #FBEBE0;  --light-letterbox: #E8E8E5;
  --light-fig-ground: #FFFFFF;  --light-fig-panel: #EDEDEA;
  --light-fig-line: #8C8C86;  /*  3.38:1 */
  --light-fig-block: #70706A; /*  4.98:1 */

  --dark-bg: #0A0A0A;   --dark-bg-raised: #161615;   --dark-line: #2C2C2A;
  --dark-fg: #F5F5F2;         /* 18.13:1 */
  --dark-fg-dim: #C6C6C1;     /* 11.55:1 */
  --dark-fg-muted: #8E8E88;   /*  6.01:1 */
  --dark-accent: #FF9250;     /*  8.94:1 */
  --dark-accent-dim: #7A4520;   --dark-accent-wash: rgba(255,146,80,.10);  --dark-letterbox: #000000;
  --dark-fig-ground: #161615;   --dark-fig-panel: #282826;
  --dark-fig-line: #5E5E59;   /*  3.04:1 */
  --dark-fig-block: #7C7C76;  /*  4.72:1 */
```

### Oxblood — cream, deep red
Warm and formal. Reads as a printed programme rather than as software.

```css
  --light-bg: #FCF9F4;  --light-bg-raised: #F2ECE1;  --light-line: #DED5C6;
  --light-fg: #1A1512;        /* 17.24:1 */
  --light-fg-dim: #463C34;    /* 10.22:1 */
  --light-fg-muted: #6F6459;  /*  5.49:1 */
  --light-accent: #9B2226;    /*  7.54:1 */
  --light-accent-dim: #DCA9A6;  --light-accent-wash: #F6E6E4;  --light-letterbox: #EBE4D8;
  --light-fig-ground: #FFFFFF;  --light-fig-panel: #EFE8DC;
  --light-fig-line: #948A7C;  /*  3.23:1 */
  --light-fig-block: #786E61; /*  4.76:1 */

  --dark-bg: #16110F;   --dark-bg-raised: #211A17;   --dark-line: #372D28;
  --dark-fg: #F4EFE8;         /* 16.37:1 */
  --dark-fg-dim: #CBC1B6;     /* 10.56:1 */
  --dark-fg-muted: #948A7E;   /*  5.53:1 */
  --dark-accent: #F08C86;     /*  7.85:1 */
  --dark-accent-dim: #71322F;   --dark-accent-wash: rgba(240,140,134,.10);  --dark-letterbox: #0C0908;
  --dark-fig-ground: #211A17;   --dark-fig-panel: #31281F;
  --dark-fig-line: #6F6256;   /*  3.17:1 */
  --dark-fig-block: #877A6C;  /*  4.49:1 */
```

Floors any new palette must clear (`fg-*`, `accent`, `fig-*` against `bg`, both themes):
`fg` ≥ 12:1 · `fg-dim` ≥ 8:1 · `fg-muted` ≥ 4.5:1 · `accent` ≥ 4.5:1 (it carries words —
figure numbers, `is-accent` headings) · `fig-line` and `fig-block` ≥ 3:1. `line`,
`bg-raised`, `accent-dim` and `accent-wash` are deliberately below that: they are
grounds and hairlines, and a divider at 3:1 looks like a rule.

## Typefaces

Paste into `deck.config.js`, then `bun run fonts` (network once; commit `src/fonts.css`).

### Syne + DM Sans — the template default. Geometric display with real personality, neutral text.
```js
  display: "Syne", text: "DM Sans", mono: null,
  families: [
    { family: "Syne",    google: "Syne:wght@500;700", weights: "500 700" },
    { family: "DM Sans", google: "DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700", weights: "400 700" }
  ],
```

### Fraunces + Inter — editorial. A serif display that photographs well, the most neutral text face there is.
```js
  display: "Fraunces", text: "Inter", mono: null,
  families: [
    { family: "Fraunces", google: "Fraunces:opsz,wght@9..144,600;9..144,700", weights: "600 700" },
    { family: "Inter",    google: "Inter:wght@400;500;700", weights: "400 700" }
  ],
```

### Space Grotesk + IBM Plex Sans — technical. Reads as engineering without reading as a terminal.
```js
  display: "Space Grotesk", text: "IBM Plex Sans", mono: "IBM Plex Mono",
  families: [
    { family: "Space Grotesk", google: "Space+Grotesk:wght@500;700", weights: "500 700" },
    { family: "IBM Plex Sans", google: "IBM+Plex+Sans:wght@400;600", weights: "400 600" },
    { family: "IBM Plex Mono", google: "IBM+Plex+Mono:wght@400", weights: "400" }
  ],
```

### System stack — nothing embedded. A serif display against the OS UI sans.
```js
  display: ["Iowan Old Style", "Palatino Linotype", "Palatino", "Georgia"],
  text: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica Neue"],
  mono: null,
  families: [],
```

A role takes one family name, a **list** (a system stack is a stack by nature), or
`null` for the built-in fallback. CSS keywords in a list are emitted unquoted.

**What the system stack costs.** It saves ~330 KB and the `bun run fonts` step, and it
is the only choice that never needs the network. In exchange the deck **sets differently
on every machine** — a Mac, a Windows laptop and the venue's Linux box each pick a
different display face, so line breaks move and a title that fitted may not. The build
says so and skips the glyph-coverage check, because the faces are the viewer's OS and
this build cannot enumerate them. Pick it when the deck will only ever be read on
machines you control, or when the file size genuinely matters; otherwise embed.

Non-Latin copy is a separate axis: `fonts.scripts` + `bun run fonts:subset`, and it is
required whichever pairing you choose — see `reference/i18n.md`.
