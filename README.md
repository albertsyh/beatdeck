# beatdeck

*Presentations, beat by beat.*

An agent skill for building presentation decks that compile to **one self-contained
HTML file**: double-click it, no server, no network. Beat-by-beat reveals, shared-element
morphs, a contents menu, keyboard shortcuts, runtime language and light/dark switching,
a portrait reflow for phones, pixel-identical PDF handouts per language × theme,
your own fonts and theme tokens, and `bun run publish` to here.now.

Works with any harness that reads the standard `SKILL.md` format — Claude Code and
Cowork, Codex, Cursor, and the ~40 agents the `skills` CLI knows about.

## Install

```bash
npx skills add albertsyh/beatdeck -g              # globally, for every project
npx skills add albertsyh/beatdeck                 # or into the current project
npx skills add albertsyh/beatdeck -a codex -g     # a specific harness
```

The CLI picks the right directory per harness (`~/.claude/skills` for Claude Code,
`~/.codex/skills` for Codex, and so on) — it prompts for which agents to install to,
or takes `-a`.

Or copy the folder into your harness's skills directory by hand. Every scaffolded
project also gets `AGENTS.md` (imported by `CLAUDE.md`) and a copy of the conventions
in `docs/beatdeck/`, so an agent opening it later is not lost without the skill.

### claude.ai and ChatGPT (upload)

Download the file for where you are installing it. Each link is the newest
[release](https://github.com/albertsyh/beatdeck/releases).

| Download | Upload it to |
|---|---|
| [**beatdeck.skill**](https://github.com/albertsyh/beatdeck/releases/latest/download/beatdeck.skill) | claude.ai: **Customize → Skills → + → Create skill → Upload a skill** (code execution on) |
| [**beatdeck-plugin.zip**](https://github.com/albertsyh/beatdeck/releases/latest/download/beatdeck-plugin.zip) | ChatGPT: **Plugins → New Plugin**. Also a Claude Code plugin (`claude --plugin-dir`) |
| [beatdeck.zip](https://github.com/albertsyh/beatdeck/releases/latest/download/beatdeck.zip) | same bytes as the `.skill`, for uploaders that only take `.zip` |

ChatGPT skills and plugins need a Business, Enterprise or Edu workspace; uploads are
scanned first and may sit in *Needs Review*. In either sandbox the agent builds the
deck and hands you the HTML; `check:layout`, handouts and `publish` need Chrome,
network and a here.now key, so they belong on your machine.

To build the packages yourself:

```bash
bun scripts/package.mjs             # → dist/, from committed files, validated
bun scripts/package.mjs --release   # …and publish them as release v<Skill version>
```

The packager runs skill-creator's official validator (needs the skill-creator
plugin and [uv](https://docs.astral.sh/uv/)) and writes all of `dist/` or nothing.
`--release` needs [gh](https://cli.github.com/) and a clean, pushed HEAD whose
version has no release yet.

## Use

```bash
bun <skill-dir>/scripts/init.mjs ../my-talk --title "My talk"
cd ../my-talk
bun run build            # → my-talk.html
bun run check:layout     # PDFs + overflow check (needs Chrome)
bun run publish          # → here.now
```

Then ask your agent: *"add a slide after the cover with three points that land one at a
time"* — the skill knows the conventions.

## Layout

```
SKILL.md            what the agent reads
reference/          authoring, theming, i18n, publishing, checks
scripts/init.mjs    scaffold a project from template/
template/           the project skeleton: framework, tools, starter deck
```

## Requirements

- [bun](https://bun.sh) ≥ 1.1 (build, tools)
- Google Chrome (only for `check:layout` / handouts)
- Python 3 + `fonttools` in a project `.venv` (only for non-Latin font subsetting)

## Licence

Code is MIT. The embedded default typefaces (Syne, DM Sans) are SIL Open Font
License 1.1 — see `LICENSES/`. Swap them in `deck.config.js` and run `bun run fonts`.

Extracted from a working training deck (`personal-apps`, 32 slides, 3 languages) and
generalised; the constraints in `SKILL.md` are the ones that bit there.
