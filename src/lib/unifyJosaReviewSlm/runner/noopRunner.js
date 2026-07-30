/**
 * SLM 미연동 테스트·골격용 러너. 모델 호출 없음.
 */

/**
 * @typedef {import('../parse.js').JosaSlmReviewResult} JosaSlmReviewResult
 */

/**
 * @typedef {{
 *   id: string,
 *   variant?: string,
 *   gluedVariant?: string,
 *   ruleStem?: string,
 *   ruleSuffix?: string,
 *   contextBefore?: string,
 *   contextAfter?: string,
 * }} JosaSlmReviewRequest
 */

/**
 * @typedef {{
 *   reviewBatch: (
 *     items: JosaSlmReviewRequest[],
 *     opts?: { mode?: 'approve' | 'reject' },
 *   ) => Promise<JosaSlmReviewResult[]>,
 * }} JosaSlmRunner
 */

/** @type {JosaSlmRunner} */
export const noopRunner = {
  async reviewBatch(items, opts = {}) {
    const mode = opts.mode ?? 'approve';
    return items.map((item) => {
      if (mode === 'reject') {
        return {
          id: item.id,
          isBoundary: false,
          kind: 'compound_word',
          confidence: 'high',
        };
      }
      return {
        id: item.id,
        isBoundary: true,
        kind: 'josa_or_suffix',
        confidence: 'high',
      };
    });
  },
};
