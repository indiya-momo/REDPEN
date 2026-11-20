import {
  SEARCH_CATEGORY,
  SEARCH_PATTERN_KIND,
} from './types.js';

/**
 * 검색 hit → 기존 결과 카드가 읽는 GroupedResult.
 * 검수·저장·내려받기 경로에 넣지 않는다.
 * @param {import('./types.js').TextHit[]} hits
 * @param {string} query
 * @returns {import('../ruleEngine.js').GroupedResult[]}
 */
export function searchHitsToGroups(hits, query) {
  const find = String(query ?? '').trim();
  if (!find || !hits?.length) return [];
  return [
    {
      find,
      replace: '',
      label: find,
      category: SEARCH_CATEGORY,
      patternKind: SEARCH_PATTERN_KIND,
      cautionId: `manuscript-search:${find}`,
      tip: '',
      instances: hits.map((hit) => ({
        find,
        replace: '',
        matchedText: String(hit.matchedText ?? find),
        suggestedText: '',
        pageNum: hit.pageNum,
        index: hit.start,
        search: true,
      })),
    },
  ];
}
