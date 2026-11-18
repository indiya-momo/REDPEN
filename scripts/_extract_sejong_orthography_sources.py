# -*- coding: utf-8 -*-
"""Extract Sejong + official orthography sources to plain text (audit only)."""
from __future__ import annotations

import re
import zlib
from pathlib import Path

import olefile
from pypdf import PdfReader

OUT = Path(__file__).resolve().parents[1] / "project-docs" / "sejong-orthography-audit" / "extracted"
OUT.mkdir(parents=True, exist_ok=True)

SOURCES = {
    "sejong-pyogibeop": Path(
        r"C:\Users\gikan\OneDrive\문서\카카오톡 받은 파일\표기법_세종서적_250622.hwp"
    ),
    "hangul-spelling-commentary": Path(
        r"C:\Users\gikan\OneDrive\바탕 화면\인디야\한글맞춤법 표준어규정 해설.pdf"
    ),
    "romanization-notice-2014-42": Path(
        r"C:\Users\gikan\OneDrive\바탕 화면\인디야\국어의로마자표기법(3) 문화체육관광부 고시 제2014-42호.hwp"
    ),
    "loanword-notice-2017-14": Path(
        r"C:\Users\gikan\OneDrive\바탕 화면\인디야\외래어표기법(7) 문화체육관광부 고시 제2017-14호.hwp"
    ),
}


def _decode_hwp_unit(raw: bytes) -> str:
    # HWP 5 BodyText units are often zlib-compressed records.
    try:
        data = zlib.decompress(raw, -15)
    except zlib.error:
        try:
            data = zlib.decompress(raw)
        except zlib.error:
            data = raw
    # Prefer UTF-16LE (HWP5 common); fall back to CP949.
    for enc in ("utf-16-le", "cp949", "utf-8"):
        try:
            text = data.decode(enc, errors="ignore")
        except LookupError:
            continue
        # Keep Hangul / basic punctuation density heuristic
        hangul = sum(1 for ch in text if "\uac00" <= ch <= "\ud7a3")
        if hangul >= 20:
            return text
    return data.decode("utf-16-le", errors="ignore")


def extract_hwp(path: Path) -> str:
    ole = olefile.OleFileIO(str(path))
    chunks: list[str] = []
    for entry in ole.listdir():
        name = "/".join(entry)
        if not name.upper().startswith("BODYTEXT"):
            continue
        raw = ole.openstream(entry).read()
        # HWP5: stream may contain multiple zlib sections; try whole then scan.
        text = _decode_hwp_unit(raw)
        if sum(1 for ch in text if "\uac00" <= ch <= "\ud7a3") < 20:
            # Scan for zlib headers inside stream
            parts: list[str] = []
            for m in re.finditer(rb"\x78[\x01\x5e\x9c\xda]", raw):
                try:
                    parts.append(_decode_hwp_unit(raw[m.start() :]))
                except Exception:
                    continue
            text = "\n".join(p for p in parts if p)
        chunks.append(f"<!-- stream:{name} -->\n{text}")
    ole.close()
    joined = "\n\n".join(chunks)
    # Normalize whitespace a bit
    joined = joined.replace("\x00", "")
    joined = re.sub(r"[ \t]+\n", "\n", joined)
    joined = re.sub(r"\n{3,}", "\n\n", joined)
    return joined.strip() + "\n"


def extract_pdf(path: Path) -> str:
    reader = PdfReader(str(path))
    pages: list[str] = []
    for i, page in enumerate(reader.pages, start=1):
        t = page.extract_text() or ""
        pages.append(f"<!-- page:{i} -->\n{t}")
    text = "\n\n".join(pages)
    text = text.replace("\x00", "")
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip() + "\n"


def main() -> None:
    summary: list[str] = []
    for key, path in SOURCES.items():
        if not path.exists():
            summary.append(f"MISSING {key}: {path}")
            continue
        out = OUT / f"{key}.txt"
        if path.suffix.lower() == ".pdf":
            text = extract_pdf(path)
        else:
            text = extract_hwp(path)
        out.write_text(text, encoding="utf-8")
        hangul = sum(1 for ch in text if "\uac00" <= ch <= "\ud7a3")
        summary.append(f"OK {key}: {out.name} chars={len(text)} hangul={hangul}")
    (OUT / "_extract-summary.txt").write_text("\n".join(summary) + "\n", encoding="utf-8")
    print("\n".join(summary))


if __name__ == "__main__":
    main()
