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
  → writes <session>/hitl/intake.json and prints its path to stdout.

  HITL gate (after each stage):
    python3 posed_app.py gate --session <dir> --stage plan \
        --artifact <dir>/curriculum_plan.json --title "Stage 1: Curriculum Plan"

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

  Decision JSON shape (written to <session>/hitl/<stage>_decision.json):
    { "stage": "plan",
      "decision": "accept | edit | regenerate",
      "guidance": "<text if regenerate, may be empty>",
      "artifact_updated": true|false,        # true when decision == "edit"
      "original_backup": "<path>|null",
      "submitted_at": "<iso8601>" }

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
import html
import json
import os
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
    ("duration_minutes", "Lecture duration (minutes)", "number", True, "50"),
    ("course_code", "Course code", "text", False, "e.g., CompENG 3510"),
    ("course_name", "Course name", "text", False, "e.g., Logic and Digital Design"),
    ("instructor", "Instructor name", "text", True, ""),
    ("institution", "Institution", "text", False, "e.g., UW-Platteville"),
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
"""

DONE_HTML = """<div class="card done"><h1>✓ Submitted</h1>
<p>You can close this tab and return to the chat — the AI will continue from here.</p></div>"""

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
# Intake page
# ----------------------------------------------------------------------------

def render_field(key, label, ftype, required, hint):
    req = '<span class="req">*</span>' if required else ""
    hint_html = f'<span class="hint">{esc(hint)}</span>' if hint and ftype != "select" else ""
    lab = f'<label for="{key}">{esc(label)} {req}{hint_html}</label>'
    r = "required" if required else ""
    if ftype == "textarea":
        return f'{lab}<textarea id="{key}" name="{key}" {r}></textarea>'
    if ftype == "select":
        opts = "".join(f'<option value="{esc(o)}">{esc(o)}</option>' for o in hint.split("|"))
        return f'{lab}<select id="{key}" name="{key}" {r}>{opts}</select>'
    if ftype == "number":
        default = f'value="{esc(hint)}"' if hint else ""
        return f'{lab}<input type="number" id="{key}" name="{key}" {default} {r}>'
    return f'{lab}<input type="text" id="{key}" name="{key}" placeholder="{esc(hint)}" {r}>'


def intake_page(flow):
    fields = POSED_INTAKE_FIELDS if flow == "posed" else P2D_INTAKE_FIELDS
    title = "POSED — New Lecture Module" if flow == "posed" else "Paper-to-Deck — New Presentation"
    sub = ("Fill in the module context. The AI will use this to draft the teaching plan."
           if flow == "posed" else
           "Fill in the presentation context. The AI will analyze the paper and build the deck.")
    body = "".join(render_field(*f) for f in fields)
    post_js = POST_JS.replace("__DONE__", js_embed(DONE_HTML))
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
function submitIntake() {{
  const f = document.getElementById('f');
  if (!f.reportValidity()) return;
  const data = {{}};
  for (const el of f.querySelectorAll('input,textarea,select')) data[el.name] = el.value;
  document.getElementById('go').disabled = true;
  postForm(data).then(ok => {{ if (!ok) document.getElementById('go').disabled = false; }});
}}
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
  return inp;
}

function renderNode(value, setter, depth) {
  if (value === null || value === undefined || typeof value !== 'object') {
    return scalarEditor(value, setter);
  }
  if (Array.isArray(value)) {
    const wrap = el('div', { class: 'arr' });
    value.forEach((item, i) => {
      const isObj = typeof item === 'object' && item !== null && !Array.isArray(item);
      const rm = el('button', { class: 'mini-btn', type: 'button', title: 'Remove this item',
        onclick: () => { value.splice(i, 1); markEdited(); rerender(); } }, '× remove');
      if (isObj) {
        const card = el('div', { class: 'obj-card' },
          el('div', { class: 'card-head' },
            el('span', { class: 'muted' }, 'Item ' + (i + 1)), rm),
          renderNode(item, v => { value[i] = v; }, depth + 1));
        wrap.append(card);
      } else {
        wrap.append(el('div', { class: 'arr-item' },
          renderNode(item, v => { value[i] = v; }, depth + 1), rm));
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
    const tag = 'h' + Math.min(2 + depth, 5);
    wrap.append(el(tag, {}, prettyKey(k)));
    wrap.append(renderNode(value[k], v => { value[k] = v; }, depth + 1));
  }
  return wrap;
}

function rerender() {
  const doc = document.getElementById('doc');
  doc.innerHTML = '';
  doc.append(renderNode(DATA, v => { DATA = v; }, 0));
}

// ---------- change tracking ----------
function isEdited() {
  if (KIND === 'json') return JSON.stringify(DATA) !== ORIG_MIN;
  if (PLAIN_FALLBACK) return document.getElementById('plain-editor').value !== ARTIFACT;
  return document.getElementById('doc').innerHTML !== INITIAL_HTML;
}
function markEdited() {
  document.getElementById('badge').style.display = isEdited() ? 'block' : 'none';
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
  postForm({ decision: 'accept', guidance: '', edited_content: edited ? content : '' })
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
             edited_content: edited ? content : '' })
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
      return;
    } catch (e) { /* fall through to markdown/plain path */ }
  }
  if (typeof marked !== 'undefined' && window.TurndownService) {
    doc.innerHTML = marked.parse(ARTIFACT);
    doc.contentEditable = 'true';
    INITIAL_HTML = doc.innerHTML;
    doc.addEventListener('input', markEdited);
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
                 "use “+ Add item” / “× remove” on lists."
                 if kind == "json" else
                 "The document below is directly editable — click anywhere and type.")
    return f"""<!DOCTYPE html><html><head><meta charset="utf-8">
