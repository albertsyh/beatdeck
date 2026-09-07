/**
 * Export one PDF per language x theme, and fail if anything overflows.
 *
 *   bun run check:layout            → layout-check/<name>-<lang>-<theme>.pdf
 *
 * The canvas is a fixed 1920x1080, so a translation that runs long does not
 * reflow — it silently spills past the slide. This drives the deck's own
 * print sheet (every slide at its FINAL beat), measures every element
 * against its slide, and writes the PDF that `bun run publish` ships.
 *
 * Needs a Chrome/Chromium binary. Set CHROME_PATH to override detection.
 */
import { mkdir, access } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright-core";
import { handoutThemes, pdfFile } from "./handouts.mjs";

const config = (await import(resolve("deck.config.js"))).default;
const { LANG_ORDER } = await import(resolve("src/strings/index.js"));
/* one handout per language x theme — or per language only, when theme.print
   pins the palette the PDF uses (the deck's link then names that file) */
const OUT_THEMES = handoutThemes(config);
const outDir = process.argv[2] || "layout-check";
const SLACK_PX = 1;
const CHROME_BAND = 96;

const exists = (p) => access(p).then(() => true, () => false);
const CANDIDATES = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"
].filter(Boolean);
let CHROME = null;
for (const c of CANDIDATES) if (await exists(c)) { CHROME = c; break; }
if (!CHROME) { console.error("No Chrome found. Install Google Chrome or set CHROME_PATH."); process.exit(2); }

const deckHtml = `${config.name}.html`;
if (!(await exists(deckHtml))) { console.error(`${deckHtml} does not exist. Run \`bun run build\` first.`); process.exit(1); }

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
let problems = 0;
let written = 0;

for (const lang of LANG_ORDER) {
  for (const theme of OUT_THEMES) {
    const url = `file://${resolve(deckHtml)}?lang=${lang}&theme=${theme}`;
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".printsheet .slide", { state: "attached" });
    await page.emulateMedia({ media: "print" });
    await page.waitForFunction(() => {
      const s = document.querySelector(".printsheet .slide");
      return s && s.getBoundingClientRect().height > 0;
    });
    await page.evaluate(() => document.fonts.ready);

    const actual = await page.evaluate(() => ({
      lang: document.documentElement.lang,
      theme: document.documentElement.getAttribute("data-theme"),
      slides: document.querySelectorAll(".printsheet .slide").length
    }));
    if (actual.lang !== lang || actual.theme !== theme) {
      console.error(`  !! asked for ${lang}/${theme}, page reports ${actual.lang}/${actual.theme}`);
      problems++;
    }

    const { overflows, tight } = await page.evaluate(({ slack, band }) => {
      const out = [], near = [];
      document.querySelectorAll(".printsheet .slide").forEach((slide, i) => {
        const box = slide.getBoundingClientRect();
        slide.querySelectorAll("*").forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) return;
          const over = { bottom: r.bottom - box.bottom, right: r.right - box.right, top: box.top - r.top, left: box.left - r.left };
          const worst = Object.entries(over).sort((a, b) => b[1] - a[1])[0];
          if (worst[1] <= slack && !el.children.length && (el.textContent || "").trim()) {
            const gap = box.bottom - r.bottom;
            if (gap < band) near.push({ slide: i + 1, gap: Math.round(gap), text: (el.textContent || "").trim().slice(0, 44) });
          }
          if (worst[1] > slack) {
            out.push({ slide: i + 1, edge: worst[0], px: Math.round(worst[1]),
              cls: el.className && el.className.baseVal === undefined ? String(el.className).split(" ")[0] : el.tagName.toLowerCase(),
              text: (el.textContent || "").trim().slice(0, 48) });
          }
        });
      });
      const best = new Map();
      for (const o of out) { const k = o.slide + ":" + o.edge; if (!best.has(k) || best.get(k).px < o.px) best.set(k, o); }
      const tightest = new Map();
      for (const n of near) { if (!tightest.has(n.slide) || tightest.get(n.slide).gap > n.gap) tightest.set(n.slide, n); }
      return { overflows: [...best.values()].sort((a, b) => b.px - a.px), tight: [...tightest.values()].sort((a, b) => a.gap - b.gap) };
    }, { slack: SLACK_PX, band: CHROME_BAND });

    const pdf = `${outDir}/${pdfFile(config, lang, theme)}`;
    await page.pdf({ path: pdf, printBackground: true, preferCSSPageSize: true });
    written++;

    const tag = `${lang}/${theme}`.padEnd(16);
    if (overflows.length === 0) {
      console.log(`  ${tag} ${actual.slides} pages, no overflow   -> ${pdf}`);
      for (const n of tight) console.log(`      TIGHT slide ${String(n.slide).padStart(2)}  ${n.gap}px clear of the chrome band  "${n.text}"`);
    } else {
      problems += overflows.length;
      console.log(`  ${tag} ${overflows.length} OVERFLOW(S)        -> ${pdf}`);
      for (const o of overflows) console.log(`      slide ${String(o.slide).padStart(2)}  ${o.px}px past ${o.edge}  .${o.cls}  "${o.text}"`);
    }
  }
}
await browser.close();

if (problems) {
  console.error(`\n${problems} layout problem(s). Shorten the copy, or retune a :root[lang="…"] token in src/theme.css / src/deck.css, then re-run.`);
  process.exit(1);
}
console.log(`\nAll ${written} combination(s) clean. PDFs in ${outDir}/`);
