# Maintaining Paper-to-Deck (for Codex and Claude Code agents)

Paper-to-Deck is developed by **two harnesses** — Claude Code and OpenAI Codex — each of
which finds different, valuable issues. This repo is the **single source of truth** for
both. Follow these rules so their work composes instead of colliding.

## One source, symlinked working dirs

This repository *is* the working copy. On the maintainer's machine the personal skill
directories are symlinks into `skills/` here (names match 1:1 — no prefix stripping):

```
~/.claude/skills/p2d-<x>       ->  <repo>/skills/p2d-<x>
~/.claude/skills/paper-to-deck ->  <repo>/skills/paper-to-deck
~/.codex/skills/p2d-<x>        ->  <repo>/skills/p2d-<x>
```

Editing a skill in **either** tool edits the file in this repo directly — no `cp` sync, no
second copy to drift. To publish, commit and push from this repo. The sibling lecture repo
is `maxuwp/posed`.

## The rule for every change

0. **Lint before push** — `python3 scripts/release_lint.py` must exit clean.
1. **Pull first** — `git pull` before editing.
2. **Edit** through your working dir (a symlink into this repo).
3. **Commit + push** as part of "update the skill"; never hand-copy between trees.
4. **Tag the source**: `Found-on: codex-desktop` / `Found-on: claude-code`.
5. Run the two harnesses **sequentially** on the same skill (shared tree = last-write-wins
   between commits).

## Keep the SKILL body tool-agnostic

Shared `SKILL.md` files must read correctly under both harnesses. When something is
genuinely harness-specific, **do not fork the SKILL body** — put it in a scoped reference
file and add one tool-agnostic pointer. See `skills/paper-to-deck/reference/harness_adaptation.md`
(Codex ↔ Claude tool-name mappings). Prefer portable phrasing (`<skill-dir>/scripts/...`,
"a fresh subagent session") over one tool's exact API name.

## Packaging (both manifests live here)

| Harness | Manifest |
|---|---|
| Claude Code | `.claude-plugin/plugin.json` |
| OpenAI Codex | `.codex-plugin/plugin.json` |

Keep the two `plugin.json` **versions in lockstep**. The `skills/` set is shared; each tool
reads its own manifest.

## Versioning

**Version collisions (two harnesses, same number).** Because Codex and Claude each pick the
next version independently, both can ship different features under the same `X.Y` in one
window — git then merges both changelog appends cleanly, leaving two same-numbered headings.
The convention: **whoever pushes second bumps to the next number** and updates plugin.json to
match. If two features genuinely release together, merge them under ONE heading with a single
version block. `scripts/release_lint.py` flags duplicate `## <prefix>_skill.X.Y` headings so
this can't reach a push unnoticed.


`p2d_skill.X.Y`, tracked in `CHANGELOG.md`. Record which harness surfaced each change.
