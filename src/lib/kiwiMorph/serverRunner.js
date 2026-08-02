/**
 * 시나리오 C — 브라우저 → 서버 analyze (wasm 미전송).
 */
import { putRemoteAnalyze } from './remoteCache.js';
import { resolveKiwiAnalyzeEndpoint } from './resolveEndpoint.js';
import {
  KIWI_ANALYZE_MAX_BATCH,
  clampAnalyzeText,
} from './serverContract.js';
import { shouldAnalyzeWithKiwi } from './shouldAnalyze.js';

/**
 * @param {unknown} body
 * @returns {import('./serverContract.js').KiwiAnalyzeItem[]}
 */
function normalizeResults(body) {
  if (!body || typeof body !== 'object') return [];
  const o = /** @type {Record<string, unknown>} */ (body);
  if (o.ok !== true) return [];
  if (Array.isArray(o.results)) {
    return o.results
      .filter((r) => r && typeof r === 'object')
      .map((r) => {
        const item = /** @type {Record<string, unknown>} */ (r);
        return {
          text: String(item.text ?? ''),
          tokens: Array.isArray(item.tokens) ? item.tokens : [],
          surface1to1: Boolean(item.surface1to1),
          ...(typeof item.score === 'number' ? { score: item.score } : {}),
        };
      });
  }
  if (typeof o.text === 'string') {
    return [
      {
        text: o.text,
        tokens: Array.isArray(o.tokens) ? /** @type {any[]} */ (o.tokens) : [],
        surface1to1: Boolean(o.surface1to1),
        ...(typeof o.score === 'number' ? { score: o.score } : {}),
      },
    ];
  }
  return [];
}

/**
 * @param {string} endpoint
 * @param {typeof fetch} fetchImpl
 * @param {number} timeoutMs
 * @returns {Promise<boolean>}
 */
export async function pingKiwiAnalyze(
  endpoint,
  fetchImpl = fetch,
  timeoutMs = 8_000,
) {
  const base = String(endpoint ?? '').replace(/\/$/, '');
  if (!base) return false;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(base, {
      method: 'GET',
      signal: ctrl.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return false;
    const body = await res.json();
    return Boolean(body?.ok && body?.ready);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @param {string} endpoint
 * @param {typeof fetch} fetchImpl
 * @param {string[]} batch
 * @param {number} timeoutMs
 * @returns {Promise<number>}
 */
async function prefetchAnalyzeBatch(endpoint, fetchImpl, batch, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let stored = 0;
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
    if (!res.ok) return 0;
    const body = await res.json();
    for (const item of normalizeResults(body)) {
      if (!item.text) continue;
      putRemoteAnalyze(item.text, {
        tokens: /** @type {import('./tokens.js').KiwiToken[]} */ (
          item.tokens
        ),
        surface1to1: item.surface1to1,
        ...(typeof item.score === 'number' ? { score: item.score } : {}),
      });
      stored += 1;
    }
  } catch {
    /* heuristic 폴백 */
  } finally {
    clearTimeout(timer);
  }
  return stored;
}

/**
 * @param {string[]} texts
 * @param {{
 *   endpoint?: string,
 *   fetchImpl?: typeof fetch,
 *   timeoutMs?: number,
 *   concurrency?: number,
 * }} [opts]
 * @returns {Promise<number>} 캐시에 넣은 개수
 */
export async function prefetchKiwiAnalyze(texts, opts = {}) {
  const endpoint = resolveKiwiAnalyzeEndpoint(opts.endpoint);
  if (!endpoint) return 0;

  const unique = [
    ...new Set(
      (texts ?? [])
        .map((t) => clampAnalyzeText(String(t ?? '').trim()))
        .filter((t) => t && shouldAnalyzeWithKiwi(t)),
    ),
  ];
  if (!unique.length) return 0;

  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 20_000;
  const concurrency = Math.max(1, Math.min(opts.concurrency ?? 3, 4));

  /** @type {string[][]} */
  const batches = [];
  for (let i = 0; i < unique.length; i += KIWI_ANALYZE_MAX_BATCH) {
    batches.push(unique.slice(i, i + KIWI_ANALYZE_MAX_BATCH));
  }

  let stored = 0;
  for (let i = 0; i < batches.length; i += concurrency) {
    const slice = batches.slice(i, i + concurrency);
    const counts = await Promise.all(
      slice.map((batch) =>
        prefetchAnalyzeBatch(endpoint, fetchImpl, batch, timeoutMs),
      ),
    );
    for (const n of counts) stored += n;
  }

  return stored;
}
