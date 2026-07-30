/**
 * SLM 추론 서버 endpoint — env·dev 프록시 우선순위.
 * @see project-docs/unify-josa-review-slm-sketch.md §13
 */

/** dev Vite proxy prefix → vLLM :8000 (CORS 회피) */
export const JOSA_SLM_DEV_PROXY_PREFIX = '/api/josa-slm/v1';

/**
 * @param {string} [explicit] createServerRunner opts.endpoint
 * @returns {string}
 */
export function resolveJosaSlmEndpoint(explicit) {
  const fromOpt = String(explicit ?? '').trim();
  if (fromOpt) return fromOpt;

  const fromEnv = String(import.meta.env.VITE_UNIFY_JOSA_SLM_ENDPOINT ?? '').trim();
  if (fromEnv) return fromEnv;

  if (import.meta.env.DEV && import.meta.env.VITE_UNIFY_JOSA_SLM === 'true') {
    return JOSA_SLM_DEV_PROXY_PREFIX;
  }

  return '';
}
