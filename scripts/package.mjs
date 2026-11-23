#!/usr/bin/env node
/**
 * Package this skill as an uploadable `.skill` file plus an identical `.zip`
 * (a ZIP whose top level is the skill folder — claude.ai looks for
 * `<name>/SKILL.md` inside it; OpenAI wants one top-level folder holding
 * exactly one SKILL.md). The `.zip` is for ChatGPT and anything else that
 * filters uploads by extension.
 *
 *   bun  scripts/package.mjs [--out dist] [--release]
 *   node scripts/package.mjs …
 *
 * --release also publishes the three files as GitHub release v<Skill version>
 * (README links /releases/latest/download/<file>). Before any work it refuses
 * a dirty tree, an unpushed HEAD, and a tag or release that already exists.
 *
 * - packages the committed tree at HEAD (git archive), never the working copy,
 *   so local scratch never ships; uncommitted changes are listed and left out
 * - names the archive's top folder from SKILL.md's `name`, so they always match
 * - runs the official validator (skill-creator's quick_validate.py, via uv) on
 *   exactly the files that go into the archive, and aborts if it fails.
 *   Finds skill-creator under ~/.claude; set SKILL_CREATOR_DIR to override.
 * - warns (does not fail) when the description is over claude.ai's stated
 *   200-character limit; the Agent Skills spec allows 1024
 * - this script is left out of the package
 *
 * Upload: claude.ai → Customize → Skills → + → Create skill → Upload a skill.
 */
import { chmodSync, copyFileSync, cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, "..");
const SELF = relative(ROOT, fileURLToPath(import.meta.url));
const CLAUDE_AI_DESC_LIMIT = 200;

const args = process.argv.slice(2);
const outIdx = args.indexOf("--out");
const OUT = resolve(ROOT, outIdx >= 0 ? args[outIdx + 1] : "dist");
const RELEASE = args.includes("--release");

let stage = null; // staging dir; removed on every exit path, including die()
const cleanup = () => { if (stage) rmSync(stage, { recursive: true, force: true }); };
const die = (msg) => { console.error(`✗ ${msg}`); cleanup(); process.exit(1); };
const run = (cmd, argv, opts = {}) => spawnSync(cmd, argv, { cwd: ROOT, encoding: "utf8", ...opts });

// ── 1. what goes in: HEAD, minus this script ────────────────────────────────
if (run("git", ["rev-parse", "--is-inside-work-tree"]).status !== 0) die("not a git repository");
const head = run("git", ["rev-parse", "--short", "HEAD"]).stdout.trim();
const dirty = run("git", ["status", "--porcelain"]).stdout.trim();
if (dirty) {
  if (RELEASE) die(`--release needs a clean tree (a release must match a commit); commit or stash:\n${dirty}`);
  console.warn(`! uncommitted changes are NOT packaged (packaging ${head}):`);
  for (const line of dirty.split("\n")) console.warn(`    ${line}`);
}
const PATHSPEC = ["--", ".", `:(exclude)${SELF}`];

// ── 2. read name/description from the committed SKILL.md ────────────────────
const skillMd = run("git", ["show", "HEAD:SKILL.md"]);
if (skillMd.status !== 0) die("SKILL.md is not committed at HEAD");
const fm = skillMd.stdout.match(/^---\n([\s\S]*?)\n---/);
if (!fm) die("SKILL.md has no YAML frontmatter");
const name = fm[1].match(/^name:\s*(\S+)\s*$/m)?.[1];
if (!name) die("SKILL.md frontmatter has no single-line `name:`");
const descBlock = fm[1].match(/^description:\s*(.*)\n((?:[ \t]+.*\n?)*)/m);
const description = descBlock
  ? [descBlock[1].replace(/^[>|][-+]?$/, ""), ...descBlock[2].split("\n")].map((l) => l.trim()).filter(Boolean).join(" ")
  : "";
const version = skillMd.stdout.match(/Skill version:\s*(\d+\.\d+\.\d+)/)?.[1];
const TAG = version && `v${version}`;
const REPO = githubRepo();

