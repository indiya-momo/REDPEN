/**
 * Match.all (비정규화)로 한 줄 분석. typo 미사용.
 * kiwi-nlp 패키지를 static import하지 않음 (브라우저 번들 오염 방지).
 * Match.all = 8388671 (kiwi-nlp Match enum)
 */
import { getKiwiInstance } from './runtime.js';
import { pickPublicTokens, surfaceMatchesTokens } from './tokens.js';

/** @see kiwi-nlp Match.all — 정규화 없음 */
export const KIWI_MATCH_ALL = 8388671;

/**
 * @param {string} text
 * @param {{ kiwi?: { ready?: () => boolean, analyze: Function } | null }} [opts]
 * @returns {{ tokens: import('./tokens.js').KiwiToken[], score?: number, surface1to1: boolean } | null}
 */
export function analyzeLine(text, opts = {}) {
  const input = String(text ?? '');
  if (!input) return null;
  const kiwi = opts.kiwi ?? getKiwiInstance();
  if (!kiwi?.ready?.()) return null;

  const raw = kiwi.analyze(input, KIWI_MATCH_ALL);
  const tokens = pickPublicTokens(raw?.tokens);
  return {
    tokens,
    score: typeof raw?.score === 'number' ? raw.score : undefined,
    surface1to1: surfaceMatchesTokens(input, tokens),
  };
}
