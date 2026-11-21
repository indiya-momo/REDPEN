/**
 * 최종 TXT 문단 재조립.
 * 검수전(조판 줄바꿈)에는 쓰지 않는다. 찾기 핫패스와 무관.
 *
 * 줄 끝 한글 음절이 단어 중간이면 공백 없이 잇고,
 * 어절 경계면 한 칸을 넣는다. 문단이 끝나는 줄바꿈만 남긴다.
 */
import {
  isHangulSyllableChar,
  isLikelyHangulEojeolBoundary,
} from './pdfPageText.js';

/** 모달에 올릴 예외 상한. 나머지는 자동 판정을 따른다. */
export const PARAGRAPH_EXCEPTION_LIMIT = 80;

/** 본문 폭 대비 이보다 짧으면 문단 끝줄·제목으로 본다. */
const SHORT_RATIO = 0.62;
/** 짧지는 않지만 끝선에 못 미치면 확인 예외. */
const BORDER_RATIO = 0.84;
const SHORT_CHAR_GAP = 6;
const BORDER_CHAR_GAP = 4;
/** 다음 줄 시작이 이 em 이상 들여쓰기면 새 문단. */
const INDENT_EM = 0.75;
/** 줄간격이 글자 크기의 이 배보다 크면 문단 간격. */
const GAP_RATIO = 1.85;
/** 글자 크기 차이가 이 배보다 크면 제목·본문 경계. */
const FONT_RATIO = 1.18;

/**
 * 문장·인용 닫힘이 줄 끝에 있으면 문단을 끝낸다.
 * `. ! ? … 。 」 』 》 ”` 와 전각 문장부호.
 */
const SENTENCE_END_RE =
  /(?:[.!?…。．？！⋯]|」|』|》|”|’|"|')(?:["'”’」』》〉)\]】）])*$/u;

const LIST_START_RE =
  /^(?:[-–—*•·∙▪◦‣●○■□▶►]\s+|\d{1,3}[.)、]\s*|[①-⑳]\s*|[㉠-㉻]\s*|[가나다라마바사아자차카타파하][.)]\s+)/u;

/**
 * 한 음절이어도 독립 어절인 말. 다음 줄과 붙여 쓰지 않는다.
 * (`때|손` → `때 손`)
 */
const COMPLETE_ONE_SYLLABLE_EOJEOL = new Set([
  '때',
  '것',
  '수',
  '중',
  '후',
  '전',
  '등',
  '및',
  '또',
  '더',
  '곧',
  '단',
  '속',
  '안',
  '밖',
  '위',
  '간',
  '겸',
  '즉',
]);

const COMPLETE_SHORT_EOJEOL = new Set(['아래']);

/**
 * @typedef {'join' | 'keep'} ParagraphAction
 * @typedef {'' | ' ' | 'dehyphen'} ParagraphGlue
 * @typedef {'keep' | 'nospace' | 'space' | 'dehyphen' | 'join'} ParagraphDecision
 * @typedef {{
 *   x?: number,
 *   y?: number,
 *   endX?: number,
 *   fontH?: number,
 *   col?: number,
 *   trailSpace?: boolean,
 * }} TxtLineLayout
 * @typedef {{
 *   action: ParagraphAction,
 *   glue: ParagraphGlue,
 *   uncertain: boolean,
 *   reason: string,
 * }} ParagraphVerdict
 */

/**
 * @param {number[]} sortedAsc
 * @param {number} p 0~1
 * @returns {number | null}
 */
function percentile(sortedAsc, p) {
  if (!sortedAsc.length) return null;
  const idx = Math.min(
    sortedAsc.length - 1,
    Math.max(0, Math.ceil(sortedAsc.length * p) - 1),
  );
  return sortedAsc[idx];
}

/**
 * @param {string[]} lines
 * @param {TxtLineLayout[]} [layouts]
 */
export function buildParagraphContext(lines, layouts = []) {
  /** @type {Map<number, { endXs: number[], lengths: number[], minX: number }>} */
  const buckets = new Map();
  for (let i = 0; i < (lines ?? []).length; i += 1) {
    const lay = layouts[i] ?? {};
    const col = Number.isFinite(lay.col) ? /** @type {number} */ (lay.col) : 0;
    let bucket = buckets.get(col);
    if (!bucket) {
      bucket = { endXs: [], lengths: [], minX: Infinity };
      buckets.set(col, bucket);
    }
    bucket.lengths.push(String(lines[i] ?? '').length);
    if (Number.isFinite(lay.endX)) bucket.endXs.push(/** @type {number} */ (lay.endX));
    if (Number.isFinite(lay.x)) bucket.minX = Math.min(bucket.minX, /** @type {number} */ (lay.x));
  }

  /** @type {Map<number, { fullEndX: number | null, fullChars: number, minX: number | null }>} */
  const byCol = new Map();
  for (const [col, bucket] of buckets) {
    const endSorted = bucket.endXs.slice().sort((a, b) => a - b);
    const lenSorted = bucket.lengths.slice().sort((a, b) => a - b);
    byCol.set(col, {
      fullEndX: percentile(endSorted, 0.8),
      fullChars: percentile(lenSorted, 0.8) ?? 0,
      minX: Number.isFinite(bucket.minX) ? bucket.minX : null,
    });
  }
  return { byCol };
}

