/**
 * 클라이언트 — Kiwi remoteCache가 비어 있을 때 바른으로 채운다.
 */
import { getRemoteAnalyze, putRemoteAnalyze } from '../kiwiMorph/remoteCache.js';
import { shouldAnalyzeWithKiwi } from '../kiwiMorph/shouldAnalyze.js';
import {
  BAREUN_ANALYZE_MAX_BATCH,
  BAREUN_ANALYZE_PATH,
} from './contract.js';

/**
 * @param {unknown} body
 * @returns {{ text: string, tokens: unknown[], surface1to1: boolean }[]}
 */
function normalizeResults(body) {
  if (!body || typeof body !== 'object') return [];
  const o = /** @type {Record<string, unknown>} */ (body);
  if (Array.isArray(o.results)) {
    return o.results
      .filter((r) => r && typeof r === 'object')
      .map((r) => {
        const item = /** @type {Record<string, unknown>} */ (r);
        return {
          text: String(item.text ?? ''),
          tokens: Array.isArray(item.tokens) ? item.tokens : [],
          surface1to1: item.surface1to1 === true,
        };
      });
  }
  return [];
}

/**
 * @param {string[]} texts
 * @param {{
 *   endpoint?: string,
 *   fetchImpl?: typeof fetch,
 *   timeoutMs?: number,
 *   maxMs?: number,
 * }} [opts]
 * @returns {Promise<number>}
 */
export async function prefetchBareunAnalyze(texts, opts = {}) {
  const endpoint = String(opts.endpoint ?? BAREUN_ANALYZE_PATH).trim();
  if (!endpoint) return 0;

  const unique = [
    ...new Set(
      (texts ?? [])
        .map((t) => String(t ?? '').trim())
        .filter((t) => t && shouldAnalyzeWithKiwi(t) && !getRemoteAnalyze(t)),
    ),
  ];
  if (!unique.length) return 0;

  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 8_000;
  const maxMs = opts.maxMs ?? 12_000;
  const deadline = performance.now() + maxMs;

  let stored = 0;
  for (let i = 0; i < unique.length; i += BAREUN_ANALYZE_MAX_BATCH) {
    if (deadline - performance.now() < 400) break;
    const batch = unique.slice(i, i + BAREUN_ANALYZE_MAX_BATCH);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetchImpl(endpoint.replace(/\/$/, ''), {
        method: 'POST',
        signal: ctrl.signal,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(
          batch.length === 1 ? { text: batch[0] } : { texts: batch },
        ),
      });
      if (!res.ok) continue;
      const body = await res.json();
      if (body?.ok === false) continue;
      for (const item of normalizeResults(body)) {
        if (!item.text) continue;
        putRemoteAnalyze(item.text, {
          tokens: /** @type {import('../kiwiMorph/tokens.js').KiwiToken[]} */ (
            item.tokens
          ),
          surface1to1: item.surface1to1,
        });
        stored += 1;
      }
    } catch {
      /* Kiwi fail-closed 유지 */
    } finally {
      clearTimeout(timer);
    }
  }
  return stored;
}
