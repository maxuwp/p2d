#!/usr/bin/env python3
"""
POSED / Paper-to-Deck guided web app (v3 — single editable document view).

Gives the user a browser-based form instead of terminal prompts — the n8n
Form-node UX, upgraded with direct in-place editing. The agent (Claude Code,
Codex, etc.) launches this script IN THE FOREGROUND with Bash; the script
opens the user's browser, BLOCKS until the user submits, writes the result to
a JSON file inside the session folder, and exits. The agent then reads the
JSON and continues the workflow.

Stdlib only — no pip installs needed. (The gate page loads marked.js and
turndown.js from CDN for markdown rendering/editing; if offline it degrades
to a plain text editor.)

USAGE

  Intake form (start of a session):
    python3 posed_app.py intake --flow posed --session ./posed-sessions/my-session/
    python3 posed_app.py intake --flow p2d   --session ./p2d-sessions/my-session/
    python3 posed_app.py intake --flow audit --session ./audit-sessions/my-course/
  → writes <session>/hitl/intake.json and prints its path to stdout.

  Change-ledger review (AI-impact course audit — itemized approval):
    python3 posed_app.py ledger --session <dir> --artifact <dir>/change_ledger.json \
        --stage change_ledger --title "Proposed Changes"
  → every proposed change gets its own approve/reject/defer decision; the
    proposed text is directly editable. Writes
    <session>/hitl/<stage>_decision.json:
    { "stage", "ledger_path",
      "decisions": [ {"id","decision":"approve|reject|defer",
                      "proposed":"<final text>","edited":bool,"comment":""} ],
      "counts": {"approve":N,"reject":N,"defer":N}, "submitted_at" }

  HITL gate (after each stage):
    python3 posed_app.py gate --session <dir> --stage plan \
        --artifact <dir>/curriculum_plan.json --title "Stage 1: Curriculum Plan"

  Cloud-synced sessions (OneDrive / iCloud Drive / Dropbox / Google Drive /
  Box / CloudStorage) are detected automatically. The page runs from
  /private/tmp/posed-local-sessions/<session-slug>/, then decision files and
  intentional edits sync back to the project session. Override with
  --cloud-safe always or --cloud-safe never when debugging.

  Codex Desktop launcher handoff:
    add --status-file /private/tmp/posed-hitl-status.json
  The helper writes {"status":"ready","url":"http://127.0.0.1:<port>/",...}
  when the server is live, so Codex can open that URL in a fresh in-app
  browser tab. After submit and decision-file sync, it writes
  {"status":"completed","decision_path":"...",...}.

  The gate shows ONE editable document view — no separate preview/edit tabs:
    - JSON artifacts render as a structured form: every value is an editable
      field (text box, number box, checkbox), lists have add/remove buttons.
      The user never sees raw JSON.
    - Markdown artifacts render as a rich document that is directly editable
      (contenteditable); edits are converted back to markdown on submit.

  TWO buttons (edits are detected automatically):
    Accept and continue — uses the document as it currently stands. If the
        user edited it, the script writes the edited version back to the
        artifact file (original backed up to
        <session>/hitl/<stage>_original.<ext>) and records decision "edit";
        otherwise records "accept".
    Regenerate — asks the AI for a new version; an optional guidance box
        lets the user steer it ("less math, more applications"). If the user
        edited the document before clicking Regenerate, the edits are KEPT:
        the script writes them to the artifact file (with backup) and the
        agent regenerates starting from the edited version.

  Decision questions: if a JSON artifact contains a question-list key
  (key_decision_points_for_faculty / faculty_decision_prompts /
  questions_for_faculty), those questions are NOT editable content — they are
  rendered as a read-only "Questions for you" section with an answer box per
  question. Non-empty answers are returned in the decision JSON.

  Decision JSON shape (written to <session>/hitl/<stage>_decision.json):
    { "stage": "plan",
      "decision": "accept | edit | regenerate",
      "guidance": "<text if regenerate, may be empty>",
      "faculty_answers": [ {"question": "...", "answer": "..."}, ... ],
      "artifact_updated": true|false,        # true when the user edited the doc
      "original_backup": "<path>|null",
      "submitted_at": "<iso8601>" }

  Agent rule for faculty_answers: if non-empty, apply each answer as a
  targeted revision (like refinement_feedback) — even when the decision is
  accept/edit, apply the answers and then re-gate the revised artifact.

Agent semantics:
  accept     → mark artifact approved in the manifest, continue.
  edit       → the artifact FILE ALREADY CONTAINS the user's edited version;
               mark approved (source: user_edited), continue.
  regenerate → re-run the stage's sub-skill; if "guidance" is non-empty, pass
               it as refinement_feedback.

The server binds 127.0.0.1 only and shuts down after one submission.

IMPORTANT FOR AGENTS: run this script in the FOREGROUND (blocking Bash call,
generous timeout, e.g. 600000 ms). Background launches can be reaped by the
harness between turns, which kills the server before the user submits.
"""

import argparse
import hashlib
import html
import json
import os
import re
import shutil
import sys
import threading
import time
import webbrowser
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs

# ----------------------------------------------------------------------------
# Form field definitions (intake)
# ----------------------------------------------------------------------------

POSED_INTAKE_FIELDS = [
    ("topic", "Lecture / module topic", "text", True,
     "e.g., AI Hardware: NPUs and On-Device Inference"),
    ("audience_level", "Audience level", "text", True,
     "e.g., Sophomore Computer Engineering"),
    ("prerequisites", "Prerequisites (what students already know)", "textarea", False,
     "e.g., digital logic, basic CPU architecture"),
    ("module_purpose", "Module purpose (why this lecture, where it sits in the course)", "textarea", True, ""),
    ("instructional_format", "How is the class run? (instructional format)", "select", True,
     "lecture-plus-lab|direct-lecture|flipped|concept-stitching|problem-based|peer-instruction|studio-workshop|socratic-seminar|custom"),
    ("duration_minutes", "Total session duration (minutes)", "number", True, "50"),
    ("course_code", "Course code", "text", False, "e.g., CompENG 3510"),
    ("course_name", "Course name", "text", False, "e.g., Logic and Digital Design"),
    ("instructor", "Instructor name", "text", True, ""),
    ("institution", "Institution", "text", False, "e.g., UW-Platteville"),
    ("local_materials_path", "Content knowledge base for sourcing (optional)", "text", False,
     "path to your reference library / Obsidian vault / course archive — used in Stage 4 to ground drafting before any web search. (Your teaching-style materials for the persona are collected separately in Stage 2.)"),
    ("other_context", "Other context the AI should know", "textarea", False,
     "textbook in use, course rhythm, recent class events…"),
]

P2D_INTAKE_FIELDS = [
    ("paper_path", "Path to the paper PDF", "text", True,
     "e.g., ./papers/my-paper.pdf"),
    ("main_topic", "Main topic / working title for the talk", "text", True, ""),
    ("audience_mode", "Audience mode", "select", True,
     "undergrad-intro|grad-seminar|conference-talk|research-group-share|self-study"),
    ("audience_level", "Audience description", "text", False,
     "e.g., Sophomore CE class, or ASEE conference session"),
    ("event_duration", "Presentation duration (minutes)", "number", True, "15"),
    ("prerequisites", "What the audience already knows", "textarea", False, ""),
    ("module_purpose", "Purpose of the presentation", "textarea", True, ""),
    ("instructor", "Presenter name", "text", True, ""),
    ("institution", "Institution", "text", False, ""),
    ("special_guidelines", "Special presentation guidelines (conference template, branding…)", "textarea", False, ""),
    ("learning_assistance", "Want the AI to fact-check its paper analysis before you review it?", "select", True,
     "Yes - run verification (recommended for unfamiliar papers)|No - I already know this paper well"),
    ("visual_style", "Visual style preference", "select", True, "Minimal|Balanced|Rich"),
    ("other_context", "Other context the AI should know", "textarea", False, ""),
]

AUDIT_INTAKE_FIELDS = [
    ("course_folder", "Course materials folder (path)", "text", True,
     "e.g., ~/Documents/courses/compeng3510 — scanned read-only; your originals are never modified"),
    ("course_code", "Course code", "text", False, "e.g., CompENG 3510"),
    ("course_name", "Course name", "text", True, ""),
    ("course_level", "Course level", "text", True, "e.g., Junior undergraduate"),
    ("discipline", "Discipline / domain", "text", True,
     "e.g., Computer Engineering — this drives the AI-capability research"),
    ("instructor", "Instructor name", "text", True, ""),
    ("institution", "Institution", "text", False, "e.g., UW-Platteville"),
    ("ai_stance", "Your AI policy stance for this course", "select", True,
     "undecided - recommend a stance per assignment|prohibit - AI use not allowed|"
     "permit-with-disclosure - allowed if documented|encourage-with-guardrails - AI expected, process assessed|"
     "varies-by-assignment - different rules per assignment"),
    ("redesign_appetite", "How much change are you open to?", "select", True,
     "light-touch - policy and wording changes only|moderate - redesign the most AI-exposed assignments|"
     "deep - restructure assessments and topic emphasis where warranted"),
    ("capability_refresh", "AI-capability research", "select", True,
     "use-cached-if-fresh - reuse a capability profile under 90 days old|force-refresh - run new web research now"),
    ("audit_lenses", "What should this audit cover? (pick one or more)", "checkboxes", True,
     "core::Core vulnerability audit::Which assignments AI can complete; where AI has changed the ground under the course.||"
     "format::Format modernization::Which content could use AI-enabled formats — NotebookLM-style shorts, interactive animations — for more active learning.||"
     "skills::Skill obsolescence & AI-era additions::Which taught skills AI has made obsolete (not fundamentals), and which new skills — loop/workflow engineering — to add.||"
     "currency::Content currency (advisory)::Which taught content the field has superseded (e.g. prompt → context engineering). Advisory only; we report, you decide.||"
     "access::Accessibility::Where materials fall short of accessibility standards — and what AI now makes newly feasible."),
    ("accessibility_depth", "Accessibility depth (only used if you picked Accessibility)", "condselect", False,
     "wcag - WCAG 2.2 conformance check (contrast, alt text, structure, captions)|"
     "wcag+ai - WCAG check + AI-enabled accommodations (auto audio, captioning, alt formats, pacing)|"
     "udl - Full UDL 3.0 lens (engagement, representation, action/expression — deepest, most authoring)"),
    ("protected_skills", "Protected foundational skills (the obsolescence lens will never propose removing these)", "textarea", False,
     "e.g., pointer arithmetic, hand-tracing recursion, reading a datasheet — skills you consider foundational regardless of AI"),
    ("focus_areas", "Anything to focus on — or leave alone?", "textarea", False,
     "e.g., focus on the homework series; do not touch the final exam"),
    ("other_context", "Other context the AI should know", "textarea", False,
     "textbook, LMS, cohort size, known AI-use incidents, department policy…"),
]

# ----------------------------------------------------------------------------
# Shared HTML / CSS
# ----------------------------------------------------------------------------

BASE_CSS = """
:root { --bg:#f8fafc; --card:#ffffff; --text:#0f172a; --muted:#64748b;
        --border:#e2e8f0; --primary:#4f46e5; --primary-dark:#4338ca; }
* { box-sizing:border-box; margin:0; padding:0; }
body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
       background:var(--bg); color:var(--text); line-height:1.6; padding:32px 16px; }
.container { max-width:920px; margin:0 auto; }
.header { background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%); color:#fff;
          padding:26px 32px; border-radius:14px; margin-bottom:22px; }
.header h1 { font-size:1.45rem; margin-bottom:4px; }
.header p  { opacity:.9; font-size:.93rem; }
.card { background:var(--card); border:1px solid var(--border); border-radius:12px;
        padding:26px; margin-bottom:20px; box-shadow:0 1px 3px rgba(0,0,0,.06); }
label { display:block; font-weight:600; margin:18px 0 6px; font-size:.92rem; }
label .req { color:#dc2626; }
label .hint { display:block; font-weight:400; color:var(--muted); font-size:.82rem; }
input[type=text], input[type=number], textarea, select {
  width:100%; padding:10px 12px; border:1px solid var(--border); border-radius:8px;
  font-size:.95rem; font-family:inherit; background:#fff; }
textarea { min-height:84px; resize:vertical; }
input:focus, textarea:focus, select:focus, [contenteditable]:focus {
  outline:2px solid #c7d2fe; border-color:transparent; }
.btn { display:inline-block; padding:13px 30px; border:none; border-radius:9px;
       color:#fff; font-size:1rem; font-weight:600; cursor:pointer; margin:6px 8px 0 0; }
.btn-accept { background:#16a34a; } .btn-accept:hover { background:#15803d; }
.btn-regen  { background:#7c3aed; } .btn-regen:hover  { background:#6d28d9; }
.btn-primary{ background:var(--primary); } .btn-primary:hover { background:var(--primary-dark); }
.btn:disabled { opacity:.5; cursor:default; }
.btn-skip  { background:#0891b2; } .btn-skip:hover  { background:#0e7490; }
.doc { background:#fff; border:1px solid var(--border); border-radius:12px;
       padding:30px 34px; max-height:600px; overflow-y:auto; }
.doc h1 { font-size:1.4rem; margin:14px 0 8px; }
.doc h2 { font-size:1.22rem; margin:18px 0 6px; color:#312e81; }
.doc h3 { font-size:1.05rem; margin:14px 0 5px; color:#4338ca; }
.doc h4,.doc h5 { font-size:.95rem; margin:12px 0 4px; color:#6366f1; }
.doc p { margin:6px 0; }
.doc ul,.doc ol { margin:6px 0 10px 24px; }
.doc table { border-collapse:collapse; margin:10px 0; width:100%; }
.doc th { background:#eef2ff; text-align:left; }
.doc th,.doc td { border:1px solid var(--border); padding:7px 10px; font-size:.88rem; }
.doc pre { white-space:pre-wrap; font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
           font-size:.85rem; background:#f1f5f9; padding:12px; border-radius:8px; }
.doc code { background:#f1f5f9; padding:1px 5px; border-radius:4px;
            font-family:ui-monospace,Menlo,monospace; font-size:.85em; }
.doc[contenteditable=true] { cursor:text; }
.val-input { border:none; border-bottom:1.5px dashed #cbd5e1; border-radius:0;
             padding:2px 4px; font-size:.95rem; background:transparent; width:100%; }
.val-input:hover { border-bottom-color:var(--primary); background:#fafbff; }
.val-area { border:1px dashed #cbd5e1; border-radius:8px; padding:8px 10px;
            font-size:.93rem; background:#fdfdff; width:100%; min-height:0;
            overflow:hidden; resize:none; }
.val-area:hover { border-color:var(--primary); }
.obj-card { border:1px solid var(--border); border-radius:10px; padding:14px 18px;
            margin:10px 0; background:#fcfcfd; }
.card-head { display:flex; justify-content:space-between; align-items:center;
             margin-bottom:4px; }
.arr-item { display:flex; gap:8px; align-items:flex-start; margin:4px 0; }
.arr-item > :first-child { flex:1; }
.mini-btn { border:1px solid var(--border); background:#fff; border-radius:6px;
            padding:2px 9px; cursor:pointer; color:var(--muted); font-size:.85rem; }
.mini-btn:hover { color:#dc2626; border-color:#dc2626; }
.mini-btn.add { margin-top:6px; color:var(--primary); }
.mini-btn.add:hover { border-color:var(--primary); }
.checkrow { display:flex; align-items:center; gap:8px; margin:2px 0; }
.checkrow input { width:auto; }
.badge { display:none; margin:12px 0 0; padding:8px 14px; background:#fef9c3;
         border:1px solid #fde047; border-radius:8px; font-size:.85rem; }
#guidance-box { display:none; margin-top:14px; }
.err { display:none; margin-top:14px; padding:12px 16px; background:#fee2e2;
       border:1px solid #fca5a5; border-radius:8px; font-size:.9rem; color:#991b1b; }
.editnote { color:var(--muted); font-size:.83rem; margin:8px 2px 0; }
.done { text-align:center; padding:60px 20px; }
.done h1 { color:#16a34a; font-size:2rem; margin-bottom:10px; }
footer { text-align:center; color:var(--muted); font-size:.8rem; margin-top:28px; }
.folder-bar { display:flex; align-items:center; gap:10px; justify-content:center; flex-wrap:wrap;
              margin-top:22px; padding:10px 16px; background:#f1f5f9; border:1px solid var(--border);
              border-radius:10px; font-size:.85rem; color:var(--muted); }
.folder-bar code { background:#fff; padding:3px 8px; border-radius:6px; font-size:.8rem;
                   user-select:all; word-break:break-all; }
.folder-bar button { border:1px solid var(--border); background:#fff; border-radius:6px;
                     padding:4px 12px; cursor:pointer; font-size:.82rem; color:var(--primary); }
.folder-bar button:hover { border-color:var(--primary); }
"""

