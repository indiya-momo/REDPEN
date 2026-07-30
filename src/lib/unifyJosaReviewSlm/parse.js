/**
 * SLM 응답 파싱·배지 승격 조건 (스케치 §3.3).
 */

/**
 * @typedef {'josa_or_suffix' | 'compound_word' | 'uncertain'} JosaSlmKind
 * @typedef {'high' | 'medium' | 'low'} JosaSlmConfidence
 */

/**
 * @typedef {{
 *   id: string,
 *   isBoundary: boolean,
 *   kind: JosaSlmKind,
 *   confidence: JosaSlmConfidence,
 *   reason?: string,
 * }} JosaSlmReviewResult
 */

const KINDS = new Set(['josa_or_suffix', 'compound_word', 'uncertain']);
const CONFIDENCES = new Set(['high', 'medium', 'low']);

/**
 * 모델 출력 텍스트에서 JSON 객체 1개 추출.
 * @param {string} text
 * @returns {unknown | null}
 */
export function parseSlmReviewJsonFromText(text) {
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
 * @param {string} text
 * @param {string} expectedId
 * @returns {JosaSlmReviewResult | null}
 */
export function parseSlmReviewFromText(text, expectedId) {
  const raw = parseSlmReviewJsonFromText(text);
  const normalized = normalizeSlmReviewResult(raw);
  if (!normalized) return null;
  if (normalized.id !== expectedId) {
    return { ...normalized, id: expectedId };
  }
  return normalized;
}

/**
 * @param {string} id
 * @returns {JosaSlmReviewResult}
 */
export function slmReviewFallback(id) {
  return {
    id,
    isBoundary: true,
    kind: 'uncertain',
    confidence: 'low',
  };
}

/**
 * @param {unknown} raw
 * @returns {JosaSlmReviewResult | null}
 */
export function normalizeSlmReviewResult(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const o = /** @type {Record<string, unknown>} */ (raw);
  const id = String(o.id ?? '').trim();
  if (!id) return null;
  const kind = String(o.kind ?? '').trim();
  const confidence = String(o.confidence ?? '').trim();
  if (!KINDS.has(kind) || !CONFIDENCES.has(confidence)) return null;
  return {
    id,
    isBoundary: o.isBoundary === true,
    kind: /** @type {JosaSlmKind} */ (kind),
    confidence: /** @type {JosaSlmConfidence} */ (confidence),
    ...(typeof o.reason === 'string' && o.reason.trim()
      ? { reason: o.reason.trim() }
      : {}),
  };
}

/**
 * @param {JosaSlmReviewResult | null | undefined} result
 * @returns {boolean}
 */
export function shouldPromoteJosaReview(result) {
  return (
    result?.isBoundary === true &&
    result.kind === 'josa_or_suffix' &&
    result.confidence === 'high'
  );
}
