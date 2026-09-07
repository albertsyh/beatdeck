/**
 * deck.config.js — the one place a deck says what it is.
 *
 * Read by build.mjs and every tool in tools/, and by src/deck.jsx. Plain
 * data, no imports, so Bun can load it without a DOM.
 */
export default {
  /* Output file: <name>.html at the project root, and dist/index.html. */
  name: "__DECK_NAME__",

  /* <title> and the heading in the generated file's header comment. */
  title: "__DECK_TITLE__",

  /* Languages live in src/strings/ (one module each + index.js). The
     default is what the deck opens in when nothing is stored or in the URL. */
  lang: { default: "en" },

  /* Themes the switch offers, in order, and the one the deck opens in.
     `print` is the palette the PDF uses whatever is on screen; set it to
     null to print whatever theme is showing. */
  theme: { options: ["light", "dark"], default: "light", print: "light" },

  /* TYPEFACES. `families` are fetched by `bun run fonts` (Google Fonts, Latin
     subset, embedded as base64 into src/fonts.css — run once, commit the
     result) or read from a local woff2 with `file:`. `display`, `text` and
     `mono` name which family plays which role; they arrive in CSS as
     --font-display / --font-text / --font-mono.

     `scripts` lists non-Latin faces to subset to exactly the characters the
     copy uses (`bun run fonts:subset`, needs a .venv with fonttools).
     Presets: "sc" (Simplified Chinese), "tc" (Traditional), "jp", "kr",
     "thai", "arabic", "devanagari". Or an object { family, file, url, pin }.
     The build fails naming any character no embedded face covers. */
  fonts: {
    display: "Syne",
    text: "DM Sans",
    mono: null,   /* null → system monospace stack */
    families: [
      { family: "Syne",    google: "Syne:wght@500;700", weights: "500 700" },
      { family: "DM Sans", google: "DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700", weights: "400 700" }
    ],
    scripts: []
  },

  /* PUBLISHING to here.now (`bun run publish`). The slug is filled in after
     the first publish so every later publish updates the SAME site — a new
     slug is a new address, and every link already handed out breaks.
     A PDF handout per language x theme is written by `bun run check:layout`
     and shipped at <site>/pdf/<name>-<lang>-<theme>.pdf. */
  publish: {
    slug: null,
    pdf: true
  }
};
