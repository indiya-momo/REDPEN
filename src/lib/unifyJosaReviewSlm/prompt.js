/**
 * 카나나-2 instruct 프롬프트 골격 (스케치 §7.3).
 */

/** @typedef {import('./runner/noopRunner.js').JosaSlmReviewRequest} JosaSlmReviewRequest */

export const JOSA_SLM_SYSTEM_PROMPT = `당신은 한국어 교정 보조입니다. 띄어쓰기 이형태에서 규칙이 제안한 접미가 조사·어미 경계인지, 합성어·고유명 일부인지 판별하세요.
교정안을 쓰지 말고 JSON 객체 하나만 출력하세요.

필드: id (string), isBoundary (boolean), kind (josa_or_suffix | compound_word | uncertain), confidence (high | medium | low), reason (선택).

예시:
입력: id="가치평가가" variant="가치 평가 가" ruleStem="가치평가" ruleSuffix="가"
출력: {"id":"가치평가가","isBoundary":false,"kind":"compound_word","confidence":"high"}

입력: id="활동이며" variant="활동 이며" ruleStem="활동" ruleSuffix="이며"
출력: {"id":"활동이며","isBoundary":true,"kind":"josa_or_suffix","confidence":"high"}`;

/**
 * @param {JosaSlmReviewRequest} req
 * @param {{ contextBefore?: string, contextAfter?: string }} [ctx]
 * @returns {string}
 */
export function buildJosaSlmUserMessage(req, ctx = {}) {
  const before = (ctx.contextBefore ?? req.contextBefore)?.trim() ?? '';
  const after = (ctx.contextAfter ?? req.contextAfter)?.trim() ?? '';
  const contextLine =
    before || after
      ? `contextBefore="${before}" contextAfter="${after}"\n`
      : '';
  return (
    `${contextLine}` +
    `id="${req.id}"\n` +
    `variant="${req.variant}" glued="${req.gluedVariant}"\n` +
    `ruleStem="${req.ruleStem}" ruleSuffix="${req.ruleSuffix}"`
  );
}

/**
 * @param {JosaSlmReviewRequest} req
 * @param {{ contextBefore?: string, contextAfter?: string }} [ctx]
 * @returns {{ role: 'system' | 'user', content: string }[]}
 */
export function buildJosaSlmChatMessages(req, ctx = {}) {
  return [
    { role: 'system', content: JOSA_SLM_SYSTEM_PROMPT },
    { role: 'user', content: buildJosaSlmUserMessage(req, ctx) },
  ];
}
