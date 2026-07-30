/**
 * 용언 2차 검토 — 응답 파싱.
 * @see project-docs/unify-predicate-review-slm-design-2026-07-30.md §4
 */

/** @typedef {'high' | 'medium' | 'low'} PredicateSlmConfidence */

/**
 * @typedef {{
 *   id: string,
 *   isPredicate: boolean,
 *   confidence: PredicateSlmConfidence,
 *   reason?: string,
 *   failed?: boolean,
 * }} PredicateSlmReviewResult
 */

const CONFIDENCES = new Set(['high', 'medium', 'low']);

/**
 * @param {string} text
 * @returns {unknown | null}
 */
export function parsePredicateSlmJsonFromText(text) {
  const trimmed = String(text ?? '').trim();
  const start = trimmed.indexOf('{');
  if (start < 0) return null;
  const snippet = trimmed.slice(start);
  const end = snippet.lastIndexOf('}');
  if (end < 0) return null;
  try {
    return JSON.parse(snippet.slice(0, end + 1));
  } catch {
    return null;
  }
}

/**
 * @param {unknown} raw
 * @returns {PredicateSlmReviewResult | null}
 */
export function normalizePredicateSlmResult(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const o = /** @type {Record<string, unknown>} */ (raw);
  const id = String(o.id ?? '').trim();
  if (!id) return null;
  if (typeof o.isPredicate !== 'boolean') return null;
  const confidence = String(o.confidence ?? 'medium').trim();
  if (!CONFIDENCES.has(confidence)) return null;
  return {
    id,
    isPredicate: o.isPredicate,
    confidence: /** @type {PredicateSlmConfidence} */ (confidence),
    ...(typeof o.reason === 'string' && o.reason.trim()
      ? { reason: o.reason.trim() }
      : {}),
  };
}

/**
 * @param {string} text
 * @param {string} expectedId
 * @returns {PredicateSlmReviewResult | null}
 */
export function parsePredicateSlmFromText(text, expectedId) {
  const normalized = normalizePredicateSlmResult(parsePredicateSlmJsonFromText(text));
  if (!normalized) return null;
  if (normalized.id !== expectedId) {
    return { ...normalized, id: expectedId };
  }
  return normalized;
}

/**
 * 파싱·네트워크 실패 — 삭제하지 않고 검토 필요.
 * @param {string} id
 * @returns {PredicateSlmReviewResult}
 */
export function predicateSlmReviewFallback(id) {
  return {
    id,
    isPredicate: true,
    confidence: 'low',
    failed: true,
  };
}

/**
 * 용언 아님으로 목록에서 뺄지 (high + isPredicate false만).
 * @param {PredicateSlmReviewResult | null | undefined} result
 */
export function shouldDropAsNonPredicate(result) {
  return (
    result != null &&
    result.failed !== true &&
    result.isPredicate === false &&
    result.confidence === 'high'
  );
}

/**
 * 실패·불확실 — 목록 유지 + 검토 필요.
 * @param {PredicateSlmReviewResult | null | undefined} result
 */
export function shouldMarkPredicateNeedsReview(result) {
  if (!result) return true;
  if (result.failed) return true;
  if (result.confidence !== 'high') return true;
  return false;
}
