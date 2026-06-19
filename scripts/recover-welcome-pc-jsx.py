"""Recover WelcomePcScreen.jsx from transcript (Write + StrReplace)."""
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
START = 17600
END = 17761
REL = "src/welcome/pc/WelcomePcScreen.jsx"


def git_show(rel: str) -> str:
    return subprocess.check_output(
        ["git", "show", f"HEAD:{rel}"],
        cwd=ROOT,
        text=True,
        encoding="utf-8",
    )


text = git_show(REL)
last_write = 0
ops = []
with TRANSCRIPT.open(encoding="utf-8") as fh:
    for lineno, line in enumerate(fh, 1):
        if lineno < START or lineno >= END:
            continue
        obj = json.loads(line)
        for block in obj.get("message", {}).get("content", []):
            if block.get("type") != "tool_use":
                continue
            inp = block.get("input", {})
            if not isinstance(inp, dict):
                continue
            if not inp.get("path", "").endswith("WelcomePcScreen.jsx"):
                continue
            ops.append((lineno, block.get("name"), inp))

for lineno, name, inp in ops:
    if name == "Write":
        text = inp.get("contents", "")
        last_write = lineno
    elif name == "StrReplace":
        old, new = inp.get("old_string", ""), inp.get("new_string", "")
        if old and old in text:
            text = text.replace(old, new, 1)

for lineno, name, inp in ops:
    if name != "StrReplace" or lineno <= last_write:
        continue
    old, new = inp.get("old_string", ""), inp.get("new_string", "")
    if old and old in text:
        text = text.replace(old, new, 1)

(ROOT / REL).write_text(text, encoding="utf-8", newline="\n")
print(f"jsx bytes={len(text)} last_write=L{last_write}")
