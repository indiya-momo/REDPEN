#!/usr/bin/env python3
"""표준국어대사전 JSON → 품사 exact 색인 (unifyStdictPos 로컬용).

원본: 국립국어원 표준국어대사전 (CC BY-SA 2.0 KR)

조회 키는 앱 hangulOnlyKey와 동일: NFC + 한글 음절만.

사용:
  python scripts/build-stdict-pos-index.py --measure "<JSON폴더>"
  python scripts/build-stdict-pos-index.py --sample "<JSON폴더>" --out-dir "<미리보기폴더>"
  python scripts/build-stdict-pos-index.py --full "<JSON폴더>"
"""

from __future__ import annotations

import argparse
import gzip
import json
import sys
import time
import unicodedata
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUT_JSON = ROOT / "public" / "data" / "stdict-pos-index.json"
DEFAULT_OUT_MD = ROOT / "public" / "data" / "stdict-pos-index.md"
LICENSE_URL = "https://creativecommons.org/licenses/by-sa/2.0/kr/"
SAMPLE_KEYS = ("모르다", "가교", "깨트리다", "사")


def configure_stdio() -> None:
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8")
        except (AttributeError, OSError):
            pass


def hangul_only_key(word: str) -> str:
    s = unicodedata.normalize("NFC", word or "")
    return "".join(ch for ch in s if "\uAC00" <= ch <= "\uD7A3")


def iter_items(raw_dir: Path):
    for path in sorted(raw_dir.glob("*.json")):
        with path.open(encoding="utf-8") as f:
            data = json.load(f)
        channel = data.get("channel") if isinstance(data, dict) else None
        items = (channel or {}).get("item") if isinstance(channel, dict) else None
        if not isinstance(items, list):
            continue
        for it in items:
            if isinstance(it, dict):
                yield it


def poses_of(word_info: dict) -> list[str]:
    out: list[str] = []
    for pe in word_info.get("pos_info") or []:
        if not isinstance(pe, dict):
            continue
        pos = str(pe.get("pos") or "").strip()
        if pos:
            out.append(pos)
    return list(dict.fromkeys(out))


def build_index(raw_dir: Path) -> tuple[dict[str, list[dict[str, str]]], dict]:
    index: dict[str, list[dict[str, str]]] = defaultdict(list)
    seen: dict[str, set[str]] = defaultdict(set)
    item_count = 0
    pos_counter: Counter[str] = Counter()

    for it in iter_items(raw_dir):
        item_count += 1
        wi = it.get("word_info")
        if not isinstance(wi, dict):
            continue
        word = str(wi.get("word") or "").strip()
        bare = hangul_only_key(word)
        if not bare:
            continue
        poses = poses_of(wi) or [""]
        for pos in poses:
            dedupe = f"{word}|{pos}"
            if dedupe in seen[bare]:
                continue
            seen[bare].add(dedupe)
            index[bare].append({"word": word, "pos": pos})
            if pos:
                pos_counter[pos] += 1

    word_per_key = Counter()
    hits_per_key = Counter()
    for bare, hits in index.items():
        hits_per_key[len(hits)] += 1
        word_per_key[len({h["word"] for h in hits})] += 1

    stats = {
        "itemCount": item_count,
        "bareKeyCount": len(index),
        "hitCount": sum(len(v) for v in index.values()),
        "keysWithGt10Words": sum(c for n, c in word_per_key.items() if n > 10),
        "keysWithGt10Hits": sum(c for n, c in hits_per_key.items() if n > 10),
        "posTop": pos_counter.most_common(20),
        "topHomographs": sorted(
            (
                (len({h["word"] for h in v}), k, len(v))
                for k, v in index.items()
            ),
            reverse=True,
        )[:20],
    }
    return dict(index), stats


def make_payload(index: dict[str, list[dict[str, str]]], downloaded: str) -> dict:
    return {
        "meta": {
            "source": "국립국어원 표준국어대사전",
            "downloaded": downloaded,
            "license": "CC BY-SA 2.0 KR",
            "licenseUrl": LICENSE_URL,
            "generatedAt": date.today().isoformat(),
            "bareKeyCount": len(index),
            "hitCount": sum(len(v) for v in index.values()),
            "keyRule": "hangulOnlyKey (NFC, Hangul syllables only)",
        },
        "index": index,
    }


