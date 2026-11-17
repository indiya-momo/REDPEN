/**
 * PDF 교정본 주석 — 좌표 계산 (pdf-lib·DOM 무관, 순수 함수).
 *
 * 화면 DOM 상자가 아니라 pdf.js 텍스트 item의 transform(사용자 공간)에서 바로 계산한다.
 * item.transform의 방향 벡터(u: 글자 진행, v: 글자 높이)를 쓰므로 /Rotate·CropBox와 무관하게 맞는다.
 * 글자별 위치: 글꼴로 잰 글자 폭 비율을 item.width(실제 PDF 폭)에 맞춰 나눈다.
 */

export {
  charOffsetsInItem,
  createCharEmMeasurer,
  fallbackCharEm,
} from '../pdfTextItemMetrics.js';
import { charOffsetsInItem } from '../pdfTextItemMetrics.js';
import { getItemGlyphOffsets } from '../pdfGlyphAdvances.js';

/** @typedef {[number, number]} Pt */
/** @typedef {{ ll: Pt, lr: Pt, ur: Pt, ul: Pt }} Seg 텍스트 방향 기준 사각형 (아래-왼, 아래-오, 위-오, 위-왼) */

/** 상자 아래·위 (글꼴 높이 배수) — 앱 화면 하이라이트(top −0.91fh, 높이 1.05fh)와 같은 비율 */
export const BOX_BOTTOM_EM = -0.14;
export const BOX_TOP_EM = 0.91;

/** @param {number} n */
export const round2 = (n) => Math.round(n * 100) / 100;
/** @param {Pt} p @param {Pt} q @returns {Pt} */
export const sub = (p, q) => [p[0] - q[0], p[1] - q[1]];
/** @param {Pt} p @param {Pt} q */
export const dot = (p, q) => p[0] * q[0] + p[1] * q[1];
/** @param {Pt} p */
const len = (p) => Math.hypot(p[0], p[1]);

/**
 * 페이지 텍스트 범위 [start, end) → 텍스트 방향 사각형 목록 (줄마다 1개로 합침).
 * @param {{ items: Array<{ str: string, transform: number[], width?: number }>, itemRefs: Array<{ start: number, end: number, itemIndex: number }> }} pageData
 * @param {number} start
 * @param {number} end
 * @param {(ch: string) => number} charEm
 * @returns {Seg[]}
 */
export function segmentsForTextRange(pageData, start, end, charEm) {
  /** @type {Seg[]} */
  const segs = [];
  for (const ref of pageData?.itemRefs ?? []) {
    if (ref.end <= start || ref.start >= end) continue;
    const item = pageData.items?.[ref.itemIndex];
    if (!item?.str || !Array.isArray(item.transform)) continue;
    const spanLen = Math.max(ref.end - ref.start, 0);
    let ls = Math.max(0, start - ref.start);
    let le = Math.min(spanLen || item.str.length, end - ref.start);
    if (le <= ls) {
      ls = 0;
      le = item.str.length;
    }
    const seg = segmentForItemSpan(item, ls, le, charEm);
    if (seg) segs.push(seg);
  }
  return mergeCollinearSegments(segs);
}

/**
 * @param {{ str: string, transform: number[], width?: number }} item
 * @param {number} localStart
 * @param {number} localEnd
 * @param {(ch: string) => number} charEm
 * @returns {Seg | null}
 */
export function segmentForItemSpan(item, localStart, localEnd, charEm) {
  const [a, b, c, d, e, f] = item.transform;
  const sx = Math.hypot(a, b);
  const sy = Math.hypot(c, d);
  const fh = sy || sx;
  if (!(fh > 0)) return null;
  /** @type {Pt} */
  const u = sx > 0 ? [a / sx, b / sx] : [1, 0];
  /** @type {Pt} */
  const v = sy > 0 ? [c / sy, d / sy] : [-u[1], u[0]];
  const n = item.str.length;
  const si = Math.max(0, Math.min(localStart, n));
  const ei = Math.max(si, Math.min(localEnd, n));
  const width = Number(item.width) || 0;
  const off = getItemGlyphOffsets(item) ?? charOffsetsInItem(item.str, width, sx || fh, charEm);
  let lo = off[si] ?? 0;
  let hi = off[ei] ?? lo;
  if (width > 0) {
    hi = Math.min(hi, width);
    lo = Math.min(lo, hi);
  }
  /** @param {number} along @param {number} up @returns {Pt} */
  const P = (along, up) => [
    e + u[0] * along + v[0] * up,
    f + u[1] * along + v[1] * up,
  ];
  const bot = BOX_BOTTOM_EM * fh;
  const top = BOX_TOP_EM * fh;
  return { ll: P(lo, bot), lr: P(hi, bot), ur: P(hi, top), ul: P(lo, top) };
}

