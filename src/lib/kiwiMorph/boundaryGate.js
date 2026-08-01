/**
 * 맞춤법/외래어 히트 — Kiwi 토큰 경계 게이트.
 * 복합어 내부 부분일치(경제⊂경제학) skip, 어간+조사(초콜렛을) 유지.
 *
 * @see project-docs/kiwi-morph-boundary-plan-2026-08-02.md §P2
 */
import { analyzeLine } from './analyze.js';

/** 승인된 어간 태그 화이트리스트 (2026-08-02) */
export const KIWI_BOUNDARY_STEM_TAGS = Object.freeze(
  new Set([
    'NNG',
    'NNP',
    'NNB',
    'NR',
    'NP',
    'SL',
    'SH',
    'SN',
    'XSN',
    'XPN',
  ]),
);

/**
 * @param {string} tag
 * @returns {boolean}
 */
export function isKiwiBoundaryStemTag(tag) {
  const t = String(tag ?? '');
  if (KIWI_BOUNDARY_STEM_TAGS.has(t)) return true;
  const base = t.split('-')[0];
  return KIWI_BOUNDARY_STEM_TAGS.has(base);
}

/**
 * @param {import('./tokens.js').KiwiToken} token
 * @param {number} start
 * @param {number} end
 */
function overlaps(token, start, end) {
  const t0 = token.position;
  const t1 = token.position + token.length;
  return t0 < end && t1 > start;
}

/**
 * 토큰 배열만으로 경계 판정 (단위 테스트용).
 *
 * @param {string} matchedRaw
 * @param {string} sourceText
 * @param {number} matchIndex
 * @param {import('./tokens.js').KiwiToken[]} tokens
 * @returns {boolean}
 */
export function shouldSkipMatchByKiwiTokens(
  matchedRaw,
  sourceText,
  matchIndex,
  tokens,
) {
  const matched = String(matchedRaw ?? '');
  const text = String(sourceText ?? '');
  if (!matched || !text || matchIndex == null || matchIndex < 0) return false;
  if (!Array.isArray(tokens) || !tokens.length) return false;

  const start = matchIndex;
  const end = matchIndex + matched.length;
  if (end > text.length) return false;
  if (text.slice(start, end) !== matched) return false;

  const overlapping = tokens.filter((t) => overlaps(t, start, end));
  if (!overlapping.length) return false;

  const first = overlapping[0];
  const last = overlapping[overlapping.length - 1];

  if (start > first.position) {
    return isKiwiBoundaryStemTag(first.tag);
  }
  if (end < last.position + last.length) {
    return isKiwiBoundaryStemTag(last.tag);
  }

  return false;
}

/**
 * 히트가 형태소 경계를 깨면 true(스킵). 실패·미정렬·미로드 → false(현행 유지).
 *
 * @param {string} matchedRaw — match[0]
 * @param {string} sourceText
 * @param {number} matchIndex
 * @param {{ kiwi?: { ready?: () => boolean, analyze: Function } | null }} [opts]
 * @returns {boolean}
 */
export function shouldSkipMatchByKiwiBoundary(
  matchedRaw,
  sourceText,
  matchIndex,
  opts = {},
) {
  const analyzed = analyzeLine(String(sourceText ?? ''), opts);
  if (!analyzed?.tokens?.length || !analyzed.surface1to1) return false;
  return shouldSkipMatchByKiwiTokens(
    matchedRaw,
    sourceText,
    matchIndex,
    analyzed.tokens,
  );
}
