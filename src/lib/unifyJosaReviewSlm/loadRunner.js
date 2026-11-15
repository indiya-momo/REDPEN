/**
 * 2차 SLM 필터 ON일 때 serverRunner 동적 로드 (번들 분리).
 * SLM = 카나나 모델. serverRunner = 추론 서버 HTTP 클라이언트.
 */

import { isUnifyJosaSlmReviewEnabled } from '../featureFlags.js';

/** CPU 카나나 1건은 약 12–16초. 로컬 DEV 기본은 한 건이 타임아웃으로 잘리지 않게. */
export const JOSA_SLM_DEV_TIMEOUT_MS = 60_000;

/** 플래그를 켠 비-DEV 기본. 운영 플래그 기본은 꺼져 있어 이 값이 찾기 경로에 쓰이지 않는다. */
export const JOSA_SLM_PROD_TIMEOUT_MS = 15_000;

/**
 * 명시 env가 있으면 그 값. 없으면 DEV 60초, 그 외 15초.
 * 서버가 꺼져 있으면 serverRunner가 2초 ping에서 바로 fallback 하므로
 * DEV 60초가 미기동×건수만큼 쌓이지 않는다.
 * @param {ImportMetaEnv} [env]
 * @returns {number}
 */
export function resolveJosaSlmTimeoutMs(env = import.meta.env) {
  const timeoutRaw = String(env.VITE_UNIFY_JOSA_SLM_TIMEOUT_MS ?? '').trim();
  if (timeoutRaw) {
    const n = Number(timeoutRaw);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return env.DEV ? JOSA_SLM_DEV_TIMEOUT_MS : JOSA_SLM_PROD_TIMEOUT_MS;
}

/**
 * @returns {Promise<{ runner: import('./runner/noopRunner.js').JosaSlmRunner, slmModel: string } | null>}
 */
export async function loadJosaSlmRunnerIfEnabled() {
  if (!isUnifyJosaSlmReviewEnabled()) return null;
  const { createServerRunner, DEFAULT_JOSA_SLM_MODEL } = await import(
    './runner/serverRunner.js'
  );
  return {
    runner: createServerRunner({
      timeoutMs: resolveJosaSlmTimeoutMs(),
    }),
    slmModel: DEFAULT_JOSA_SLM_MODEL,
  };
}
