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
const INDENT_EM = 0.55;
/** 다음 줄이 이 em 이상 왼쪽으로 물러나면 표 칸·다른 덩어리. */
const OUTDENT_EM = 0.55;
/** 줄간격이 글자 크기의 이 배보다 크면 문단 간격. */
const GAP_RATIO = 1.75;
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

/** 표 셀이 y만 같고 x 간격 없이 섞일 때 흔한 조각(한 글자 띄어쓰기 나열). */
const SPACED_SYLLABLE_JUNK_RE = /(?:[가-힣]\s+){3,}[가-힣]/u;

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
 * 다음 줄 첫 어절이 이 말과 같으면 앞 말에 붙는 조사로 본다.
 * `가을`·`도로`·`만약`처럼 조사로 시작만 하는 단어는 넣지 않는다.
 */
const PARTICLE_EOJEOL = new Set([
  '가',
  '이',
  '은',
  '는',
  '을',
  '를',
  '에',
  '의',
  '로',
  '와',
  '과',
  '도',
  '만',
  '에서',
  '으로',
  '까지',
  '부터',
  '에게',
  '한테',
  '처럼',
  '보다',
  '에는',
  '에도',
  '로는',
  '로도',
  '와는',
  '과는',
  '와도',
  '과도',
  '에서는',
  '에서도',
  '으로는',
  '으로도',
  '에게는',
  '에게도',
  '한테는',
  '한테도',
  '까지는',
  '까지도',
  '부터는',
  '부터도',
  '에서부터',
  '으로부터',
  '에게서',
  '한테서',
  '에게서는',
  '한테서는',
]);

/** 한 음절·`보다`는 새 단어일 수 있어 모달에 올린다. */
const AMBIGUOUS_PARTICLE = new Set([
  '가',
  '이',
  '은',
  '는',
  '을',
  '를',
  '에',
  '의',
  '로',
  '와',
  '과',
  '도',
  '만',
  '보다',
]);

/** 앞 어절이 이미 조사로 끝난 것으로 보는 한 음절. `사과`·`포도`의 끝음절은 빼 둔다. */
const CLOSED_EOJEOL_JOSA = new Set(['은', '는', '이', '가', '을', '를', '에']);

const CLOSED_EOJEOL_PARTICLE = [
  '에서부터',
  '으로부터',
  '에게서는',
  '한테서는',
  '에게서',
  '한테서',
  '에서는',
  '에서도',
  '으로는',
  '으로도',
  '에게는',
  '에게도',
  '한테는',
  '한테도',
  '까지는',
  '까지도',
  '부터는',
  '부터도',
  '에서',
  '으로',
  '까지',
  '부터',
  '에게',
  '한테',
  '처럼',
];

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
 * 다음 줄 첫 어절이 앞 말에 붙는 조사인지.
 * `sure`는 붙여 쓰고 모달에 올리지 않는다. `uncertain`은 붙여 쓰되 모달에 올린다.
 * @param {string} left
 * @param {string} right
 * @returns {'sure' | 'uncertain' | null}
 */
