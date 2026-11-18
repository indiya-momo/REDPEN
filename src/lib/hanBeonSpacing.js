/**
 * 세종 S2-2-2e — 한 번(횟수·강조) 띄어 / 한번(막연) 붙여.
 * 고확신 닫힌 표면만. 「다시 한번」일괄 붙임은 출판사 고유(하우스)라 여기 넣지 않음.
 * ruleEngine 비부착.
 */

export const HAN_BEON_CATEGORY = '한 번';
export const HAN_BEON_LABEL = '한 번/한번';
export const HAN_BEON_TIP =
  '횟수·강조는 「한 번」, 막연한 경우는 「한번」으로 씁니다.';

/** 횟수·강조 — 붙여 쓴 오류 → 띄어 */
const COUNT_SPLIT = [
  { find: '단한번', replace: '단 한 번' },
  { find: '단 한번', replace: '단 한 번' },
  { find: '딱한번', replace: '딱 한 번' },
  { find: '딱 한번', replace: '딱 한 번' },
  { find: '단한번도', replace: '단 한 번도' },
  { find: '한번도 없', replace: '한 번도 없' },
];

/**
 * @param {string} text
 * @returns {{ index: number, matchedText: string, suggestedText: string, kind: string }[]}
 */
export function findHanBeonSpacingHits(text) {
  if (!text) return [];
  /** @type {{ index: number, matchedText: string, suggestedText: string, kind: string }[]} */
  const hits = [];
  const occupied = [];

  const overlaps = (start, end) =>
    occupied.some(([a, b]) => start < b && end > a);

  // 긴 find 우선
  const rows = [...COUNT_SPLIT].sort((a, b) => b.find.length - a.find.length);

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
          kind: 'count-한-번',
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
export function findHanBeonSpacingInPages(pages) {
  /** @type {{ pageNum: number, index: number, matchedText: string, suggestedText: string, kind: string }[]} */
  const out = [];
  for (const page of pages ?? []) {
    const text = String(page?.text ?? '');
    if (!text) continue;
    for (const hit of findHanBeonSpacingHits(text)) {
      out.push({ pageNum: page.pageNum, ...hit });
    }
  }
  return out;
}