DONE_HTML = """<div class="card done"><h1>✓ Submitted</h1>
<p>You can close this tab and return to the chat — the AI will continue from here.</p>
<p id="ac-note" style="color:#64748b;font-size:.85rem;margin-top:8px">This tab will close automatically in 4 seconds…</p></div>
<script>setTimeout(function(){window.close();},4000);</script>"""

POST_JS = r"""
async function postForm(data) {
  try {
    const resp = await fetch('/submit', { method:'POST',
      headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams(data) });
    if (!resp.ok) throw new Error('HTTP '+resp.status);
    document.querySelector('.container').innerHTML = __DONE__;
    window.scrollTo(0,0);
    return true;
  } catch (e) {
    const err = document.getElementById('err');
    err.style.display = 'block';
    err.textContent = '⚠ Could not reach the local server — the AI agent process may have ' +
      'stopped or timed out. Go back to the chat and ask the agent to reopen this form. ' +
      '(Your entries are still on this page; copy anything important before closing.)';
    return false;
  }
}
"""


def esc(s):
    return html.escape(str(s), quote=True)


def js_embed(text):
    """Safely embed arbitrary text as a JS string literal inside <script>."""
    return json.dumps(text).replace("</", "<\\/")

# ----------------------------------------------------------------------------
# Cloud-storage-safe staging
# ----------------------------------------------------------------------------

LOCAL_STAGING_ROOT = "/private/tmp/posed-local-sessions"


def _path_components(path):
    return [p.lower() for p in os.path.abspath(path).split(os.sep) if p]


def likely_cloud_synced_path(path):
    """Detect session paths that often block helper-process file access on macOS."""
    abs_path = os.path.abspath(path)
    text = abs_path.lower()
    if "cloudstorage" in text:
        return True
    components = _path_components(abs_path)
    for comp in components:
        compact = comp.replace(" ", "")
        if (
            "onedrive" in compact
            or comp in {"icloud drive", "icloud"}
            or "clouddocs" in compact
            or comp == "mobile documents"
            or "dropbox" in compact
            or "google drive" in comp
            or "googledrive" in compact
            or comp == "box"
            or comp.startswith("box ")
        ):
            return True
    return False


def _safe_slug(path):
    base = os.path.basename(os.path.abspath(path).rstrip(os.sep)) or "session"
    base = re.sub(r"[^A-Za-z0-9._-]+", "-", base).strip("-._") or "session"
    digest = hashlib.sha1(os.path.abspath(path).encode("utf-8")).hexdigest()[:10]
    return f"{base}-{digest}"


def _is_inside(path, root):
    try:
        return os.path.commonpath([os.path.abspath(path), os.path.abspath(root)]) == os.path.abspath(root)
    except ValueError:
        return False


def _copy_file(src, dest):
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    shutil.copy2(src, dest)


def _load_json(path, default):
    try:
        with open(path) as f:
            return json.load(f)
    except Exception:
        return default


def _write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)


class CloudSafeSession:
    """Keep cloud-hosted project sessions durable while the page runs locally."""

    def __init__(self, project_session, mode="auto"):
        self.project_session = os.path.abspath(project_session)
        self.mode = mode
        self.active = mode == "always" or (mode == "auto" and likely_cloud_synced_path(self.project_session))
        self.local_session = os.path.join(LOCAL_STAGING_ROOT, _safe_slug(self.project_session))
        self.staged_inputs = []
        self.synced_outputs = []
        if self.active:
            os.makedirs(self.local_session, exist_ok=True)
            manifest = os.path.join(self.project_session, "manifest.json")
            if os.path.exists(manifest):
                self.stage_session_file("manifest.json", required=False)

    @property
    def runtime_session(self):
        return self.local_session if self.active else self.project_session

    @property
    def display_session(self):
        return self.project_session

    def project_for_local(self, local_path):
        if not self.active:
            return os.path.abspath(local_path)
        local_path = os.path.abspath(local_path)
        if _is_inside(local_path, self.local_session):
            rel = os.path.relpath(local_path, self.local_session)
            return os.path.join(self.project_session, rel)
        return local_path

    def stage_session_file(self, rel_path, required=True):
        src = os.path.join(self.project_session, rel_path)
        dest = os.path.join(self.local_session, rel_path)
        if os.path.exists(src):
            _copy_file(src, dest)
            self.staged_inputs.append({"project": src, "staging": dest})
        elif required:
            raise FileNotFoundError(src)
        return dest

    def stage_artifact(self, artifact_path):
        project_path = os.path.abspath(artifact_path)
        if not self.active:
            return project_path, project_path
        if _is_inside(project_path, self.project_session):
            rel = os.path.relpath(project_path, self.project_session)
            local_path = os.path.join(self.local_session, rel)
        else:
            rel = os.path.join("hitl", "staged_artifacts", os.path.basename(project_path))
            local_path = os.path.join(self.local_session, rel)
        _copy_file(project_path, local_path)
        self.staged_inputs.append({"project": project_path, "staging": local_path})
        return local_path, project_path

    def sync_file_back(self, local_path, project_path=None):
        if not self.active:
            return os.path.abspath(local_path)
        local_path = os.path.abspath(local_path)
        project_path = os.path.abspath(project_path or self.project_for_local(local_path))
        _copy_file(local_path, project_path)
        self.synced_outputs.append({"staging": local_path, "project": project_path})
        return project_path

    def sync_tree_back(self, local_dir):
        if not (self.active and os.path.isdir(local_dir)):
            return None
        project_dir = self.project_for_local(local_dir)
        for root, _, files in os.walk(local_dir):
            for name in files:
                src = os.path.join(root, name)
                rel = os.path.relpath(src, local_dir)
                self.sync_file_back(src, os.path.join(project_dir, rel))
        return project_dir

    def metadata(self, mode_name, stage=None):
        if not self.active:
            return None
        return {
            "enabled": True,
            "mode": mode_name,
            "stage": stage,
            "project_session": self.project_session,
            "staging_session": self.local_session,
            "staged_inputs": self.staged_inputs,
            "synced_outputs": self.synced_outputs,
            "synced_at": datetime.now(timezone.utc).isoformat(),
        }

    def record_sync(self, mode_name, stage=None):
        meta = self.metadata(mode_name, stage)
        if not meta:
            return
        manifest_path = os.path.join(self.project_session, "manifest.json")
        record = {
            "ts": meta["synced_at"],
            "stage": stage or mode_name,
            "action": "cloud_safe_hitl_sync",
            "staging_session": self.local_session,
            "synced_outputs": self.synced_outputs,
        }
        if os.path.exists(manifest_path):
            manifest = _load_json(manifest_path, {})
            manifest.setdefault("history", []).append(record)
            manifest.setdefault("cloud_safe_hitl", []).append(meta)
            manifest["updated_at"] = meta["synced_at"]
            _write_json(manifest_path, manifest)
            return
        feedback_path = os.path.join(self.project_session, "feedback_log.json")
        feedback = _load_json(feedback_path, [])
        if isinstance(feedback, list):
            feedback.append(record)
        elif isinstance(feedback, dict):
            feedback.setdefault("cloud_safe_hitl", []).append(record)
        else:
            feedback = [record]
        _write_json(feedback_path, feedback)

# ----------------------------------------------------------------------------
# Intake page
# ----------------------------------------------------------------------------

def render_field(key, label, ftype, required, hint):
    req = '<span class="req">*</span>' if required else ""
    hint_html = f'<span class="hint">{esc(hint)}</span>' if hint and ftype not in ("select", "checkboxes", "condselect") else ""
    lab = f'<label for="{key}">{esc(label)} {req}{hint_html}</label>'
    r = "required" if required else ""
    if ftype == "checkboxes":
        # hint = "key::Label::intro||key2::Label2::intro2" ; no preselection (L2)
        rows = []
        for opt in hint.split("||"):
            parts = opt.split("::")
            okey = parts[0]
            olabel = parts[1] if len(parts) > 1 else parts[0]
            ointro = parts[2] if len(parts) > 2 else ""
            oc = (' onchange="if(typeof onLensToggle===\'function\')onLensToggle()"'
                  if key == "audit_lenses" else "")
            rows.append(
                f'<label class="checkrow" style="align-items:flex-start;margin:7px 0">'
                f'<input type="checkbox" name="{key}" value="{esc(okey)}"{oc} style="margin-top:4px">'
                f'<span><b>{esc(olabel)}</b>'
                f'<span class="hint" style="margin:0">{esc(ointro)}</span></span></label>')
        note = ('<div class="err" id="' + key + '-err" style="display:none">Pick at least one.</div>'
                if required else "")
        return f'{lab}<div class="obj-card" style="padding:12px 16px">{"".join(rows)}</div>{note}'
    if ftype == "condselect":
        # Accessibility depth — shown only when the access lens is checked (JS toggles it).
        opts = "".join(f'<option value="{esc(o)}">{esc(o)}</option>' for o in hint.split("|"))
        return (f'<div id="{key}-wrap" style="display:none">{lab}'
                f'<select id="{key}" name="{key}">{opts}</select></div>')
    if ftype == "textarea":
        return f'{lab}<textarea id="{key}" name="{key}" {r}></textarea>'
    if ftype == "select":
        opts = "".join(f'<option value="{esc(o)}">{esc(o)}</option>' for o in hint.split("|"))
        onchange = ' onchange="if(typeof updateFmtDesc===\'function\')updateFmtDesc()"' if key == "instructional_format" else ""
        after = ('<div id="format-desc" style="display:none;margin:-4px 0 12px;padding:8px 12px;'
                 'background:#eef2ff;border-left:3px solid var(--primary);border-radius:0 8px 8px 0;'
                 'font-size:.88rem;color:#3730a3;line-height:1.5;"></div>'
                 if key == "instructional_format" else "")
        return f'{lab}<select id="{key}" name="{key}"{onchange} {r}>{opts}</select>{after}'
    if ftype == "number":
        default = f'value="{esc(hint)}"' if hint else ""
        return f'{lab}<input type="number" id="{key}" name="{key}" {default} {r}>'
    return f'{lab}<input type="text" id="{key}" name="{key}" placeholder="{esc(hint)}" {r}>'


INTAKE_FLOWS = {
    "posed": (POSED_INTAKE_FIELDS, "POSED — New Lecture Module",
              "Fill in the module context. The AI will use this to draft the teaching plan."),
    "p2d": (P2D_INTAKE_FIELDS, "Paper-to-Deck — New Presentation",
            "Fill in the presentation context. The AI will analyze the paper and build the deck."),
    "audit": (AUDIT_INTAKE_FIELDS, "POSED — AI-Impact Course Audit",
              "Point the AI at your existing course. It will scan the materials, research current AI "
              "capability in your domain, and propose changes — nothing is modified without your "
              "item-by-item approval."),
}


def intake_page(flow):
    fields, title, sub = INTAKE_FLOWS[flow]
    body = "".join(render_field(*f) for f in fields)
    post_js = POST_JS.replace("__DONE__", js_embed(DONE_HTML))
    fmt_desc_js = ""
    if flow == "posed":
        fmt_desc_js = """
const _FMT_DESC = {
  'lecture-plus-lab':   'Traditional lecture followed by a hands-on lab. Best when theory needs immediate practical reinforcement.',
  'direct-lecture':     'Instructor-led presentation throughout. Best for foundational concepts, history, or theory-heavy material.',
  'flipped':            'Students watch/read before class; in-class time is guided problem-solving and Q&A. Reduces passive lecture time.',
  'concept-stitching':  '7-checkpoint arc — each new concept is motivated by a concrete failure the prior one cannot handle. Best for mechanisms, protocols, and algorithms.',
  'problem-based':      'Opens with an authentic driving problem; concepts are introduced just-in-time as students need them to solve it.',
  'peer-instruction':   'ConcepTest clusters: pose → individual vote → peer discussion → revote → explanation. High engagement, best when common misconceptions are predictable.',
  'studio-workshop':    'Short instructor demos interleaved with extended build/create blocks. Best for design, coding, or maker sessions.',
  'socratic-seminar':   'Discussion-driven; instructor guides with questions, not slides. Best for interpretive, ethical, or case-study topics.',
  'custom':             'Describe your own format in the next step — the AI builds a custom style module from your description.',
};
function updateFmtDesc() {
  var sel = document.getElementById('instructional_format');
  var div = document.getElementById('format-desc');
  if (!sel || !div) return;
  var d = _FMT_DESC[sel.value] || '';
  div.textContent = d;
  div.style.display = d ? 'block' : 'none';
}
updateFmtDesc();"""
    lens_js = ""
    if flow == "audit":
        lens_js = """
// Show the accessibility-depth select only when the Accessibility lens is checked (L2: no default).
function onLensToggle() {
  var checked = Array.from(document.querySelectorAll('input[name=audit_lenses]:checked')).map(e=>e.value);
  var wrap = document.getElementById('accessibility_depth-wrap');
  if (wrap) wrap.style.display = checked.indexOf('access') >= 0 ? 'block' : 'none';
}
onLensToggle();"""
    return f"""<!DOCTYPE html><html><head><meta charset="utf-8">
<title>{esc(title)}</title><style>{BASE_CSS}</style></head><body>
<div class="container">
  <div class="header"><h1>{esc(title)}</h1><p>{esc(sub)}</p></div>
  <form class="card" id="f" onsubmit="return false;">
    {body}
    <div class="err" id="err"></div>
    <button class="btn btn-primary" id="go" type="button" onclick="submitIntake()">Start the workflow →</button>
  </form>
  <footer>POSED guided app · local only (127.0.0.1)</footer>
</div>
<script>
{post_js}
{fmt_desc_js}
{lens_js}
function submitIntake() {{
  const f = document.getElementById('f');
  if (!f.reportValidity()) return;
  const data = {{}};
  const cbGroups = {{}};      // name -> {{required, checked:[]}}
  for (const el of f.querySelectorAll('input,textarea,select')) {{
    if (el.type === 'checkbox') {{
      const g = cbGroups[el.name] || (cbGroups[el.name] = {{checked: []}});
      if (el.checked) g.checked.push(el.value);
      continue;
    }}
    // skip hidden conditional selects that aren't visible (e.g. accessibility_depth when access unchecked)
    const wrap = document.getElementById(el.name + '-wrap');
    if (wrap && wrap.style.display === 'none') continue;
    data[el.name] = el.value;
  }}
  // Required checkbox groups: audit_lenses must have >=1
  for (const name in cbGroups) {{
    data[name] = cbGroups[name].checked.join(',');
  }}
  if (('audit_lenses' in cbGroups) && cbGroups['audit_lenses'].checked.length === 0) {{
    const e = document.getElementById('audit_lenses-err');
    if (e) e.style.display = 'block';
    return;
  }}
  document.getElementById('go').disabled = true;
  postForm(data).then(ok => {{ if (!ok) document.getElementById('go').disabled = false; }});
}}
</script>
</body></html>"""

