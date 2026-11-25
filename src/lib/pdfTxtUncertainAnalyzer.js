/**
 * TXT 문단 uncertain 후보 전용 분석기 (플랜 3단계).
 *
 * - classifyParagraphPair / analyzeParagraphFlow 핫패스에 넣지 않는다.
 * - 기본 OFF. ON이어도 갈림·실패·Kiwi 없음 → 현행 defaultDecision 유지.
 * - midword + nospace만:
 *   - Kiwi가 이음 지점을 가로지르면 A(붙임 유지)
 *   - 어절 경계(Y)면 space
 *   - 단·표 어긋남·다른 문장(K)이면 keep
 * - 로컬 Kiwi만 사용 (바른·원격 전송 없음).
 */
import { isTxtLinebreakAnalyzerEnabled } from './featureFlags.js';
import { analyzeLine } from './kiwiMorph/analyze.js';
import { getKiwiInstance } from './kiwiMorph/runtime.js';
import { isHangulSyllableChar } from './pdfPageText.js';

export { isTxtLinebreakAnalyzerEnabled };

/** 다음 줄이 접속·담화 표지로 시작하면 같은 문장 soft-wrap이 아님(단·표 어긋남). */
const DISCOURSE_START_RE =
  /^(그러나|그런데|하지만|물론|이에|그래서|그리고|또한|다만|즉|곧|한편|반면|따라서|그러므로|왜냐하면|특히|아울러|더불어|그래도|또는|혹은)/u;

/**
 * 다음 줄이 용언 없이 어미·연결만으로 시작하면, 앞 줄과 이어 붙일 어절이 아님.
 * 예: 개입↵다고, 불치병↵지 않는다면
 */
const ORPHAN_ENDING_START_RE =
  /^(다고|다는|다고\s|지\s|며\s|고\s|지만|다면|으며|으면|아서|어서)/u;

/**
 * @typedef {{
 *   enabled: boolean,
 *   suggestions: Record<string, 'keep' | 'nospace' | 'space' | 'dehyphen'>,
 *   metrics: {
 *     candidateCount: number,
 *     overridden: number,
 *     keptCurrent: number,
 *     midwordSeen: number,
 *     yToSpace: number,
 *     yToKeep: number,
 *     aKept: number,
 *     skipped: string,
 *   },
 * }} UncertainAnalyzerResult
 */

/**
 * 단·표·다른 문장 이음으로 보이는 쌍 (띄움이 아니라 줄 유지).
 * @param {string} left
 * @param {string} right
 */
export function isLikelyLayoutBreakPair(left, right) {
  const L = String(left ?? '').replace(/\s+$/u, '');
  const R = String(right ?? '').replace(/^\s+/u, '');
  if (!L || !R) return false;
  if (DISCOURSE_START_RE.test(R)) return true;
  if (ORPHAN_ENDING_START_RE.test(R)) return true;
  return false;
}

/**
 * @param {string} left
 * @param {string} right
 * @param {(text: string) => { tokens?: { position: number, length: number }[] } | null} [analyze]
 * @returns {'A' | 'Y' | 'K' | 'skip'}
 *   A=형태소 중간(붙임), Y=어절 경계(띄움), K=단·문장 어긋남(유지)
 */
export function labelMidwordJoin(left, right, analyze = analyzeLine) {
  const L = String(left ?? '').replace(/\s+$/u, '');
  const R = String(right ?? '').replace(/^\s+/u, '');
  if (!L || !R) return 'skip';
  const last = L[L.length - 1];
  const first = R[0];
  if (!isHangulSyllableChar(last) || !isHangulSyllableChar(first)) return 'skip';

  if (isLikelyLayoutBreakPair(L, R)) return 'K';

  const leftTail = L.slice(Math.max(0, L.length - 12));
  const rightHead = R.slice(0, 12);
  const window = leftTail + rightHead;
  const at = leftTail.length;
  let analyzed;
  try {
    analyzed = analyze(window);
  } catch {
    return 'skip';
  }
  const tokens = analyzed?.tokens ?? [];
  if (!tokens.length) return 'skip';

  for (const t of tokens) {
    const start = Number(t.position) || 0;
    const len = Number(t.length) || 0;
    const end = start + len;
    if (start < at && end > at && len >= 2) return 'A';
  }
  return 'Y';
}

