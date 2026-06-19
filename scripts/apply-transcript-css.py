"""Apply transcript CSS StrReplace ops (full old/new strings) onto HEAD."""
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
START = 17655
END = 17761


def git_show(rel: str) -> str:
    return subprocess.check_output(
        ["git", "show", f"HEAD:{rel}"],
        cwd=ROOT,
        text=True,
        encoding="utf-8",
    )


ops: list[tuple[int, str, str]] = []
with TRANSCRIPT.open(encoding="utf-8") as fh:
    for lineno, line in enumerate(fh, 1):
        if lineno < START or lineno >= END:
            continue
        obj = json.loads(line)
        for block in obj.get("message", {}).get("content", []):
            if block.get("name") != "StrReplace":
                continue
            inp = block.get("input", {})
            if not inp.get("path", "").endswith("welcome-pc.css"):
                continue
            old = inp.get("old_string", "")
            new = inp.get("new_string", "")
            if old:
                ops.append((lineno, old, new))

text = git_show("src/welcome/pc/welcome-pc.css")
ok = 0
misses: list[int] = []
for lineno, old, new in ops:
    if old in text:
        text = text.replace(old, new, 1)
        ok += 1
    else:
        misses.append(lineno)

out = ROOT / "src/welcome/pc/welcome-pc.css"
out.write_text(text, encoding="utf-8", newline="\n")
print(f"applied={ok} miss={len(misses)} bytes={len(text)}")
if misses:
    print("miss lines:", misses[:20], "..." if len(misses) > 20 else "")
