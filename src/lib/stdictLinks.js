/**
 * 표준국어대사전 링크 — 결과 카드 고칠 말 → 공식 사전 화면.
 *
 * 주소 형식은 이 파일 한 곳에만 둔다(설계안 §4).
 * 색인(public/data/stdict-link-index.json)은 호출하는 쪽이 넘긴다. 이 파일은 읽기·쓰기를 하지 않는다.
 *
 * 출처: 국립국어원 표준국어대사전 (CC BY-SA 2.0 KR)
 */

/** 사전 첫 화면(묶음 제목 링크용) */
export const STDICT_MAIN_URL = 'https://kdict.korean.go.kr/standard/main/main.do';

const STDICT_VIEW_URL = 'https://kdict.korean.go.kr/standard/search/searchView.do';
const STDICT_SEARCH_URL = 'https://kdict.korean.go.kr/standard/search/searchResult.do';

/**
 * 표제어 직결 화면.
 * @param {number | string} targetCode 사전 target_code
 */
export function stdictViewUrl(targetCode) {
  return `${STDICT_VIEW_URL}?wordNo=${encodeURIComponent(String(targetCode))}&searchKeywordTo=3`;
}

/**
 * 검색 결과 화면(후보가 여러 개일 때).
 * @param {string} word 고칠 말
 */
export function stdictSearchUrl(word) {
  return `${STDICT_SEARCH_URL}?pageSize=10&searchKeyword=${encodeURIComponent(word)}`;
}

/**
 * 고칠 말 하나에 대한 링크 판정.
 * - 후보 1개 → 직결 (direct)
 * - 후보 여러 개 → 검색 (search)
 * - 색인에 없음 → 링크 없음 (none)
 *
 * @param {string} correction 고칠 말(색인 키)
 * @param {Record<string, number[]> | null | undefined} index 색인의 entries
 * @param {{ fallback?: 'search', wordNo?: number | string }} [opts]
 *   wordNo가 있으면 그 항으로 직결한다. fallback은 색인에 없을 때 검색 화면으로 보낼지.
 * @returns {{ kind: 'direct', url: string, codes: number[] }
 *   | { kind: 'search', url: string, codes: number[] }
 *   | { kind: 'none' }}
 */
export function stdictLinkFor(correction, index, opts = {}) {
  if (opts.wordNo != null && opts.wordNo !== '') {
    const n = Number(opts.wordNo);
    if (Number.isFinite(n)) {
      return { kind: 'direct', url: stdictViewUrl(n), codes: [n] };
    }
  }
  const word = String(correction ?? '').trim();
  const codes = index?.[word];
  if (Array.isArray(codes) && codes.length === 1) {
    return { kind: 'direct', url: stdictViewUrl(codes[0]), codes };
  }
  if (Array.isArray(codes) && codes.length > 1) {
    return { kind: 'search', url: stdictSearchUrl(word), codes };
  }
  if (opts.fallback === 'search' && word) {
    return { kind: 'search', url: stdictSearchUrl(word), codes: [] };
  }
  return { kind: 'none' };
}
