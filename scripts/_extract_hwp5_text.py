# -*- coding: utf-8 -*-
"""Minimal HWP5 BodyText → plain text (audit)."""
from __future__ import annotations

import struct
import zlib
from pathlib import Path

import olefile

HWPTAG_BEGIN = 0x10
HWPTAG_PARA_TEXT = HWPTAG_BEGIN + 51  # 0x43
HWPTAG_PARA_HEADER = HWPTAG_BEGIN + 50


def _is_compressed(header: bytes) -> bool:
    # FileHeader offset 36: flags dword; bit 0 = compressed
    if len(header) < 40:
        return True
    flags = struct.unpack_from("<I", header, 36)[0]
    return bool(flags & 1)


def _decompress_stream(raw: bytes) -> bytes:
    try:
        return zlib.decompress(raw, -15)
    except zlib.error:
        try:
            return zlib.decompress(raw)
        except zlib.error:
            return raw


def _decode_para_text(payload: bytes) -> str:
    # UTF-16LE units; control codes u+0000..u+001F and private-use inline
    out: list[str] = []
    i = 0
    n = len(payload) // 2 * 2
    while i < n:
        (code,) = struct.unpack_from("<H", payload, i)
        i += 2
        if code in (0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23):
            # inline control — skip following size if present varies; treat as break/space
            if code in (10, 13):
                out.append("\n")
            elif code == 9:
                out.append("\t")
            continue
        if 0xFFFE == code or code == 0xFFFF:
            continue
        # Extended control: some records use 16-bit marker then length
        if code >= 0xFFF0:
            continue
        try:
            out.append(chr(code))
        except ValueError:
            continue
    return "".join(out)


def extract_hwp5_text(path: Path) -> str:
    ole = olefile.OleFileIO(str(path))
    header = ole.openstream("FileHeader").read()
    compressed = _is_compressed(header)
    chunks: list[str] = []
    for entry in ole.listdir():
        name = "/".join(entry)
        if not name.upper().startswith("BODYTEXT/"):
            continue
        raw = ole.openstream(entry).read()
        data = _decompress_stream(raw) if compressed else raw
        pos = 0
        while pos + 4 <= len(data):
            header32 = struct.unpack_from("<I", data, pos)[0]
            tag = header32 & 0x3FF
            size = (header32 >> 20) & 0xFFF
            pos += 4
            if size == 0xFFF:
                if pos + 4 > len(data):
                    break
                size = struct.unpack_from("<I", data, pos)[0]
                pos += 4
            payload = data[pos : pos + size]
            pos += size
            if tag == HWPTAG_PARA_TEXT and payload:
                text = _decode_para_text(payload)
                if text.strip():
                    chunks.append(text)
            elif tag == HWPTAG_PARA_HEADER:
                # paragraph boundary
                if chunks and not chunks[-1].endswith("\n"):
                    chunks.append("\n")
    ole.close()
    text = "".join(chunks)
    # tidy
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    while "\n\n\n" in text:
        text = text.replace("\n\n\n", "\n\n")
    return text.strip() + "\n"


def extract_prv_text(path: Path) -> str:
    ole = olefile.OleFileIO(str(path))
    raw = ole.openstream("PrvText").read()
    ole.close()
    return raw.decode("utf-16-le", errors="ignore").strip() + "\n"


if __name__ == "__main__":
    import sys

    p = Path(sys.argv[1])
    t = extract_hwp5_text(p)
    hangul = sum(1 for ch in t if "\uac00" <= ch <= "\ud7a3")
    print(f"chars={len(t)} hangul={hangul}")
    print(t[:3000])
