/**
 * 골든셋·회귀 테스트용 SLM 러너 — id별 고정 응답.
 */

/**
 * @typedef {import('../parse.js').JosaSlmReviewResult} JosaSlmReviewResult
 */

/**
 * @typedef {import('./noopRunner.js').JosaSlmReviewRequest} JosaSlmReviewRequest
 * @typedef {import('./noopRunner.js').JosaSlmRunner} JosaSlmRunner
 */

/**
 * @param {Record<string, JosaSlmReviewResult | null | undefined>} responsesById
 * id가 없거나 값이 null이면 uncertain/low로 응답(SLM 실패·누락 시뮬).
 * @returns {JosaSlmRunner}
 */
export function createGoldenRunner(responsesById) {
  return {
    async reviewBatch(items) {
      return items.map((item) => {
        if (!Object.prototype.hasOwnProperty.call(responsesById, item.id)) {
          return {
            id: item.id,
            isBoundary: true,
            kind: 'uncertain',
            confidence: 'low',
          };
        }
        const fixed = responsesById[item.id];
        if (!fixed) {
          return {
            id: item.id,
            isBoundary: true,
            kind: 'uncertain',
            confidence: 'low',
          };
        }
        return { ...fixed, id: item.id };
      });
    },
  };
}
