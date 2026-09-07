/**
 * Build src/deck.jsx into ONE self-contained HTML file: <name>.html.
 *
 *   bun run build
 *
 * Bundles React + Motion + the framework + the deck with Bun, inlines every
 * imported image/video as a data URI, embeds the fonts, and injects it all
 * into src/shell.html. ES modules, @font-face and image fetches are all
 * blocked over file://, so anything not inlined would fail silently on the
 * lecture-room laptop — hence the guards below, which fail the build instead.
 */
import { readFile, writeFile, stat, access } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { SCRIPT_FACES } from "./tools/script-faces.mjs";

const config = (await import(resolve("deck.config.js"))).default;
const SHELL = "src/shell.html";
const ENTRY = "src/deck.jsx";
const MARKS = { fonts: "<!--@FONTS-->", styles: "<!--@STYLES-->", bundle: "<!--@BUNDLE-->", title: "<!--@TITLE-->" };

const IMG_WARN_BYTES = 300 * 1024, IMG_MAX_BYTES = 1024 * 1024, IMG_DECK_BUDGET = 4 * 1024 * 1024;
const VID_MAX_BYTES = 3 * 1024 * 1024, VID_DECK_BUDGET = 4 * 1024 * 1024;
const FONT_WARN_BYTES = 400 * 1024;
const MIME = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml", ".gif": "image/gif", ".mp4": "video/mp4" };

const kb = (n) => (n / 1024).toFixed(0) + "KB";
const fail = (msg) => { console.error(msg); process.exit(1); };
const exists = (p) => access(p).then(() => true, () => false);

if (!config.name || /[^a-z0-9-]/.test(config.name)) fail(`deck.config.js: name must be lowercase letters, digits and dashes (got ${JSON.stringify(config.name)})`);
const out = `${config.name}.html`;

/* --- fonts: the embedded faces, and the token block that names them ---- */
if (!(await exists("src/fonts.css"))) fail("src/fonts.css is missing. Run `bun run fonts` once (needs network) to embed the typefaces named in deck.config.js.");
const fonts = await readFile("src/fonts.css", "utf8");
let deckFonts = "";
if ((config.fonts?.scripts || []).length) {
  const f = "src/fonts-scripts.css";
  if (!(await exists(f))) fail(`deck.config.js lists fonts.scripts but ${f} does not exist. Run \`bun run fonts:subset\`.`);
  deckFonts = await readFile(f, "utf8");
  if (Buffer.byteLength(deckFonts) > FONT_WARN_BYTES) console.warn(`warning: subsetted fonts are ${kb(Buffer.byteLength(deckFonts))} (over ${kb(FONT_WARN_BYTES)})`);
}
/* every family the deck may render, in stack order: the chosen face first,
   then every subsetted script face (their unicode-ranges are disjoint), then
   a system fallback */
const scriptFamilies = (config.fonts?.scripts || []).map((s) => typeof s === "string" ? SCRIPT_FACES[s]?.family : s.family).filter(Boolean);
const stack = (primary, tail) => [primary, ...scriptFamilies].filter(Boolean).map((f) => `"${f}"`).concat(tail).join(", ");
const fontTokens = `:root{
  --font-display: ${stack(config.fonts?.display, ["Georgia", "serif"])};
  --font-text: ${stack(config.fonts?.text, ["system-ui", "-apple-system", "Segoe UI", "Helvetica", "Arial", "sans-serif"])};
  --font-mono: ${stack(config.fonts?.mono, ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"])};
}`;

/* --- glyph coverage: every character of every language must be embedded -- */
function coveredBy(css) {
  const set = new Set();
  for (const [, body] of css.matchAll(/unicode-range:\s*([^;}]+)/g)) {
    for (const part of body.split(",")) {
      const m = /^\s*U\+([0-9A-Fa-f]+)(?:-([0-9A-Fa-f]+))?\s*$/.exec(part);
      if (!m) continue;
      const lo = parseInt(m[1], 16), hi = m[2] ? parseInt(m[2], 16) : lo;
      for (let cp = lo; cp <= hi; cp++) set.add(cp);
    }
  }
  return set;
}
{
  const strings = await import(resolve("src/strings/index.js"));
  const covered = coveredBy(fonts + "\n" + deckFonts);
  const missing = new Map();
  for (const ch of strings.allText()) {
    if (/\s/.test(ch)) continue;
    const cp = ch.codePointAt(0);
    if (!covered.has(cp) && !missing.has(cp)) missing.set(cp, ch);
  }
  if (missing.size) {
    const show = [...missing.entries()].slice(0, 8).map(([cp, ch]) => `"${ch}" U+${cp.toString(16).toUpperCase().padStart(4, "0")}`).join(", ");
    fail(`${missing.size} character(s) in the copy are not covered by any embedded font: ${show}${missing.size > 8 ? ", …" : ""}\n` +
         "The deck would show tofu boxes. Add the script to fonts.scripts in deck.config.js and run `bun run fonts:subset`.");
  }
}

/* --- shell + styles ------------------------------------------------------ */
const shell = await readFile(SHELL, "utf8");
for (const [name, mark] of Object.entries(MARKS)) if (!shell.includes(mark)) fail(`${SHELL} is missing the ${name} marker ${mark}.`);
const styles = [await readFile("src/framework/base.css", "utf8"), await readFile("src/theme.css", "utf8")];
if (await exists("src/deck.css")) styles.push(await readFile("src/deck.css", "utf8"));

