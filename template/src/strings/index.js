/**
 * The deck's languages. Add one: write <tag>.js against en.js (same keys,
 * same array lengths), import it here, add it to the object and the order.
 * The shape guard runs at import, so drift fails the build by path.
 * After adding non-Latin copy: `bun run fonts:subset` (and list the script
 * in deck.config.js fonts.scripts).
 */
import { defineLanguages } from "../framework/i18n.js";
import en from "./en.js";

export const { LANGS, LANG_ORDER, DEFAULT_LANG, allText } = defineLanguages(
  { en },
  { defaultLang: "en", order: ["en"] }
);
