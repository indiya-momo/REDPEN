/**
 * 세종 S2-3-5·6 — 외자 접미(-인/-어/-교 등)·동서남북·중앙+외국 지명 붙임.
 * 잘못 띈 닫힌 표면만. ruleEngine 비부착.
 */

export const PLACE_AFFIX_CATEGORY = '지명·접미';
export const PLACE_AFFIX_LABEL = '지명·외자 접미 붙임';
export const PLACE_AFFIX_TIP =
  '세종·맞춤법: 외자 접미와 동·서·남·북·중앙이 붙은 외국 지명은 붙여 씁니다.';

const ATTACH_ROWS = [
  // S2-3-6 예
  { find: '동 로마', replace: '동로마' },
  { find: '서 베를린', replace: '서베를린' },
  { find: '남 아메리카', replace: '남아메리카' },
  { find: '북 아프리카', replace: '북아프리카' },
  { find: '중앙 아시아', replace: '중앙아시아' },
  // 흔한 외자 접미 오분
  { find: '한국 인', replace: '한국인' },
  { find: '일본 어', replace: '일본어' },
  { find: '기독 교', replace: '기독교' },
  { find: '불교 도', replace: '불교도' },
];

/**
 * @param {string} text
 * @returns {{ index: number, matchedText: string, suggestedText: string, kind: string }[]}
 */
export function findPlaceAffixSpacingHits(text) {
  if (!text) return [];
  /** @type {{ index: number, matchedText: string, suggestedText: string, kind: string }[]} */
  const hits = [];
  const occupied = [];

  const overlaps = (start, end) =>
    occupied.some(([a, b]) => start < b && end > a);

  const rows = [...ATTACH_ROWS].sort((a, b) => b.find.length - a.find.length);
  for (const row of rows) {
    let from = 0;
    while (from < text.length) {
      const idx = text.indexOf(row.find, from);
      if (idx === -1) break;
      const end = idx + row.find.length;
      if (!overlaps(idx, end)) {
        occupied.push([idx, end]);
        hits.push({
          index: idx,
          matchedText: row.find,
          suggestedText: row.replace,
          kind: 'place-attach',
        });
      }
      from = end;
    }
  }

  hits.sort((a, b) => a.index - b.index);
  return hits;
}

/**
 * @param {{ pageNum: number, text?: string }[]} pages
 */
export function findPlaceAffixSpacingInPages(pages) {
  /** @type {{ pageNum: number, index: number, matchedText: string, suggestedText: string, kind: string }[]} */
  const out = [];
  for (const page of pages ?? []) {
    const text = String(page?.text ?? '');
    if (!text) continue;
    for (const hit of findPlaceAffixSpacingHits(text)) {
      out.push({ pageNum: page.pageNum, ...hit });
    }
  }
  return out;
}