// ── 2b. --release preflight: everything that can refuse, before any work ──
if (RELEASE) {
  if (!version) die("SKILL.md has no `Skill version: x.y.z` line; the release tag is v<version>");
  if (!REPO) die("origin is not a GitHub remote; --release publishes a GitHub release");
  if (spawnSync("gh", ["--version"], { stdio: "ignore" }).status !== 0) die("gh (GitHub CLI) is not on PATH");
  if (run("git", ["fetch", "--quiet", "origin"]).status !== 0) die("git fetch origin failed");
  const upstream = run("git", ["rev-parse", "@{u}"]);
  if (upstream.status !== 0) die("this branch has no upstream; push it first");
  if (upstream.stdout.trim() !== run("git", ["rev-parse", "HEAD"]).stdout.trim()) {
    die(`HEAD (${head}) is not what origin has; push first, so the release points at a commit people can see`);
  }
  const tag = run("git", ["ls-remote", "--exit-code", "--tags", "origin", `refs/tags/${TAG}`]);
  if (tag.status === 0) die(`tag ${TAG} already exists on origin; bump "Skill version" in SKILL.md for a new release`);
  if (tag.status !== 2) die(`could not check origin for tag ${TAG}: ${tag.stderr.trim()}`);
  if (spawnSync("gh", ["release", "view", TAG, "-R", REPO], { stdio: "ignore" }).status === 0) {
    die(`release ${TAG} already exists on ${REPO}`);
  }
}

