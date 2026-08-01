/**
 * 서버 analyze 요청/응답 계약 (클라이언트·서버 공유).
 * 시나리오 C: wasm/모델은 서버에만, 브라우저는 토큰 JSON만 수신.
 *
 * @typedef {{
 *   str: string,
 *   tag: string,
 *   position: number,
 *   length: number,
 *   score?: number,
 * }} KiwiApiToken
 *
 * @typedef {{
 *   text: string,
 *   tokens: KiwiApiToken[],
 *   surface1to1: boolean,
 *   score?: number,
 * }} KiwiAnalyzeItem
 *
 * @typedef {{
 *   ok: true,
 *   text: string,
 *   tokens: KiwiApiToken[],
 *   surface1to1: boolean,
 *   score?: number,
 * }} KiwiAnalyzeOk
 *
 * @typedef {{ ok: true, results: KiwiAnalyzeItem[] }} KiwiAnalyzeBatchOk
 *
 * @typedef {{ ok: false, error: string }} KiwiAnalyzeErr
 *
 * @typedef {{ ok: true, ready: boolean }} KiwiAnalyzeHealth
 */

export const KIWI_ANALYZE_PATH = '/api/kiwi/analyze';

/** 한 요청 최대 문자열 길이 */
export const KIWI_ANALYZE_MAX_CHARS = 8000;

/** 배치 최대 개수 */
export const KIWI_ANALYZE_MAX_BATCH = 64;

/** @param {string} text @param {number} [max] */
export function clampAnalyzeText(text, max = KIWI_ANALYZE_MAX_CHARS) {
  const s = String(text ?? '');
  if (s.length <= max) return s;
  return s.slice(0, max);
}

/**
 * @param {unknown} body
 * @returns {{ texts: string[] } | { error: string }}
 */
export function parseAnalyzeRequestBody(body) {
  if (!body || typeof body !== 'object') {
    return { error: 'KIWI_BODY_INVALID' };
  }
  const o = /** @type {Record<string, unknown>} */ (body);
  if (Array.isArray(o.texts)) {
    const texts = o.texts
      .map((t) => clampAnalyzeText(String(t ?? '')))
      .filter((t) => t.length > 0)
      .slice(0, KIWI_ANALYZE_MAX_BATCH);
    if (!texts.length) return { error: 'KIWI_TEXT_MISSING' };
    return { texts };
  }
  if (typeof o.text === 'string') {
    const text = clampAnalyzeText(o.text);
    if (!text) return { error: 'KIWI_TEXT_MISSING' };
    return { texts: [text] };
  }
  return { error: 'KIWI_TEXT_MISSING' };
}
