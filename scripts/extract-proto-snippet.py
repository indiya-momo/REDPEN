import json
import re
from pathlib import Path

path = Path(
    r"C:\Users\gikan\.cursor\projects\c-Users-gikan-Documents-pdf-publish-proofread"
    r"\agent-transcripts\626d9dc1-e94d-43a5-9bd7-f9c9a869eb70"
    r"\626d9dc1-e94d-43a5-9bd7-f9c9a869eb70.jsonl"
)
out = Path(__file__).resolve().parents[1] / "project-docs" / "guest-layout-b-prototype.html"

for line in path.read_text(encoding="utf-8").splitlines():
    if "B안 (정렬 칼같이)" not in line:
        continue
    text = json.loads(line)["message"]["content"][0]["text"]
    start = text.find("<!DOCTYPE html>")
    end = text.find("</html>") + len("</html>")
    html = text[start:end]
    out.write_text(html, encoding="utf-8")
    m = re.search(r'<div class="ph">.*?</div>\s*</div>', html, re.S)
    print(m.group(0) if m else "no ph block")
    m2 = re.search(r'--cream[^;]+;', html)
    print(m2.group(0) if m2 else "no cream")
    break
