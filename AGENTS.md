# AGENTS.md — Paper-to-Deck (Codex + Claude Code)

This repo is the **single source of truth** for Paper-to-Deck on both harnesses. It ships
the Claude Code plugin (`.claude-plugin/`) and the Codex plugin (`.codex-plugin/`) from one
shared `skills/` set.

**The personal skill dirs are symlinks into this repo.** `~/.codex/skills/p2d-<x>` →
`skills/p2d-<x>` and `~/.codex/skills/paper-to-deck` → `skills/paper-to-deck` (names match
1:1). Editing through `~/.codex/skills/…` edits the file in this repo directly — no second
copy.

## Rules for every change

1. `git pull` before editing.
2. Edit the skill (via the symlinked working dir or here directly).
3. `git commit && git push` from this repo — committing is how you publish; never copy
   files between trees.
4. Commit trailer `Found-on: codex-desktop` (or `codex-cli`).
5. **Keep the SKILL body tool-agnostic.** Do not fork per harness; harness-specifics go in a
   scoped `skills/*/reference/*.md` file + one neutral pointer. See
   `skills/paper-to-deck/reference/harness_adaptation.md`.
6. Bump BOTH `.claude-plugin/plugin.json` and `.codex-plugin/plugin.json` in lockstep; log
   in `CHANGELOG.md`.

Full detail: **MAINTAINING.md**.
