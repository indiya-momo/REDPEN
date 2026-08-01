/**
 * Kiwi 서버 analyze endpoint 해석 (시나리오 C).
 */
import { KIWI_ANALYZE_PATH } from './serverContract.js';
import {
  isSpellingKiwiBoundaryEnabled,
  isUnifyKiwiJosaEnabled,
} from '../featureFlags.js';

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

  // DEV + Kiwi 플래그 → Vite kiwiAnalyzeDevPlugin
  if (
    import.meta.env.DEV &&
    (isUnifyKiwiJosaEnabled() || isSpellingKiwiBoundaryEnabled())
  ) {
    return KIWI_ANALYZE_PATH;
  }

  return '';
}
