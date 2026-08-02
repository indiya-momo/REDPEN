/**
 * 서버 analyze 결과 메모리 캐시 — analyzeLine이 로컬 kiwi 없을 때 사용.
 */

/** @type {Map<string, { tokens: import('./tokens.js').KiwiToken[], score?: number, surface1to1: boolean }>} */
const remoteCache = new Map();

/** unify prefetch 상한(1200)보다 크게 — 배치 저장 중 조기 eviction 방지 */
const MAX_REMOTE = 2048;

export function clearRemoteAnalyzeCache() {
  remoteCache.clear();
}

/**
 * @param {string} text
 * @returns {{ tokens: import('./tokens.js').KiwiToken[], score?: number, surface1to1: boolean } | null}
 */
export function getRemoteAnalyze(text) {
  return remoteCache.get(String(text ?? '')) ?? null;
}

/**
 * @param {string} text
 * @param {{ tokens: import('./tokens.js').KiwiToken[], score?: number, surface1to1: boolean }} result
 */
export function putRemoteAnalyze(text, result) {
  const key = String(text ?? '');
  if (!key || !result) return;
  if (remoteCache.size >= MAX_REMOTE && !remoteCache.has(key)) {
    const oldest = remoteCache.keys().next().value;
    if (oldest != null) remoteCache.delete(oldest);
  }
  remoteCache.set(key, result);
}

export function remoteAnalyzeCacheSize() {
  return remoteCache.size;
}