/**
 * uncertain 후보 배치만 검토한다.
 *
 * @param {import('./pdfTxtLinebreakReview.js').LinebreakCandidate[]} candidates
 * @param {{ analyze?: typeof analyzeLine, forceEnabled?: boolean }} [opts]
 * @returns {UncertainAnalyzerResult}
 */
export function suggestUncertainLinebreakDecisions(candidates = [], opts = {}) {
  const list = Array.isArray(candidates) ? candidates : [];
  const enabled =
    opts.forceEnabled === true || isTxtLinebreakAnalyzerEnabled();
  if (!enabled) {
    return {
      enabled: false,
      suggestions: {},
      metrics: {
        candidateCount: list.length,
        overridden: 0,
        keptCurrent: list.length,
        midwordSeen: 0,
        yToSpace: 0,
        yToKeep: 0,
        aKept: 0,
        skipped: 'flag-off',
      },
    };
  }

  const analyze = opts.analyze ?? analyzeLine;
  const kiwi = getKiwiInstance();
  const kiwiReady = Boolean(opts.analyze) || Boolean(kiwi?.ready?.());
  if (!kiwiReady) {
    return {
      enabled: true,
      suggestions: {},
      metrics: {
        candidateCount: list.length,
        overridden: 0,
        keptCurrent: list.length,
        midwordSeen: 0,
        yToSpace: 0,
        yToKeep: 0,
        aKept: 0,
        skipped: 'kiwi-unavailable',
      },
    };
  }

  /** @type {Record<string, 'keep' | 'nospace' | 'space' | 'dehyphen'>} */
  const suggestions = {};
  let midwordSeen = 0;
  let yToSpace = 0;
  let yToKeep = 0;
  let aKept = 0;
  let overridden = 0;

  for (const c of list) {
    if (c.reason !== 'midword') continue;
    if (c.defaultDecision !== 'nospace' && c.glue !== '') continue;
    midwordSeen += 1;
    const label = labelMidwordJoin(c.left, c.right, analyze);
    if (label === 'K') {
      if (c.defaultDecision !== 'keep') {
        suggestions[c.id] = 'keep';
        overridden += 1;
        yToKeep += 1;
      }
    } else if (label === 'Y') {
      if (c.defaultDecision !== 'space') {
        suggestions[c.id] = 'space';
        overridden += 1;
        yToSpace += 1;
      }
    } else if (label === 'A') {
      aKept += 1;
    }
  }

  return {
    enabled: true,
    suggestions,
    metrics: {
      candidateCount: list.length,
      overridden,
      keptCurrent: list.length - overridden,
      midwordSeen,
      yToSpace,
      yToKeep,
      aKept,
      skipped: overridden === 0 && midwordSeen === 0 ? 'no-midword' : '',
    },
  };
}

/**
 * @param {Record<string, 'keep' | 'nospace' | 'space' | 'dehyphen'>} base
 * @param {UncertainAnalyzerResult} result
 * @returns {Record<string, 'keep' | 'nospace' | 'space' | 'dehyphen'>}
 */
export function mergeUncertainSuggestions(base = {}, result) {
  if (!result?.enabled) return { ...base };
  const out = { ...base };
  for (const [id, decision] of Object.entries(result.suggestions ?? {})) {
    if (
      decision === 'keep' ||
      decision === 'nospace' ||
      decision === 'space' ||
      decision === 'dehyphen'
    ) {
      out[id] = decision;
    }
  }
  return out;
}

/**
 * @param {import('./pdfTxtLinebreakReview.js').LinebreakCandidate[]} candidates
 * @param {UncertainAnalyzerResult} result
 */
export function applyUncertainSuggestionsToCandidates(candidates, result) {
  if (!result?.enabled || !result.suggestions) return candidates ?? [];
  const map = result.suggestions;
  return (candidates ?? []).map((c) => {
    const next = map[c.id];
    if (!next || next === c.defaultDecision) return c;
    return { ...c, defaultDecision: next };
  });
}
