/**
 * PR #3「-ㄴ지 기간 문맥」— 의존명사 「지」띄어쓰기 (고확신).
 * F05 떠난지 오래 → 떠난 지 오래 / F06 온지 3년 → 온 지 3년
 * 막연 의문(어떤지)은 기간 문맥이 없어 미검출.
 * ruleEngine 비부착.
 */

export const N_JI_DURATION_CATEGORY = '-ㄴ지 기간';
export const N_JI_DURATION_LABEL = '-ㄴ지 기간 띄어쓰기';
export const N_JI_DURATION_TIP =
  '기간을 나타내는 의존명사 「지」는 관형사형 뒤에서 띄어 씁니다.';

/**
 * @param {string} text
 * @returns {{ index: number, matchedText: string, suggestedText: string, kind: string }[]}
 */
export function findNJiDurationSpacingHits(text) {
  if (!text) return [];
  /** @type {{ index: number, matchedText: string, suggestedText: string, kind: string }[]} */
  const hits = [];
  const occupied = [];

  const overlaps = (start, end) =>
    occupied.some(([a, b]) => start < b && end > a);

  // 관형 어미성 끝 + 지 + 기간 힌트
  const re =
    /((?:떠난|온|간|된|한|인|난|지난|도착한|시작한|끝난|태어난)지)(?=\s*(?:오래|오래되|오래됐|됐|되었|지났|만|쯤|정도|\d))/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const matchedText = m[1];
    const start = m.index;
    const end = start + matchedText.length;
    if (overlaps(start, end)) continue;
    const suggestedText = `${matchedText.slice(0, -1)} 지`;
    occupied.push([start, end]);
    hits.push({
      index: start,
      matchedText,
      suggestedText,
      kind: 'duration-지',
    });
  }

  hits.sort((a, b) => a.index - b.index);
  return hits;
}

/**
 * @param {{ pageNum: number, text?: string }[]} pages
 */
export function findNJiDurationSpacingInPages(pages) {
  /** @type {{ pageNum: number, index: number, matchedText: string, suggestedText: string, kind: string }[]} */
  const out = [];
  for (const page of pages ?? []) {
    const text = String(page?.text ?? '');
    if (!text) continue;
    for (const hit of findNJiDurationSpacingHits(text)) {
      out.push({ pageNum: page.pageNum, ...hit });
    }
  }
  return out;
}