# ----------------------------------------------------------------------------
# Materials page — collect teaching materials for persona analysis
# ----------------------------------------------------------------------------

MATERIALS_JS = r"""
const MAX_SAMPLE = __MAX_SAMPLE__;   // max files auto-selected from a folder
const PURPOSE = __PURPOSE__;          // 'persona' | 'sources'
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_BYTES = (PURPOSE === 'sources' ? 60 : 25) * 1024 * 1024;
const ALLOWED_EXT = ['md','txt','pdf','docx','doc','pptx','ppt','html','htm','tex','rtf','odt','key'];

// category heuristics: lower priority number = more style signal
const CATEGORIES = [
  { name: 'syllabus',    prio: 1, re: /syllabus/i },
  { name: 'persona',     prio: 2, re: /persona|profile|philosoph/i },
  { name: 'notes',       prio: 3, re: /note|lecture|script/i },
  { name: 'slides',      prio: 4, re: /slide|ppt|deck|presentation/i },
  { name: 'handout',     prio: 5, re: /lab|handout|activity|worksheet|exercise/i },
  { name: 'assessment',  prio: 6, re: /exam|quiz|assess|rubric|homework|hw\d|test/i },
  { name: 'other',       prio: 7, re: /./ }
];
function categorize(name) {
  for (const c of CATEGORIES) if (c.re.test(name)) return c;
  return CATEGORIES[CATEGORIES.length - 1];
}
function eligible(f) {
  const ext = f.name.split('.').pop().toLowerCase();
  if (!ALLOWED_EXT.includes(ext)) return false;
  if (f.size > MAX_FILE_BYTES || f.size === 0) return false;
  const rel = (f.webkitRelativePath || f.name);
  if (/(^|\/)\./.test(rel)) return false;               // hidden files/dirs
  if (/node_modules|__pycache__|\.git/.test(rel)) return false;
  return true;
}
// stratified sample: best of each category first, then fill by (prio, recency)
function sampleFiles(all) {
  const elig = all.filter(eligible);
  const byCat = {};
  for (const f of elig) {
    const c = categorize(f.webkitRelativePath || f.name);
    (byCat[c.name] = byCat[c.name] || []).push(f);
  }
  for (const k in byCat) byCat[k].sort((a, b) => b.lastModified - a.lastModified);
  const picked = [];
  for (const c of CATEGORIES) {            // one per category, priority order
    if (byCat[c.name] && byCat[c.name].length && picked.length < MAX_SAMPLE)
      picked.push(byCat[c.name].shift());
  }
  const rest = [];
  for (const k in byCat) rest.push(...byCat[k]);
  rest.sort((a, b) => (categorize(a.name).prio - categorize(b.name).prio) || (b.lastModified - a.lastModified));
  while (picked.length < MAX_SAMPLE && rest.length) picked.push(rest.shift());
  return { picked: picked, totalEligible: elig.length, totalAll: all.length };
}

let SELECTED = [];   // [{file, cat}]
let FOLDER_INFO = null;

function refreshList() {
  const box = document.getElementById('sel-box');
  const list = document.getElementById('sel-list');
  list.innerHTML = '';
  if (!SELECTED.length) { box.style.display = 'none'; return; }
  box.style.display = 'block';
  document.getElementById('sel-summary').textContent = FOLDER_INFO
    ? (PURPOSE === 'sources'
        ? 'Selected ' + SELECTED.length + ' of ' + FOLDER_INFO.totalEligible + ' readable documents in "' + FOLDER_INFO.name + '" to index. Remove anything you do not want grounding your slides.'
        : 'Sampled ' + SELECTED.length + ' of ' + FOLDER_INFO.totalAll + ' files in "' + FOLDER_INFO.name + '" (most style-revealing first). Uncheck anything that does not represent your teaching.')
    : SELECTED.length + ' file(s) selected.';
  SELECTED.forEach((s, i) => {
    const row = document.createElement('div');
    row.className = 'arr-item';
    const label = document.createElement('div');
    label.innerHTML = '<b>' + s.file.name + '</b> <span class="muted">(' +
      Math.round(s.file.size / 1024) + ' KB · looks like: ' + s.cat + ')</span>';
    const rm = document.createElement('button');
    rm.className = 'mini-btn'; rm.type = 'button'; rm.textContent = '× remove';
    rm.onclick = () => { SELECTED.splice(i, 1); refreshList(); };
    row.append(label, rm);
    list.append(row);
  });
}
function onFilesPicked(input) {
  FOLDER_INFO = null;
  for (const f of input.files)
    SELECTED.push({ file: f, cat: categorize(f.name).name });
  refreshList();
}
function onFolderPicked(input) {
  const all = Array.from(input.files);
  let picked, totalEligible;
  if (PURPOSE === 'sources') {
    // index breadth: take all eligible text docs up to MAX_SAMPLE, newest first
    const elig = all.filter(eligible).sort((a, b) => b.lastModified - a.lastModified);
    totalEligible = elig.length;
    picked = elig.slice(0, MAX_SAMPLE);
  } else {
    const res = sampleFiles(all);          // persona: stratified style sample
    totalEligible = res.totalEligible;
    picked = res.picked;
  }
  FOLDER_INFO = { name: (all[0] && all[0].webkitRelativePath.split('/')[0]) || 'folder',
                  totalAll: all.length, totalEligible: totalEligible };
  SELECTED = picked.map(f => ({ file: f, cat: categorize(f.webkitRelativePath || f.name).name }));
  refreshList();
}
function b64FromBuffer(buf) {
  const bytes = new Uint8Array(buf); let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000)
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
async function postJSON(obj) {
  try {
    const resp = await fetch('/submit', { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    document.querySelector('.container').innerHTML = __DONE__;
    window.scrollTo(0, 0); return true;
  } catch (e) {
    const err = document.getElementById('err');
    err.style.display = 'block';
    err.textContent = '⚠ Could not reach the local server — ask the agent to reopen this form.';
    return false;
  }
}
async function submitMaterials(skip) {
  const err = document.getElementById('err'); err.style.display = 'none';
  const advPath = document.getElementById('adv-path').value.trim();
  const files = [];
  if (!skip) {
    let total = 0;
    for (const s of SELECTED) total += s.file.size;
    if (total > MAX_TOTAL_BYTES) { err.style.display = 'block';
      err.textContent = 'Selected files exceed 25 MB total — remove some.'; return; }
    for (const s of SELECTED) {
      const buf = await s.file.arrayBuffer();
      files.push({ name: s.file.name, rel: s.file.webkitRelativePath || s.file.name,
                   category: s.cat, b64: b64FromBuffer(buf) });
    }
    if (!files.length && !advPath) { err.style.display = 'block';
      err.textContent = 'Select files or a folder (or use Skip).'; return; }
  }
  const polEl = document.querySelector('input[name=policy]:checked');
  document.getElementById('go').disabled = true; document.getElementById('skip').disabled = true;
  postJSON({ skip: !!skip, path: advPath, files: files,
             research_policy: polEl ? polEl.value : null,
             folder_info: FOLDER_INFO }).then(ok => {
    if (!ok) { document.getElementById('go').disabled = false; document.getElementById('skip').disabled = false; }
  });
}
function toggleAdv() {
  const d = document.getElementById('adv-box');
  d.style.display = (d.style.display === 'block') ? 'none' : 'block';
}
"""


def materials_page(stage_label, purpose="persona"):
    sources = (purpose == "sources")
    max_sample = 40 if sources else 8
    js = (MATERIALS_JS
          .replace("__DONE__", js_embed(DONE_HTML))
          .replace("__MAX_SAMPLE__", str(max_sample))
          .replace("__PURPOSE__", js_embed(purpose)))
    if purpose == "template":
        title = f"{esc(stage_label)}: PowerPoint Template"
        intro = ("Upload (or point to) the .pptx template the final deck should use — your course or "
                 "university template with its fonts, colors, and layouts. The compiled presentation "
                 "is built on top of it. Skip to use a clean default theme.")
        pick_note = ("Pick the .pptx (or .potx) file. If a folder is chosen, the newest PowerPoint "
                     "file in it is used.")
        token_note = "Only the template's layouts/theme are read — its slide content is not ingested."
        skip_label = "Skip — use a clean default theme"
        policy_html = ""
        # template accepts PowerPoint files only
        js = js.replace("const ALLOWED_EXT = ['md','txt','pdf','docx','doc','pptx','ppt','html','htm','tex','rtf','odt','key'];",
                        "const ALLOWED_EXT = ['pptx','potx','ppt'];")
    elif sources:
        title = f"{esc(stage_label)}: Knowledge Base & Research Policy"
        intro = ("Point the AI at your content knowledge base — an Obsidian vault, a folder of "
                 "papers/notes/PDFs, a course archive. It is inventoried ONCE here and then used by every "
                 "stage: planning (SLOs/topics), outlining, sourcing, and drafting. Below, also choose "
                 "where course content should come from (your materials, the web, or both).")
        pick_note = (f"Pick a folder (a vault or archive is ideal here) and the page selects up to {max_sample} "
                     "readable documents to index — it skips images, code, and oversized files. Review and "
                     "remove anything you don't want indexed.")
        token_note = ("Token-saving note: files are inventoried and chunked; while planning and drafting, "
                      "only the passages relevant to each topic are retrieved — never the whole library at once.")
        skip_label = "Skip — no local knowledge base"
        policy_html = """
    <h2 style="font-size:1.05rem;margin-top:22px">Research policy — where should course content come from?</h2>
    <div class="wz-pol"><label class="pol-row"><input type="radio" name="policy" value="local-first" checked>
      <span><b>Local first</b> — my materials are primary; web search fills the gaps <span class="muted">(notes/papers collected, topic moves fast)</span></span></label>
    <label class="pol-row"><input type="radio" name="policy" value="local-only">
      <span><b>Local only</b> — use ONLY my provided materials; no web search <span class="muted">(textbook-based course)</span></span></label>
    <label class="pol-row"><input type="radio" name="policy" value="web-first">
      <span><b>Web first</b> — prefer the latest online material; my materials supplement <span class="muted">(cutting-edge topic)</span></span></label>
    <label class="pol-row"><input type="radio" name="policy" value="web-only">
      <span><b>Web only</b> — I have no local materials for this module</span></label></div>"""
    else:
        title = "Persona: Extract Your Persona from Your Teaching Materials"
        intro = ("To capture YOUR teaching style, the AI analyzes examples of how you actually teach — "
                 "lecture notes, slides, syllabi, lab handouts, rubrics. (Not your content knowledge "
                 "base — that is used later for sourcing.)")
        pick_note = (f"Pick a folder and the page automatically selects up to {max_sample} of the most "
                     "style-revealing files (syllabus, notes, slides, handouts, assessments) — it never "
                     "uploads everything. You can review and remove items before continuing.")
        token_note = ("Token-saving note: only representative excerpts are analyzed (style, tone, "
                      "structure) — not the full content of every file.")
        skip_label = "Skip — use a generic template"
        policy_html = ""
    return f"""<!DOCTYPE html><html><head><meta charset="utf-8">
<title>{title}</title><style>{BASE_CSS}</style></head><body>
<div class="container">
  <div class="header"><h1>{title}</h1>
    <p>{esc(intro)}</p></div>

  <div class="card">
    <input type="file" id="file-input" multiple style="display:none" onchange="onFilesPicked(this)">
    <input type="file" id="folder-input" webkitdirectory style="display:none" onchange="onFolderPicked(this)">
    <button class="btn btn-primary" type="button" onclick="document.getElementById('file-input').click()">📄 Choose files…</button>
    <button class="btn btn-primary" type="button" onclick="document.getElementById('folder-input').click()">📁 Choose a folder…</button>
    <p class="editnote" style="margin-top:10px">{esc(pick_note)}</p>

    <div id="sel-box" style="display:none;margin-top:14px">
      <p id="sel-summary" style="font-weight:600;font-size:.92rem"></p>
      <div id="sel-list"></div>
    </div>

    <p class="editnote" style="margin-top:14px"><a href="javascript:toggleAdv()">Advanced: type a file/folder path instead</a></p>
    <div id="adv-box" style="display:none">
      <input type="text" id="adv-path" placeholder="/Users/you/Documents/my-materials  (file or folder)">
    </div>

    {policy_html}
    <div class="err" id="err"></div>
    <button class="btn btn-accept" id="go" type="button" onclick="submitMaterials(false)">Use these materials →</button>
    <button class="btn btn-skip" id="skip" type="button" onclick="submitMaterials(true)">{esc(skip_label)}</button>
  </div>
  <p class="editnote">{esc(token_note)}</p>
  <footer>POSED guided app · local only (127.0.0.1)</footer>
</div>
<script>
{js}
</script>
</body></html>"""

# ----------------------------------------------------------------------------
# Gate page — single editable document view
# ----------------------------------------------------------------------------

