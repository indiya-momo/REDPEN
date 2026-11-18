/** @typedef {{ ok: true, ready: boolean, configured?: boolean }} BareunHealth */
/** @typedef {{ ok: true, results: { text: string, tokens: unknown[], surface1to1: boolean }[] }} BareunBatchOk */
/** @typedef {{ ok: false, error: string }} BareunErr */

export const BAREUN_ANALYZE_PATH = '/api/bareun/analyze';

export const BAREUN_ANALYZE_MAX_BATCH = 32;

export const BAREUN_DEFAULT_UPSTREAM = 'https://api.bareun.ai';

/**
 * @param {unknown} body
 * @returns {{ texts: string[] } | { error: string }}
 */
export function parseBareunAnalyzeBody(body) {
  if (!body || typeof body !== 'object') return { error: 'BAREUN_BODY_INVALID' };
  const o = /** @type {Record<string, unknown>} */ (body);
  if (Array.isArray(o.texts)) {
    const texts = o.texts
      .map((t) => String(t ?? '').trim())
      .filter(Boolean)
      .slice(0, BAREUN_ANALYZE_MAX_BATCH);
    if (!texts.length) return { error: 'BAREUN_TEXT_MISSING' };
    return { texts };
  }
  if (typeof o.text === 'string') {
    const text = o.text.trim();
    if (!text) return { error: 'BAREUN_TEXT_MISSING' };
    return { texts: [text] };
  }
  return { error: 'BAREUN_TEXT_MISSING' };
}
