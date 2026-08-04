/**
 * 조사·어간 2차 SLM 필터 — HTTP runner.
 * 앱 → serverRunner → **추론 서버**(vLLM·transformers 등) → **SLM**(카나나-2).
 * vLLM은 추론 서버 이름이며 SLM/LLM 모델이 아님.
 * @see project-docs/unify-josa-review-slm-sketch.md §0·§7.2
 */

import { buildJosaSlmChatMessages } from '../prompt.js';
import {
  parseSlmReviewFromText,
  slmReviewFallback,
} from '../parse.js';
import { resolveJosaSlmEndpoint } from '../resolveEndpoint.js';

/** @typedef {import('../parse.js').JosaSlmReviewResult} JosaSlmReviewResult */
/** @typedef {import('./noopRunner.js').JosaSlmReviewRequest} JosaSlmReviewRequest */
/** @typedef {import('./noopRunner.js').JosaSlmRunner} JosaSlmRunner */

export const DEFAULT_JOSA_SLM_MODEL = 'kakaocorp/kanana-2-1.3b-instruct'; // SLM 가중치 ID (vLLM 아님)

/**
 * @typedef {{
 *   endpoint?: string,
 *   model?: string,
 *   fetchImpl?: typeof fetch,
 *   timeoutMs?: number,
 *   contextById?: Record<string, { contextBefore?: string, contextAfter?: string }>,
 * }} ServerRunnerOptions
 */

/**
 * @param {unknown} body
 * @returns {string}
 */
export function extractAssistantContent(body) {
  if (!body || typeof body !== 'object') return '';
  const choices = /** @type {{ choices?: unknown[] }} */ (body).choices;
  const first = choices?.[0];
  if (!first || typeof first !== 'object') return '';
  const message = /** @type {{ message?: { content?: unknown } }} */ (first).message;
  const content = message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) =>
        part && typeof part === 'object' && 'text' in part ? String(part.text ?? '') : '',
      )
      .join('');
  }
  return '';
}

/**
 * @param {ServerRunnerOptions} [opts]
 * @returns {JosaSlmRunner}
 */
export function createServerRunner(opts = {}) {
  const endpoint = resolveJosaSlmEndpoint(opts.endpoint);
  const model = opts.model?.trim() || DEFAULT_JOSA_SLM_MODEL;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 15_000;
  const contextById = opts.contextById ?? {};

  return {
    async reviewBatch(items) {
      if (!endpoint || !items?.length) {
        return (items ?? []).map((item) => slmReviewFallback(item.id));
      }

      // 서버 미기동 시 항목마다 긴 timeout 대기하지 않음 (DEV 기본 180s×N 방지)
      try {
        const ping = await fetchImpl(`${endpoint.replace(/\/$/, '')}/models`, {
          method: 'GET',
          signal: AbortSignal.timeout(2_000),
        });
        if (!ping.ok) {
          return items.map((item) => slmReviewFallback(item.id));
        }
      } catch {
        return items.map((item) => slmReviewFallback(item.id));
      }

      /** @type {JosaSlmReviewResult[]} */
      const results = [];
      for (const item of items) {
        try {
          const ctx = contextById[item.id];
          const messages = buildJosaSlmChatMessages(item, {
            contextBefore: item.contextBefore ?? ctx?.contextBefore,
            contextAfter: item.contextAfter ?? ctx?.contextAfter,
          });
          const response = await fetchImpl(`${endpoint.replace(/\/$/, '')}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model,
              messages,
              temperature: 0,
              max_tokens: 128,
            }),
            signal: AbortSignal.timeout(timeoutMs),
          });
          if (!response.ok) {
            results.push(slmReviewFallback(item.id));
            continue;
          }
          const body = await response.json();
          const text = extractAssistantContent(body);
          results.push(parseSlmReviewFromText(text, item.id) ?? slmReviewFallback(item.id));
        } catch {
          results.push(slmReviewFallback(item.id));
        }
      }
      return results;
    },
  };
}