export function particleAttachKind(left, right) {
  const L = String(left ?? '').replace(/\s+$/u, '');
  const R = String(right ?? '').replace(/^\s+/u, '');
  if (!L || !R) return null;
  const last = L[L.length - 1];
  const first = R[0];
  if (!isHangulSyllableChar(last) || !isHangulSyllableChar(first)) return null;
  const firstEojeol = R.split(/\s+/u).filter(Boolean)[0] ?? '';
  if (!PARTICLE_EOJEOL.has(firstEojeol)) return null;
  const lastEojeol = L.split(/\s+/u).filter(Boolean).pop() ?? '';
  if (CLOSED_EOJEOL_JOSA.has(lastEojeol[lastEojeol.length - 1] ?? '')) return null;
  if (CLOSED_EOJEOL_PARTICLE.some((particle) => lastEojeol.endsWith(particle) && lastEojeol.length > particle.length)) {
    return null;
  }
  return AMBIGUOUS_PARTICLE.has(firstEojeol) ? 'uncertain' : 'sure';
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
    if (particleAttachKind(L, R)) return '';
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
 * 쪽 넘김 이음이 믿을 수 있는지. analyzeParagraphFlow·applyLinebreakDecisions 공용.
 * column/body* 필드가 없는 옛 입력은 trusted(현행과 동일).
 * @param {{
 *   lines?: string[],
 *   column?: { kind?: string, deferred?: boolean, margin?: string },
 *   bodyHeadIndex?: number,
 *   bodyTailIndex?: number,
 * } | null | undefined} leftPage
 * @param {{
 *   lines?: string[],
 *   column?: { kind?: string, deferred?: boolean, margin?: string },
 *   bodyHeadIndex?: number,
 *   bodyTailIndex?: number,
 * } | null | undefined} rightPage
 * @returns {{
 *   crossPage: true,
 *   layoutTrust: 'trusted' | 'untrusted',
 *   untrustedWhy?: string,
 * }}
 */
export function crossPageLayoutTrust(leftPage, rightPage) {
  const leftHas =
    leftPage &&
    leftPage.column != null &&
    Number.isFinite(leftPage.bodyHeadIndex) &&
    Number.isFinite(leftPage.bodyTailIndex);
  const rightHas =
    rightPage &&
    rightPage.column != null &&
    Number.isFinite(rightPage.bodyHeadIndex) &&
    Number.isFinite(rightPage.bodyTailIndex);
  if (!leftHas || !rightHas) {
    return { crossPage: true, layoutTrust: 'trusted' };
  }

  if (leftPage.column.deferred === true) {
    return {
      crossPage: true,
      layoutTrust: 'untrusted',
      untrustedWhy: 'left-deferred',
    };
  }
  if (rightPage.column.deferred === true) {
    return {
      crossPage: true,
      layoutTrust: 'untrusted',
      untrustedWhy: 'right-deferred',
    };
  }
  if (leftPage.column.kind === 'two' && leftPage.column.margin === 'near') {
    return {
      crossPage: true,
      layoutTrust: 'untrusted',
      untrustedWhy: 'left-near-two',
    };
  }
  if (rightPage.column.kind === 'two' && rightPage.column.margin === 'near') {
    return {
      crossPage: true,
      layoutTrust: 'untrusted',
      untrustedWhy: 'right-near-two',
    };
  }

  const leftLen = (leftPage.lines ?? []).length;
  const rightLen = (rightPage.lines ?? []).length;
  if (leftLen > 0 && leftPage.bodyTailIndex !== leftLen - 1) {
    return {
      crossPage: true,
      layoutTrust: 'untrusted',
      untrustedWhy: 'tail-mismatch',
    };
  }
  if (rightLen > 0 && rightPage.bodyHeadIndex !== 0) {
    return {
      crossPage: true,
      layoutTrust: 'untrusted',
      untrustedWhy: 'head-mismatch',
    };
  }

  return { crossPage: true, layoutTrust: 'trusted' };
}

/**
 * @param {string} left
 * @param {string} right
 * @param {TxtLineLayout | null | undefined} leftLayout
 * @param {TxtLineLayout | null | undefined} rightLayout
 * @param {{ byCol: Map<number, { fullEndX: number | null, fullChars: number }> } | null} [context]
 * @param {{
 *   crossPage?: boolean,
 *   layoutTrust?: 'trusted' | 'untrusted',
 *   untrustedWhy?: string,
 * }} [opts]
 *   쪽·단이 바뀌면 y·x는 비교하지 않는다. 문장 끝·짧은 줄·제목·조사 규칙은 그대로다.
 *   layoutTrust=untrusted이면 잇기 후보를 page-layout keep으로 막는다.
 * @returns {ParagraphVerdict}
 */
export function classifyParagraphPair(
  left,
  right,
  leftLayout = null,
  rightLayout = null,
  context = null,
  opts = {},
) {
  const L = String(left ?? '').replace(/\s+$/u, '');
  const R = String(right ?? '').replace(/^\s+/u, '');
  const glue = paragraphJoinGlue(L, R, {
    trailSpace: Boolean(leftLayout?.trailSpace),
  });
  const particle = leftLayout?.trailSpace ? null : particleAttachKind(L, R);
  const midWord = glue === '' && !particle;
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
  if (SPACED_SYLLABLE_JUNK_RE.test(L) || SPACED_SYLLABLE_JUNK_RE.test(R)) {
    return keep('table', true);
  }

  const sameCol =
    !opts.crossPage &&
    (!leftLayout ||
      !rightLayout ||
      !Number.isFinite(leftLayout.col) ||
      !Number.isFinite(rightLayout.col) ||
      leftLayout.col === rightLayout.col);

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
    // 단어 중간·조사 붙임·하이픈 soft-wrap은 행간이 넓어도 잇는다.
    // (depressione 「그러|지 않는다면」: dy≈2.1em → 옛 gap keep 오판)
    if (dy > ref * GAP_RATIO && !midWord && !dehyphen && !particle) {
      return keep('gap', false);
    }
  }

  if (
    sameCol &&
    leftLayout &&
    rightLayout &&
    Number.isFinite(leftLayout.x) &&
    Number.isFinite(rightLayout.x)
  ) {
    const em = Math.max(leftLayout.fontH || 0, rightLayout.fontH || 0, 8);
    if (rightLayout.x > leftLayout.x + em * INDENT_EM) {
      return keep('indent', false);
    }
    // 다음 줄이 왼쪽으로 크게 물러나면 표 칸·다른 열.
    if (rightLayout.x < leftLayout.x - em * OUTDENT_EM) {
      return keep('outdent', true);
    }
  }

  const fullness = lineFullness(L, leftLayout, context);
  // 폭을 모르면(unknown) 짧은 줄로 단정하지 않고 문단 안 줄바꿈으로 잇는다.
  // 끝줄이 짧은데 음절이 이어져 보이면 문단 끝을 우선하고, 모달에서 고치게 한다.
  // (맞춘 조판에서 단어 중간 줄바꿈은 오른쪽 끝선까지 찬 줄에서 난다.)
  if (fullness === 'short') {
    return keep('short', L.length <= 22 || midWord || dehyphen);
  }

  // border만으로 끊지 않는다(본문 soft-wrap 오측). 들여쓰기·짧은 다음 줄이 있으면 문단 끝.
  if (
    fullness === 'border' &&
    !midWord &&
    !dehyphen &&
    !particle &&
    leftLayout &&
    rightLayout &&
    Number.isFinite(leftLayout.x) &&
    Number.isFinite(rightLayout.x)
  ) {
    const emB = Math.max(leftLayout.fontH || 0, rightLayout.fontH || 0, 8);
    const softIndent = rightLayout.x > leftLayout.x + emB * 0.35;
    const nextShortish = R.length <= 16 && L.length >= 20;
    if (softIndent || nextShortish) {
      return keep('border', true);
    }
  }

  // 잇기로 갈 수 있을 때만 page-layout keep (이미 keep인 sentence·short 등은 유지).
  if (opts.crossPage && opts.layoutTrust === 'untrusted') {
    return keep('page-layout', true);
  }

  let uncertain = midWord || dehyphen || fullness === 'border' || particle === 'uncertain';
  let reason = 'wrap';
  if (particle === 'uncertain') reason = 'josa';
  else if (midWord) reason = 'midword';
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
  // O5 확정(2026-11-26): page-layout을 모달 맨 앞(−1). 미등록(9)이면 상한에서 잘린다.
  // 「쪽 수의 10%」 관측은 F4 보고용; 최종 TXT keep은 상한과 무관.
  'page-layout': -1,
  josa: 0,
  midword: 1,
  hyphen: 2,
  border: 3,
  outdent: 3,
  table: 3,
  heading: 4,
  short: 5,
};

