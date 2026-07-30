/**
 * 2차 SLM 필터 ON일 때 serverRunner 동적 로드 (번들 분리).
 * SLM = 카나나 모델. serverRunner = 추론 서버 HTTP 클라이언트.
 */

import { isUnifyJosaSlmReviewEnabled } from '../featureFlags.js';

/**
 * @returns {Promise<{ runner: import('./runner/noopRunner.js').JosaSlmRunner, slmModel: string } | null>}
 */
export async function loadJosaSlmRunnerIfEnabled() {
  if (!isUnifyJosaSlmReviewEnabled()) return null;
  const { createServerRunner, DEFAULT_JOSA_SLM_MODEL } = await import(
    './runner/serverRunner.js'
  );
  const timeoutRaw = String(import.meta.env.VITE_UNIFY_JOSA_SLM_TIMEOUT_MS ?? '').trim();
  const timeoutMs = timeoutRaw
    ? Number(timeoutRaw)
    : import.meta.env.DEV
      ? 180_000
      : 15_000;
  return {
    runner: createServerRunner({ timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : 180_000 }),
    slmModel: DEFAULT_JOSA_SLM_MODEL,
  };
}
