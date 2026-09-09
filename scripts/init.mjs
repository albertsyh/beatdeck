#!/usr/bin/env node
/**
 * Scaffold a new beatdeck project from the skill's template.
 *
 *   bun  <skill>/scripts/init.mjs <dir> [--name my-deck] [--title "My talk"] [--no-install] [--no-docs]
 *   node <skill>/scripts/init.mjs <dir> …      (works the same; bun is only needed to build)
 *
 * - copies template/ into <dir> (refuses to overwrite a non-empty directory
 *   unless --force)
 * - stamps the deck name (from --name or the directory name) and title
 * - copies SKILL.md + reference/ into <dir>/docs/beatdeck so an agent opening
 *   the project later has the conventions even with beatdeck uninstalled
 *   (skip with --no-docs). Deliberately NOT .agents/skills or .claude/skills:
 *   `npx skills add` owns those and wipes the destination on install.
 * - writes AGENTS.md (read by Codex, Cursor, Amp) plus a CLAUDE.md that imports
 *   it, unless those files already exist
 * - runs `bun install` when bun is on PATH (skip with --no-install)
 */
import { cp, mkdir, readdir, readFile, writeFile, stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const SKILL = resolve(here, "..");
const TEMPLATE = join(SKILL, "template");

const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const opt = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const target = args.find((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--") && ["--name", "--title"].includes(args[i - 1])));
if (!target) {
  console.error("usage: init.mjs <dir> [--name my-deck] [--title \"My talk\"] [--no-install] [--no-docs] [--force]");
  process.exit(2);
}
const dir = resolve(target);
const name = (opt("--name") || basename(dir)).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
const title = opt("--title") || name.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
if (!name) { console.error("could not derive a deck name; pass --name"); process.exit(2); }

/* refuse to clobber */
try {
  const entries = (await readdir(dir)).filter((e) => e !== ".DS_Store");
  if (entries.length && !flag("--force")) {
    console.error(`${dir} is not empty. Pass --force to scaffold into it anyway (existing files with the same names are overwritten).`);
    process.exit(1);
  }
} catch { /* does not exist yet */ }

await mkdir(dir, { recursive: true });
await cp(TEMPLATE, dir, { recursive: true, filter: (src) => !/node_modules|\.DS_Store/.test(src) });

/* stamp name and title */
for (const rel of ["deck.config.js", "package.json", "src/strings/en.js"]) {
  const p = join(dir, rel);
  const s = await readFile(p, "utf8");
  await writeFile(p, s.replaceAll("__DECK_NAME__", name).replaceAll("__DECK_TITLE__", title.replace(/"/g, '\\"')), "utf8");
}

/* the conventions, project-local, so an agent opening this folder later has them
   even where beatdeck is not installed. Docs only: template/ would be a second
   copy of the files this project already is, and scripts/ cannot be used from
   inside a scaffolded deck. */
if (!flag("--no-docs") && !flag("--no-skill")) {
  const dest = join(dir, "docs", "beatdeck");
  await mkdir(dest, { recursive: true });
  await cp(join(SKILL, "SKILL.md"), join(dest, "SKILL.md"));
  await cp(join(SKILL, "reference"), join(dest, "reference"), {
    recursive: true,
    filter: (src) => !/\.DS_Store/.test(src),
  });
}

/* project docs: AGENTS.md is read by Codex, Cursor and Amp; Claude Code reads
   CLAUDE.md, so that one imports AGENTS.md rather than repeating it. Neither is
   overwritten if it already exists. */
const docs = `# ${title}

A **beatdeck** presentation: \`src/deck.jsx\` + \`src/strings/*.js\` compile to one
self-contained \`${name}.html\` that opens by double-click, prints to PDF, switches
language and theme at runtime, and reflows on a phone.

The framework and its conventions are documented in \`docs/beatdeck/SKILL.md\` and
\`docs/beatdeck/reference/\` — read them before changing anything. For the full skill
(scaffolder and template included): \`npx skills add albertsyh/beatdeck\`.

\`\`\`bash
bun run build          # regenerate ${name}.html — the only verify step
bun run check:layout   # PDFs per language x theme + overflow check (needs Chrome)
bun run publish        # build → handouts → dist → here.now
\`\`\`

- \`${name}.html\` is **generated**; never edit it.
- Copy lives in \`src/strings/\`; structure (ids, step counts) in \`src/deck.jsx\`.
- Look: \`src/theme.css\` (tokens) and \`deck.config.js\` (fonts). Never per-slide values.
- After editing non-Latin copy: \`bun run fonts:subset\`.
`;

const agentsMd = join(dir, "AGENTS.md");
if (!(await stat(agentsMd).catch(() => null))) await writeFile(agentsMd, docs, "utf8");
else console.warn("AGENTS.md already exists — left alone; the beatdeck notes are in docs/beatdeck/.");

const claudeMd = join(dir, "CLAUDE.md");
if (!(await stat(claudeMd).catch(() => null))) {
  /* if AGENTS.md was already there and is someone else's, still point at it —
     it is the file every other harness in this project reads. */
  await writeFile(claudeMd, `See @AGENTS.md\n`, "utf8");
}

/* dependencies */
const hasBun = spawnSync("bun", ["--version"], { stdio: "ignore" }).status === 0;
if (!flag("--no-install")) {
  if (hasBun) {
    const r = spawnSync("bun", ["install"], { cwd: dir, stdio: "inherit" });
    if (r.status !== 0) console.warn("bun install failed — run it yourself in the project.");
  } else {
    console.warn("bun is not on PATH — install it (https://bun.sh) then run `bun install` in the project.");
  }
}

console.log(`
✔ ${dir}
  deck name   ${name}         → builds ${name}.html
  title       ${title}

Next:
  cd ${target}
  bun run build            # then open ${name}.html
  bun run check:layout     # handouts + overflow check (needs Chrome)
  bun run publish          # → here.now

Conventions for this framework: docs/beatdeck/SKILL.md (+ reference/).

Edit src/strings/en.js (copy), src/deck.jsx (structure), src/theme.css (look),
deck.config.js (fonts, themes, publishing). Fonts are pre-embedded for the
default pair; change them in deck.config.js and run \`bun run fonts\`.
`);
