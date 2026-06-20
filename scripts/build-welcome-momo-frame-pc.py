"""사용자 제공 액자 PNG — 목재만 남기고 홀·배경 투명. 색 가공 없음."""
from __future__ import annotations

import argparse
from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SRC = ROOT / "public" / "welcome" / "Gemini_Generated_Image2-crop1.png"
OUT = ROOT / "src" / "assets" / "welcome" / "welcome_momo_frame_pc.png"


def is_wood(r: int, g: int, b: int, a: int) -> bool:
    if a < 200:
        return False
    if max(r, g, b) < 40:
        return False
    if r > 235 and g > 235 and b > 230:
        return False
    if abs(r - g) < 14 and abs(g - b) < 14 and r > 130:
        return False
    return r > 70 and (r - b) > 15 and g > 35


def wood_bbox(px, w: int, h: int) -> tuple[int, int, int, int]:
    minx, miny, maxx, maxy = w, h, 0, 0
    for y in range(h):
        for x in range(w):
            if is_wood(*px[x, y]):
                minx = min(minx, x)
                miny = min(miny, y)
                maxx = max(maxx, x)
                maxy = max(maxy, y)
    return minx, miny, maxx, maxy


def flood_interior(w: int, h: int, px, start: tuple[int, int]) -> set[tuple[int, int]]:
    seen: set[tuple[int, int]] = set()
    q: deque[tuple[int, int]] = deque([start])
    while q:
        x, y = q.popleft()
        if (x, y) in seen or x < 0 or y < 0 or x >= w or y >= h:
            continue
        if is_wood(*px[x, y]):
            continue
        seen.add((x, y))
        q.extend([(x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)])
    return seen


def process_frame(src: Path) -> tuple[Image.Image, dict[str, float]]:
    img = Image.open(src).convert("RGBA")
    px = img.load()
    w, h = img.size
    bx0, by0, bx1, by1 = wood_bbox(px, w, h)
    frame = img.crop((bx0, by0, bx1 + 1, by1 + 1)).copy()
    px = frame.load()
    fw, fh = frame.size
    cx, cy = fw // 2, fh // 2

    inner = flood_interior(fw, fh, px, (cx, cy))
    for x, y in inner:
        r, g, b, _a = px[x, y]
        px[x, y] = (r, g, b, 0)

    for y in range(fh):
        for x in range(fw):
            r, g, b, a = px[x, y]
            if a > 0 and not is_wood(r, g, b, a):
                px[x, y] = (r, g, b, 0)

    hx0, hy0, hx1, hy1 = fw, fh, 0, 0
    for x, y in inner:
        hx0 = min(hx0, x)
        hy0 = min(hy0, y)
        hx1 = max(hx1, x)
        hy1 = max(hy1, y)

    meta = {
        "fw": fw,
        "fh": fh,
        "hole_left": round(hx0 / fw * 100, 2),
        "hole_top": round(hy0 / fh * 100, 2),
        "hole_right": round((fw - hx1 - 1) / fw * 100, 2),
        "hole_bottom": round((fh - hy1 - 1) / fh * 100, 2),
        "frame_aspect": round(fw / fh, 4),
        "hole_aspect": round((hx1 - hx0 + 1) / (hy1 - hy0 + 1), 4),
        "width_scale": round((1211 / 1305) * (fw / fh), 4),
    }
    return frame, meta


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--src", type=Path, default=DEFAULT_SRC)
    args = parser.parse_args()

    frame, meta = process_frame(args.src)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    frame.save(OUT, optimize=True)

    print("src", args.src)
    print("saved", OUT, frame.size)
    print("hole_insets_pct", meta["hole_left"], meta["hole_top"], meta["hole_right"], meta["hole_bottom"])
    print("frame_aspect", meta["frame_aspect"])
    print("hole_aspect", meta["hole_aspect"])
    print("hero_width_scale", meta["width_scale"])


if __name__ == "__main__":
    main()
