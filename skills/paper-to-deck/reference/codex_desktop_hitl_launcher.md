# Codex Desktop HITL Launcher Handoff

> ## ⚠️ macOS Codex Desktop HITL rule (READ FIRST)
> **On macOS Codex Desktop, do NOT rely on Finder, `.app` launchers, external browsers,
> direct `file://` pages, or ad-hoc local-server workarounds for POSED HITL gates.** They
> fail in the sandbox. The one reliable path: run an **already-approved POSED command
> prefix** that starts the local `127.0.0.1` HITL server, pass `--status-file`, read the
> reported URL from stderr or the status file, then open that exact URL **directly in the
> Codex in-app browser** (Browser plugin). If a new gate name or item name is introduced,
> get its command prefix **approved before the stage begins** — an unapproved prefix drops
> Codex into the restricted sandbox where it cannot bind the local port.
>
> *Scope: this rule is validated on **macOS Codex Desktop only**. Windows and Linux HITL
> launch behavior is not yet validated — test separately before documenting platform rules.*

Use this pattern whenever a POSED HITL form runs inside Codex Desktop. Claude Code does not
need it (it holds the foreground server itself); this is the Codex-Desktop path.

## The working pattern (do this)

1. **Run the approved POSED command directly** — do NOT wrap it in a Finder/`.command`
   launcher. The command prefix must already be approved so the sandbox allows the port
   bind. Pass `--status-file` (put it under `/private/tmp`):

   ```bash
   python3 <paper-to-deck-skill-dir>/scripts/posed_app.py items \
     --name outline_step4_activity_assessment \
     --session "<session-dir>" \
     --status-file /private/tmp/posed_hitl_status.json
   ```
   (Resolve `<posed-skill-dir>` to your install path. Same shape for `gate`, `scope`,
   `plan-wizard`, `choose`, `intake`, `materials`, `ledger` — only `--name`/`--stage`
   changes.)

2. **Read the ready URL** — from stderr:
   ```
   [posed_app] Form ready: http://127.0.0.1:58675/
   ```
   or from the status file:
   ```json
   { "status": "ready", "url": "http://127.0.0.1:58675/", ... }
   ```

3. **Open that exact URL in the Codex in-app browser** (Browser plugin), as a **fresh
   tab** — never navigate an old `file://…` tab:
   ```js
   await tab.goto("http://127.0.0.1:58675/")
   ```

4. **After the user submits, read the decision JSON** (`status` → `completed`, then
   `decision_path`) and continue the POSED workflow. Emit the stage-end artifact summary.

## Command-prefix approval

New gate/item names introduce new command prefixes. **Approve the prefix before the stage
begins.** If Codex hits an unapproved `posed_app.py … --name <new>` mid-stage, it may be
forced into the restricted sandbox and fail to bind the port — which looks like a server
failure but is really a permissions failure. When you add a gate name to a skill, list its
exact command in that skill so the prefix can be pre-approved.

## Failure modes to expect (and what they really mean)

- **"Operation not permitted"** binding a port from a direct Python/Node server → the
  command prefix was not approved; the sandbox blocked the bind. Fix: approved prefix.
- **`file://` navigation blocked by Browser policy** → never use `file://` gate pages; open
  the `http://127.0.0.1:<port>/` URL instead.
- **Finder / `.app` launchers unreliable** → they may lack permission to read OneDrive,
  Documents, `.codex`, or plugin paths, and can silently do nothing. Don't use them.
- **Stale page** → reusing an old `127.0.0.1` tab/URL shows a previous gate, not the
  current one. Always open the NEW status URL in a fresh tab.
- **Unapproved new gate name** → forced sandbox, port bind fails (see above).

## Pre-flight checklist (before opening any HITL page on Codex Desktop)

- [ ] Is this command prefix already approved?
- [ ] Is the gate input file present (e.g. `hitl/<name>_input.json`)?
- [ ] Is `--status-file` provided?
- [ ] Is the browser target the **new** status URL, not an old `127.0.0.1` tab?
- [ ] Does this path avoid Finder, external browser, and `file://` fallback?

## Standard per-gate pattern (applies to every HITL gate)

write input JSON → run the POSED helper with `--status-file` → wait for `status:"ready"` →
open `status.url` in the in-app browser → wait for submission → read the decision JSON →
emit a concise artifact summary after the stage.

## Status file schema

When the server is live:
```json
{
  "status": "ready",
  "url": "http://127.0.0.1:52351/",
  "pid": 12345,
  "mode": "items",
  "stage": "outline_step4_activity_assessment",
  "project_session": "/path/to/project/session",
  "runtime_session": "/private/tmp/posed-local-sessions/session-slug",
  "cloud_safe_active": true,
  "started_at": "…"
}
```
After submit: `status` → `submitted_to_server` (decision being written/synced) → `completed`
with `decision_path` (and, for gate mode, `decision` + `artifact_updated`).

## Automatic continuation

Poll the status file (or the expected `hitl/<name>_decision.json`) every few seconds:
`ready` = keep waiting; `submitted_to_server` = keep waiting for the JSON; `completed` +
readable `decision_path` = resume the stage immediately. The browser submission IS the HITL
signal — do not require the user to return to chat and say they submitted.

## While the page is open: wait quietly

- Do not repeatedly screenshot or narrate the page. Open it, say once that the form is
  open, then wait silently on the status file.
- Do not click, submit, or simulate a decision. **Never auto-accept a gate** unless the
  user explicitly says to auto-accept that specific gate in the current turn. "Prefer
  defaults" means prefill defaults on the page — never accept on the faculty's behalf.

## Relationship to cloud-safe HITL

Combine both: keep `--cloud-safe auto` (staging for OneDrive/iCloud/… sessions) AND add
`--status-file`. Cloud-safe decides where files stage/sync; the launcher handoff decides
how the localhost page is started and opened.

## Do not

- Do not replace the native page with a static `file://` page unless the user explicitly approves.
- Do not use Finder / `.app` launchers, or ask faculty to run Terminal commands, as the normal path.
- Do not navigate a stale local-file or old-port tab after a policy error; open a fresh `127.0.0.1` tab.
- Do not stop after opening the page; poll for completion and continue automatically.

## Platform scope

Validated on **macOS Codex Desktop**. **Windows and Linux HITL launch behavior is not yet
validated; test separately before documenting platform-specific rules.** Do not assume the
sandbox, port-binding, or in-app-browser policies are the same on other platforms.
