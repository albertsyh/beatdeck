/**
 * Publish the deck to here.now.
 *
 *   bun run publish              build → check:layout (PDFs) → dist → upload
 *   bun run publish --no-pdf     skip the handouts (no Chrome needed)
 *   bun run publish --dry-run    do everything except upload
 *
 * Talks to the public here.now API directly (create → upload → finalize),
 * so nothing but bun is needed. Auth, in order: $HERENOW_API_KEY, then
 * ~/.herenow/credentials. Without either the site is ANONYMOUS and expires
 * in 24 hours; the claim URL printed then makes it permanent.
 *
 * THE SLUG IS THE ADDRESS. The first publish creates one; it is written to
 * .herenow/state.json and printed. Put it in deck.config.js publish.slug so
 * every later publish — from any machine, any clone — updates the SAME
 * site; a new slug is a new URL and every link already handed out breaks.
 */
import { readFile, writeFile, mkdir, readdir, stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { join, resolve, relative } from "node:path";

const config = (await import(resolve("deck.config.js"))).default;
const args = process.argv.slice(2);
const noPdf = args.includes("--no-pdf") || config.publish?.pdf === false;
const dryRun = args.includes("--dry-run");
const BASE = process.env.HERENOW_BASE_URL || "https://here.now";
const STATE = ".herenow/state.json";

const die = (m) => { console.error(`error: ${m}`); process.exit(1); };
const run = (label, cmd) => {
  console.log(`\n▶ ${label}`);
  const r = spawnSync(cmd[0], cmd.slice(1), { stdio: "inherit" });
  if (r.status !== 0) die(`${label} failed (exit ${r.status})`);
};

/* --- 1. build, handouts, dist ------------------------------------------- */
run("build", ["bun", "run", "build.mjs"]);
if (!noPdf) run("check:layout (handouts)", ["bun", "run", "tools/check-layout.mjs"]);
run("dist", ["bun", "run", "tools/make-dist.mjs", ...(noPdf ? ["--no-pdf"] : [])]);

/* --- 2. auth and slug ----------------------------------------------------- */
let apiKey = process.env.HERENOW_API_KEY || "";
let keySource = apiKey ? "env" : "none";
if (!apiKey) {
  try { apiKey = (await readFile(join(homedir(), ".herenow", "credentials"), "utf8")).trim(); keySource = "credentials file"; } catch {}
}
let state = { publishes: {} };
try { state = JSON.parse(await readFile(STATE, "utf8")); } catch {}
let slug = config.publish?.slug || null;
let claimToken = null;
if (!slug) {
  const known = Object.entries(state.publishes || {});
  if (known.length === 1) { slug = known[0][0]; claimToken = known[0][1].claimToken || null; }
  else if (known.length > 1) die(`${STATE} has several slugs and deck.config.js names none. Set publish.slug to the one to update: ${known.map(([s]) => s).join(", ")}`);
} else {
  claimToken = state.publishes?.[slug]?.claimToken || null;
}
if (!apiKey && slug && !claimToken) die(`no API key and no claim token for slug "${slug}" — cannot update an anonymous site from here. Save a key to ~/.herenow/credentials.`);

/* --- 3. the file manifest ------------------------------------------------- */
const TYPES = { html: "text/html; charset=utf-8", pdf: "application/pdf", css: "text/css; charset=utf-8", js: "text/javascript; charset=utf-8", png: "image/png", jpg: "image/jpeg", svg: "image/svg+xml", json: "application/json; charset=utf-8", txt: "text/plain; charset=utf-8" };
async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(p));
    else if (e.name !== ".DS_Store") out.push(p);
  }
  return out.sort();
}
const files = [];
for (const p of await walk("dist")) {
  const bytes = await readFile(p);
  files.push({
    path: relative("dist", p).split("\\").join("/"),
    size: (await stat(p)).size,
    contentType: TYPES[p.split(".").pop().toLowerCase()] || "application/octet-stream",
    hash: createHash("sha256").update(bytes).digest("hex"),
    local: p
  });
}
if (!files.find((f) => f.path === "index.html")) die("dist/index.html is missing");
console.log(`\n▶ publish ${files.length} file(s)${slug ? ` → ${slug}` : " (new site)"} as ${apiKey ? `authenticated (${keySource})` : "ANONYMOUS"}`);
if (dryRun) { console.log("dry run — not uploading."); process.exit(0); }

/* --- 4. create/update → upload → finalize ------------------------------- */
const headers = { "content-type": "application/json", "x-herenow-client": "beatdeck/publish-mjs" };
if (apiKey) headers.authorization = `Bearer ${apiKey}`;
const body = { files: files.map(({ path, size, contentType, hash }) => ({ path, size, contentType, hash })) };
if (config.title) body.viewer = { title: config.title };
if (claimToken && slug && !apiKey) body.claimToken = claimToken;

const res = await fetch(slug ? `${BASE}/api/v1/publish/${slug}` : `${BASE}/api/v1/publish`, {
  method: slug ? "PUT" : "POST", headers, body: JSON.stringify(body)
});
const created = await res.json().catch(() => ({}));
if (!res.ok || created.error) die(`${created.error || res.status}${created.details ? ` (${JSON.stringify(created.details)})` : ""}`);

/* remember the slug BEFORE uploading, so a failed upload or finalize can be
   retried against the same site instead of creating a second one */
const outSlug = created.slug;
state.publishes = state.publishes || {};
state.publishes[outSlug] = {
  siteUrl: created.siteUrl,
  ...(created.claimToken ? { claimToken: created.claimToken, claimUrl: created.claimUrl } : {}),
  ...(created.expiresAt ? { expiresAt: created.expiresAt } : {}),
  createdAt: new Date().toISOString()
};
await mkdir(".herenow", { recursive: true });
await writeFile(STATE, JSON.stringify(state, null, 2) + "\n");

const uploads = created.upload?.uploads || [];
const skipped = created.upload?.skipped || [];
console.log(`uploading ${uploads.length} file(s)${skipped.length ? ` (${skipped.length} unchanged)` : ""}…`);
for (const u of uploads) {
  const f = files.find((x) => x.path === u.path);
  if (!f) die(`server asked for ${u.path}, which is not in dist/`);
  const h = {};
  if (u.headers?.["Content-Type"]) h["Content-Type"] = u.headers["Content-Type"];
  const put = await fetch(u.url, { method: "PUT", headers: h, body: await readFile(f.local) });
  if (!put.ok) die(`upload failed for ${u.path} (HTTP ${put.status})`);
}

const fin = await fetch(created.upload.finalizeUrl, {
  method: "POST", headers, body: JSON.stringify({ versionId: created.upload.versionId })
});
const finalized = await fin.json().catch(() => ({}));
if (!fin.ok || finalized.error) die(`finalize failed: ${finalized.error || fin.status}`);

/* --- 5. record the live version ------------------------------------------- */
const siteUrl = finalized.siteUrl || created.siteUrl;
state.publishes[outSlug].siteUrl = siteUrl;
state.publishes[outSlug].publishedAt = new Date().toISOString();
await writeFile(STATE, JSON.stringify(state, null, 2) + "\n");

console.log(`\n${siteUrl}`);
if (apiKey) console.log("permanent — saved to your here.now account");
else {
  console.log("ANONYMOUS — expires in 24 hours.");
  if (created.claimUrl) console.log(`claim it to keep it: ${created.claimUrl}`);
}
if (!config.publish?.slug) console.log(`\nPin it: set publish.slug = "${outSlug}" in deck.config.js so the next publish updates this same address.`);
if (!noPdf) console.log(`handouts at ${siteUrl}pdf/`);
