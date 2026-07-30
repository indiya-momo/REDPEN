/**
 * 용언 2차 ON일 때 serverRunner 동적 로드.
 */

import { isUnifyPredicateSlmReviewEnabled } from '../featureFlags.js';
import { DEFAULT_JOSA_SLM_MODEL } from '../unifyJosaReviewSlm/runner/serverRunner.js';

/**
 * @returns {Promise<{ runner: import('./runner/noopRunner.js').PredicateSlmRunner, slmModel: string } | null>}
 */
export async function loadPredicateSlmRunnerIfEnabled() {
  if (!isUnifyPredicateSlmReviewEnabled()) return null;
  const { createPredicateServerRunner } = await import(
    './runner/serverRunner.js'
  );
  const timeoutRaw = String(
    import.meta.env.VITE_UNIFY_PREDICATE_SLM_TIMEOUT_MS ??
      import.meta.env.VITE_UNIFY_JOSA_SLM_TIMEOUT_MS ??
      '',
  ).trim();
  const timeoutMs = timeoutRaw
    ? Number(timeoutRaw)
    : import.meta.env.DEV
      ? 180_000
      : 15_000;
  return {
    runner: createPredicateServerRunner({
      timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : 180_000,
    }),
    slmModel: DEFAULT_JOSA_SLM_MODEL,
  };
}