// ── 3. extract exactly those files and validate them ────────────────────────
stage = mkdtempSync(join(tmpdir(), "beatdeck-package-"));
try {
  const skillDir = join(stage, name);
  mkdirSync(skillDir);
  const tar = run("git", ["-c", "tar.umask=022", "archive", "--format=tar", "HEAD", ...PATHSPEC], { encoding: "buffer", maxBuffer: 256 << 20 });
  if (tar.status !== 0) die(`git archive failed: ${tar.stderr}`);
  // -p keeps git's 644/755 modes regardless of umask; they are zipped as-is below
  const x = spawnSync("tar", ["-x", "-p", "-C", skillDir], { input: tar.stdout });
  if (x.status !== 0) die(`could not extract archive: ${x.stderr}`);

  const validator = findValidator();
  if (!validator) {
    die("skill-creator's quick_validate.py not found under ~/.claude. Install the skill-creator plugin, " +
      "or set SKILL_CREATOR_DIR to the folder that contains scripts/quick_validate.py.");
  }
  const hasUv = spawnSync("uv", ["--version"], { stdio: "ignore" }).status === 0;
  if (!hasUv) die("uv is needed to run the validator (it supplies PyYAML): https://docs.astral.sh/uv/");
  const v = spawnSync("uv", ["run", "--quiet", "--no-project", "--with", "pyyaml", "python", "-m", "scripts.quick_validate", skillDir],
    { cwd: validator, encoding: "utf8" });
  const verdict = (v.stdout + v.stderr).trim();
  if (v.status !== 0) die(`validation failed: ${verdict}`);
  console.log(`✓ ${verdict}  (${relative(homedir(), validator).replace(/^/, "~/")})`);

  if (description.length > CLAUDE_AI_DESC_LIMIT) {
    console.warn(`! description is ${description.length} chars; claude.ai's help center states a ` +
      `${CLAUDE_AI_DESC_LIMIT}-char limit (the spec allows 1024). If the upload is rejected, trim it.`);
  }

  // ── 4. zip the validated folder itself, skill folder as the top level ─────
  // Zipped with `zip` rather than `git archive --format=zip`: git writes
  // FAT-style entries with no Unix modes, leaving permissions to whatever
  // unpacks it (ChatGPT uploads have been reported failing on 600-mode files).
  // -X drops macOS extra attributes. Same bytes go out as .skill and .zip.
  if (spawnSync("zip", ["-v"], { stdio: "ignore" }).status !== 0) die("`zip` is not on PATH");
  // Everything is built in the stage and copied to OUT only once all of it
  // has passed, so a failed run never leaves a half-updated dist/.
  const BUILD = join(stage, "out");
  mkdirSync(BUILD);
  const file = join(BUILD, `${name}.skill`);
  const zipCopy = join(BUILD, `${name}.zip`);
  const z =spawnSync("zip", ["-q", "-r", "-X", file, name], { cwd: stage, encoding: "utf8" });
  if (z.status !== 0) die(`zip failed: ${z.stderr || z.stdout}`);
  copyFileSync(file, zipCopy);

  // ── 5. plugin archive: <name>/.claude-plugin/plugin.json + skills/<name>/ ─
  // For plugin uploaders (ChatGPT's "New Plugin" dialog, Claude Code
  // --plugin-dir). ChatGPT accepts .claude-plugin/plugin.json and converts it
  // to its own manifest; skills are discovered at skills/<name>/SKILL.md.
  const pluginFile = join(BUILD, `${name}-plugin.zip`);
  const pluginRoot = join(stage, "plugin", name);
  mkdirSync(join(pluginRoot, ".claude-plugin"), { recursive: true });
  mkdirSync(join(pluginRoot, "skills"));
  cpSync(skillDir, join(pluginRoot, "skills", name), { recursive: true });
  if (existsSync(join(skillDir, "LICENSE"))) copyFileSync(join(skillDir, "LICENSE"), join(pluginRoot, "LICENSE"));
  const manifestPath = join(pluginRoot, ".claude-plugin", "plugin.json");
  writeFileSync(manifestPath, JSON.stringify(pluginManifest(skillDir, name), null, 2) + "\n");
  for (const d of [join(stage, "plugin"), pluginRoot, join(pluginRoot, ".claude-plugin"), join(pluginRoot, "skills")]) chmodSync(d, 0o755);
  chmodSync(manifestPath, 0o644);
  if (existsSync(join(pluginRoot, "LICENSE"))) chmodSync(join(pluginRoot, "LICENSE"), 0o644);

  const hasClaude = spawnSync("claude", ["--version"], { stdio: "ignore" }).status === 0;
  if (hasClaude) {
    const pv = spawnSync("claude", ["plugin", "validate", pluginRoot], { encoding: "utf8" });
    if (pv.status !== 0) die(`plugin manifest failed \`claude plugin validate\`:\n${(pv.stdout + pv.stderr).trim()}`);
    console.log("✓ plugin manifest passes `claude plugin validate`");
  } else {
    console.warn("! `claude` not on PATH; plugin manifest not validated");
  }
  const pz = spawnSync("zip", ["-q", "-r", "-X", pluginFile, name], { cwd: join(stage, "plugin"), encoding: "utf8" });
  if (pz.status !== 0) die(`zip (plugin) failed: ${pz.stderr || pz.stdout}`);

  // ── 6. all passed: publish to OUT ─────────────────────────────────────────
  mkdirSync(OUT, { recursive: true });
  const out = (p) => join(OUT, basename(p));
  for (const p of [file, zipCopy, pluginFile]) copyFileSync(p, out(p));

  const count = countFiles(skillDir);
  const kb = (p) => `${(statSync(p).size / 1024).toFixed(0)} KB`;
  const rel = (p) => relative(process.cwd(), out(p)) || out(p);
  console.log(`✓ from ${head}, ${count} skill files:`);
  console.log(`  ${rel(file)}  ${kb(file)}   claude.ai: Customize → Skills → + → Create skill → Upload a skill`);
  console.log(`  ${rel(zipCopy)}  ${kb(zipCopy)}   same bytes, for uploaders that want .zip (ChatGPT Skills → Create → Upload)`);
  console.log(`  ${rel(pluginFile)}  ${kb(pluginFile)}   plugin uploaders: ChatGPT "New Plugin"; Claude Code --plugin-dir`);

  // ── 7. --release: publish the three files as GitHub release v<version> ───
  // README links /releases/latest/download/<file>, so every release must
  // carry all three under these exact names.
  if (RELEASE) {
    const sha = run("git", ["rev-parse", "HEAD"]).stdout.trim();
    const dl = (f) => `[${basename(f)}](https://github.com/${REPO}/releases/download/${TAG}/${basename(f)})`;
    const notes = [
      `Upload packages for beatdeck ${version}, built from ${sha.slice(0, 7)}.`,
      "",
      "| File | Upload it to |",
      "|---|---|",
      `| ${dl(file)} | claude.ai: Customize → Skills → + → Create skill → Upload a skill |`,
      `| ${dl(pluginFile)} | ChatGPT: Plugins → New Plugin (Business, Enterprise, Edu). Also a Claude Code plugin (\`claude --plugin-dir\`) |`,
      `| ${dl(zipCopy)} | same bytes as the .skill, for uploaders that only take .zip |`,
      "",
      `Claude Code, Codex, Cursor and other SKILL.md harnesses: \`npx skills add ${REPO} -g\``,
    ].join("\n");
    const r = spawnSync("gh", ["release", "create", TAG, ...[file, zipCopy, pluginFile].map(out),
      "-R", REPO, "--target", sha, "--title", `beatdeck ${version}`, "--notes", notes], { encoding: "utf8" });
    if (r.status !== 0) die(`gh release create failed (dist/ is built; fix and re-run --release):\n${(r.stderr || r.stdout).trim()}`);
    run("git", ["fetch", "--quiet", "--tags", "origin"]);
    console.log(`✓ released ${TAG}: ${r.stdout.trim()}`);
    console.log(`  always-newest links: https://github.com/${REPO}/releases/latest/download/<file>`);
  }
} finally {
  cleanup();
}