GATE_JS = r"""
const ARTIFACT = __ARTIFACT__;
const KIND = __KIND__;           // 'json' | 'markdown'
let DATA = null;                 // live model for JSON artifacts
let ORIG_MIN = '';               // minified original JSON for change detection
let INITIAL_HTML = '';           // initial rendered HTML for markdown change detection
let PLAIN_FALLBACK = false;      // offline markdown fallback (textarea)
// Keys that are QUESTIONS FOR THE USER, not editable content. Rendered as a
// read-only Q&A section with answer boxes; answers flow back to the agent.
const QA_KEYS = ['key_decision_points_for_faculty', 'faculty_decision_prompts',
                 'questions_for_faculty'];
let QA = [];                     // [{question, textarea}]
// Section-level feedback: section_id -> {disposition, comment, label}.
// Survives rerender() so add/remove-item rebuilds don't lose faculty input.
const SECTION_STATE = {};

// ---------- tiny DOM helper ----------
function el(tag, attrs, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  for (const c of children) if (c != null) e.append(c);
  return e;
}
function prettyKey(k) {
  return String(k).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
function autosize(ta) { ta.style.height = 'auto'; ta.style.height = (ta.scrollHeight + 4) + 'px'; }

// ---------- section-level feedback (keep / revise / split / remove + comment) ----------
function sectionControl(id, label) {
  const st = SECTION_STATE[id] || (SECTION_STATE[id] = { disposition: 'keep', comment: '', label: label });
  st.label = label;
  const sel = el('select', { class: 'val-input',
    style: 'width:auto;padding:2px 6px;font-size:.78rem;flex:none' });
  for (const opt of ['keep', 'revise', 'split', 'remove']) {
    const o = el('option', { value: opt }, opt);
    if (opt === st.disposition) o.selected = true;
    sel.append(o);
  }
  sel.addEventListener('change', () => { st.disposition = sel.value; });
  const ta = el('textarea', { class: 'val-area', rows: '1',
    placeholder: 'Optional feedback on this section…',
    style: 'font-size:.78rem;min-height:30px;flex:1' });
  ta.value = st.comment;
  setTimeout(() => autosize(ta), 0);
  ta.addEventListener('input', () => { st.comment = ta.value; autosize(ta); });
  return el('div', { class: 'sec-fb',
    style: 'display:flex;gap:8px;align-items:flex-start;margin:2px 0 10px;opacity:.9' },
    el('span', { class: 'muted', style: 'font-size:.72rem;white-space:nowrap;padding-top:7px' }, '§'),
    sel, ta);
}
function collectSectionFeedback() {
  const out = [];
  for (const [id, st] of Object.entries(SECTION_STATE)) {
    if (st.disposition !== 'keep' || st.comment.trim() !== '')
      out.push({ section_id: id, label: st.label || id,
                 disposition: st.disposition, comment: st.comment.trim() });
  }
  return JSON.stringify(out);
}

// ---------- JSON: editable structured document ----------
function scalarEditor(value, setter) {
  if (typeof value === 'boolean') {
    const cb = el('input', { type: 'checkbox' });
    cb.checked = value;
    cb.addEventListener('change', () => { setter(cb.checked); markEdited(); });
    return el('span', { class: 'checkrow' }, cb, el('span', { class: 'muted' }, value ? '' : ''));
  }
  if (typeof value === 'number') {
    const inp = el('input', { type: 'number', class: 'val-input', step: 'any' });
    inp.value = value;
    inp.addEventListener('input', () => {
      const n = parseFloat(inp.value);
      setter(isNaN(n) ? inp.value : n); markEdited();
    });
    return inp;
  }
  const s = String(value ?? '');
  if (s.length > 60 || s.includes('\n')) {
    const ta = el('textarea', { class: 'val-area' });
    ta.value = s;
    ta.addEventListener('input', () => { setter(ta.value); markEdited(); autosize(ta); });
    setTimeout(() => autosize(ta), 0);
    return ta;
  }
  const inp = el('input', { type: 'text', class: 'val-input' });
  inp.value = s;
  inp.addEventListener('input', () => { setter(inp.value); markEdited(); });
  if (/^https?:\/\//.test(s)) {
    // URL value: pair the editable field with an open-in-new-tab button
    const wrap = el('span', { style: 'display:flex;gap:6px;align-items:center' });
    const btn = el('button', { class: 'mini-btn', type: 'button', title: 'Open link in new tab',
      onclick: () => window.open(inp.value, '_blank') }, '↗ open');
    wrap.append(inp, btn);
    return wrap;
  }
  return inp;
}

function renderNode(value, setter, depth, path) {
  path = path || '';
  if (value === null || value === undefined || typeof value !== 'object') {
    return scalarEditor(value, setter);
  }
  if (Array.isArray(value)) {
    const wrap = el('div', { class: 'arr' });
    value.forEach((item, i) => {
      const isObj = typeof item === 'object' && item !== null && !Array.isArray(item);
      const itemPath = path + '[' + i + ']';
      const rm = el('button', { class: 'mini-btn', type: 'button', title: 'Remove this item',
        onclick: () => { value.splice(i, 1); markEdited(); rerender(); } }, '× remove');
      if (isObj) {
        const label = item.subtopic_title || item.title || ('Item ' + (i + 1));
        const card = el('div', { class: 'obj-card' },
          el('div', { class: 'card-head' },
            el('span', { class: 'muted' }, label), rm),
          (depth === 1 ? sectionControl(itemPath, label) : null),
          renderNode(item, v => { value[i] = v; }, depth + 1, itemPath));
        wrap.append(card);
      } else {
        wrap.append(el('div', { class: 'arr-item' },
          renderNode(item, v => { value[i] = v; }, depth + 1, itemPath), rm));
      }
    });
    wrap.append(el('button', { class: 'mini-btn add', type: 'button', onclick: () => {
      let proto = '';
      if (value.length) {
        const last = value[value.length - 1];
        if (typeof last === 'object' && last !== null) {
          proto = JSON.parse(JSON.stringify(last));
          if (!Array.isArray(proto))
            for (const k of Object.keys(proto))
              if (typeof proto[k] === 'string') proto[k] = '';
        } else proto = (typeof last === 'number') ? 0 : '';
      }
      value.push(proto); markEdited(); rerender();
    } }, '+ Add item'));
    return wrap;
  }
  // plain object → headings + fields
  const wrap = el('div', {});
  for (const k of Object.keys(value)) {
    // Question-list keys are rendered separately as a Q&A section, not as
    // editable content (top level only).
    if (depth === 0 && QA_KEYS.includes(k)) continue;
    const kPath = path ? path + '.' + k : k;
    const tag = 'h' + Math.min(2 + depth, 5);
    wrap.append(el(tag, {}, prettyKey(k)));
    // Top-level structured sections get a keep/revise/split/remove + comment
    // control; scalars (title, duration) don't need one.
    if (depth === 0 && typeof value[k] === 'object' && value[k] !== null)
      wrap.append(sectionControl(kPath, prettyKey(k)));
    wrap.append(renderNode(value[k], v => { value[k] = v; }, depth + 1, kPath));
  }
  return wrap;
}

function renderQA() {
  QA = [];
  const card = document.getElementById('qa-card');
  const list = document.getElementById('qa-list');
  list.innerHTML = '';
  let questions = [];
  for (const k of QA_KEYS) {
    if (Array.isArray(DATA?.[k]) && DATA[k].every(q => typeof q === 'string'))
      questions = questions.concat(DATA[k]);
  }
  if (!questions.length) { card.style.display = 'none'; return; }
  questions.forEach((q, i) => {
    const ta = el('textarea', { class: 'val-area', rows: '2',
      placeholder: 'Your answer (optional — leave blank to skip)' });
    setTimeout(() => autosize(ta), 0);
    ta.addEventListener('input', () => autosize(ta));
    list.append(el('div', { class: 'obj-card' },
      el('p', { style: 'font-weight:600;margin-bottom:6px' }, (i + 1) + '. ' + q), ta));
    QA.push({ question: q, ta: ta });
  });
  card.style.display = 'block';
}
function collectAnswers() {
  return JSON.stringify(
    QA.filter(x => x.ta.value.trim() !== '')
      .map(x => ({ question: x.question, answer: x.ta.value.trim() })));
}

function rerender() {
  const doc = document.getElementById('doc');
  doc.innerHTML = '';
  doc.append(renderNode(DATA, v => { DATA = v; }, 0, ''));
}

// ---------- change tracking ----------
function isEdited() {
  if (KIND === 'json') return JSON.stringify(DATA) !== ORIG_MIN;
  if (PLAIN_FALLBACK) return document.getElementById('plain-editor').value !== ARTIFACT;
  return document.getElementById('doc').innerHTML !== INITIAL_HTML;
}
function markEdited() {
  const edited = isEdited();
  document.getElementById('badge').style.display = edited ? 'block' : 'none';
  document.getElementById('btn-accept').textContent =
    edited ? '✓ Save my edits & continue' : '✓ Accept and continue';
}
function getCurrentContent() {
  if (KIND === 'json') return JSON.stringify(DATA, null, 2);
  if (PLAIN_FALLBACK) return document.getElementById('plain-editor').value;
  const docEl = document.getElementById('doc');
  if (window.TurndownService) {
    const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
    if (window.turndownPluginGfm) td.use(turndownPluginGfm.gfm);
    return td.turndown(docEl.innerHTML);
  }
  return null;
}

// ---------- decisions ----------
function submitAccept() {
  const edited = isEdited();
  let content = '';
  if (edited) {
    content = getCurrentContent();
    if (content === null) {
      const err = document.getElementById('err');
      err.style.display = 'block';
      err.textContent = '⚠ The markdown converter (CDN) did not load, so your edits cannot be saved from this view. Check your network or ask the agent to apply your changes instead.';
      return;
    }
  }
  setBusy(true);
  postForm({ decision: 'accept', guidance: '', edited_content: edited ? content : '',
             faculty_answers: collectAnswers(),
             section_feedback: collectSectionFeedback() })
    .then(ok => { if (!ok) setBusy(false); });
}
function toggleRegen() {
  const box = document.getElementById('guidance-box');
  box.style.display = (box.style.display === 'block') ? 'none' : 'block';
}
function submitRegen() {
  // If the user edited the document before clicking Regenerate, keep their
  // edits: the regeneration starts FROM the edited version.
  const edited = isEdited();
  let content = '';
  if (edited) {
    content = getCurrentContent();
    if (content === null) content = '';   // converter unavailable: guidance only
  }
  setBusy(true);
  postForm({ decision: 'regenerate',
             guidance: document.getElementById('guidance').value,
             edited_content: edited ? content : '',
             faculty_answers: collectAnswers(),
             section_feedback: collectSectionFeedback() })
    .then(ok => { if (!ok) setBusy(false); });
}
function setBusy(b) {
  for (const id of ['btn-accept', 'btn-regen', 'btn-regen-go'])
    { const e = document.getElementById(id); if (e) e.disabled = b; }
}

// ---------- init ----------
(function init() {
  const doc = document.getElementById('doc');
  if (KIND === 'json') {
    try {
      DATA = JSON.parse(ARTIFACT);
      ORIG_MIN = JSON.stringify(DATA);
      rerender();
      renderQA();
      return;
    } catch (e) { /* fall through to markdown/plain path */ }
  }
  if (typeof marked !== 'undefined' && window.TurndownService) {
    doc.innerHTML = marked.parse(ARTIFACT);
    doc.contentEditable = 'true';
    INITIAL_HTML = doc.innerHTML;
    doc.addEventListener('input', markEdited);
    // contenteditable swallows link clicks (click = place cursor); restore
    // navigation: clicking a link opens it in a new tab. To edit a link's
    // text, click just beside it.
    doc.addEventListener('click', (e) => {
      const a = e.target.closest && e.target.closest('a');
      if (a && a.href) { e.preventDefault(); window.open(a.href, '_blank'); }
    });
    doc.querySelectorAll('a').forEach(a => { a.style.cursor = 'pointer'; a.title = 'Opens in a new tab'; });
  } else {
    // offline fallback: plain text editor
    PLAIN_FALLBACK = true;
    const ta = el('textarea', { id: 'plain-editor',
      style: 'width:100%;min-height:480px;font-family:ui-monospace,Menlo,monospace;font-size:.85rem;border:none;' });
    ta.value = ARTIFACT;
    ta.addEventListener('input', markEdited);
    doc.innerHTML = '';
    doc.append(ta);
  }
})();
"""


def gate_page(stage, title, artifact_path, artifact_text, kind):
    """kind: 'markdown' or 'json'"""
    post_js = POST_JS.replace("__DONE__", js_embed(DONE_HTML))
    gate_js = (GATE_JS
               .replace("__ARTIFACT__", js_embed(artifact_text))
               .replace("__KIND__", js_embed(kind)))
    edit_hint = ("Every field below is editable — type directly into the boxes, "
                 "use “+ Add item” / “× remove” on lists. Each major section also has a "
                 "§ control: mark it keep / revise / split / remove and add a comment — "
                 "your section feedback is applied even if you click Accept."
                 if kind == "json" else
                 "The document below is directly editable — click anywhere and type.")
    return f"""<!DOCTYPE html><html><head><meta charset="utf-8">
<title>{esc(title)}</title><style>{BASE_CSS}</style></head><body>
<div class="container">
  <div class="header"><h1>{esc(title)}</h1>
    <p>Review — and edit, if you like — the document below, then accept or regenerate.
       File: <code>{esc(artifact_path)}</code></p></div>

  <div class="doc" id="doc"></div>
  <p class="editnote">✎ {esc(edit_hint)}
     There is no separate Save button — both buttons below save your work automatically.</p>
  <div class="badge" id="badge">✎ You have edits — they will be kept either way: “Accept” approves your edited version; “Regenerate” starts from it.</div>

  <div class="card" id="qa-card" style="display:none">
    <h2 style="font-size:1.1rem;margin-bottom:2px">❓ Questions for you</h2>
    <p class="editnote" style="margin:0 0 10px">The AI raised these decision points for you to settle.
       Type your answers below (optional) — they will be applied when you continue.
       You can also just edit the document above directly and leave these blank.</p>
    <div id="qa-list"></div>
  </div>

  <div class="card">
    <div class="err" id="err"></div>
    <button class="btn btn-accept" id="btn-accept" type="button" onclick="submitAccept()">✓ Accept and continue</button>
    <button class="btn btn-regen" id="btn-regen" type="button" onclick="toggleRegen()">↻ Regenerate…</button>
    <div id="guidance-box">
      <label for="guidance">Extra instructions (optional)
        <span class="hint">Any edits you made in the document above are already included —
        the AI will keep them and regenerate around them. Use this box only for things
        you can't express by editing, e.g., overall tone or depth.</span></label>
      <textarea id="guidance" placeholder="e.g., less math, more real-world applications"></textarea>
      <button class="btn btn-regen" id="btn-regen-go" type="button" onclick="submitRegen()">Confirm regenerate</button>
    </div>
  </div>
  <footer>POSED guided app · stage: {esc(stage)} · local only (127.0.0.1)</footer>
</div>
<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/turndown/dist/turndown.js"></script>
<script src="https://cdn.jsdelivr.net/npm/turndown-plugin-gfm/dist/turndown-plugin-gfm.js"></script>
<script>
{post_js}
{gate_js}
</script>
</body></html>"""

# ----------------------------------------------------------------------------
# Plan wizard — 3-step backward-design flow
#   Step 1: SLOs + subtopics (outcomes first)
#   Step 2: instructional format (with per-style "why this?" recommendation)
#   Step 3: deliverables (tailored to chosen format) + time allocation
# Reads <session>/hitl/plan_wizard_input.json, writes <session>/hitl/plan_decision.json
# ----------------------------------------------------------------------------

