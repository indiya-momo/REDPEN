/**
 * PDF TextItem 안 글자별 가로 오프셋 — 화면 하이라이트·주석보내기 공통.
 * 글자 폭 비율을 item.width에 맞춰 나눈다.
 *
 * 한계: 한글 전각 폰트(예: MapoGoldenPier)는 측정·글리프가 균등 분할과
 * 거의 같다. book_part2 p32 `뛰지말라는`은 Δ≈1.5pt로 1글자(≈8pt) 밀림을
 * 이 모듈로 설명하지 못한다. project-docs/pdf-highlight-origin-p32-2026-11-18.md
 */

/**
 * 캔버스 없을 때(테스트·SSR) 쓰는 글자 폭 추정 (em 단위).
 * @param {string} ch
 */
export function fallbackCharEm(ch) {
  if (/\s/.test(ch)) return 0.25;
  const code = ch.codePointAt(0) ?? 0;
  // 한글·CJK·전각
  if (
    (code >= 0x1100 && code <= 0x11ff) ||
    (code >= 0x3000 && code <= 0x9fff) ||
    (code >= 0xac00 && code <= 0xd7a3) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xff00 && code <= 0xffef)
  ) {
    return 1;
  }
  if (/[.,:;'"!|()[\]{}·‘’“”]/.test(ch)) return 0.3;
  if (/[A-Z]/.test(ch)) return 0.65;
  if (/[a-z0-9]/.test(ch)) return 0.52;
  return 0.6;
}

/**
 * 브라우저면 canvas measureText, 아니면 {@link fallbackCharEm}.
 * @returns {(ch: string) => number}
 */
export function createCharEmMeasurer() {
  /** @type {Map<string, number>} */
  const cache = new Map();
  /** @type {CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null} */
  let ctx = null;
  try {
    if (typeof OffscreenCanvas !== 'undefined') {
      ctx = new OffscreenCanvas(8, 8).getContext('2d');
    } else if (typeof document !== 'undefined') {
      ctx = document.createElement('canvas').getContext('2d');
    }
    if (ctx) ctx.font = '100px sans-serif';
  } catch {
    ctx = null;
  }
  return (ch) => {
    let w = cache.get(ch);
    if (w == null) {
      const measured = ctx ? ctx.measureText(ch).width / 100 : 0;
      w = measured > 0 ? measured : fallbackCharEm(ch);
      cache.set(ch, w);
    }
    return w;
  };
}

/**
 * item 안 글자 경계 오프셋(텍스트 방향, 사용자 공간 길이). 길이 ≈ str.length + 1.
 * @param {string} str
 * @param {number} itemWidth pdf.js item.width (사용자 공간)
 * @param {number} fontScaleX hypot(transform[0], transform[1])
 * @param {(ch: string) => number} charEm
 * @returns {number[]}
 */
export function charOffsetsInItem(str, itemWidth, fontScaleX, charEm) {
  const chars = Array.from(str);
  const ems = chars.map((c) => Math.max(0, charEm(c)));
  const total = ems.reduce((a, b) => a + b, 0) || 1;
  const k = itemWidth > 0 ? itemWidth / total : fontScaleX;
  /** @type {number[]} */
  const off = [0];
  let acc = 0;
  // 서로게이트 쌍은 str 인덱스 2칸 → 같은 오프셋을 한 번 더 넣어 인덱스를 맞춘다
  chars.forEach((c, i) => {
    acc += ems[i] * k;
    off.push(acc);
    if (c.length === 2) off.push(acc);
  });
  return off;
}