<title>{esc(title)}</title><style>{BASE_CSS}</style></head><body>
<div class="container">
  <div class="header"><h1>{esc(title)}</h1>
    <p>Review — and edit, if you like — the document below, then accept or regenerate.
       File: <code>{esc(artifact_path)}</code></p></div>

  <div class="doc" id="doc"></div>
  <p class="editnote">✎ {esc(edit_hint)}</p>
  <div class="badge" id="badge">✎ You have edits — they will be kept either way: “Accept” approves your edited version; “Regenerate” starts from it.</div>

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
# Server
# ----------------------------------------------------------------------------

class _Handler(BaseHTTPRequestHandler):
    page_html = ""
    result = None
    done_event = None

    def log_message(self, *args):
        pass

    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        self.wfile.write(self.page_html.encode())

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length).decode()
        data = {k: v[0] for k, v in parse_qs(body, keep_blank_values=True).items()}
        type(self).result = data
        self.send_response(200)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.end_headers()
        self.wfile.write(b"ok")
        self.done_event.set()


def serve_once(page_html, port=0):
    """Serve one page on 127.0.0.1, block until a POST arrives, return form data."""
    done = threading.Event()
    handler = type("H", (_Handler,), {"page_html": page_html, "result": None, "done_event": done})
    httpd = HTTPServer(("127.0.0.1", port), handler)
    url = f"http://127.0.0.1:{httpd.server_address[1]}/"

    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()

    print(f"[posed_app] Form ready: {url}", file=sys.stderr)
    print("[posed_app] Waiting for the user to submit in the browser…", file=sys.stderr)
    try:
        webbrowser.open(url)
    except Exception:
        pass

    done.wait()
    time.sleep(0.3)
    httpd.shutdown()
    return handler.result

# ----------------------------------------------------------------------------
# Main
# ----------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("mode", choices=["intake", "gate"])
    ap.add_argument("--session", required=True, help="Session folder")
    ap.add_argument("--flow", choices=["posed", "p2d"], default="posed", help="Which intake form (intake mode)")
    ap.add_argument("--stage", help="Stage name (gate mode), e.g. plan / persona / outline")
    ap.add_argument("--artifact", help="Path to artifact file to review (gate mode)")
    ap.add_argument("--title", help="Page title (gate mode)")
    ap.add_argument("--port", type=int, default=0, help="Port (default: auto)")
    args = ap.parse_args()

    session = os.path.abspath(args.session)
    hitl_dir = os.path.join(session, "hitl")
    os.makedirs(hitl_dir, exist_ok=True)

    if args.mode == "intake":
        result = serve_once(intake_page(args.flow), args.port)
        out_path = os.path.join(hitl_dir, "intake.json")
        payload = {"flow": args.flow,
                   "submitted_at": datetime.now(timezone.utc).isoformat(), **result}
    else:
        if not (args.stage and args.artifact):
            ap.error("gate mode requires --stage and --artifact")
        artifact_path = os.path.abspath(args.artifact)
        with open(artifact_path) as f:
            text = f.read()
        kind = "json" if artifact_path.endswith(".json") else "markdown"
        title = args.title or f"Review: {args.stage}"

        result = serve_once(gate_page(args.stage, title, artifact_path, text, kind), args.port)

        decision = result.get("decision", "")
        guidance = result.get("guidance", "")
        edited = result.get("edited_content", "")

        backup = None
        artifact_updated = False
        # User edits are kept for BOTH decisions:
        #  - accept + edits  → decision becomes "edit" (approve the edited version)
        #  - regenerate + edits → decision stays "regenerate", but the artifact
        #    file now contains the user's edits, so the agent regenerates FROM
        #    the edited version (selective re-entry, per the POSED paper).
        if edited and edited != text:
            ext = os.path.splitext(artifact_path)[1] or ".txt"
            backup = os.path.join(hitl_dir, f"{args.stage}_original{ext}")
            if not os.path.exists(backup):
                with open(backup, "w") as f:
                    f.write(text)
            with open(artifact_path, "w") as f:
                f.write(edited)
            artifact_updated = True
            if decision == "accept":
                decision = "edit"

        payload = {
            "stage": args.stage,
            "decision": decision,
            "guidance": guidance if decision == "regenerate" else "",
            "artifact_updated": artifact_updated,
            "original_backup": backup,
            "submitted_at": datetime.now(timezone.utc).isoformat(),
        }
        out_path = os.path.join(hitl_dir, f"{args.stage}_decision.json")

    with open(out_path, "w") as f:
        json.dump(payload, f, indent=2)
    # The ONLY stdout output: the result file path. Agents parse this.
    print(out_path)


if __name__ == "__main__":
    main()
