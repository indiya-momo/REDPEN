"""Replay welcome-pc edits from agent transcript up to line 17761 (multi-pass)."""
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

REL_PATHS = [
    "src/welcome/pc/welcome-pc.css",
    "src/welcome/pc/WelcomePcScreen.jsx",
]


def git_show(rel: str) -> str:
    return subprocess.check_output(
        ["git", "show", f"HEAD:{rel}"],
        cwd=ROOT,
        text=True,
        encoding="utf-8",
    )


def norm_path(p: str) -> str:
    return str(Path(p.replace("\\", "/")).as_posix()).lower()


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
                raw_path = inp.get("path", "")
                if "welcome/pc" not in raw_path.replace("\\", "/"):
                    continue
                ops.append((lineno, name, norm_path(raw_path), inp))
    return ops


def apply_ops(files: dict[str, str], ops) -> tuple[int, int]:
    ok = miss = 0
    for lineno, name, key, inp in ops:
        if key not in files:
            continue
        if name == "Write":
            files[key] = inp.get("contents", "")
            ok += 1
        elif name == "StrReplace":
            old = inp.get("old_string", "")
            new = inp.get("new_string", "")
            if old and old in files[key]:
                files[key] = files[key].replace(old, new, 1)
                ok += 1
            else:
                miss += 1
    return ok, miss


files: dict[str, str] = {}
for rel in REL_PATHS:
    files[norm_path(str((ROOT / rel).resolve()))] = git_show(rel)

ops = collect_ops()
for pass_no in range(1, 6):
    ok, miss = apply_ops(files, ops)
    print(f"pass {pass_no}: ok={ok} miss={miss}")
    if ok == 0:
        break

for rel in REL_PATHS:
    key = norm_path(str((ROOT / rel).resolve()))
    (ROOT / rel).write_text(files[key], encoding="utf-8", newline="\n")
    print(f"Wrote {rel} ({len(files[key])} chars)")
