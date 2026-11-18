/**
 * 세종 S2-2-45 — 다음날(막연) / 다음 날(이튿날).
 * 문맥 의존 → 이튿날 힌트가 분명할 때만 confirm.
 * ruleEngine 비부착.
 */

export const DAEUM_NAL_CATEGORY = '다음 날';
export const DAEUM_NAL_LABEL = '다음날/다음 날';
export const DAEUM_NAL_TIP =
  '이튿날을 가리킬 때는 「다음 날」, 막연하면 「다음날」입니다.';

/** 이튿날 힌트 + 다음날 붙임 → 다음 날 */
const ANCHOR_RE =
  /((?:그|이|저|생일|결혼식|개업|입학|졸업|개막|폐막|공연|회의|시합|경기|여행|출장|입원|수술)(?:\s*)다음날)/g;

/**
 * @param {string} text
 * @returns {{ index: number, matchedText: string, suggestedText: string, kind: string }[]}
 */
export function findDaeumNalSpacingHits(text) {
  if (!text) return [];
  /** @type {{ index: number, matchedText: string, suggestedText: string, kind: string }[]} */
  const hits = [];
  const occupied = [];

  const overlaps = (start, end) =>
    occupied.some(([a, b]) => start < b && end > a);

  let m;
  const re = new RegExp(ANCHOR_RE.source, 'g');
  while ((m = re.exec(text)) !== null) {
    const matchedText = m[1];
    if (!matchedText.includes('다음날')) continue;
    const start = m.index;
    const end = start + matchedText.length;
    if (overlaps(start, end)) continue;
    // "그다음날" → "그 다음 날", "그 다음날" → "그 다음 날"
    const fixed = matchedText.replace(/\s*다음날$/, '').trimEnd();
    const suggest = `${fixed} 다음 날`;
    occupied.push([start, end]);
    hits.push({
      index: start,
      matchedText,
      suggestedText: suggest,
      kind: 'confirm-다음-날',
    });
  }

  hits.sort((a, b) => a.index - b.index);
  return hits;
}

/**
 * @param {{ pageNum: number, text?: string }[]} pages
 */
export function findDaeumNalSpacingInPages(pages) {
  /** @type {{ pageNum: number, index: number, matchedText: string, suggestedText: string, kind: string }[]} */
  const out = [];
  for (const page of pages ?? []) {
    const text = String(page?.text ?? '');
    if (!text) continue;
    for (const hit of findDaeumNalSpacingHits(text)) {
      out.push({ pageNum: page.pageNum, ...hit });
    }
  }
  return out;
}