PLAN_WIZARD_JS = r"""
const WZ = __WZ__;
const STEP = WZ.step;          // 1 | 2 | 3 — one sub-stage per page

const state = {
  slos: (WZ.slos || []).map(t => ({ text: t, selected: true })),
  subtopics: (WZ.subtopics || []).map(s => ({
    id: s.id, title: s.title, description: s.description || '',
    duration_minutes: s.duration_minutes || 0,
    segment: s.segment || 'lecture',
    selected: s.selected_by_default !== false })),
  format: (WZ.formats && (WZ.formats.find(f => f.recommended) || WZ.formats[0]) || {key:''}).key,
  custom_description: '',
  blocks: (WZ.blocks || []).map(b => ({ ...b })),
  deliverables: {}
};
(WZ.deliverables || []).forEach(d => state.deliverables[d.key] =
  { label: d.label, selected: !!d.selected, applies_when: d.applies_when || '' });

function el(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'html') e.innerHTML = v;
    else e.setAttribute(k, v);
  }
  for (const c of kids) if (c != null) e.append(c);
  return e;
}
function autosize(t){ t.style.height='auto'; t.style.height=(t.scrollHeight+4)+'px'; }

// ---------- Step 1: SLOs + subtopics ----------
function renderStep1(host) {
  host.append(el('h2', {}, 'Student Learning Outcomes'));
  const slist = el('div', {});
  function drawSlos() {
    slist.innerHTML = '';
    state.slos.forEach((s, i) => {
      const cb = el('input', { type: 'checkbox' }); cb.checked = s.selected;
      cb.addEventListener('change', () => s.selected = cb.checked);
      const ta = el('textarea', { class: 'val-area', rows: '2' }); ta.value = s.text;
      ta.addEventListener('input', () => { s.text = ta.value; autosize(ta); });
      setTimeout(() => autosize(ta), 0);
      const rm = el('button', { class: 'mini-btn', type: 'button',
        onclick: () => { state.slos.splice(i, 1); drawSlos(); } }, '× remove');
      slist.append(el('div', { class: 'wz-row' }, cb, ta, rm));
    });
  }
  drawSlos(); host.append(slist);
  host.append(el('button', { class: 'mini-btn add', type: 'button',
    onclick: () => { state.slos.push({ text: '', selected: true });
      slist.innerHTML=''; drawSlos(); } }, '+ Add outcome'));

  host.append(el('h2', { style:'margin-top:22px' }, 'Proposed Topics / Subtopics'));
  const tlist = el('div', {});
  function drawSubs() {
    tlist.innerHTML = '';
    state.subtopics.forEach((s, i) => {
      const cb = el('input', { type: 'checkbox' }); cb.checked = s.selected;
      cb.addEventListener('change', () => s.selected = cb.checked);
      const title = el('input', { type: 'text', class: 'val-input', value: s.title, placeholder: 'Topic title' });
      title.addEventListener('input', () => s.title = title.value);
      const seg = el('span', { class: 'wz-seg' }, s.segment);
      const desc = el('textarea', { class: 'val-area', rows: '2' }); desc.value = s.description;
      desc.addEventListener('input', () => { s.description = desc.value; autosize(desc); });
      setTimeout(() => autosize(desc), 0);
      const rm = el('button', { class: 'mini-btn', type: 'button',
        onclick: () => { state.subtopics.splice(i, 1); drawSubs(); } }, '× remove');
      tlist.append(el('div', { class: 'obj-card' },
        el('div', { class: 'wz-row' }, cb, title, seg, rm), desc));
    });
  }
  drawSubs(); host.append(tlist);
  host.append(el('button', { class: 'mini-btn add', type: 'button',
    onclick: () => { state.subtopics.push({ id: 'subtopic_new_' + Date.now(), title: '', description: '',
      duration_minutes: 10, segment: 'lecture', selected: true }); tlist.innerHTML=''; drawSubs(); } }, '+ Add topic'));
}

// ---------- Step 2: teaching style ----------
function fmtCard(host, f) {
  const sel = () => state.format === f.key;
  const card = el('div', { class: 'fmt-card' + (sel() ? ' sel' : '') });
  const radio = el('input', { type: 'radio', name: 'fmt' }); radio.checked = sel();
  radio.addEventListener('change', () => { state.format = f.key;
    document.querySelectorAll('.fmt-card').forEach(c => c.classList.remove('sel')); card.classList.add('sel');
    const cb = document.getElementById('custom-desc-box'); if (cb) cb.style.display = (f.key === '__custom__') ? 'block' : 'none'; });
  const head = el('div', { class: 'wz-row' }, radio,
    el('b', { style: 'font-size:1.02rem' }, f.label || f.key),
    f.recommended ? el('span', { class: 'rec-badge' }, '★ recommended') : null,
    f.category === 'custom' ? el('span', { class: 'cust-badge' }, 'custom') : null);
  head.style.cursor = 'pointer';
  head.addEventListener('click', (e) => { if (e.target !== radio) { radio.checked = true; radio.dispatchEvent(new Event('change')); } });
  card.append(head);
  if (f.recommendation) {
    const why = el('div', { class: 'why', style: 'display:none' }, f.recommendation);
    const btn = el('button', { class: 'mini-btn', type: 'button', style: 'margin-top:6px',
      onclick: () => { why.style.display = why.style.display === 'none' ? 'block' : 'none'; } }, '? Why this?');
    card.append(btn, why);
  }
  host.append(card);
}
function renderStep2(host) {
  host.append(el('p', { class: 'wz-intro' },
    'Pick a teaching style. Click "Why this?" for the AI\'s take on how that style fits this module. ' +
    'After you continue, the AI builds the deliverables and schedule FOR the style you chose.'));
  const std = (WZ.formats || []).filter(f => (f.category || 'standard') === 'standard');
  const cust = (WZ.formats || []).filter(f => f.category === 'custom');
  if (std.length) host.append(el('h2', {}, 'Standard styles'));
  std.forEach(f => fmtCard(host, f));
  host.append(el('h2', { style:'margin-top:18px' }, 'Custom styles'));
  cust.forEach(f => fmtCard(host, f));

  const isCustom = state.format === '__custom__';
  const card = el('div', { class: 'fmt-card' + (isCustom ? ' sel' : '') });
  const radio = el('input', { type: 'radio', name: 'fmt' }); radio.checked = isCustom;
  radio.addEventListener('change', () => { state.format = '__custom__';
    document.querySelectorAll('.fmt-card').forEach(c => c.classList.remove('sel')); card.classList.add('sel');
    document.getElementById('custom-desc-box').style.display = 'block'; });
  const head = el('div', { class: 'wz-row' }, radio, el('b', { style: 'font-size:1.02rem' }, '✎ Describe your own style…'));
  head.style.cursor = 'pointer';
  head.addEventListener('click', (e) => { if (e.target !== radio) { radio.checked = true; radio.dispatchEvent(new Event('change')); } });
  card.append(head);
  const box = el('div', { id: 'custom-desc-box', style: 'display:' + (isCustom ? 'block' : 'none') + ';margin-top:8px' });
  const ta = el('textarea', { id: 'custom-desc', class: 'val-area', rows: '9' });
  ta.value = state.custom_description || WZ.custom_template || '';
  ta.addEventListener('input', () => state.custom_description = ta.value);
  if (!state.custom_description) state.custom_description = ta.value;
  box.append(el('p', { class: 'editnote', style:'margin:0 0 6px' },
    'Answer the prompts; after you continue, the AI creates a new named style module from your answers and builds the schedule and deliverables for it.'), ta);
  card.append(box);
  host.append(card);
}

// ---------- Step 3: deliverables + schedule for the CHOSEN style ----------
function renderStep3(host) {
  host.append(el('p', { class: 'wz-intro' },
    'Built for the ' + (WZ.format_label || WZ.format_key || 'selected') + ' style' +
    (WZ.style_note ? ' — ' + WZ.style_note : '') + '.'));

  host.append(el('h2', {}, 'Deliverables to produce'));
  const dl = el('div', {});
  Object.entries(state.deliverables).forEach(([k, d]) => {
    const cb = el('input', { type: 'checkbox' }); cb.checked = d.selected;
    cb.addEventListener('change', () => d.selected = cb.checked);
    dl.append(el('div', { class: 'wz-row' }, cb,
      el('span', {}, el('b', {}, d.label), d.applies_when ? el('span', { class: 'muted' }, '  — ' + d.applies_when) : null)));
  });
  host.append(dl);

  host.append(el('h2', { style:'margin-top:22px' }, 'Schedule (restructured for this style)'));
  const tbl = el('div', {});
  const total = WZ.total_minutes || 0;
  const sumEl = el('span', {});
  const isPre = b => (b.segment || '').toLowerCase().startsWith('pre');
  function drawBlocks() {
    tbl.innerHTML = '';
    state.blocks.forEach(b => {
      const num = el('input', { type: 'number', class: 'val-input', style: 'width:90px', step: '1', value: b.minutes });
      num.addEventListener('input', () => { b.minutes = Number(num.value) || 0; drawSum(); });
      const titleInp = el('input', { type: 'text', class: 'val-input', style: 'flex:1;font-weight:600', value: b.title, placeholder: 'Block title' });
      titleInp.addEventListener('input', () => { b.title = titleInp.value; });
      const descTA = el('textarea', { class: 'val-area', rows: '2', style: 'margin-top:6px', placeholder: 'Description (optional)' });
      descTA.value = b.description || '';
      descTA.addEventListener('input', () => { b.description = descTA.value; autosize(descTA); });
      setTimeout(() => autosize(descTA), 0);
      const row = el('div', { class: 'obj-card' },
        el('div', { class: 'wz-row' },
          el('span', { class: 'wz-seg' + (isPre(b) ? ' pre' : '') }, b.segment),
          titleInp,
          num, el('span', { class: 'muted' }, 'min')),
        descTA);
      if (isPre(b)) row.style.opacity = '0.8';
      tbl.append(row);
    });
    drawSum();
  }
  function drawSum() {
    let inClass = 0, pre = 0;
    state.blocks.forEach(b => { const m = Number(b.minutes) || 0; if (isPre(b)) pre += m; else inClass += m; });
    const over = total && inClass > total;
    sumEl.innerHTML = 'In-class: <b>' + inClass + '</b> min' + (total ? ' of <b>' + total + '</b>' : '') +
      (total ? ' · <span style="color:' + (over ? '#dc2626' : '#16a34a') + '">' + (over ? (inClass - total) + ' over budget' : (total - inClass) + ' min for intro/transitions') + '</span>' : '') +
      (pre ? ' &nbsp;·&nbsp; Pre-class student time: <b>' + pre + '</b> min' : '');
  }
  drawBlocks();
  host.append(tbl, el('p', { style: 'margin-top:8px;font-weight:600' }, sumEl));
}

// ---------- submit ----------
function payloadForStep(decision, guidance) {
  if (STEP === 1) return { step: 1, decision: decision, guidance: guidance || '',
    slos: state.slos, subtopics: state.subtopics };
  if (STEP === 2) return { step: 2, decision: decision, guidance: guidance || '',
    instructional_format: state.format,
    custom_description: state.format === '__custom__' ? (state.custom_description || '') : '' };
  return { step: 3, decision: decision, guidance: guidance || '',
    format_key: WZ.format_key,
    deliverables: Object.entries(state.deliverables).filter(([k, d]) => d.selected).map(([k]) => k),
    deliverables_full: state.deliverables,
    blocks: state.blocks };
}
async function post(payload) {
  for (const id of ['btn-submit', 'btn-regen', 'btn-regen-go']) {
    const b = document.getElementById(id); if (b) b.disabled = true; }
  try {
    const resp = await fetch('/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    document.querySelector('.container').innerHTML = __DONE__;
    window.scrollTo(0, 0);
  } catch (e) {
    const err = document.getElementById('err'); err.style.display = 'block';
    err.textContent = '⚠ Could not reach the local server — ask the agent to reopen this form.';
    for (const id of ['btn-submit', 'btn-regen', 'btn-regen-go']) {
      const b = document.getElementById(id); if (b) b.disabled = false; }
  }
}
function submitStep() {
  if (STEP === 2 && state.format === '__custom__' && !(state.custom_description || '').trim()) {
    const err = document.getElementById('err'); err.style.display='block';
    err.textContent = 'Describe your style first (or pick one of the listed styles).'; return;
  }
  post(payloadForStep(STEP === 3 ? 'accept' : 'continue', ''));
}
function toggleRegen() {
  const d = document.getElementById('regen-box');
  d.style.display = d.style.display === 'block' ? 'none' : 'block';
}
function submitRegen() { post(payloadForStep('regenerate', document.getElementById('regen-guidance').value)); }

// ---------- init ----------
(function init() {
  for (let i = 1; i <= 3; i++) {
    const t = document.getElementById('tab' + i);
    t.classList.toggle('active', i === STEP);
    t.classList.toggle('done', i < STEP);
  }
  const host = document.getElementById('wz-body');
  if (STEP === 1) renderStep1(host);
  else if (STEP === 2) renderStep2(host);
  else renderStep3(host);
})();
"""

PLAN_WIZARD_CSS = """
.wz-tabs { display:flex; gap:0; margin-bottom:18px; }
.wz-tab { flex:1; text-align:center; padding:12px 8px; border-bottom:3px solid var(--border);
          color:var(--muted); font-weight:600; font-size:.9rem; }
.wz-tab.active { color:var(--primary); border-bottom-color:var(--primary); }
.wz-tab.done { color:#16a34a; border-bottom-color:#16a34a; }
.wz-tab .n { display:inline-flex; width:22px; height:22px; border-radius:50%; background:var(--border);
             color:#fff; align-items:center; justify-content:center; font-size:.8rem; margin-right:6px; }
.wz-tab.active .n { background:var(--primary); } .wz-tab.done .n { background:#16a34a; }
.wz-intro { color:var(--muted); margin-bottom:14px; }
.wz-row { display:flex; gap:10px; align-items:flex-start; margin:6px 0; }
.wz-row > input[type=checkbox], .wz-row > input[type=radio] { margin-top:6px; width:auto; }
.wz-seg { font-size:.72rem; text-transform:uppercase; letter-spacing:.04em; color:#6366f1;
          background:#eef2ff; border-radius:5px; padding:2px 7px; margin-top:4px; white-space:nowrap; }
.wz-seg.pre { color:#92400e; background:#fef3c7; }
.fmt-card { border:2px solid var(--border); border-radius:10px; padding:14px 18px; margin:10px 0; }
.fmt-card.sel { border-color:var(--primary); background:#eef2ff; }
.rec-badge { font-size:.75rem; color:#16a34a; background:#dcfce7; border-radius:6px; padding:2px 8px; margin-left:8px; }
.cust-badge { font-size:.72rem; color:#92400e; background:#fef3c7; border-radius:6px; padding:2px 8px; margin-left:8px; }
.why { margin-top:8px; padding:10px 12px; background:#f8fafc; border:1px solid var(--border);
       border-radius:8px; font-size:.9rem; color:#334155; white-space:pre-wrap; }
"""

# .pol-row styling is shared via BASE_CSS additions below (kept here for clarity)
BASE_CSS += """
.pol-row { display:flex; gap:10px; align-items:flex-start; padding:8px 10px; border:1px solid var(--border);
           border-radius:8px; margin:6px 0; cursor:pointer; font-weight:400; }
.pol-row input { width:auto; margin-top:4px; }
.pol-row:hover { border-color:var(--primary); }
"""


def plan_wizard_page(wz, title):
    # Embed WZ as a JSON string parsed at runtime (robust against quotes/newlines).
    wz_literal = "JSON.parse(" + js_embed(json.dumps(wz)) + ")"
    js = PLAN_WIZARD_JS.replace("__WZ__", wz_literal).replace("__DONE__", js_embed(DONE_HTML))
    step = int(wz.get("step", 1))
    step_names = {1: "Outcomes & Topics", 2: "Teaching Style", 3: "Deliverables & Schedule"}
    submit_label = {1: "Continue — AI processes your outcomes →",
                    2: "Continue — AI builds the plan for this style →",
                    3: "✓ Finalize plan"}[step]
    sub = {1: "Select and edit the learning outcomes and topics for this module.",
           2: "Choose how the class is run. The AI prepares the next step for the style you pick.",
           3: "Review the deliverables and schedule the AI built for your chosen style."}[step]
    regen_html = """
    <button class="btn btn-regen" id="btn-regen" type="button" onclick="toggleRegen()">↻ Ask AI to revise…</button>
    <div id="regen-box" style="display:none;margin-top:12px">
      <label for="regen-guidance">What should the AI rework? <span class="hint">Your edits on this page are included automatically.</span></label>
      <textarea id="regen-guidance" placeholder="e.g., merge the first two blocks; give the build more time"></textarea>
      <button class="btn btn-regen" id="btn-regen-go" type="button" onclick="submitRegen()">Confirm — regenerate from my edits</button>
    </div>""" if step == 3 else ""
    return f"""<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Planning Stage — {esc(step_names[step])}</title><style>{BASE_CSS}{PLAN_WIZARD_CSS}</style></head><body>
<div class="container">
  <div class="header"><h1>Planning Stage — Step {step} of 3: {esc(step_names[step])}</h1>
    <p>{esc(title)}</p><p style="opacity:.85;font-size:.88rem">{esc(sub)}</p></div>
  <div class="wz-tabs">
    <div class="wz-tab" id="tab1"><span class="n">1</span>Outcomes &amp; Topics</div>
    <div class="wz-tab" id="tab2"><span class="n">2</span>Teaching Style</div>
    <div class="wz-tab" id="tab3"><span class="n">3</span>Deliverables &amp; Schedule</div>
  </div>
  <div class="card"><div id="wz-body"></div></div>
  <div class="card">
    <div class="err" id="err"></div>
    <button class="btn btn-accept" id="btn-submit" type="button" onclick="submitStep()">{esc(submit_label)}</button>
    {regen_html}
  </div>
  <footer>POSED guided app · planning stage {step}/3 · local only (127.0.0.1)</footer>
</div>
<script>
{js}
</script>
</body></html>"""


