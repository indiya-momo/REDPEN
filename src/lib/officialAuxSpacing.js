/**
 * 세종 S2-2-8a·8c · 맞춤법 제47항 쪽 — 보조용언 띄어쓰기 (고시·PR #3 골든).
 * 세종 하우스「어/아+보조 무조건 붙임」과 축이 다름. 여기는 고시 표면만.
 * F10–F14 닫힌 FIX. Kiwi 없음. ruleEngine 비부착.
 */

export const OFFICIAL_AUX_CATEGORY = '보조용언';
export const OFFICIAL_AUX_LABEL = '보조용언(고시)';
export const OFFICIAL_AUX_TIP =
  '맞춤법 제47항: -지 말다 등은 띄어 쓰고, -아/어+보조는 띄어·붙여 모두 허용합니다.';

/** 긴 것 우선 */
const FIX_ROWS = [
  { find: '어루만져주세요', replace: '어루만져 주세요' },
  { find: '도와드려보다', replace: '도와드려 보다' },
  { find: '해보이', replace: '해 보이' },
  { find: '뛰지말라', replace: '뛰지 말라' },
  { find: '하지말라', replace: '하지 말라' },
  { find: '가지말라', replace: '가지 말라' },
  { find: '먹지말라', replace: '먹지 말라' },
  { find: '보지말라', replace: '보지 말라' },
];

/** 이미 허용된 표기 — 제안하지 않음(점유만) */
const KEEP_SURFACES = ['먹어 보다', '먹어보다', '도와 드려 보다', '도와드려 보다'];

/**
 * @param {string} text
 * @returns {{ index: number, matchedText: string, suggestedText: string, kind: string }[]}
 */
export function findOfficialAuxSpacingHits(text) {
  if (!text) return [];
  /** @type {{ index: number, matchedText: string, suggestedText: string, kind: string }[]} */
  const hits = [];
  const occupied = [];

  const overlaps = (start, end) =>
    occupied.some(([a, b]) => start < b && end > a);

  for (const keep of KEEP_SURFACES) {
    let from = 0;
    while (from < text.length) {
      const idx = text.indexOf(keep, from);
      if (idx === -1) break;
      occupied.push([idx, idx + keep.length]);
      from = idx + keep.length;
    }
  }

  const rows = [...FIX_ROWS].sort((a, b) => b.find.length - a.find.length);
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
          kind: 'aux-space',
        });
      }
      from = end;
    }
  }

  // F12: …나봐 → …나 봐 (그랬나봐·좋았나봐·었나봐)
  {
    const re = /([가-힣]*나봐)/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      const matchedText = m[1];
      if (!matchedText.endsWith('나봐')) continue;
      const start = m.index;
      const end = start + matchedText.length;
      if (overlaps(start, end)) continue;
      occupied.push([start, end]);
      hits.push({
        index: start,
        matchedText,
        suggestedText: matchedText.replace(/나봐$/, '나 봐'),
        kind: 'aux-space',
      });
    }
  }

  hits.sort((a, b) => a.index - b.index);
  return hits;
}

/**
 * @param {{ pageNum: number, text?: string }[]} pages
 */
export function findOfficialAuxSpacingInPages(pages) {
  /** @type {{ pageNum: number, index: number, matchedText: string, suggestedText: string, kind: string }[]} */
  const out = [];
  for (const page of pages ?? []) {
    const text = String(page?.text ?? '');
    if (!text) continue;
    for (const hit of findOfficialAuxSpacingHits(text)) {
      out.push({ pageNum: page.pageNum, ...hit });
    }
  }
  return out;
}
