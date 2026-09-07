/**
 * Assemble dist/ — what gets published.
 *
 *   bun run dist            dist/index.html + dist/pdf/<name>-<lang>-<theme>.pdf
 *   bun run dist --no-pdf   the deck alone
 *
 * REFUSES A STALE SET: the closing slide links to the PDFs, so a deck edited
 * after the last `bun run check:layout` would offer a handout of the previous
 * version. Every PDF must exist and be newer than the built deck.
 */
import { mkdir, copyFile, rm, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { handoutThemes, pdfFile } from "./handouts.mjs";

const config = (await import(resolve("deck.config.js"))).default;
const { LANG_ORDER } = await import(resolve("src/strings/index.js"));
const withPdf = config.publish?.pdf !== false && !process.argv.includes("--no-pdf");

const deckHtml = `${config.name}.html`;
const deckAge = (await stat(deckHtml).catch(() => null))?.mtimeMs;
if (deckAge == null) { console.error(`${deckHtml} does not exist. Run \`bun run build\` first.`); process.exit(1); }

const wanted = withPdf ? LANG_ORDER.flatMap((lang) => handoutThemes(config).map((theme) => pdfFile(config, lang, theme))) : [];
const missing = [], stale = [];
for (const f of wanted) {
  const st = await stat(`layout-check/${f}`).catch(() => null);
  if (!st) missing.push(f);
  else if (st.mtimeMs < deckAge) stale.push(f);
}
if (missing.length || stale.length) {
  if (missing.length) console.error(`Missing handout(s): ${missing.join(", ")}`);
  if (stale.length) console.error(`Handout(s) older than ${deckHtml}: ${stale.join(", ")}`);
  console.error("Run `bun run check:layout` to regenerate them (or `bun run dist --no-pdf`).");
  process.exit(1);
}

await rm("dist", { recursive: true, force: true });
await mkdir("dist/pdf", { recursive: true });
await copyFile(deckHtml, "dist/index.html");
for (const f of wanted) await copyFile(`layout-check/${f}`, `dist/pdf/${f}`);
console.log(`dist/ ready — index.html + ${wanted.length} handout(s).`);
