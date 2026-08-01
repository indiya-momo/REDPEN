/**
 * Kiwi 서버 analyze endpoint 해석 (시나리오 C).
 */
import { KIWI_ANALYZE_PATH } from './serverContract.js';

/**
 * @param {string} [explicit]
 * @returns {string}
 */
export function resolveKiwiAnalyzeEndpoint(explicit) {
  const fromOpt = String(explicit ?? '').trim();
  if (fromOpt) return fromOpt;

  const fromEnv = String(
    import.meta.env.VITE_KIWI_ANALYZE_ENDPOINT ?? '',
  ).trim();
  if (fromEnv) return fromEnv;

  // DEV: Vite kiwiAnalyzeDevPlugin — 표기통일 잡음 제외가 플래그 없이 부트하므로
  // 서버 path는 플래그와 무관하게 노출 (ping 실패 시 wasm 폴백).
  if (import.meta.env.DEV) {
    return KIWI_ANALYZE_PATH;
  }

  return '';
}
