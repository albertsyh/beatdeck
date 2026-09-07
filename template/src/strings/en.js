/**
 * English copy. Every other language file mirrors this shape exactly.
 *
 * Inline markers (src/framework/rich.jsx): **bold**, _italic_, [[slot the
 * speaker fills in]], and \n for a hard line break. Nothing else.
 *
 * RULES
 * - `ui` and `labels` are required by the framework.
 * - Array length is a slide's step count: `points` with three entries is a
 *   three-beat slide, and the manifest in src/deck.jsx must say steps: 3.
 * - No value here is ever used as an id, a key or a layoutId.
 */
export default {
  meta: { title: "__DECK_TITLE__" },

  ui: {
    langGroup: "Language",
    langNames: { en: "EN" },
    langFull: { en: "English" },
    themeGroup: "Theme",
    themeNames: { light: "Light", dark: "Dark" },
    themeFull: { light: "Light theme", dark: "Dark theme" },
    menu: { title: "Contents", hint: "M or Esc to close", openLabel: "Contents", closeLabel: "Close contents" },
    download: "Download the PDF"
  },

  /* chrome labels and contents-menu entries, keyed by slide id */
  labels: {
    cover: "Cover",
    points: "Three points",
    close: "Closing"
  },

  cover: {
    kicker: "A talk",
    title: "Write the title as a **conclusion**, not a label",
    sub: "One sentence under it that says why anyone should care.",
    by: "[[Your name]]",
    where: "[[Where and when]]"
  },

  points: {
    kicker: "The argument",
    title: "Three things to remember",
    /* one entry per beat */
    items: [
      { h: "The first point", note: "A line of support underneath it." },
      { h: "The second point", note: "Points land one keypress at a time." },
      { h: "The third point", note: "Everything is in the PDF, whether or not you pressed it." }
    ]
  },

  close: {
    kicker: "That is all",
    title: "Thank you",
    body: "Questions, contact details, a link — whatever the room needs next.",
    takeaway: "The one sentence you want them to **leave with**."
  }
};
