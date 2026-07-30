/**
 * 용언 여부 2차 검토 프롬프트.
 * @see project-docs/unify-predicate-review-slm-design-2026-07-30.md §4
 */

/** @typedef {import('./enqueue.js').PredicateSlmReviewRequest} PredicateSlmReviewRequest */

export const PREDICATE_SLM_SYSTEM_PROMPT = `당신은 한국어 교정 보조입니다. 주어진 표기(또는 계열 어근)가 동사·형용사 등 용언 어간으로 쓰이는지 판별하세요.
의존명사+조사(예: 개+의 → 개의), 일반 명사·고유명·부사는 용언이 아닙니다.
교정안을 쓰지 말고 JSON 객체 하나만 출력하세요.

필드: id (string), isPredicate (boolean), confidence (high | medium | low), reason (선택).

예시:
입력: id="series:prefix:개의" stem="개의"
출력: {"id":"series:prefix:개의","isPredicate":false,"confidence":"high","reason":"의존명사 개+의"}

입력: id="만들어" stem="만들어"
출력: {"id":"만들어","isPredicate":true,"confidence":"high"}`;

/**
 * @param {PredicateSlmReviewRequest} req
 * @returns {string}
 */
export function buildPredicateSlmUserMessage(req) {
  const before = req.contextBefore?.trim() ?? '';
  const after = req.contextAfter?.trim() ?? '';
  const contextLine =
    before || after
      ? `contextBefore="${before}" contextAfter="${after}"\n`
      : '';
  return (
    `${contextLine}` +
    `id="${req.id}"\n` +
    `stem="${req.stem}"\n` +
    `kind="${req.kind}"` +
    (req.sampleVariant ? `\nsampleVariant="${req.sampleVariant}"` : '')
  );
}

/**
 * @param {PredicateSlmReviewRequest} req
 * @returns {{ role: 'system' | 'user', content: string }[]}
 */
export function buildPredicateSlmChatMessages(req) {
  return [
    { role: 'system', content: PREDICATE_SLM_SYSTEM_PROMPT },
    { role: 'user', content: buildPredicateSlmUserMessage(req) },
  ];
}
