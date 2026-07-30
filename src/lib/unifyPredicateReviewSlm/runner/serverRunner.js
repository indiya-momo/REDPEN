/**
 * 용언 2차 — HTTP runner (조사 SLM과 동일 엔드포인트·모델).
 */

import { buildPredicateSlmChatMessages } from '../prompt.js';
import {
  parsePredicateSlmFromText,
  predicateSlmReviewFallback,
} from '../parse.js';
import {
  DEFAULT_JOSA_SLM_MODEL,
  extractAssistantContent,
} from '../../unifyJosaReviewSlm/runner/serverRunner.js';
import { resolveJosaSlmEndpoint } from '../../unifyJosaReviewSlm/resolveEndpoint.js';

/** @typedef {import('../parse.js').PredicateSlmReviewResult} PredicateSlmReviewResult */
/** @typedef {import('../enqueue.js').PredicateSlmReviewRequest} PredicateSlmReviewRequest */
/** @typedef {import('./noopRunner.js').PredicateSlmRunner} PredicateSlmRunner */

/**
 * @param {{
 *   endpoint?: string,
 *   model?: string,
 *   fetchImpl?: typeof fetch,
 *   timeoutMs?: number,
 * }} [opts]
 * @returns {PredicateSlmRunner}
 */
export function createPredicateServerRunner(opts = {}) {
  const endpoint = resolveJosaSlmEndpoint(opts.endpoint);
  const model = opts.model?.trim() || DEFAULT_JOSA_SLM_MODEL;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 15_000;

  return {
    async reviewBatch(items) {
      if (!endpoint) {
        return items.map((item) => predicateSlmReviewFallback(item.id));
      }

      /** @type {PredicateSlmReviewResult[]} */
      const results = [];
      for (const item of items) {
        try {
          const messages = buildPredicateSlmChatMessages(item);
          const response = await fetchImpl(
            `${endpoint.replace(/\/$/, '')}/chat/completions`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model,
                messages,
                temperature: 0,
                max_tokens: 128,
              }),
              signal: AbortSignal.timeout(timeoutMs),
            },
          );
          if (!response.ok) {
            results.push(predicateSlmReviewFallback(item.id));
            continue;
          }
          const body = await response.json();
          const text = extractAssistantContent(body);
          results.push(
            parsePredicateSlmFromText(text, item.id) ??
              predicateSlmReviewFallback(item.id),
          );
        } catch {
          results.push(predicateSlmReviewFallback(item.id));
        }
      }
      return results;
    },
  };
}