/**
 * 같은 줄에서 이어진 조각을 하나로 (글자별로 쪼개진 item 대비).
 * @param {Seg[]} segs
 * @returns {Seg[]}
 */
export function mergeCollinearSegments(segs) {
  /** @type {Seg[]} */
  const out = [];
  for (const s of segs) {
    const prev = out[out.length - 1];
    if (prev) {
      const ua = sub(prev.lr, prev.ll);
      const la = len(ua) || 1;
      /** @type {Pt} */
      const u = [ua[0] / la, ua[1] / la];
      const hv = sub(prev.ul, prev.ll);
      const h = len(hv) || 1;
      const ub = sub(s.lr, s.ll);
      const lb = len(ub) || 1;
      const sameDir = dot(u, [ub[0] / lb, ub[1] / lb]) > 0.98 || lb < 0.01;
      const perp = Math.abs(dot(sub(s.ll, prev.ll), [-u[1], u[0]]));
      const hs = len(sub(s.ul, s.ll));
      const gap = dot(sub(s.ll, prev.lr), u);
      if (
        sameDir &&
        perp < 0.3 * h &&
        Math.abs(hs - h) < 0.25 * h &&
        gap > -0.5 * h &&
        gap < 0.7 * h
      ) {
        const a1 = Math.max(dot(sub(prev.lr, prev.ll), u), dot(sub(s.lr, prev.ll), u));
        /** @param {number} al @param {number} up @returns {Pt} */
        const P = (al, up) => [
          prev.ll[0] + u[0] * al + hv[0] * up,
          prev.ll[1] + u[1] * al + hv[1] * up,
        ];
        out[out.length - 1] = { ll: P(0, 0), lr: P(a1, 0), ur: P(a1, 1), ul: P(0, 1) };
        continue;
      }
    }
    out.push(s);
  }
  return out;
}

/**
 * QuadPoints — Acrobat 관례 순서(위-왼, 위-오, 아래-왼, 아래-오). 대부분 뷰어 호환.
 * @param {Seg[]} segs
 * @returns {number[]}
 */
export function quadPointsAcrobatOrder(segs) {
  return segs.flatMap((s) => [s.ul, s.ur, s.ll, s.lr].flat().map(round2));
}

/**
 * 모든 꼭짓점을 감싸는 /Rect.
 * @param {Seg[]} segs
 * @param {number} [pad]
 * @returns {[number, number, number, number]}
 */
export function rectEnclosing(segs, pad = 0) {
  const pts = segs.flatMap((s) => [s.ll, s.lr, s.ur, s.ul]);
  return rectOfPoints(pts, pad);
}

/**
 * @param {Pt[]} pts
 * @param {number} [pad]
 * @returns {[number, number, number, number]}
 */
export function rectOfPoints(pts, pad = 0) {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return /** @type {[number, number, number, number]} */ ([
    Math.min(...xs) - pad,
    Math.min(...ys) - pad,
    Math.max(...xs) + pad,
    Math.max(...ys) + pad,
  ].map(round2));
}

/** 상자 높이(1.05fh) — 사각형 세로 길이 */
export function segHeight(/** @type {Seg} */ s) {
  return len(sub(s.ul, s.ll));
}

/**
 * 교정 기호 모양 (띄움표 ∨ / 붙임표 ⌒ 위만).
 * A = 앞 글자 사각형, B = 뒤 글자 사각형(없거나 다른 줄이면 A 끝 기준).
 * @param {'insert' | 'join'} type
 * @param {Seg} A
 * @param {Seg | null} B
 * @returns {{ strokes: Pt[][], path: string, lineWidth: number, sameLine: boolean }}
 */
