# beatdeck

An agent skill for building presentation decks that compile to **one self-contained
HTML file**: double-click it, no server, no network. Beat-by-beat reveals, shared-element
morphs, a contents menu, keyboard shortcuts, runtime language and light/dark switching,
a portrait reflow for phones, pixel-identical PDF handouts per language × theme,
your own fonts and theme tokens, and `bun run publish` to here.now.

Works with Claude Code and Claude Cowork (standard `SKILL.md` format).

## Install

```bash
npx skills add albertsyh/beatdeck -g     # globally, for every project
npx skills add albertsyh/beatdeck        # or into the current project
```

Or copy the folder into `~/.claude/skills/beatdeck` by hand. `init.mjs` also
installs the skill into every project it scaffolds.

## Use

```bash
bun ~/.claude/skills/beatdeck/scripts/init.mjs ../my-talk --title "My talk"
cd ../my-talk
bun run build            # → my-talk.html
bun run check:layout     # PDFs + overflow check (needs Chrome)
bun run publish          # → here.now
```

Then ask Claude: *"add a slide after the cover with three points that land one at a
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