# ----------------------------------------------------------------------------
# Choose page — generic picker (deliverables to generate now / what-next)
#   Reads <session>/hitl/<name>_input.json: {title,intro,kind:"multi"|"single",
#     options:[{key,label,desc,selected}], note}
#   Writes <session>/hitl/<name>_decision.json: {selected:[keys], ...}
# ----------------------------------------------------------------------------

def choose_page(cfg, title):
    done_js = js_embed(DONE_HTML)
    kind = cfg.get("kind", "multi")
    rows = []
    for o in cfg.get("options", []):
        typ = "checkbox" if kind == "multi" else "radio"
        chk = "checked" if o.get("selected") else ""
        desc = f'<span class="muted"> — {esc(o.get("desc",""))}</span>' if o.get("desc") else ""
        rows.append(
            f'<label class="pol-row"><input type="{typ}" name="opt" value="{esc(o["key"])}" {chk}>'
            f'<span><b>{esc(o["label"])}</b>{desc}</span></label>')
    note = f'<p class="editnote">{esc(cfg["note"])}</p>' if cfg.get("note") else ""
    return f"""<!DOCTYPE html><html><head><meta charset="utf-8">
<title>{esc(title)}</title><style>{BASE_CSS}</style></head><body>
<div class="container">
  <div class="header"><h1>{esc(title)}</h1><p>{esc(cfg.get("intro",""))}</p></div>
  <form class="card" id="f" onsubmit="return false;">
    {''.join(rows)}
    {note}
    <div class="err" id="err"></div>
    <button class="btn btn-accept" id="btn-go" type="button" onclick="submitChoice()">{esc(cfg.get("submit_label","Continue →"))}</button>
  </form>
  <footer>POSED guided app · local only (127.0.0.1)</footer>
</div>
<script>
const DONE_HTML = {done_js};
async function submitChoice() {{
  const err = document.getElementById('err'); err.style.display='none';
  const sel = Array.from(document.querySelectorAll('input[name=opt]:checked')).map(e => e.value);
  if (!sel.length) {{ err.style.display='block'; err.textContent='Pick at least one.'; return; }}
  const btn = document.getElementById('btn-go'); btn.disabled = true;
  try {{
    const resp = await fetch('/submit', {{ method:'POST',
      headers:{{'Content-Type':'application/x-www-form-urlencoded'}},
      body:new URLSearchParams({{ selected: JSON.stringify(sel) }}) }});
    if (!resp.ok) throw new Error('HTTP '+resp.status);
    document.querySelector('.container').innerHTML = DONE_HTML;
    window.scrollTo(0,0);
  }} catch (e) {{
    err.style.display='block';
    err.textContent='⚠ Could not reach the local server — ask the agent to reopen this window.';
    btn.disabled = false;
  }}
}}
</script>
</body></html>"""

# ----------------------------------------------------------------------------
# Items page — generic reviewable item-list wizard step (outline wizard 3.1-3.4)
#   Reads <session>/hitl/<name>_input.json:
#     {title, intro, step_label, item_noun, reorderable, allow_add,
#      reviewer:{total,threshold,passed,flags:[],findings:[{item_id,issue,fix}]},
#      fields:[{key,label,type:"text"|"textarea"|"number"}],
#      items:[{id, <field values>}], submit_label, note}
#   Writes <session>/hitl/<name>_decision.json:
#     {decision:"approve"|"regenerate", guidance,
#      items:[{id, order, disposition:keep|revise|split|remove, comment,
#              <edited field values>}], submitted_at}
#   Faculty get per-item keep/revise/split/remove + comment + reorder + add —
#   NEVER free-form feedback typed into description fields.
# ----------------------------------------------------------------------------

ITEMS_JS = r"""
const CFG = __CFG__;
let ITEMS = (CFG.items || []).map(it => ({
  data: { ...it }, disposition: 'keep', comment: ''
}));
let NEXT_NEW = 1;

function el(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  for (const c of kids) if (c != null) e.append(c);
  return e;
}
function autosize(t){ t.style.height='auto'; t.style.height=(t.scrollHeight+4)+'px'; }

function fieldEditor(field, item) {
  const v = item.data[field.key];
  if (field.type === 'textarea') {
    const ta = el('textarea', { class: 'val-area', rows: '2' });
    ta.value = (v == null ? '' : String(v));
    setTimeout(() => autosize(ta), 0);
    ta.addEventListener('input', () => { item.data[field.key] = ta.value; autosize(ta); });
    return ta;
  }
  const inp = el('input', { type: field.type === 'number' ? 'number' : 'text', class: 'val-input' });
  inp.value = (v == null ? '' : String(v));
  inp.addEventListener('input', () => {
    item.data[field.key] = (field.type === 'number' && inp.value !== '' && !isNaN(+inp.value))
      ? +inp.value : inp.value;
  });
  return inp;
}

function itemCard(item, idx) {
  const head = el('div', { class: 'card-head' },
    el('span', { class: 'muted' }, '#' + (idx + 1) + ' · ' + (item.data.id || '')),
    el('span', {},
      (CFG.reorderable ? el('button', { class: 'mini-btn', type: 'button', title: 'Move up',
        onclick: () => { if (idx > 0) { [ITEMS[idx-1], ITEMS[idx]] = [ITEMS[idx], ITEMS[idx-1]]; render(); } } }, '↑') : null),
      (CFG.reorderable ? el('button', { class: 'mini-btn', type: 'button', title: 'Move down',
        onclick: () => { if (idx < ITEMS.length-1) { [ITEMS[idx+1], ITEMS[idx]] = [ITEMS[idx], ITEMS[idx+1]]; render(); } } }, '↓') : null)));
  const body = el('div', {});
  for (const f of (CFG.fields || [])) {
    body.append(el('div', { class: 'muted', style: 'font-size:.72rem;margin:8px 0 2px;text-transform:uppercase;letter-spacing:.04em' }, f.label || f.key));
    body.append(fieldEditor(f, item));
  }
  const sel = el('select', { class: 'val-input', style: 'width:auto;padding:2px 8px;font-size:.8rem;flex:none' });
  for (const opt of ['keep', 'revise', 'split', 'remove']) {
    const o = el('option', { value: opt }, opt);
    if (opt === item.disposition) o.selected = true;
    sel.append(o);
  }
  const card = el('div', { class: 'obj-card' });
  sel.addEventListener('change', () => {
    item.disposition = sel.value;
    card.style.opacity = (sel.value === 'remove') ? '.45' : '1';
  });
  const cm = el('textarea', { class: 'val-area', rows: '1',
    placeholder: 'Comment for the AI on this ' + (CFG.item_noun || 'item') + ' (optional)…',
    style: 'font-size:.8rem;min-height:30px;flex:1' });
  cm.value = item.comment;
  cm.addEventListener('input', () => { item.comment = cm.value; autosize(cm); });
  card.append(head, body,
    el('div', { style: 'display:flex;gap:8px;align-items:flex-start;margin-top:10px' },
      el('span', { class: 'muted', style: 'font-size:.72rem;white-space:nowrap;padding-top:7px' }, '§'),
      sel, cm));
  if (item.disposition === 'remove') card.style.opacity = '.45';
  return card;
}

function render() {
  const host = document.getElementById('items');
  host.innerHTML = '';
  ITEMS.forEach((item, idx) => host.append(itemCard(item, idx)));
  if (CFG.allow_add !== false) {
    host.append(el('button', { class: 'mini-btn add', type: 'button', onclick: () => {
      const blank = { id: 'new-' + (NEXT_NEW++) };
      for (const f of (CFG.fields || [])) blank[f.key] = '';
      ITEMS.push({ data: blank, disposition: 'keep', comment: '' });
      render();
      window.scrollTo(0, document.body.scrollHeight);
    } }, '+ Add ' + (CFG.item_noun || 'item')));
  }
}

function renderReviewer() {
  const r = CFG.reviewer;
  const host = document.getElementById('reviewer');
  if (!r) { host.style.display = 'none'; return; }
  const flagTxt = (r.flags && r.flags.length)
    ? '⚑ ' + r.flags.length + ' flag(s)' : 'no critical flags';
  host.append(el('p', { style: 'margin:0;font-weight:600' },
    'Independent reviewer: ' + r.total + '/100 (threshold ' + r.threshold + ') · ' + flagTxt));
  if ((r.findings || []).length) {
    const d = el('details', {}, el('summary', { class: 'muted', style: 'cursor:pointer;font-size:.82rem' },
      r.findings.length + ' finding(s) — click to expand'));
    for (const f of r.findings)
      d.append(el('p', { style: 'font-size:.82rem;margin:6px 0 0' },
        '• [' + (f.item_id || '—') + '] ' + (f.issue || '') + (f.fix ? ' → ' + f.fix : '')));
    host.append(d);
  }
}

function collectItems() {
  return JSON.stringify(ITEMS.map((it, idx) => ({
    ...it.data, order: idx, disposition: it.disposition, comment: it.comment.trim()
  })));
}
function submitApprove() {
  setBusy(true);
  postForm({ decision: 'approve', guidance: '', items: collectItems() })
    .then(ok => { if (!ok) setBusy(false); });
}
function toggleRegen() {
  const b = document.getElementById('regen-box');
  b.style.display = (b.style.display === 'block') ? 'none' : 'block';
}
function submitRegen() {
  setBusy(true);
  postForm({ decision: 'regenerate',
             guidance: document.getElementById('regen-guidance').value,
             items: collectItems() })
    .then(ok => { if (!ok) setBusy(false); });
}
function setBusy(b) {
  for (const id of ['btn-approve', 'btn-regen', 'btn-regen-go'])
    { const e = document.getElementById(id); if (e) e.disabled = b; }
}
renderReviewer();
render();
"""


def items_page(cfg, title):
    cfg_literal = "JSON.parse(" + js_embed(json.dumps(cfg)) + ")"
    post_js = POST_JS.replace("__DONE__", js_embed(DONE_HTML))
    js = ITEMS_JS.replace("__CFG__", cfg_literal)
    note = f'<p class="editnote">{esc(cfg["note"])}</p>' if cfg.get("note") else ""
    return f"""<!DOCTYPE html><html><head><meta charset="utf-8">
<title>{esc(title)}</title><style>{BASE_CSS}</style></head><body>
<div class="container">
  <div class="header"><h1>{esc(title)}</h1>
    <p>{esc(cfg.get("intro", ""))}</p></div>
  <div class="card" id="reviewer"></div>
  <div id="items"></div>
  <p class="editnote">✎ Every field is editable. Each {esc(cfg.get("item_noun", "item"))} has a § control —
     keep / revise / split / remove — plus a comment box and ↑↓ reorder. Use those, not the text fields, for feedback.</p>
  {note}
  <div class="card">
    <div class="err" id="err"></div>
    <button class="btn btn-accept" id="btn-approve" type="button" onclick="submitApprove()">{esc(cfg.get("submit_label", "✓ Approve this step — AI builds the next step"))}</button>
    <button class="btn btn-regen" id="btn-regen" type="button" onclick="toggleRegen()">↻ Ask AI to revise this step…</button>
    <div id="regen-box" style="display:none;margin-top:12px">
      <label for="regen-guidance">What should the AI rework? <span class="hint">Your edits, dispositions, and comments above are included automatically.</span></label>
      <textarea id="regen-guidance" placeholder="e.g., split the life-cycle concept into per-stage entries"></textarea>
      <button class="btn btn-regen" id="btn-regen-go" type="button" onclick="submitRegen()">Confirm — revise this step</button>
    </div>
  </div>
  <footer>POSED guided app · {esc(cfg.get("step_label", "outline step"))} · local only (127.0.0.1)</footer>
</div>
<script>
{post_js}
{js}
</script>
</body></html>"""


# ----------------------------------------------------------------------------
# Scope page — declarative preference/scope form (e.g. Stage 4.0 Source Scope Gate)
#   Reads <session>/hitl/<name>_input.json:
#     {title, intro, submit_label, note,
#      groups:[{key, label, intro,
#               type:"checks"|"radio"|"text"|"textlist",
#               options:[{key,label,desc,selected}],   # checks/radio
#               value, values, placeholder}]}
#   Writes <session>/hitl/<name>_decision.json:
#     {name, groups:{<key>: [selected keys] | "selected key" | "text" | [texts]},
#      submitted_at}
#   Generic — the categories/options live in the SKILL's input json, not here.
# ----------------------------------------------------------------------------

SCOPE_JS = r"""
const CFG = __CFG__;
function el(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  for (const c of kids) if (c != null) e.append(c);
  return e;
}
function autosize(t){ t.style.height='auto'; t.style.height=(t.scrollHeight+4)+'px'; }
const STATE = {};   // group key -> value

function renderGroup(g) {
  const card = el('div', { class: 'card' });
  card.append(el('h2', { style: 'font-size:1.05rem;margin-bottom:2px' }, g.label || g.key));
  if (g.intro) card.append(el('p', { class: 'editnote', style: 'margin:0 0 10px' }, g.intro));

  if (g.type === 'checks' || g.type === 'radio') {
    STATE[g.key] = g.type === 'checks'
      ? (g.options || []).filter(o => o.selected).map(o => o.key)
      : ((g.options || []).find(o => o.selected) || {}).key || '';
    for (const o of (g.options || [])) {
      const inp = el('input', { type: g.type === 'checks' ? 'checkbox' : 'radio', name: g.key });
      inp.checked = !!o.selected;
      inp.addEventListener('change', () => {
        if (g.type === 'radio') STATE[g.key] = o.key;
        else {
          const set = new Set(STATE[g.key]);
          inp.checked ? set.add(o.key) : set.delete(o.key);
          STATE[g.key] = [...set];
        }
      });
      const desc = o.desc ? el('span', { class: 'muted' }, ' — ' + o.desc) : null;
      card.append(el('label', { class: 'pol-row', style: 'display:flex;gap:8px;align-items:flex-start;margin:4px 0' },
        inp, el('span', {}, el('b', {}, o.label), desc)));
    }
  } else if (g.type === 'text') {
    STATE[g.key] = g.value || '';
    const ta = el('textarea', { class: 'val-area', rows: '2', placeholder: g.placeholder || '' });
    ta.value = STATE[g.key];
    setTimeout(() => autosize(ta), 0);
    ta.addEventListener('input', () => { STATE[g.key] = ta.value; autosize(ta); });
    card.append(ta);
  } else if (g.type === 'textlist') {
    STATE[g.key] = Array.isArray(g.values) ? [...g.values] : [];
    const list = el('div', {});
    const draw = () => {
      list.innerHTML = '';
      STATE[g.key].forEach((v, i) => {
        const inp = el('input', { type: 'text', class: 'val-input', placeholder: g.placeholder || '' });
        inp.value = v;
        inp.addEventListener('input', () => { STATE[g.key][i] = inp.value; });
        const rm = el('button', { class: 'mini-btn', type: 'button',
          onclick: () => { STATE[g.key].splice(i, 1); draw(); } }, '× remove');
        list.append(el('div', { class: 'arr-item', style: 'display:flex;gap:6px;margin:3px 0' }, inp, rm));
      });
      list.append(el('button', { class: 'mini-btn add', type: 'button',
        onclick: () => { STATE[g.key].push(''); draw(); } }, '+ Add'));
    };
    draw();
    card.append(list);
  }
  return card;
}

function submitScope() {
  // drop empty textlist entries
  const out = {};
  for (const [k, v] of Object.entries(STATE))
    out[k] = Array.isArray(v) ? v.map(x => (typeof x === 'string' ? x.trim() : x)).filter(x => x !== '') : v;
  const btn = document.getElementById('btn-go'); btn.disabled = true;
  postForm({ groups: JSON.stringify(out) }).then(ok => { if (!ok) btn.disabled = false; });
}

(function init(){
  const host = document.getElementById('groups');
  for (const g of (CFG.groups || [])) host.append(renderGroup(g));
})();
"""