export function proofMarkGeometry(type, A, B) {
  const uv = sub(A.lr, A.ll);
  const ul = len(uv) || 1;
  /** @type {Pt} */
  const u = [uv[0] / ul, uv[1] / ul];
  const hv = sub(A.ul, A.ll);
  const h = len(hv) || 1;
  /** @type {Pt} */
  const nv = [hv[0] / h, hv[1] / h];
  const o = A.ll;
  const aEnd = dot(sub(A.lr, o), u);
  let gx = aEnd + 0.08 * h;
  let sameLine = false;
  /** @type {[number, number] | null} */
  let bSpan = null;
  if (B) {
    const bS = dot(sub(B.ll, o), u);
    const perp = Math.abs(dot(sub(B.ll, o), nv));
    if (perp < 0.3 * h && bS > aEnd - 0.5 * h && bS < aEnd + 3 * h) {
      gx = (aEnd + bS) / 2;
      sameLine = true;
      bSpan = [bS, dot(sub(B.lr, o), u)];
    }
  }
  /** @param {number} al @param {number} up @returns {Pt} */
  const P = (al, up) => [
    round2(o[0] + u[0] * al + nv[0] * up),
    round2(o[1] + u[1] * al + nv[1] * up),
  ];
  const lineWidth = round2(Math.max(0.6, h * 0.07));
  /** @param {Pt} p */
  const xy = (p) => `${p[0]} ${p[1]}`;
  if (type === 'insert') {
    // ∨: 꼭짓점이 글자 사이 줄 윗선 근처, 두 팔은 위로
    const pts = [P(gx - 0.2 * h, h * 1.3), P(gx, h * 0.92), P(gx + 0.2 * h, h * 1.3)];
    return {
      strokes: [pts],
      path: `${xy(pts[0])} m ${xy(pts[1])} l ${xy(pts[2])} l S`,
      lineWidth,
      sameLine,
    };
  }
  // 붙임표: 앞 글자 가운데 ~ 뒤 글자 가운데 위에 ⌒ 하나 (아래 호 없음)
  const x0 = aEnd / 2;
  const x1 = bSpan ? (bSpan[0] + bSpan[1]) / 2 : aEnd + 0.45 * h;
  const y = h * 1.0;
  const bulge = h * 0.26;
  const p0 = P(x0, y);
  const p3 = P(x1, y);
  const c = P((x0 + x1) / 2, y + bulge);
  /** @type {Pt} */
  const c1 = [round2(p0[0] + (2 / 3) * (c[0] - p0[0])), round2(p0[1] + (2 / 3) * (c[1] - p0[1]))];
  /** @type {Pt} */
  const c2 = [round2(p3[0] + (2 / 3) * (c[0] - p3[0])), round2(p3[1] + (2 / 3) * (c[1] - p3[1]))];
  /** @type {Pt[]} */
  const samples = [];
  for (let i = 0; i <= 8; i += 1) {
    const t = i / 8;
    const q = (1 - t) * (1 - t);
    const w = 2 * (1 - t) * t;
    const z = t * t;
    samples.push([
      round2(q * p0[0] + w * c[0] + z * p3[0]),
      round2(q * p0[1] + w * c[1] + z * p3[1]),
    ]);
  }
  return {
    strokes: [samples],
    path: `${xy(p0)} m ${xy(c1)} ${xy(c2)} ${xy(p3)} c S`,
    lineWidth,
    sameLine,
  };
}

/**
 * 라벨(고칠 말) 위치 — 첫 사각형 위, 겹치면 위로 밀기.
 * @param {Seg} seg
 * @param {number} textWidth
 * @param {number} textHeight
 * @param {'center' | 'left'} align
 * @param {Array<[number, number, number, number]>} placed 같은 쪽에 이미 놓인 라벨 Rect (변경됨)
 * @returns {[number, number, number, number]}
 */
export function placeLabelRect(seg, textWidth, textHeight, align, placed) {
  const h = segHeight(seg);
  const top = Math.max(seg.ul[1], seg.ur[1]);
  const left = Math.min(seg.ul[0], seg.ll[0]);
  const cx = (seg.ul[0] + seg.ur[0]) / 2;
  const x0 = align === 'center' ? cx - textWidth / 2 - 1 : left;
  const y0 = top + h * 0.09;
  /** @type {[number, number, number, number]} */
  let R = [x0, y0, x0 + textWidth + 2, y0 + textHeight];
  /** @param {number[]} p @param {number[]} q */
  const hit = (p, q) => p[0] < q[2] && q[0] < p[2] && p[1] < q[3] && q[1] < p[3];
  for (let k = 0; k < 6 && placed.some((b) => hit(R, b)); k += 1) {
    const dy = textHeight + 1;
    R = [R[0], R[1] + dy, R[2], R[3] + dy];
  }
  const out = /** @type {[number, number, number, number]} */ (R.map(round2));
  placed.push(out);
  return out;
}