/**
 * 붙일 때 경계 처리. 문단을 나눌지는 여기서 정하지 않는다.
 * @param {string} left
 * @param {string} right
 * @param {{ trailSpace?: boolean }} [hints]
 * @returns {ParagraphGlue}
 */
export function paragraphJoinGlue(left, right, hints = {}) {
  const L = String(left ?? '').replace(/\s+$/u, '');
  const R = String(right ?? '').replace(/^\s+/u, '');
  if (!L || !R) return ' ';

  if (/[A-Za-z][\-\u00AD]$/u.test(L) && /^[a-z]/u.test(R)) return 'dehyphen';
  if (/[A-Za-z]-$/u.test(L) && /^[A-Z]/u.test(R)) return '';

  const last = L[L.length - 1];
  const first = R[0];
  if (isHangulSyllableChar(last) && isHangulSyllableChar(first)) {
    if (hints.trailSpace) return ' ';
    if (isLikelyHangulEojeolBoundary(L, R)) return ' ';
    const lastEojeol = L.split(/\s+/u).filter(Boolean).pop() ?? '';
    if (
      COMPLETE_ONE_SYLLABLE_EOJEOL.has(lastEojeol) ||
      COMPLETE_SHORT_EOJEOL.has(lastEojeol)
    ) {
      return ' ';
    }
    return '';
  }
  return ' ';
}

/**
 * @param {string} text
 * @param {TxtLineLayout | null | undefined} layout
 * @param {{ byCol: Map<number, { fullEndX: number | null, fullChars: number, minX?: number | null }> } | null | undefined} context
 * @returns {'short' | 'border' | 'full' | 'unknown'}
 */
function lineFullness(text, layout, context) {
  const col = Number.isFinite(layout?.col) ? /** @type {number} */ (layout.col) : 0;
  const colCtx = context?.byCol?.get(col);
  const em = layout?.fontH && layout.fontH > 0 ? layout.fontH : 12;
  if (
    colCtx &&
    layout &&
    Number.isFinite(layout.endX) &&
    Number.isFinite(colCtx.fullEndX)
  ) {
    const minX = Number.isFinite(colCtx.minX)
      ? colCtx.minX
      : Number.isFinite(layout.x)
        ? layout.x
        : null;
    const measure =
      minX == null ? NaN : /** @type {number} */ (colCtx.fullEndX) - minX;
    if (measure > em * 4) {
      const gapRatio =
        (/** @type {number} */ (colCtx.fullEndX) - layout.endX) / measure;
      if (gapRatio > 1 - SHORT_RATIO) return 'short';
      if (gapRatio > 1 - BORDER_RATIO) return 'border';
      return 'full';
    }
  }
  if (colCtx && colCtx.fullChars >= 8) {
    const len = String(text ?? '').length;
    const gap = colCtx.fullChars - len;
    const ratio = len / colCtx.fullChars;
    if (ratio <= SHORT_RATIO && gap >= SHORT_CHAR_GAP) return 'short';
    if (ratio <= BORDER_RATIO && gap >= BORDER_CHAR_GAP) return 'border';
    return 'full';
  }
  return 'unknown';
}

/**
 * @param {string} left
 * @param {string} right
 * @param {TxtLineLayout | null | undefined} leftLayout
 * @param {TxtLineLayout | null | undefined} rightLayout
 * @param {{ byCol: Map<number, { fullEndX: number | null, fullChars: number }> } | null} [context]
 * @returns {ParagraphVerdict}
 */
