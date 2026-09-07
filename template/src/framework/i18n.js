/**
 * Languages, and the guard that keeps them in step.
 *
 * defineLanguages() runs at import — build.mjs imports src/strings/index.js
 * before bundling — so a translation that has drifted (a missing key, an
 * array that lost an entry, an empty string) FAILS THE BUILD naming the path,
 * instead of leaving a blank line to be discovered on stage.
 *
 * Array length is load-bearing: an array of beats IS a slide's step count,
 * so every language must have the same number of entries as the default.
 *
 * No React, no DOM: tools/subset-fonts.mjs and build.mjs import this too.
 */

function assertSameShape(ref, got, lang, path = "") {
  const where = path || "(root)";
  const join = (k) => (where === "(root)" ? k : `${where}.${k}`);
  if (Array.isArray(ref)) {
    if (!Array.isArray(got)) throw new Error(`[strings:${lang}] ${where} must be an array`);
    if (ref.length !== got.length) {
      throw new Error(`[strings:${lang}] ${where} has ${got.length} entries, the default language has ${ref.length}`);
    }
    ref.forEach((r, i) => assertSameShape(r, got[i], lang, `${where}[${i}]`));
    return;
  }
  if (ref && typeof ref === "object") {
    if (!got || typeof got !== "object" || Array.isArray(got)) throw new Error(`[strings:${lang}] ${where} must be an object`);
    for (const k of Object.keys(ref)) {
      if (!(k in got)) throw new Error(`[strings:${lang}] missing key ${join(k)}`);
      assertSameShape(ref[k], got[k], lang, join(k));
    }
    for (const k of Object.keys(got)) {
      if (!(k in ref)) throw new Error(`[strings:${lang}] unknown key ${join(k)} (not in the default language)`);
    }
    return;
  }
  if (typeof got !== "string") throw new Error(`[strings:${lang}] ${where} must be a string, got ${typeof got}`);
  if (got.trim() === "") throw new Error(`[strings:${lang}] ${where} is empty — an untranslated string is worse than a default-language one`);
}

/**
 * defineLanguages({ en, "zh-Hans": zh }, { defaultLang: "en", order: ["en", "zh-Hans"] })
 * Returns { LANGS, LANG_ORDER, DEFAULT_LANG, allText }.
 */
export function defineLanguages(langs, { defaultLang, order } = {}) {
  const DEFAULT_LANG = defaultLang || Object.keys(langs)[0];
  const LANG_ORDER = order || Object.keys(langs);
  const ref = langs[DEFAULT_LANG];
  if (!ref) throw new Error(`[strings] default language "${DEFAULT_LANG}" is not in LANGS`);

  for (const [lang, strings] of Object.entries(langs)) {
    if (lang !== DEFAULT_LANG) assertSameShape(ref, strings, lang);
    if (!LANG_ORDER.includes(lang)) throw new Error(`[strings] LANGS has "${lang}" but the order does not`);
  }
  for (const lang of LANG_ORDER) {
    if (!langs[lang]) throw new Error(`[strings] order has "${lang}" but LANGS does not`);
  }
  /* The switcher shows every language's name in every language, so those
     keys are required whenever there is more than one language. */
  if (LANG_ORDER.length > 1) {
    for (const [lang, strings] of Object.entries(langs)) {
      for (const key of ["langNames", "langFull"]) {
        for (const other of LANG_ORDER) {
          if (!strings?.ui?.[key]?.[other]) {
            throw new Error(`[strings:${lang}] ui.${key}.${other} is missing — every language file names every language`);
          }
        }
      }
    }
  }

  /* Every character the deck can ever display, across all languages. */
  function allText() {
    const out = [];
    const walk = (v) => {
      if (typeof v === "string") out.push(v);
      else if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === "object") Object.values(v).forEach(walk);
    };
    walk(langs);
    return out.join("\n");
  }

  return { LANGS: langs, LANG_ORDER, DEFAULT_LANG, allText };
}
