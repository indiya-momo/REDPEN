/**
 * 끝 조사(J*) 제거 — Kiwi 토큰 경계. 실패 시 null → 호출측 heuristic.
 */
import { analyzeLine } from './analyze.js';
import { isJosaTag, isSkippableTrailingTag } from './tokens.js';

const HANGUL_RE = /[\uAC00-\uD7A3]/g;

function hangulCount(s) {
  return (String(s).match(HANGUL_RE) || []).length;
}

/**
 * @param {string} surface
 * @param {import('./tokens.js').KiwiToken[]} tokens
 * @param {number} minStemHangul
 * @returns {string | null} 조사 제거된 표면형. 조사 없거나 실패면 null
 */
export function stripTrailingJosaFromTokens(
  surface,
  tokens,
  minStemHangul = 2,
) {
  const v = String(surface ?? '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!v || !tokens?.length) return null;

  let end = tokens.length - 1;
  while (end >= 0 && isSkippableTrailingTag(tokens[end].tag)) end -= 1;
  if (end < 0) return null;

  let firstJosa = end;
  while (firstJosa >= 0 && isJosaTag(tokens[firstJosa].tag)) firstJosa -= 1;
  firstJosa += 1;
  if (firstJosa > end) return null;

  const josaTok = tokens[firstJosa];
  if (josaTok.position <= 0) return null;

  const stem = v.slice(0, josaTok.position).replace(/\s+$/u, '');
  if (!stem || hangulCount(stem) < minStemHangul) return null;
  if (stem === v) return null;
  return stem;
}

/**
 * @param {string} surface
 * @param {number} [minStemHangul]
 * @param {{ kiwi?: import('kiwi-nlp').Kiwi | null }} [opts]
 * @returns {string | null}
 */
export function stripTrailingJosaKiwi(surface, minStemHangul = 2, opts = {}) {
  const v = String(surface ?? '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!v) return null;

  const analyzed = analyzeLine(v, opts);
  if (!analyzed?.tokens?.length) return null;
  if (!analyzed.surface1to1) return null;

  return stripTrailingJosaFromTokens(v, analyzed.tokens, minStemHangul);
}
