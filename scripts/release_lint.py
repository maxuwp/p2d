#!/usr/bin/env python3
"""Release lint for the POSED repo — run before every push (see MAINTAINING.md).

Checks the drift classes that have actually bitten releases:
  1. Hardcoded ~/.claude / ~/.codex paths in shared skill markdown
     (whitelist: harness_adaptation.md, which defines the path mappings).
  2. The two plugin manifests (.claude-plugin / .codex-plugin) version-match.
  3. Deprecated repo URLs (posed-codex / p2d-codex) outside CHANGELOG.md.
  4. Rubric dimension points sum to 100 in skills/outline/reference/*rubric*.md.
  5. CHANGELOG.md mentions the current plugin version.
  6. reference/ files cited by skills exist (warning only — heuristic).

Exit 0 = clean (warnings allowed), 1 = errors found.
"""
import json, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
errors, warnings = [], []

# 1. Hardcoded harness paths in shared skill bodies
WHITELIST = {"harness_adaptation.md"}
for p in (ROOT / "skills").rglob("*.md"):
    if p.name in WHITELIST:
        continue
    for i, line in enumerate(p.read_text().splitlines(), 1):
        if "~/.claude/" in line or "~/.codex/" in line:
            errors.append(f"[path] {p.relative_to(ROOT)}:{i} hardcodes a harness path — "
                          f"use <posed-skill-dir>/… or <skills-dir>/…")

# 2. Manifest versions match
vers = {}
for mp in (".claude-plugin/plugin.json", ".codex-plugin/plugin.json"):
    f = ROOT / mp
    if not f.exists():
        errors.append(f"[manifest] missing {mp}"); continue
    vers[mp] = json.loads(f.read_text()).get("version")
if len(set(vers.values())) > 1:
    errors.append(f"[manifest] version mismatch: {vers}")
plugin_version = next(iter(vers.values()), None)

# 3. Deprecated repo URLs outside the changelog
DEPRECATED = ("maxuwp/posed-codex", "maxuwp/p2d-codex")
for p in list(ROOT.rglob("*.md")) + list(ROOT.rglob("*.json")):
    rel = p.relative_to(ROOT)
    if rel.parts[0] in {".git", "node_modules"} or p.name == "CHANGELOG.md":
        continue
    text = p.read_text(errors="ignore")
    for dep in DEPRECATED:
        if dep in text:
            errors.append(f"[repo] {rel} references deprecated {dep}")

# 4. Rubric dimensions sum to 100 (table style: | n | name | pts | ... ;
#    heading style: '### N. Name — 20 points')
for p in (ROOT / "skills").glob("*/reference/*rubric*.md"):
    text = p.read_text()
    if "100 points" not in text and "/100" not in text:
        continue  # not a scored reviewer rubric (e.g., student-facing rubric refs)
    pts = [int(m.group(1)) for m in
           re.finditer(r"^\|\s*\d+\s*\|[^|]+\|\s*(\d+)\s*\|", text, re.M)]
    if not pts:
        pts = [int(m.group(1)) for m in
               re.finditer(r"^###\s+\d+\..*—\s*(\d+)\s*points", text, re.M)]
    if pts and sum(pts) != 100:
        errors.append(f"[rubric] {p.name}: dimensions sum to {sum(pts)}, expected 100")
    elif not pts:
        warnings.append(f"[rubric] {p.name}: could not parse dimension points")

# 5. Changelog covers the current plugin version (heading required — a
#    "*Next reflection → …*" teaser line does not count) AND is not duplicated.
#    Duplicate same-version headings happen when both harnesses ship a feature
#    under the same number and git merges both appends cleanly.
if plugin_version:
    prefix = "p2d_skill." if (ROOT / "skills" / "paper-to-deck").exists() else "posed_skill."
    changelog = (ROOT / "CHANGELOG.md").read_text()
    major_minor = prefix + ".".join(plugin_version.split(".")[:2])
    if f"## {major_minor} " not in changelog:
        errors.append(f"[changelog] no '## {major_minor}' entry heading "
                      f"(plugin.json is {plugin_version})")
    dupes = [h for h in re.findall(rf"^## ({re.escape(prefix)}\d+\.\d+) ", changelog, re.M)
             if re.findall(rf"^## {re.escape(h)} ", changelog, re.M).__len__() > 1]
    for h in sorted(set(dupes)):
        n = len(re.findall(rf"^## {re.escape(h)} ", changelog, re.M))
        errors.append(f"[changelog] '## {h}' heading appears {n}× — merge the "
                      f"duplicate entries into one (or bump the second to a new version)")

# 6. Cited reference files exist (heuristic, warning only)
cite = re.compile(r"`(?:<posed-skill-dir>/)?reference/([A-Za-z0-9_\-]+\.md)`")
for p in (ROOT / "skills").rglob("SKILL.md"):
    text = p.read_text()
    for m in cite.finditer(text):
        name = m.group(1)
        candidates = [p.parent / "reference" / name,
                      ROOT / "skills" / "posed" / "reference" / name,
                      ROOT / "skills" / "outline" / "reference" / name]
        if not any(c.exists() for c in candidates):
            warnings.append(f"[ref] {p.relative_to(ROOT)} cites reference/{name} — not found")

# 7. No skill directory is swallowed by .gitignore. A bare `sources/` rule
#    (meant for session-data corpus folders) once matched skills/sources/ too,
#    hiding the entire Stage 4 sourcing skill from the repo. Every skills/*/SKILL.md
#    must NOT be matched by an ignore rule.
#    NOTE: --no-index is REQUIRED. Plain `git check-ignore` never reports a file
#    that is already TRACKED, so once the skill is committed the check silently
#    stops being falsifiable (removing the negation would not fail the lint).
#    --no-index evaluates the ignore RULES regardless of tracked status, which is
#    the actual thing we want to guard.
import subprocess
skill_mds = [str(p.relative_to(ROOT)) for p in (ROOT / "skills").glob("*/SKILL.md")]
if skill_mds:
    try:
        out = subprocess.run(["git", "-C", str(ROOT), "check-ignore", "--no-index"] + skill_mds,
                             capture_output=True, text=True)
        for line in out.stdout.splitlines():
            errors.append(f"[gitignore] {line.strip()} is matched by an ignore rule — a skill "
                          f"is (or would be) excluded from the repo; add a negation "
                          f"(e.g. !skills/<name>/) to .gitignore")
    except Exception:
        warnings.append("[gitignore] could not run 'git check-ignore' (git unavailable?)")

for w in warnings: print("WARN ", w)
for e in errors:   print("ERROR", e)
print(f"\nrelease_lint: {len(errors)} error(s), {len(warnings)} warning(s)")
sys.exit(1 if errors else 0)
