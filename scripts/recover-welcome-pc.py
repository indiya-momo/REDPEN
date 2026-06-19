"""Recover welcome-pc to transcript state before line 17762 (CTA-border turn)."""
from __future__ import annotations

import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TRANSCRIPT = Path(
    r"C:\Users\gikan\.cursor\projects\c-Users-gikan-Documents-pdf-publish-proofread"
    r"\agent-transcripts\626d9dc1-e94d-43a5-9bd7-f9c9a869eb70"
    r"\626d9dc1-e94d-43a5-9bd7-f9c9a869eb70.jsonl"
)
START_LINE = 17600
END_LINE = 17761

FILES = {
    "css": ROOT / "src/welcome/pc/welcome-pc.css",
    "jsx": ROOT / "src/welcome/pc/WelcomePcScreen.jsx",
}


def git_show(rel: str) -> str:
    return subprocess.check_output(
        ["git", "show", f"HEAD:{rel}"],
        cwd=ROOT,
        text=True,
        encoding="utf-8",
    )


def norm_path(p: str) -> str:
    name = Path(p.replace("\\", "/")).name.lower()
    if name == "welcome-pc.css":
        return "css"
    if name == "welcomepcscreen.jsx":
        return "jsx"
    return ""


def collect_ops():
    ops = []
    with TRANSCRIPT.open(encoding="utf-8") as fh:
        for lineno, line in enumerate(fh, 1):
            if lineno < START_LINE or lineno >= END_LINE:
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                continue
            content = obj.get("message", {}).get("content")
            if not isinstance(content, list):
                continue
            for block in content:
                if not isinstance(block, dict) or block.get("type") != "tool_use":
                    continue
                name = block.get("name")
                inp = block.get("input")
                if not isinstance(inp, dict):
                    continue
                key = norm_path(inp.get("path", ""))
                if not key:
                    continue
                ops.append((lineno, name, key, inp))
    return ops


def recover(key: str, base: str, ops) -> tuple[str, int, int]:
    text = base
    last_write_line = 0
    for lineno, name, k, inp in ops:
        if k != key:
            continue
        if name == "Write":
            text = inp.get("contents", "")
            last_write_line = lineno
        elif name == "StrReplace":
            old = inp.get("old_string", "")
            new = inp.get("new_string", "")
            if old and old in text:
                text = text.replace(old, new, 1)
    # second pass: only StrReplace after last write (or all for css)
    ok = miss = 0
    for _ in range(8):
        changed = 0
        for lineno, name, k, inp in ops:
            if k != key or name != "StrReplace":
                continue
            if key == "jsx" and lineno <= last_write_line:
                continue
            old = inp.get("old_string", "")
            new = inp.get("new_string", "")
            if old and old in text:
                text = text.replace(old, new, 1)
                changed += 1
                ok += 1
            else:
                miss += 1
        if changed == 0:
            break
    return text, ok, miss


ops = collect_ops()
css_base = git_show("src/welcome/pc/welcome-pc.css")
jsx_base = git_show("src/welcome/pc/WelcomePcScreen.jsx")

css_text, css_ok, css_miss = recover("css", css_base, ops)
jsx_text, jsx_ok, jsx_miss = recover("jsx", jsx_base, ops)

FILES["css"].write_text(css_text, encoding="utf-8", newline="\n")
FILES["jsx"].write_text(jsx_text, encoding="utf-8", newline="\n")

print(f"css: applied={css_ok} miss={css_miss} bytes={len(css_text)}")
print(f"jsx: applied={jsx_ok} miss={jsx_miss} bytes={len(jsx_text)}")
print("markers:")
for label, text in [("guest-cta", "--welcome-guest-cta-width"), ("cta-group", "welcome-pc__cta-group"), ("portrait-anchor", "--welcome-portrait-anchor"), ("layout-guest", "layout--guest")]:
    print(f"  {label}: {label in text or text.find(label.split('-')[0]) >= 0} -> {label if label.startswith('--') else ''}{''}")
