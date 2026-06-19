"""Single-pass transcript replay — no duplicate applications."""
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
START = 17617
END = 17761


def git_show(rel: str) -> str:
    return subprocess.check_output(
        ["git", "show", f"HEAD:{rel}"],
        cwd=ROOT,
        text=True,
        encoding="utf-8",
    )


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
            p = inp.get("path", "").replace("\\", "/")
            if not p.endswith("welcome-pc.css"):
                continue
            ops.append((lineno, block.get("name"), inp))

text = git_show("src/welcome/pc/welcome-pc.css")
ok = miss = 0
for lineno, name, inp in ops:
    if name == "Write":
        text = inp.get("contents", "")
        ok += 1
        print(f"L{lineno} Write")
    elif name == "StrReplace":
        old = inp.get("old_string", "")
        new = inp.get("new_string", "")
        if old and old in text:
            text = text.replace(old, new, 1)
            ok += 1
        else:
            miss += 1
            print(f"L{lineno} MISS")

out = ROOT / "src/welcome/pc/welcome-pc.css"
out.write_text(text, encoding="utf-8", newline="\n")
print(f"done ok={ok} miss={miss} bytes={len(text)}")