/* --- the deck module: manifest sanity before bundling ---------------------- */
const mod = await import(resolve(ENTRY));
const slides = mod.SLIDES || [];
if (slides.length === 0) fail("src/deck.jsx exports no SLIDES.");
const ids = new Set();
for (const s of slides) {
  if (!s.id || !s.view || !(s.steps >= 1)) fail(`manifest entry ${JSON.stringify(s.id)} needs id, view and steps >= 1.`);
  if (ids.has(s.id)) fail(`manifest has duplicate slide id "${s.id}".`);
  ids.add(s.id);
}
if (mod.DOCK) {
  const at = (id) => slides.findIndex((s) => s.id === id);
  for (const key of ["from", "release"]) if (at(mod.DOCK[key]) < 0) fail(`DOCK.${key} = "${mod.DOCK[key]}" is not a slide id.`);
  if (at(mod.DOCK.release) <= at(mod.DOCK.from)) fail(`DOCK.release must come after DOCK.from.`);
}
const beats = slides.reduce((n, s) => n + s.steps, 0);

/* --- inline images and video ------------------------------------------------ */
const images = { bytes: 0, files: [] }, videos = { bytes: 0, files: [] };
const inlinePlugin = {
  name: "inline-assets",
  setup(build) {
    build.onLoad({ filter: /\.(jpe?g|png|webp|svg|gif)$/i }, async (args) => {
      const bytes = (await stat(args.path)).size;
      const rel = args.path.replace(resolve(".") + "/", "");
      if (bytes > IMG_MAX_BYTES) fail(`${rel} is ${kb(bytes)}; the per-image limit is ${kb(IMG_MAX_BYTES)}. Resize or recompress it.`);
      if (bytes > IMG_WARN_BYTES) console.warn(`warning: ${rel} is ${kb(bytes)}`);
      images.bytes += bytes; images.files.push(rel);
      if (images.bytes > IMG_DECK_BUDGET) fail(`inlined images total ${kb(images.bytes)}; the budget is ${kb(IMG_DECK_BUDGET)}.`);
      const data = await readFile(args.path);
      return { contents: `export default "data:${MIME[extname(args.path).toLowerCase()]};base64,${data.toString("base64")}";`, loader: "js" };
    });
    build.onLoad({ filter: /\.mp4$/i }, async (args) => {
      const bytes = (await stat(args.path)).size;
      const rel = args.path.replace(resolve(".") + "/", "");
      if (bytes > VID_MAX_BYTES) fail(`${rel} is ${kb(bytes)}; the per-video limit is ${kb(VID_MAX_BYTES)}. Re-encode smaller (H.264, e.g. ffmpeg -c:v libx264 -crf 32).`);
      const data = await readFile(args.path);
      /* HEVC shows a black frame on machines without hardware support; the
         codec tags sit at the END of the file, so scan all of it */
      if (["hvc1", "hev1", "hvcC"].some((tag) => data.includes(tag, 0, "latin1"))) fail(`${rel} looks like HEVC (H.265). Re-encode with libx264.`);
      videos.bytes += bytes; videos.files.push(rel);
      if (videos.bytes > VID_DECK_BUDGET) fail(`inlined video totals ${kb(videos.bytes)}; the budget is ${kb(VID_DECK_BUDGET)}.`);
      return { contents: `export default "data:video/mp4;base64,${data.toString("base64")}";`, loader: "js" };
    });
  }
};

const built = await Bun.build({
  entrypoints: [ENTRY], target: "browser", format: "esm", minify: true,
  define: { "process.env.NODE_ENV": '"production"' },
  plugins: [inlinePlugin]
});
if (!built.success) { console.error("bundle failed:"); for (const log of built.logs) console.error(" ", String(log)); process.exit(1); }
if (built.outputs.length !== 1) fail(`expected exactly one bundle output, got ${built.outputs.length}. A code-split or an unhandled asset import crept in; the deck must stay one file.`);

let js = await built.outputs[0].text();
js = js.replaceAll("</script", "<\\/script");

const escape = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const html = shell
  .replaceAll(MARKS.title, escape(config.title || config.name))
  .replaceAll("@HEADING@", escape(config.title || config.name))
  .replaceAll("@OUT@", out)
  .replaceAll("@SLIDES@", String(slides.length))
  .replaceAll("@BEATS@", String(beats))
  .replaceAll("@LANG@", config.lang?.default || "en")
  .replaceAll("@THEME@", config.theme?.default || "light")
  .replaceAll("@PRINT@", config.theme?.print || "")
  .replace(MARKS.fonts, fonts + (deckFonts ? "\n" + deckFonts : ""))
  .replace(MARKS.styles, [fontTokens, ...styles].join("\n"))
  .replace(MARKS.bundle, js);

await writeFile(out, html, "utf8");
console.log(`${out} written — ${kb(Buffer.byteLength(html))} total, ${slides.length} slides, ${beats} beats`);
console.log(`  script ${kb(Buffer.byteLength(js))}   fonts ${kb(Buffer.byteLength(fonts))}${deckFonts ? ` + ${kb(Buffer.byteLength(deckFonts))} scripts` : ""}` +
            (images.files.length ? `   images ${kb(images.bytes)} across ${images.files.length}` : "") +
            (videos.files.length ? `   video ${kb(videos.bytes)}` : ""));

