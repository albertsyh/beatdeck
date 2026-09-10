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
 * It also measures the CHROME on the live deck — the bar is not in the print
 * tree, so its boxes are read per slide from the running deck and compared,
 * in canvas coordinates, against the copy on the printed page. Copy that
 * lands on a cluster fails; copy that stops within CLEARANCE_PX of one is
 * reported as TIGHT. Mark copy meant to sit under the bar `.over-chrome`.
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
/* copy that stops this close to a chrome cluster reads as touching it */
const CLEARANCE_PX = 12;

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
    /* screen media first: @media print hides .deck, and the chrome pass below
       has to measure the running deck, not the print sheet */
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

    /* Where the bar actually is, slide by slide. The label is per slide and
       per language and the dots follow `steps`, so the left cluster's width
       changes as you walk the deck — one box for the whole deck would be a
       guess. Canvas coordinates: the stage is the 1920x1080 box a slide fills,
       so a rect measured against it compares directly with the print tree. */
    const chrome = await page.evaluate(async () => {
      const stage = document.getElementById("stage");
      const counter = document.querySelector(".counter");
      if (!stage || !counter) return null;
      const first = /^#(\d+)/.exec(location.hash || "");
      const numberFrom = first ? parseInt(first[1], 10) : 1;
      const seen = /(\d+)\s*\/\s*(\d+)/.exec(counter.textContent || "");
      if (!seen) return null;
      const count = parseInt(seen[2], 10) - numberFrom + 1;
      const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const canvasW = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--canvas-w")) || 1920;
      /* what a slide says, for lining screen slides up with printed pages */
      const sig = (el) => el ? (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 160) : "";
      const out = [];
      for (let i = 0; i < count; i++) {
        /* .999 — readHash clamps the beat, so this is the final beat, which is
           what the print sheet draws (and what decides a docked chip) */
        location.hash = `#${numberFrom + i}.999`;
        const want = String(numberFrom + i).padStart(2, "0");
        /* settled = the counter says this slide AND the outgoing slide-layer
           has finished exiting, so there is exactly one slide to read */
        for (let t = 0; t < 40; t++) {
          await frame();
          if ((counter.textContent || "").trim().startsWith(want)
              && document.querySelectorAll(".stage .slide").length === 1) break;
        }
        await frame();
        const s = stage.getBoundingClientRect();
        const scale = s.width / canvasW;
        const box = (sel) => {
          const el = document.querySelector(sel);
          const r = el && el.getBoundingClientRect();
          if (!r || !r.width || !r.height) return null;
          return { left: (r.left - s.left) / scale, top: (r.top - s.top) / scale,
                   right: (r.right - s.left) / scale, bottom: (r.bottom - s.top) / scale };
        };
        const live = document.querySelector(".stage .slide");
        out.push({ left: box(".chrome-left"), right: box(".chrome-right"), sig: sig(live) });
      }
      location.hash = `#${numberFrom}.1`;
      return out;
    });
    if (!chrome) {
      console.error("  !! could not measure the chrome on the live deck — collisions unchecked");
      problems++;
    }

    await page.emulateMedia({ media: "print" });
    await page.waitForFunction(() => {
      const s = document.querySelector(".printsheet .slide");
      return s && s.getBoundingClientRect().height > 0;
    });

    const { overflows, hits, tight, unaligned } = await page.evaluate(({ slack, clear, chrome }) => {
      const out = [], near = [], onbar = [];
      const canvasW = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--canvas-w")) || 1920;
      const pages = [...document.querySelectorAll(".printsheet .slide")];
      const sig = (el) => el ? (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 160) : "";

      /* Page N is not always slide N — a view that returns null under
         useStatic() prints nothing, so the two sequences drift. Walk them
         together in order and match on what the slide says. The two renders
         are not always identical either (a screen-only download link adds a
         tail), so match on a shared opening rather than on equality; an
         unmatched page keeps its chrome unchecked rather than borrowing
         another slide's bar. */
      const alike = (a, b) => {
        const n = Math.min(a.length, b.length);
        if (n < 8) return a === b;
        let i = 0;
        while (i < n && a[i] === b[i]) i++;
        return i / n >= 0.6;
      };
      const slideOf = [];
      let cursor = 0;
      const unaligned = [];
      for (let p = 0; p < pages.length; p++) {
        const want = sig(pages[p]);
        let found = -1;
        for (let j = cursor; chrome && j < chrome.length; j++) {
          if (alike(chrome[j].sig, want)) { found = j; break; }
        }
        slideOf.push(found);
        if (found >= 0) cursor = found + 1;
        else unaligned.push(p + 1);
      }

      pages.forEach((slide, i) => {
        const box = slide.getBoundingClientRect();
        const scale = box.width / canvasW;
        const bar = slideOf[i] >= 0 ? chrome[slideOf[i]] : null;
        const clusters = bar ? [["left", bar.left], ["right", bar.right]].filter(([, b]) => b) : [];
        slide.querySelectorAll("*").forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) return;
          const over = { bottom: r.bottom - box.bottom, right: r.right - box.right, top: box.top - r.top, left: box.left - r.left };
          const worst = Object.entries(over).sort((a, b) => b[1] - a[1])[0];
          /* Copy against the bar. Leaf text only: a full-bleed .ground or a
             hero image sitting under the chrome is a design, not a bug. */
          const copy = worst[1] <= slack && !el.children.length && (el.textContent || "").trim()
            && !el.closest(".sr-only, .over-chrome");
          if (copy) {
            const e = { left: (r.left - box.left) / scale, top: (r.top - box.top) / scale,
                        right: (r.right - box.left) / scale, bottom: (r.bottom - box.top) / scale };
            const text = (el.textContent || "").trim().slice(0, 44);
            for (const [side, c] of clusters) {
              const ox = Math.min(e.right, c.right) - Math.max(e.left, c.left);
              const oy = Math.min(e.bottom, c.bottom) - Math.max(e.top, c.top);
              if (ox > 0 && oy > 0) onbar.push({ slide: i + 1, side, px: Math.round(Math.min(ox, oy)), text });
              else {
                const gap = Math.hypot(Math.max(-ox, 0), Math.max(-oy, 0));
                if (gap < clear) near.push({ slide: i + 1, side, gap: Math.round(gap), text });
              }
            }
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
      const worstHit = new Map();
      for (const h of onbar) { const k = h.slide + ":" + h.side; if (!worstHit.has(k) || worstHit.get(k).px < h.px) worstHit.set(k, h); }
      const tightest = new Map();
      for (const n of near) {
        const k = n.slide + ":" + n.side;
        if (worstHit.has(k)) continue;                 /* already reported as a hit */
        if (!tightest.has(k) || tightest.get(k).gap > n.gap) tightest.set(k, n);
      }
      return {
        unaligned,
        overflows: [...best.values()].sort((a, b) => b.px - a.px),
        hits: [...worstHit.values()].sort((a, b) => b.px - a.px),
        tight: [...tightest.values()].sort((a, b) => a.gap - b.gap)
      };
    }, { slack: SLACK_PX, clear: CLEARANCE_PX, chrome });

    const pdf = `${outDir}/${pdfFile(config, lang, theme)}`;
    await page.pdf({ path: pdf, printBackground: true, preferCSSPageSize: true });
    written++;

    const tag = `${lang}/${theme}`.padEnd(16);
    const bad = overflows.length + hits.length;
    if (bad === 0) console.log(`  ${tag} ${actual.slides} pages, clear of the edges and the chrome   -> ${pdf}`);
    else {
      problems += bad;
      console.log(`  ${tag} ${bad} PROBLEM(S)        -> ${pdf}`);
    }
    for (const o of overflows) console.log(`      slide ${String(o.slide).padStart(2)}  ${o.px}px past ${o.edge}  .${o.cls}  "${o.text}"`);
    for (const h of hits) console.log(`      slide ${String(h.slide).padStart(2)}  ON the chrome (${h.side} cluster) by ${h.px}px  "${h.text}"`);
    for (const n of tight) console.log(`      TIGHT slide ${String(n.slide).padStart(2)}  ${n.gap}px clear of the chrome (${n.side} cluster)  "${n.text}"`);
    if (unaligned && unaligned.length) console.log(`      note: page(s) ${unaligned.join(", ")} print copy the deck does not show, so their chrome is unchecked`);
  }
}
await browser.close();

if (problems) {
  console.error(`\n${problems} layout problem(s). Shorten the copy, lift it clear of the chrome, or retune a :root[lang="…"] token in src/theme.css / src/deck.css, then re-run.`);
  process.exit(1);
}
console.log(`\nAll ${written} combination(s) clean. PDFs in ${outDir}/`);