def scope_page(cfg, title):
    cfg_literal = "JSON.parse(" + js_embed(json.dumps(cfg)) + ")"
    post_js = POST_JS.replace("__DONE__", js_embed(DONE_HTML))
    js = SCOPE_JS.replace("__CFG__", cfg_literal)
    note = f'<p class="editnote">{esc(cfg["note"])}</p>' if cfg.get("note") else ""
    return f"""<!DOCTYPE html><html><head><meta charset="utf-8">
<title>{esc(title)}</title><style>{BASE_CSS}</style></head><body>
<div class="container">
  <div class="header"><h1>{esc(title)}</h1>
    <p>{esc(cfg.get("intro", ""))}</p></div>
  <div id="groups"></div>
  {note}
  <div class="card">
    <div class="err" id="err"></div>
    <button class="btn btn-accept" id="btn-go" type="button" onclick="submitScope()">{esc(cfg.get("submit_label", "✓ Submit scope — AI proceeds within it"))}</button>
  </div>
  <footer>POSED guided app · scope gate · local only (127.0.0.1)</footer>
</div>
<script>
{post_js}
{js}
</script>
</body></html>"""


# ----------------------------------------------------------------------------
# Ledger page — itemized change-proposal review (AI-impact course audit)
#   Reads a change_ledger.json: {course, generated_at, changes:[{id, severity,
#     category, file, location, finding, current, proposed, rationale, effort,
#     evidence}]}
#   Every change gets its own decision: approve / reject / defer. The
#   "proposed" text is directly editable — approving an edited proposal
#   returns the edited text. Nothing is applied until the agent reads the
#   decision file; rejected and deferred items are never applied.
# ----------------------------------------------------------------------------

LEDGER_CSS = """
.sev { font-size:.72rem; font-weight:700; padding:2px 10px; border-radius:99px;
       color:#fff; letter-spacing:.04em; }
.sev-high { background:#dc2626; } .sev-medium { background:#d97706; }
.sev-low { background:#0891b2; }
.cat { font-size:.75rem; color:var(--muted); border:1px solid var(--border);
       border-radius:99px; padding:2px 10px; margin-left:6px; }
.chg-file { font-family:ui-monospace,Menlo,monospace; font-size:.82rem; color:#4338ca; }
.chg details { margin:8px 0; }
.chg summary { cursor:pointer; font-size:.85rem; color:var(--muted); font-weight:600; }
.chg pre { white-space:pre-wrap; font-family:ui-monospace,Menlo,monospace; font-size:.83rem;
           background:#f8fafc; border:1px solid var(--border); padding:10px 12px;
           border-radius:8px; margin:6px 0; max-height:260px; overflow-y:auto; }
.decide { display:flex; gap:18px; margin:10px 0 6px; flex-wrap:wrap; }
.decide label { display:flex; align-items:center; gap:6px; font-weight:500;
                margin:0; font-size:.9rem; cursor:pointer; }
.decide input { width:auto; }
.chg { border-left:4px solid var(--border); transition:border-color .15s, background .15s; }
.chg.is-approve, .chg.is-autofix { border-left-color:#16a34a; background:#f6fef8; }
.chg.is-manual  { border-left-color:#2563eb; background:#f5f8ff; }
.chg.is-reject  { border-left-color:#dc2626; background:#fef7f7; opacity:.75; }
.chg.is-defer   { border-left-color:#d97706; }
.bulk-bar { display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-bottom:14px; }
.bulk-bar button { border:1px solid var(--border); background:#fff; border-radius:8px;
                   padding:6px 14px; cursor:pointer; font-size:.85rem; }
.bulk-bar button:hover { border-color:var(--primary); color:var(--primary); }
#tally { font-weight:600; font-size:.9rem; margin-left:auto; }
.lens { font-size:.72rem; font-weight:600; padding:2px 9px; border-radius:99px; margin-left:6px;
        background:#eef2ff; color:#4338ca; }
.lens-format{background:#f0fdf4;color:#15803d;} .lens-skills{background:#fef3c7;color:#92400e;}
.lens-currency{background:#f3e8ff;color:#7c2d92;} .lens-access{background:#e0f2fe;color:#075985;}
.preview-row { display:flex; align-items:center; gap:8px; margin:8px 0 2px; font-size:.88rem; }
.preview-row input { width:auto; }
.cost-note { background:#fffbeb; border:1px solid #fde68a; border-radius:8px; padding:8px 12px;
             font-size:.82rem; color:#92400e; margin:10px 0; }
"""


def ledger_page(ledger, title):
    done_js = js_embed(DONE_HTML)
    changes = ledger.get("changes", [])
    cards = []
    originals = {}
    for i, c in enumerate(changes, 1):
        cid = c.get("id", f"chg-{i:03d}")
        originals[cid] = c.get("proposed", "")
        sev = (c.get("severity") or "medium").lower()
        loc = f' — {esc(c["location"])}' if c.get("location") else ""
        meta_bits = []
        if c.get("effort"):
            meta_bits.append(f"Effort: {esc(c['effort'])}")
        if c.get("evidence"):
            meta_bits.append(f"Evidence: {esc(c['evidence'])}")
        meta = " · ".join(meta_bits)
        rationale = f'<p class="editnote"><b>Why:</b> {esc(c.get("rationale",""))}' \
                    + (f'<br>{meta}' if meta else "") + "</p>"
        current = (f'<details><summary>Current content</summary><pre>{esc(c.get("current",""))}</pre></details>'
                   if c.get("current") else "")
        lens = (c.get("lens") or "").lower()
        lens_badge = (f'<span class="lens lens-{esc(lens)}">{esc(lens)}</span>' if lens else "")
        # Access items get a 4-way disposition (auto-fix vs manual); others the standard 3-way.
        if lens == "access":
            decide = (
              f'<div class="decide">'
              f'<label><input type="radio" name="dec-{esc(cid)}" value="autofix" onchange="mark(this)"> ✅ Auto-fix</label>'
              f'<label><input type="radio" name="dec-{esc(cid)}" value="manual" onchange="mark(this)"> 🛠 I\'ll fix manually</label>'
              f'<label><input type="radio" name="dec-{esc(cid)}" value="reject" onchange="mark(this)"> ❌ Reject</label>'
              f'<label><input type="radio" name="dec-{esc(cid)}" value="defer" checked onchange="mark(this)"> ⏸ Decide later</label>'
              f'</div>')
        else:
            decide = (
              f'<div class="decide">'
              f'<label><input type="radio" name="dec-{esc(cid)}" value="approve" onchange="mark(this)"> ✅ Approve</label>'
              f'<label><input type="radio" name="dec-{esc(cid)}" value="reject" onchange="mark(this)"> ❌ Reject</label>'
              f'<label><input type="radio" name="dec-{esc(cid)}" value="defer" checked onchange="mark(this)"> ⏸ Decide later</label>'
              f'</div>')
        # Format items can request an on-demand preview (nothing generates unless checked).
        preview_row = ""
        if lens == "format":
            preview_row = (
              f'<div class="preview-row"><input type="checkbox" class="preview-req" id="pv-{esc(cid)}">'
              f'<label for="pv-{esc(cid)}" style="margin:0;font-weight:500">Generate a preview of this format '
              f'<span class="hint" style="margin:0">(uses tokens — only runs if checked)</span></label></div>')
        cards.append(f"""
  <div class="obj-card chg is-defer" data-id="{esc(cid)}" data-lens="{esc(lens)}">
    <div class="card-head">
      <b>#{i} <span class="chg-file">{esc(c.get("file",""))}</span>{loc}</b>
      <span><span class="sev sev-{esc(sev)}">{esc(sev.upper())}</span><span class="cat">{esc(c.get("category",""))}</span>{lens_badge}</span>
    </div>
    <p>{esc(c.get("finding",""))}</p>
    {current}
    <label style="margin-top:8px">Proposed change <span class="hint">(edit directly — approving keeps your edits)</span></label>
    <textarea class="val-area proposed" rows="4">{esc(c.get("proposed",""))}</textarea>
    {rationale}
    {decide}
    {preview_row}
    <input type="text" class="comment" placeholder="Optional note to the AI about this item (e.g., 'yes, but keep the page budget')">
  </div>""")
    has_format = any((c.get("lens") or "").lower() == "format" for c in changes)
    cost_note = ('<div class="cost-note">💡 Format previews cost tokens — <b>nothing generates unless you '
                 'request it</b>. Tick "Generate a preview" on any format item, or use "Preview all formats" below. '
                 'Skip it and you just get the written spec.</div>' if has_format else "")
    preview_all_btn = ('<button type="button" onclick="previewAll()">Preview all formats</button>'
                       if has_format else "")
    intro = (f'{len(changes)} proposed changes for <b>{esc(ledger.get("course",""))}</b>. '
             "Decide each item — only approved items will be applied, and always as revised "
             "copies with diffs; your original files are never modified.")
    return f"""<!DOCTYPE html><html><head><meta charset="utf-8">
<title>{esc(title)}</title><style>{BASE_CSS}{LEDGER_CSS}</style></head><body>
<div class="container">
  <div class="header"><h1>{esc(title)}</h1><p>{intro}</p></div>
  <div class="card">
    {cost_note}
    <div class="bulk-bar">
      <span style="font-size:.85rem;color:var(--muted)">Bulk:</span>
      <button type="button" onclick="bulk('approve')">Approve all</button>
      <button type="button" onclick="bulk('reject')">Reject all</button>
      <button type="button" onclick="bulk('defer')">Reset all to Decide later</button>
      {preview_all_btn}
      <span id="tally"></span>
    </div>
    {''.join(cards)}
    <div class="err" id="err"></div>
    <button class="btn btn-accept" id="btn-go" type="button" onclick="submitLedger()">Submit decisions →</button>
    <p class="editnote">Deferred items are saved and re-presented next time — nothing is lost.</p>
  </div>
  <footer>POSED guided app · local only (127.0.0.1)</footer>
</div>
<script>
const DONE_HTML = {done_js};
const ORIGINALS = {js_embed(json.dumps(originals))};
function mark(radio) {{
  const card = radio.closest('.chg');
  card.className = 'obj-card chg is-' + radio.value;
  tally();
}}
function bulk(val) {{
  // 'approve' maps to 'autofix' on access items (they have no plain approve radio).
  document.querySelectorAll('.chg').forEach(card => {{
    let want = val;
    if (val === 'approve' && card.dataset.lens === 'access') want = 'autofix';
    const r = card.querySelector('input[value="'+want+'"]');
    if (r) {{ r.checked = true; mark(r); }}
  }});
}}
function previewAll() {{
  document.querySelectorAll('.preview-req').forEach(cb => cb.checked = true);
}}
function tally() {{
  let a=0, r=0, d=0;
  document.querySelectorAll('.chg').forEach(card => {{
    const v = card.querySelector('input[type=radio]:checked').value;
    if (v==='approve'||v==='autofix'||v==='manual') a++; else if (v==='reject') r++; else d++;
  }});
  document.getElementById('tally').textContent = '✅ '+a+' · ❌ '+r+' · ⏸ '+d;
}}
tally();
async function submitLedger() {{
  const orig = JSON.parse(ORIGINALS);
  const decisions = [];
  document.querySelectorAll('.chg').forEach(card => {{
    const id = card.dataset.id;
    const proposed = card.querySelector('.proposed').value;
    const pv = card.querySelector('.preview-req');
    decisions.push({{
      id: id,
      decision: card.querySelector('input[type=radio]:checked').value,
      lens: card.dataset.lens || null,
      proposed: proposed,
      edited: proposed !== (orig[id] || ''),
      comment: card.querySelector('.comment').value.trim(),
      preview_requested: pv ? pv.checked : false
    }});
  }});
  const btn = document.getElementById('btn-go'); btn.disabled = true;
  const err = document.getElementById('err'); err.style.display = 'none';
  try {{
    const resp = await fetch('/submit', {{ method:'POST',
      headers:{{'Content-Type':'application/x-www-form-urlencoded'}},
      body:new URLSearchParams({{ decisions: JSON.stringify(decisions) }}) }});
    if (!resp.ok) throw new Error('HTTP '+resp.status);
    document.querySelector('.container').innerHTML = DONE_HTML;
    window.scrollTo(0,0);
  }} catch (e) {{
    err.style.display='block';
    err.textContent='⚠ Could not reach the local server — ask the agent to reopen this window. Your decisions are still on this page.';
    btn.disabled = false;
  }}
}}
</script>
</body></html>"""

# ----------------------------------------------------------------------------
# Server
# ----------------------------------------------------------------------------

class _Handler(BaseHTTPRequestHandler):
    page_html = ""
    result = None
    done_event = None
    session_dir = None

    def log_message(self, *args):
        pass

    def do_GET(self):
        if self.path == "/ping":
            self.send_response(200); self.send_header("Content-Type","text/plain"); self.end_headers()
            self.wfile.write(b"ok"); return
        if self.path == "/open" and self.session_dir:
            # Open the session folder in the OS file manager (page JS calls this).
            import subprocess, platform
            cmd = {"Darwin": "open", "Windows": "explorer"}.get(platform.system(), "xdg-open")
            try:
                subprocess.Popen([cmd, self.session_dir])
            except Exception:
                pass
            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(b"ok")
            return
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        self.wfile.write(self.page_html.encode())

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length).decode()
        ctype = self.headers.get("Content-Type", "")
        if ctype.startswith("application/json"):
            try:
                data = json.loads(body)
            except Exception:
                data = {}
        else:
            data = {k: v[0] for k, v in parse_qs(body, keep_blank_values=True).items()}
        type(self).result = data
        self.send_response(200)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.end_headers()
        self.wfile.write(b"ok")
        self.done_event.set()


FOLDER_BAR = """<div class="folder-bar">📁 Session artifacts are saved to:
<code>{path}</code>
<button type="button" onclick="fetch('/open')" title="Open this folder in your file manager">Open folder</button></div>
<footer>"""


