# Handouts and publishing

## PDF export by hand

`Cmd/Ctrl+P` → Save as PDF, tick **Background graphics**. The print sheet is a
separate static render of every slide at its final beat, in the language on screen,
in the palette `deck.config.js theme.print` names (or the screen theme if `null`).
Page size is 1920×1080px so nothing reflows.

## `bun run check:layout`

Drives that print sheet headlessly (system Chrome via playwright-core; set
`CHROME_PATH` if it is not found), for every language × handout theme:

- measures every element against its slide and **fails on overflow** — the canvas is
  fixed, so a long translation spills silently otherwise;
- reports `TIGHT` when copy passes the padding edge where the on-screen chrome sits;
- writes `layout-check/<name>-<lang>-<theme>.pdf`.

When `theme.print` pins a palette there is one PDF per language; otherwise one per
language × theme. The closing slide's download button names the same file
(`pdf/<name>-<lang>-<theme>.pdf`, relative to the published site).

Passing means nothing spilled. Look at the pages:
`pdftoppm -png -r 60 -f 3 -l 3 layout-check/<file>.pdf out`.

## `bun run dist`

`dist/index.html` + `dist/pdf/*.pdf`. **Refuses a stale set**: every PDF must be newer
than the built deck, or the published page would offer a handout of the previous
version and nothing on it could say so. `--no-pdf` ships the deck alone.

## `bun run publish`

`build → check:layout → dist → here.now`, using the public API directly
(create → upload → finalize). Flags: `--no-pdf`, `--dry-run`.

Auth: `$HERENOW_API_KEY`, else `~/.herenow/credentials`. With neither, the site is
**anonymous and expires in 24 hours**; the script prints a claim URL — pass it on
byte-for-byte. To get a permanent key: ask the user's email, then

```bash
curl -sS https://here.now/api/auth/agent/request-code -H "content-type: application/json" -d '{"email":"…"}'
# user pastes the code from their inbox
curl -sS https://here.now/api/auth/agent/verify-code  -H "content-type: application/json" -d '{"email":"…","code":"ABCD-2345"}'
mkdir -p ~/.herenow && echo "<apiKey>" > ~/.herenow/credentials && chmod 600 ~/.herenow/credentials
```

**The slug is the address.** The first publish creates one and writes it to
`.herenow/state.json` (gitignored). Put it in `deck.config.js publish.slug` so every
later publish, from any clone, updates the same site. A publish without it creates a
second site at a new URL and every link already handed out points at the old one.

What to tell the user: the site URL on its own line; whether it is permanent or
expires; the claim URL if anonymous; where the handouts are (`<site>/pdf/`).

## Custom domains, passwords, workspaces

Out of scope for the script; the here.now docs (https://here.now/docs) cover them,
and the `here-now` skill's `publish.sh` accepts `--workspace`. The deck itself is a
plain static site, so any host works — copy `dist/` anywhere.