export function classifyParagraphPair(
  left,
  right,
  leftLayout = null,
  rightLayout = null,
  context = null,
) {
  const L = String(left ?? '').replace(/\s+$/u, '');
  const R = String(right ?? '').replace(/^\s+/u, '');
  const glue = paragraphJoinGlue(L, R, {
    trailSpace: Boolean(leftLayout?.trailSpace),
  });
  const midWord = glue === '';
  const dehyphen = glue === 'dehyphen';

  const keep = (reason, uncertain = false) => ({
    action: /** @type {ParagraphAction} */ ('keep'),
    glue,
    uncertain,
    reason,
  });

  if (!L || !R) return keep('empty', false);
  if (SENTENCE_END_RE.test(L)) return keep('sentence', false);
  if (LIST_START_RE.test(R)) return keep('list', false);

  const sameCol =
    !leftLayout ||
    !rightLayout ||
    !Number.isFinite(leftLayout.col) ||
    !Number.isFinite(rightLayout.col) ||
    leftLayout.col === rightLayout.col;

  if (
    sameCol &&
    leftLayout &&
    rightLayout &&
    Number.isFinite(leftLayout.fontH) &&
    Number.isFinite(rightLayout.fontH) &&
    leftLayout.fontH > 0 &&
    rightLayout.fontH > 0
  ) {
    const ratio =
      Math.max(leftLayout.fontH, rightLayout.fontH) /
      Math.min(leftLayout.fontH, rightLayout.fontH);
    if (ratio > FONT_RATIO) return keep('heading', true);
  }

  if (
    sameCol &&
    leftLayout &&
    rightLayout &&
    Number.isFinite(leftLayout.y) &&
    Number.isFinite(rightLayout.y)
  ) {
    const dy = leftLayout.y - rightLayout.y;
    const ref = Math.max(leftLayout.fontH || 0, rightLayout.fontH || 0, 8);
    if (dy > ref * GAP_RATIO) return keep('gap', false);
  }

  if (
    sameCol &&
    leftLayout &&
    rightLayout &&
    Number.isFinite(leftLayout.x) &&
    Number.isFinite(rightLayout.x)
  ) {
    const em = Math.max(leftLayout.fontH || 0, rightLayout.fontH || 0, 8);
    if (rightLayout.x > leftLayout.x + em * INDENT_EM) return keep('indent', false);
  }

  const fullness = lineFullness(L, leftLayout, context);
  // 폭을 모르면(unknown) 짧은 줄로 단정하지 않고 문단 안 줄바꿈으로 잇는다.
  // 끝줄이 짧은데 음절이 이어져 보이면 문단 끝을 우선하고, 모달에서 고치게 한다.
  // (맞춘 조판에서 단어 중간 줄바꿈은 오른쪽 끝선까지 찬 줄에서 난다.)
  if (fullness === 'short') {
    return keep('short', L.length <= 22 || midWord || dehyphen);
  }

  let uncertain = midWord || dehyphen || fullness === 'border';
  let reason = 'wrap';
  if (midWord) reason = 'midword';
  else if (dehyphen) reason = 'hyphen';
  else if (fullness === 'border') reason = 'border';

  return {
    action: 'join',
    glue,
    uncertain,
    reason,
  };
}

/**
 * @param {ParagraphVerdict} verdict
 * @returns {ParagraphDecision}
 */
export function autoDecisionForVerdict(verdict) {
  if (verdict.action === 'keep') return 'keep';
  if (verdict.glue === '') return 'nospace';
  if (verdict.glue === 'dehyphen') return 'dehyphen';
  return 'space';
}

const EXCEPTION_RANK = {
  midword: 0,
  hyphen: 1,
  border: 2,
  heading: 3,
  short: 4,
};

/**
 * @param {{ pageNum: number, lines: string[], lineLayout?: TxtLineLayout[] }[]} pages
 */
export function analyzeParagraphFlow(pages) {
  /** @type {import('./pdfTxtLinebreakReview.js').LinebreakCandidate[]} */
  const exceptions = [];
  let joined = 0;
  let kept = 0;

  for (const page of pages ?? []) {
    const lines = page.lines ?? [];
    const layouts = page.lineLayout ?? [];
    const context = buildParagraphContext(lines, layouts);
    for (let i = 0; i < lines.length - 1; i += 1) {
      const verdict = classifyParagraphPair(
        lines[i],
        lines[i + 1],
        layouts[i],
        layouts[i + 1],
        context,
      );
      if (verdict.action === 'join') joined += 1;
      else kept += 1;
      if (!verdict.uncertain) continue;
      exceptions.push({
        id: `${page.pageNum}:${i}`,
        pageNum: page.pageNum,
        lineIndex: i,
        left: lines[i],
        right: lines[i + 1],
        defaultDecision: autoDecisionForVerdict(verdict),
        glue: verdict.glue,
        reason: verdict.reason,
        rank: EXCEPTION_RANK[verdict.reason] ?? 9,
      });
    }
  }

  exceptions.sort((a, b) => a.rank - b.rank || a.pageNum - b.pageNum || a.lineIndex - b.lineIndex);
  const omitted = Math.max(0, exceptions.length - PARAGRAPH_EXCEPTION_LIMIT);
  return {
    candidates: exceptions.slice(0, PARAGRAPH_EXCEPTION_LIMIT),
    stats: { joined, kept, omitted },
  };
}

/**
 * @param {string} buf
 * @param {string} right
 * @param {ParagraphDecision} decision
 * @param {ParagraphGlue} autoGlue
 * @returns {string}
 */
export function appendParagraphPiece(buf, right, decision, autoGlue) {
  const next = String(right ?? '').replace(/^\s+/u, '');
  if (decision === 'keep') return `${buf}\n${next}`;

  let glue = autoGlue;
  if (decision === 'nospace') glue = '';
  else if (decision === 'space') glue = ' ';
  else if (decision === 'dehyphen') glue = 'dehyphen';
  else if (decision === 'join') glue = autoGlue;

  if (glue === 'dehyphen') {
    return buf.replace(/[\-\u00AD]$/u, '') + next;
  }
  if (glue === ' ') {
    return `${buf.replace(/[ \t\u00A0\u3000]+$/u, '')} ${next}`;
  }
  return buf.replace(/[ \t\u00A0\u3000]+$/u, '') + next;
}