LIVENESS_JS = """<script>
/* Surface ANY runtime JS error visibly — a click must never fail silently. */
window.onerror = function (msg, src_, line) {
  var e = document.getElementById('err');
  if (!e) { e = document.createElement('div'); e.className = 'err';
            document.querySelector('.container').prepend(e); }
  e.style.display = 'block';
  e.textContent = '⚠ Page error: ' + msg + ' (line ' + line + '). Tell the agent — do not keep clicking.';
};
/* Stale-window guard: when this page's server is gone (the agent moved on or
   was interrupted), cover the page so a dead tab cannot be mistaken for live. */
(function heartbeat() {
  var misses = 0;
  setInterval(function () {
    fetch('/ping', { cache: 'no-store' }).then(function (r) { if (r.ok) misses = 0; else misses++; check(); })
      .catch(function () { misses++; check(); });
    function check() {
      if (misses >= 2 && !document.getElementById('stale-overlay')) {
        var o = document.createElement('div');
        o.id = 'stale-overlay';
        o.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.93);color:#fff;' +
          'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
          'z-index:9999;text-align:center;padding:40px;font-size:1.1rem;gap:12px';
        o.innerHTML = '<div style="font-size:2.4rem">⛔ This window is STALE</div>' +
          '<div>Its server has stopped — buttons here no longer work.</div>' +
          '<div style="opacity:.8">Closing automatically in 4 seconds. If you still need this step, ask the agent to reopen it.</div>';
        document.body.appendChild(o);
        setTimeout(function() { window.close(); }, 4000);
      }
    }
  }, 3000);
})();
</script></body>"""


def _write_status_file(path, payload):
    if not path:
        return
    try:
        _write_json(os.path.abspath(path), payload)
    except Exception as e:
        print(f"[posed_app] Could not write status file {path}: {e}", file=sys.stderr)


def serve_once(page_html, port=0, session_dir=None, status_file=None, status_payload=None):
    """Serve one page on 127.0.0.1, block until a POST arrives, return form data."""
    page_html = page_html.replace("</body>", LIVENESS_JS, 1)
    if session_dir:
        # Show the artifact location on EVERY guided page, with an open-folder button.
        page_html = page_html.replace("<footer>", FOLDER_BAR.format(path=html.escape(session_dir)), 1)
    done = threading.Event()
    handler = type("H", (_Handler,), {"page_html": page_html, "result": None, "done_event": done,
                                      "session_dir": session_dir})
    httpd = HTTPServer(("127.0.0.1", port), handler)
    url = f"http://127.0.0.1:{httpd.server_address[1]}/"

    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()

    print(f"[posed_app] Form ready: {url}", file=sys.stderr)
    print("[posed_app] Waiting for the user to submit in the browser…", file=sys.stderr)
    status = {
        "status": "ready",
        "url": url,
        "pid": os.getpid(),
        "session_dir": session_dir,
        "started_at": datetime.now(timezone.utc).isoformat(),
    }
    if status_payload:
        status.update(status_payload)
    _write_status_file(status_file, status)
    try:
        webbrowser.open(url)
    except Exception:
        pass

    done.wait()
    time.sleep(0.3)
    httpd.shutdown()
    status["status"] = "submitted_to_server"
    status["submitted_at"] = datetime.now(timezone.utc).isoformat()
    _write_status_file(status_file, status)
    return handler.result

# ----------------------------------------------------------------------------
# Main
# ----------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("mode", choices=["intake", "gate", "materials", "plan-wizard", "choose", "ledger", "items", "scope"])
    ap.add_argument("--step", type=int, choices=[1, 2, 3], default=None,
                    help="Planning sub-stage (plan-wizard mode): 1=outcomes/topics, 2=style, 3=deliverables/schedule")
    ap.add_argument("--session", required=True, help="Session folder")
    ap.add_argument("--flow", choices=["posed", "p2d", "audit"], default="posed", help="Which intake form (intake mode)")
    ap.add_argument("--stage", help="Stage name (gate mode), e.g. plan / persona / outline")
    ap.add_argument("--artifact", help="Path to artifact file to review (gate mode)")
    ap.add_argument("--title", help="Page title (gate mode)")
    ap.add_argument("--purpose", choices=["persona", "sources", "template"], default="persona",
                    help="Materials-window purpose (materials mode)")
    ap.add_argument("--name", help="choose-mode input/output basename (e.g. pick_deliverables)")
    ap.add_argument("--port", type=int, default=0, help="Port (default: auto)")
    ap.add_argument("--cloud-safe", choices=["auto", "always", "never"], default="auto",
                    help="Stage guided pages outside cloud-synced folders (default: auto)")
    ap.add_argument("--status-file",
                    help="Write live server status JSON here for launcher/browser handoff")
    args = ap.parse_args()

    cloud = CloudSafeSession(os.path.abspath(args.session), args.cloud_safe)
    session = cloud.runtime_session
    display_session = cloud.display_session
    hitl_dir = os.path.join(session, "hitl")
    os.makedirs(hitl_dir, exist_ok=True)

    project_artifact_path = None
    local_artifact_path = None
    backup = None
    project_backup = None
    uploads_dir = None
    server_status = {
        "mode": args.mode,
        "stage": args.stage,
        "project_session": cloud.project_session,
        "runtime_session": session,
        "cloud_safe_active": cloud.active,
    }

    def run_page(page_html):
        return serve_once(
            page_html,
            args.port,
            session_dir=display_session,
            status_file=args.status_file,
            status_payload=server_status,
        )

    if args.mode == "choose":
        name = args.name or "choose"
        if cloud.active:
            cloud.stage_session_file(os.path.join("hitl", f"{name}_input.json"))
        in_path = os.path.join(hitl_dir, f"{name}_input.json")
        if not os.path.exists(in_path):
            ap.error(f"choose needs {in_path}")
        cfg = json.load(open(in_path))
        title = args.title or cfg.get("title", "Choose")
        result = run_page(choose_page(cfg, title))
        try:
            selected = json.loads(result.get("selected", "[]"))
        except Exception:
            selected = []
        payload = {"name": name, "selected": selected,
                   "submitted_at": datetime.now(timezone.utc).isoformat()}
        out_path = os.path.join(hitl_dir, f"{name}_decision.json")
    elif args.mode == "items":
        name = args.name
        if not name:
            ap.error("items mode requires --name (e.g. outline_step1_concepts)")
        if cloud.active:
            cloud.stage_session_file(os.path.join("hitl", f"{name}_input.json"))
        in_path = os.path.join(hitl_dir, f"{name}_input.json")
        if not os.path.exists(in_path):
            ap.error(f"items needs {in_path} (write the step input first)")
        cfg = json.load(open(in_path))
        title = args.title or cfg.get("title", "Review items")
        result = run_page(items_page(cfg, title))
        try:
            items = json.loads(result.get("items", "[]"))
        except Exception:
            items = []
        payload = {"name": name,
                   "decision": result.get("decision", ""),
                   "guidance": result.get("guidance", ""),
                   "items": items,
                   "submitted_at": datetime.now(timezone.utc).isoformat()}
        out_path = os.path.join(hitl_dir, f"{name}_decision.json")
    elif args.mode == "scope":
        name = args.name
        if not name:
            ap.error("scope mode requires --name (e.g. source_scope)")
        if cloud.active:
            cloud.stage_session_file(os.path.join("hitl", f"{name}_input.json"))
        in_path = os.path.join(hitl_dir, f"{name}_input.json")
        if not os.path.exists(in_path):
            ap.error(f"scope needs {in_path} (write the scope-form spec first)")
        cfg = json.load(open(in_path))
        title = args.title or cfg.get("title", "Scope")
        result = run_page(scope_page(cfg, title))
        try:
            groups = json.loads(result.get("groups", "{}"))
        except Exception:
            groups = {}
        payload = {"name": name, "groups": groups,
                   "submitted_at": datetime.now(timezone.utc).isoformat()}
        out_path = os.path.join(hitl_dir, f"{name}_decision.json")
    elif args.mode == "plan-wizard":
        step = args.step or 1
        if cloud.active:
            cloud.stage_session_file(os.path.join("hitl", f"plan_step{step}_input.json"))
        in_path = os.path.join(hitl_dir, f"plan_step{step}_input.json")
        if not os.path.exists(in_path):
            ap.error(f"plan-wizard step {step} needs {in_path} (write the step input first)")
        wz = json.load(open(in_path))
        wz["step"] = step
        title = args.title or "Planning the module"
        result = run_page(plan_wizard_page(wz, title))
        payload = {"submitted_at": datetime.now(timezone.utc).isoformat(), **result}
        out_path = os.path.join(hitl_dir, f"plan_step{step}_decision.json")
    elif args.mode == "ledger":
        if not args.artifact:
            ap.error("ledger mode requires --artifact (path to change_ledger.json)")
        ledger_path, project_ledger_path = cloud.stage_artifact(args.artifact)
        with open(ledger_path) as f:
            ledger = json.load(f)
        title = args.title or "AI-Impact Audit — Proposed Changes"
        stage = args.stage or "change_ledger"
        result = run_page(ledger_page(ledger, title))
        try:
            decisions = json.loads(result.get("decisions", "[]"))
        except Exception:
            decisions = []
        counts = {"approve": 0, "reject": 0, "defer": 0, "autofix": 0, "manual": 0}
        preview_requested = 0
        format_total = 0
        for d in decisions:
            dec = d.get("decision", "defer")
            counts[dec] = counts.get(dec, 0) + 1
            if (d.get("lens") or "") == "format":
                format_total += 1
            if d.get("preview_requested"):
                preview_requested += 1
        # preview_mode: none / selected / all (all = every format item was requested)
        if preview_requested == 0:
            preview_mode = "none"
        elif format_total and preview_requested >= format_total:
            preview_mode = "all"
        else:
            preview_mode = "selected"
        payload = {"stage": stage, "ledger_path": project_ledger_path, "decisions": decisions,
                   "counts": counts, "preview_mode": preview_mode,
                   "preview_requested": preview_requested,
                   "submitted_at": datetime.now(timezone.utc).isoformat()}
        out_path = os.path.join(hitl_dir, f"{stage}_decision.json")
    elif args.mode == "intake":
        result = run_page(intake_page(args.flow))
        out_path = os.path.join(hitl_dir, "intake.json")
        payload = {"flow": args.flow,
                   "submitted_at": datetime.now(timezone.utc).isoformat(), **result}
    elif args.mode == "materials":
        import base64
        import re as _re
        purpose = args.purpose
        stage_label = args.stage or purpose.capitalize()
        result = run_page(materials_page(stage_label, purpose))
        uploads_dir = os.path.join(session, "uploads", purpose)
        saved = []
        if not result.get("skip"):
            for f in result.get("files", []):
                name = _re.sub(r"[^A-Za-z0-9._ -]+", "_", os.path.basename(f.get("name", "file")))
                os.makedirs(uploads_dir, exist_ok=True)
                dest = os.path.join(uploads_dir, name)
                with open(dest, "wb") as fh:
                    fh.write(base64.b64decode(f.get("b64", "")))
                saved.append(os.path.relpath(dest, session))
        raw_path = (result.get("path") or "").strip() or None
        path_kind = None
        if raw_path:
            path_kind = "folder" if os.path.isdir(raw_path) else ("file" if os.path.isfile(raw_path) else "missing")
        payload = {
            "purpose": purpose,
            "mode": "skip" if result.get("skip") else "provided",
            "path": raw_path,
            "path_kind": path_kind,
            "uploaded_files": saved,
            "research_policy": result.get("research_policy"),
            "folder_info": result.get("folder_info"),
            "submitted_at": datetime.now(timezone.utc).isoformat(),
        }
        out_path = os.path.join(hitl_dir, f"{purpose}_materials.json")
    else:
        if not (args.stage and args.artifact):
            ap.error("gate mode requires --stage and --artifact")
        local_artifact_path, project_artifact_path = cloud.stage_artifact(args.artifact)
        with open(local_artifact_path) as f:
            text = f.read()
        kind = "json" if local_artifact_path.endswith(".json") else "markdown"
        title = args.title or f"Review: {args.stage}"

        result = run_page(gate_page(args.stage, title, project_artifact_path, text, kind))

        decision = result.get("decision", "")
        guidance = result.get("guidance", "")
        edited = result.get("edited_content", "")
        try:
            faculty_answers = json.loads(result.get("faculty_answers", "") or "[]")
        except Exception:
            faculty_answers = []
        try:
            section_feedback = json.loads(result.get("section_feedback", "") or "[]")
        except Exception:
            section_feedback = []

        artifact_updated = False
        # User edits are kept for BOTH decisions:
        #  - accept + edits  → decision becomes "edit" (approve the edited version)
        #  - regenerate + edits → decision stays "regenerate", but the artifact
        #    file now contains the user's edits, so the agent regenerates FROM
        #    the edited version (selective re-entry, per the POSED paper).
        if edited and edited != text:
            ext = os.path.splitext(local_artifact_path)[1] or ".txt"
            backup = os.path.join(hitl_dir, f"{args.stage}_original{ext}")
            project_backup = cloud.project_for_local(backup)
            if not os.path.exists(backup):
                with open(backup, "w") as f:
                    f.write(text)
            with open(local_artifact_path, "w") as f:
                f.write(edited)
            artifact_updated = True
            if decision == "accept":
                decision = "edit"

        payload = {
            "stage": args.stage,
            "decision": decision,
            "guidance": guidance if decision == "regenerate" else "",
            "faculty_answers": faculty_answers,
            "section_feedback": section_feedback,
            "artifact_updated": artifact_updated,
            "original_backup": project_backup if project_backup else backup,
            "submitted_at": datetime.now(timezone.utc).isoformat(),
        }
        out_path = os.path.join(hitl_dir, f"{args.stage}_decision.json")

    final_out_path = out_path
    if cloud.active:
        if args.mode == "gate" and payload.get("artifact_updated") and local_artifact_path and project_artifact_path:
            cloud.sync_file_back(local_artifact_path, project_artifact_path)
            if backup and project_backup:
                cloud.sync_file_back(backup, project_backup)
        if args.mode == "materials" and uploads_dir:
            cloud.sync_tree_back(uploads_dir)
        final_out_path = cloud.project_for_local(out_path)
        pending_decision = {"staging": os.path.abspath(out_path), "project": os.path.abspath(final_out_path)}
        meta = cloud.metadata(args.mode, args.stage or args.name or args.purpose or args.flow)
        if meta:
            meta["synced_outputs"] = list(cloud.synced_outputs) + [pending_decision]
            payload["cloud_safe_hitl"] = meta

    with open(out_path, "w") as f:
        json.dump(payload, f, indent=2)

    if cloud.active:
        cloud.sync_file_back(out_path, final_out_path)
        cloud.record_sync(args.mode, args.stage or args.name or args.purpose or args.flow)

    if args.status_file:
        final_status = _load_json(os.path.abspath(args.status_file), {})
        final_status.update({
            "status": "completed",
            "mode": args.mode,
            "stage": args.stage,
            "project_session": cloud.project_session,
            "runtime_session": session,
            "cloud_safe_active": cloud.active,
            "decision_path": os.path.abspath(final_out_path),
            "completed_at": datetime.now(timezone.utc).isoformat(),
        })
        if args.mode == "gate":
            final_status["decision"] = payload.get("decision")
            final_status["artifact_updated"] = payload.get("artifact_updated", False)
        _write_status_file(args.status_file, final_status)

    # The ONLY stdout output: the result file path. Agents parse this.
    print(final_out_path)


if __name__ == "__main__":
    main()
