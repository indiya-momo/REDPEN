/**
 * 용언 2차 — 테스트용 noop 러너.
 */

/** @typedef {import('./parse.js').PredicateSlmReviewResult} PredicateSlmReviewResult */
/** @typedef {import('./enqueue.js').PredicateSlmReviewRequest} PredicateSlmReviewRequest */

/**
 * @typedef {{
 *   reviewBatch: (
 *     items: PredicateSlmReviewRequest[],
 *     opts?: { mode?: 'predicate' | 'non_predicate' | 'fail' },
 *   ) => Promise<PredicateSlmReviewResult[]>,
 * }} PredicateSlmRunner
 */

/** @type {PredicateSlmRunner} */
export const noopPredicateRunner = {
  async reviewBatch(items, opts = {}) {
    const mode = opts.mode ?? 'predicate';
    return items.map((item) => {
      if (mode === 'fail') {
        return {
          id: item.id,
          isPredicate: true,
          confidence: 'low',
          failed: true,
        };
      }
      if (mode === 'non_predicate') {
        return {
          id: item.id,
          isPredicate: false,
          confidence: 'high',
        };
      }
      return {
        id: item.id,
        isPredicate: true,
        confidence: 'high',
      };
    });
  },
};
