/**
 * @typedef {{
 *   str: string,
 *   tag: string,
 *   position: number,
 *   length: number,
 *   score?: number,
 * }} KiwiToken
 */

/** 세종 조사·보조사·접속조사 (J*) */
export function isJosaTag(tag) {
  const t = String(tag ?? '');
  return t.startsWith('J');
}

/** 기호·문장부호 등 — 끝에서 조사 탐색 시 건너뜀 */
export function isSkippableTrailingTag(tag) {
  const t = String(tag ?? '');
  return (
    t === 'SF' ||
    t === 'SP' ||
    t === 'SS' ||
    t === 'SE' ||
    t === 'SO' ||
    t === 'SW' ||
    t === 'SH' ||
    t === 'SL' ||
    t === 'SN' ||
    t === 'Z_CODA'
  );
}

/**
 * @param {string} input
 * @param {KiwiToken[]} tokens
 * @returns {boolean}
 */
export function surfaceMatchesTokens(input, tokens) {
  if (!Array.isArray(tokens)) return false;
  for (const t of tokens) {
    if (input.slice(t.position, t.position + t.length) !== t.str) return false;
  }
  return true;
}

/**
 * analyze 결과에서 인디야가 쓰는 필드만 남긴다. typoCost/typoFormId 폐기.
 * @param {unknown} raw
 * @returns {KiwiToken[]}
 */
export function pickPublicTokens(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((t) => ({
    str: String(t?.str ?? ''),
    tag: String(t?.tag ?? ''),
    position: Number(t?.position) || 0,
    length: Number(t?.length) || 0,
    score: typeof t?.score === 'number' ? t.score : undefined,
  }));
}