/**
 * @param {{ pageNum?: number, lines?: string[] }[]} pages
 */
function pagesWithLines(pages) {
  return (pages ?? []).filter((page) => (page.lines ?? []).length > 0);
}

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

  const filled = pagesWithLines(pages);
  for (let p = 0; p < filled.length - 1; p += 1) {
    const page = filled[p];
    const next = filled[p + 1];
    const lines = page.lines ?? [];
    const nextLines = next.lines ?? [];
    const layouts = page.lineLayout ?? [];
    const nextLayouts = next.lineLayout ?? [];
    const context = buildParagraphContext(lines, layouts);
    const crossOpts = crossPageLayoutTrust(page, next);
    const verdict = classifyParagraphPair(
      lines[lines.length - 1],
      nextLines[0],
      layouts[lines.length - 1],
      nextLayouts[0],
      context,
      crossOpts,
    );
    if (verdict.action === 'join') joined += 1;
    else kept += 1;
    if (!verdict.uncertain) continue;
    exceptions.push({
      id: `${page.pageNum}:page`,
      pageNum: page.pageNum,
      lineIndex: lines.length - 1,
      left: lines[lines.length - 1],
      right: nextLines[0],
      defaultDecision: autoDecisionForVerdict(verdict),
      glue: verdict.glue,
      reason: verdict.reason,
      rank: EXCEPTION_RANK[verdict.reason] ?? 9,
    });
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
