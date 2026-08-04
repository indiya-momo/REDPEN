/**
 * 시나리오 C — 브라우저 → 서버 analyze (wasm 미전송).
 */
import { getRemoteAnalyze, putRemoteAnalyze } from './remoteCache.js';
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
  timeoutMs = 3_000,
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
 *   maxMs?: number,
 * }} [opts]
 * @returns {Promise<number>} 캐시에 넣은 개수
 */
export async function prefetchKiwiAnalyze(texts, opts = {}) {
  const endpoint = resolveKiwiAnalyzeEndpoint(opts.endpoint);
  if (!endpoint) return 0;

  // PDF 준비 시 prefetch 후 찾기에서 다시 돌리지 않도록 — 캐시 hit는 제외
  const unique = [
    ...new Set(
      (texts ?? [])
        .map((t) => clampAnalyzeText(String(t ?? '').trim()))
        .filter((t) => t && shouldAnalyzeWithKiwi(t)),
    ),
  ].filter((t) => !getRemoteAnalyze(t));
  if (!unique.length) return 0;

  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 8_000;
  const concurrency = Math.max(1, Math.min(opts.concurrency ?? 3, 4));
  // 찾기 경로에서 1200표면×배치가 수분 블로킹하지 않도록 전체 예산
  const maxMs = opts.maxMs ?? 12_000;
  const deadline = performance.now() + maxMs;

  /** @type {string[][]} */
  const batches = [];
  for (let i = 0; i < unique.length; i += KIWI_ANALYZE_MAX_BATCH) {
    batches.push(unique.slice(i, i + KIWI_ANALYZE_MAX_BATCH));
  }

  let stored = 0;
  let consecutiveEmpty = 0;
  for (let i = 0; i < batches.length; i += concurrency) {
    const left = deadline - performance.now();
    if (left < 400) {
      if (import.meta.env.DEV) {
        console.warn(
          `[kiwiMorph] prefetch budget ${maxMs}ms — skipped ${batches.length - i}/${batches.length} batches (stored=${stored})`,
        );
      }
      break;
    }
    const slice = batches.slice(i, i + concurrency);
    const batchTimeout = Math.min(timeoutMs, Math.max(400, Math.floor(left)));
    const counts = await Promise.all(
      slice.map((batch) =>
        prefetchAnalyzeBatch(endpoint, fetchImpl, batch, batchTimeout),
      ),
    );
    let round = 0;
    for (const n of counts) {
      stored += n;
      round += n;
    }
    if (round === 0) {
      consecutiveEmpty += 1;
      // 서버 미응답·타임아웃 연속 → 나머지 배치로 찾기 전체를 묶지 않음
      if (consecutiveEmpty >= 2) {
        if (import.meta.env.DEV) {
          console.warn(
            '[kiwiMorph] prefetch abort after empty rounds — fall through to scan',
          );
        }
        break;
      }
    } else {
      consecutiveEmpty = 0;
    }
  }

  return stored;
}