function findValidator() {
  const ok = (d) => d && existsSync(join(d, "scripts", "quick_validate.py"));
  if (process.env.SKILL_CREATOR_DIR) {
    return ok(process.env.SKILL_CREATOR_DIR) ? resolve(process.env.SKILL_CREATOR_DIR) : null;
  }
  const base = join(homedir(), ".claude");
  const candidates = [
    join(base, "plugins/marketplaces/claude-plugins-official/plugins/skill-creator/skills/skill-creator"),
    join(base, "skills/skill-creator"),
  ];
  const synced = join(base, "skills/synced");
  if (existsSync(synced)) for (const d of readdirSync(synced)) candidates.push(join(synced, d, "skill-creator"));
  return candidates.find(ok) ?? null;
}

// Every field comes from committed files, so the manifest never drifts:
// version ← SKILL.md "Skill version: x.y.z", description ← README intro,
// author ← LICENSE copyright line, homepage ← GitHub remote.
function pluginManifest(skillDir, name) {
  const skill = readFileSync(join(skillDir, "SKILL.md"), "utf8");
  const version = skill.match(/Skill version:\s*(\d+\.\d+\.\d+)/)?.[1];
  if (!version) die("SKILL.md has no `Skill version: x.y.z` line (the plugin manifest needs a semver)");

  const readme = existsSync(join(skillDir, "README.md")) ? readFileSync(join(skillDir, "README.md"), "utf8") : "";
  // first plain paragraph after the title/tagline
  const para = readme.split(/\n\s*\n/).map((p) => p.trim())
    .find((p) => p && !p.startsWith("#") && !/^\*[^*].*\*$/.test(p) && !p.startsWith("```"));
  const description = (para || "").replace(/\s+/g, " ")
    .replace(/\*\*(.+?)\*\*/g, "$1").replace(/`([^`]+)`/g, "$1").trim().slice(0, 1024);
  if (!description) die("could not derive a plugin description from README.md");

  const lic = existsSync(join(skillDir, "LICENSE")) ? readFileSync(join(skillDir, "LICENSE"), "utf8") : "";
  const holder = lic.match(/Copyright \(c\)\s*(?:\d{4}(?:\s*[-–]\s*\d{4})?\s+)?(.+)/i)?.[1]?.trim();
  if (!holder) die("could not read the author from LICENSE's copyright line (plugin manifests require author.name)");
  const licenseId = /^MIT License/m.test(lic) ? "MIT" : undefined;

  const homepage = REPO ? `https://github.com/${REPO}` : undefined;

  return {
    name,
    version,
    description,
    author: { name: holder },
    ...(homepage && { homepage, repository: homepage }),
    ...(licenseId && { license: licenseId }),
    keywords: ["slides", "presentation", "deck", "react", "html"],
  };
}

// "owner/repo" when origin is on GitHub, else null
function githubRepo() {
  const remote = run("git", ["remote", "get-url", "origin"]).stdout.trim();
  return remote.match(/github\.com[:/](.+?)(?:\.git)?\/?$/)?.[1] ?? null;
}

function countFiles(dir) {
  let n = 0;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    n += e.isDirectory() ? countFiles(join(dir, e.name)) : 1;
  }
  return n;
}