def measure_bytes(payload: dict) -> dict:
    raw = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    gz = gzip.compress(raw, compresslevel=9)
    return {
        "jsonBytes": len(raw),
        "jsonMB": round(len(raw) / 1024 / 1024, 2),
        "gzip9Bytes": len(gz),
        "gzip9MB": round(len(gz) / 1024 / 1024, 2),
        "gate12MB": "pass" if len(gz) <= 12 * 1024 * 1024 else "fail",
        "recommend": "A" if len(gz) <= 12 * 1024 * 1024 else "B",
    }


def write_md(path: Path, meta: dict) -> None:
    text = (
        "# 표준국어대사전 품사 색인 출처\n\n"
        "`stdict-pos-index.json`은 국립국어원 표준국어대사전 표제어·품사만 뽑은 exact 조회용 색인입니다. "
        "원본 JSON은 레포에 넣지 않습니다.\n\n"
        "**라이선스·저작자 표시(정본):** [STDICT-NOTICE.md](./STDICT-NOTICE.md)\n\n"
        f"- 출처: {meta.get('source')}\n"
        f"- 원본 내려받기: {meta.get('downloaded')}\n"
        f"- 라이선스: [CC BY-SA 2.0 KR]({LICENSE_URL})\n"
        "- 생성: `python scripts/build-stdict-pos-index.py --full \"<JSON 폴더>\"`\n"
        f"- bareKey 수: {meta.get('bareKeyCount')}\n"
        f"- hit 수: {meta.get('hitCount')}\n"
        f"- 키 규칙: {meta.get('keyRule')}\n"
    )
    path.write_text(text, encoding="utf-8")


def write_sample_preview(
    out_dir: Path, index: dict[str, list[dict[str, str]]], stats: dict, sizes: dict
) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    summary = {
        **{k: stats[k] for k in (
            "itemCount",
            "bareKeyCount",
            "hitCount",
            "keysWithGt10Words",
            "keysWithGt10Hits",
            "topHomographs",
            "posTop",
        )},
        **sizes,
    }
    (out_dir / "_measure.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    for key in SAMPLE_KEYS:
        hits = index.get(key, [])
        lines = [f"# {key}", f"hits={len(hits)}", ""]
        for h in hits:
            lines.append(f"{h['word']}\t{h['pos']}")
        (out_dir / f"{key}.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")


def infer_downloaded(raw_dir: Path) -> str:
    name = raw_dir.name
    if "_" in name:
        tail = name.rsplit("_", 1)[-1]
        if len(tail) == 8 and tail.isdigit():
            return f"{tail[0:4]}-{tail[4:6]}-{tail[6:8]}"
    return "unknown"


def main() -> int:
    configure_stdio()
    ap = argparse.ArgumentParser(description="표준국어대사전 품사 색인 빌드")
    mode = ap.add_mutually_exclusive_group(required=True)
    mode.add_argument("--measure", action="store_true")
    mode.add_argument("--sample", action="store_true")
    mode.add_argument("--full", action="store_true")
    ap.add_argument("raw_dir", type=Path)
    ap.add_argument("--out-dir", type=Path, default=None)
    ap.add_argument("--out-json", type=Path, default=DEFAULT_OUT_JSON)
    args = ap.parse_args()
    raw_dir = args.raw_dir.resolve()
    if not raw_dir.is_dir():
        print(f"폴더 없음: {raw_dir}", file=sys.stderr)
        return 1

    t0 = time.time()
    index, stats = build_index(raw_dir)
    downloaded = infer_downloaded(raw_dir)
    payload = make_payload(index, downloaded)
    sizes = measure_bytes(payload)
    elapsed = round(time.time() - t0, 1)

    report = {"elapsed_s": elapsed, **stats, **sizes, "downloaded": downloaded}
    print(json.dumps(report, ensure_ascii=False, indent=2))

    if args.sample:
        out_dir = (
            args.out_dir.resolve()
            if args.out_dir
            else (raw_dir.parent / "_sample_pos_index")
        )
        write_sample_preview(out_dir, index, stats, sizes)
        print(f"sample_dir={out_dir}", file=sys.stderr)

    if args.full:
        out_json: Path = args.out_json.resolve()
        out_json.parent.mkdir(parents=True, exist_ok=True)
        out_json.write_text(
            json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )
        md_path = DEFAULT_OUT_MD if out_json == DEFAULT_OUT_JSON else out_json.with_suffix(".md")
        write_md(md_path, payload["meta"])
        print(f"wrote={out_json}", file=sys.stderr)
        print(f"bytes={out_json.stat().st_size}", file=sys.stderr)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
