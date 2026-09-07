/**
 * Preset non-Latin faces for `fonts.scripts` in deck.config.js. Each is a
 * variable Noto face from the google/fonts repository (Open Font License),
 * subsetted by tools/subset-fonts.mjs to the characters the copy uses.
 * `pin` fixes an axis the deck never varies before subsetting.
 */
const RAW = "https://raw.githubusercontent.com/google/fonts/main/ofl";
export const SCRIPT_FACES = {
  sc:         { family: "Noto Sans SC",         file: "NotoSansSC[wght].ttf",              url: `${RAW}/notosanssc/NotoSansSC%5Bwght%5D.ttf`, pin: null, note: "Simplified Chinese" },
  tc:         { family: "Noto Sans TC",         file: "NotoSansTC[wght].ttf",              url: `${RAW}/notosanstc/NotoSansTC%5Bwght%5D.ttf`, pin: null, note: "Traditional Chinese" },
  jp:         { family: "Noto Sans JP",         file: "NotoSansJP[wght].ttf",              url: `${RAW}/notosansjp/NotoSansJP%5Bwght%5D.ttf`, pin: null, note: "Japanese" },
  kr:         { family: "Noto Sans KR",         file: "NotoSansKR[wght].ttf",              url: `${RAW}/notosanskr/NotoSansKR%5Bwght%5D.ttf`, pin: null, note: "Korean" },
  thai:       { family: "Noto Sans Thai",       file: "NotoSansThai[wdth,wght].ttf",       url: `${RAW}/notosansthai/NotoSansThai%5Bwdth,wght%5D.ttf`, pin: "wdth=100", note: "Thai" },
  arabic:     { family: "Noto Sans Arabic",     file: "NotoSansArabic[wdth,wght].ttf",     url: `${RAW}/notosansarabic/NotoSansArabic%5Bwdth,wght%5D.ttf`, pin: "wdth=100", note: "Arabic" },
  devanagari: { family: "Noto Sans Devanagari", file: "NotoSansDevanagari[wdth,wght].ttf", url: `${RAW}/notosansdevanagari/NotoSansDevanagari%5Bwdth,wght%5D.ttf`, pin: "wdth=100", note: "Devanagari (Hindi, Marathi, Nepali)" }
};

/* resolve a config entry — a preset key or a full object — to a face */
export function resolveScript(entry) {
  if (typeof entry === "string") {
    if (!SCRIPT_FACES[entry]) throw new Error(`fonts.scripts: unknown preset "${entry}" (one of ${Object.keys(SCRIPT_FACES).join(", ")})`);
    return SCRIPT_FACES[entry];
  }
  for (const k of ["family", "file", "url"]) if (!entry?.[k]) throw new Error(`fonts.scripts: a custom face needs ${k}`);
  return { pin: null, note: entry.family, ...entry };
}
