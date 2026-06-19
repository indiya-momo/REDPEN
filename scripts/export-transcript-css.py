import json
from pathlib import Path

TRANSCRIPT = Path(
    r"C:\Users\gikan\.cursor\projects\c-Users-gikan-Documents-pdf-publish-proofread"
    r"\agent-transcripts\626d9dc1-e94d-43a5-9bd7-f9c9a869eb70"
    r"\626d9dc1-e94d-43a5-9bd7-f9c9a869eb70.jsonl"
)
OUT = Path(__file__).resolve().parent / "transcript-css-blocks.txt"

chunks = []
with TRANSCRIPT.open(encoding="utf-8") as f:
    for i, line in enumerate(f, 1):
        if i < 17617 or i >= 17761:
            continue
        obj = json.loads(line)
        for b in obj.get("message", {}).get("content", []):
            if b.get("name") != "StrReplace":
                continue
            inp = b.get("input", {})
            if not inp.get("path", "").endswith("welcome-pc.css"):
                continue
            chunks.append(
                f"--- L{i} ---\nNEW:\n{inp.get('new_string', '')}\n\n"
                f"OLD (first 300 chars):\n{inp.get('old_string', '')[:300]}\n\n"
            )

OUT.write_text("".join(chunks), encoding="utf-8")
print(f"wrote {len(chunks)} blocks to {OUT}")
