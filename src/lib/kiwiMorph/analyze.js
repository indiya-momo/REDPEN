/**
 * Match.all (비정규화)로 한 줄 분석. typo 미사용.
 * kiwi-nlp 패키지를 static import하지 않음 (브라우저 번들 오염 방지).
 * 동일 문자열 반복 analyze는 메모리 캐시 (로컬 P3).
 * 시나리오 C: 로컬 인스턴스 없으면 remoteCache(서버 prefetch) 사용.
 */
import { getRemoteAnalyze } from './remoteCache.js';
import { getKiwiInstance } from './runtime.js';
import { pickPublicTokens, surfaceMatchesTokens } from './tokens.js';
import { shouldAnalyzeWithKiwi } from './shouldAnalyze.js';

/** @see kiwi-nlp Match.all — 정규화 없음 */
export const KIWI_MATCH_ALL = 8388671;

/** prefetch(≤1200) + 스캔 unique 표면을 담을 여유 */
const MAX_CACHE = 2048;

/** @type {Map<string, { tokens: import('./tokens.js').KiwiToken[], score?: number, surface1to1: boolean }>} */
const resultCache = new Map();

/** @type {unknown} */
let cachedForKiwi = null;

export function clearKiwiAnalyzeCache() {
  resultCache.clear();
  cachedForKiwi = null;
}

/**
 * @param {string} text
 * @param {{ kiwi?: { ready?: () => boolean, analyze: Function } | null, skipCache?: boolean }} [opts]
 * @returns {{ tokens: import('./tokens.js').KiwiToken[], score?: number, surface1to1: boolean } | null}
 */
export function analyzeLine(text, opts = {}) {
  const input = String(text ?? '');
  if (!input) return null;
  if (!shouldAnalyzeWithKiwi(input)) return null;
  const kiwi = opts.kiwi ?? getKiwiInstance();

  if (!kiwi?.ready?.()) {
    return getRemoteAnalyze(input);
  }

  if (kiwi !== cachedForKiwi) {
    resultCache.clear();
    cachedForKiwi = kiwi;
  }

  if (!opts.skipCache && resultCache.has(input)) {
    return resultCache.get(input) ?? null;
  }

  const raw = kiwi.analyze(input, KIWI_MATCH_ALL);
  const tokens = pickPublicTokens(raw?.tokens);
  const result = {
    tokens,
    score: typeof raw?.score === 'number' ? raw.score : undefined,
    surface1to1: surfaceMatchesTokens(input, tokens),
  };

  if (!opts.skipCache) {
    if (resultCache.size >= MAX_CACHE) {
      const oldest = resultCache.keys().next().value;
      if (oldest != null) resultCache.delete(oldest);
    }
    resultCache.set(input, result);
  }
  return result;
}
