/**
 * 세종 S2-2-10 — -ㄹ까 보다 · -나 보다 등 띄어쓰기 (닫힌 표면).
 * 예) 할까보다 → 할까 보다 / 가는가보다 → 가는가 보다
 * 「별수 없이」「말수」「살수차」등 ㄹ 수 명사는 이 모듈 범위 밖(미검출=KEEP).
 * ruleEngine 비부착.
 */

export const RIEUL_KKA_BODA_CATEGORY = 'ㄹ까 보다';
export const RIEUL_KKA_BODA_LABEL = '-ㄹ까 보다 띄어쓰기';
export const RIEUL_KKA_BODA_TIP =
  "한글 맞춤법 제47항: 보조 용언 앞에 '-(으)ㄴ가, -나, -는가, -(으)ㄹ까' 등 종결 어미가 있으면 보조 용언은 앞말에 붙여 쓰지 않습니다. 예) -ㄹ까 보다 → 갈까 보다";

const ROWS = [
  { find: '할까보다', replace: '할까 보다' },
  { find: '갈까보다', replace: '갈까 보다' },
  { find: '볼까보다', replace: '볼까 보다' },
  { find: '줄까보다', replace: '줄까 보다' },
  { find: '올까보다', replace: '올까 보다' },
  { find: '살까보다', replace: '살까 보다' },
  { find: '될까보다', replace: '될까 보다' },
  { find: '가는가보다', replace: '가는가 보다' },
  { find: '오려나보다', replace: '오려나 보다' },
  { find: '했나보다', replace: '했나 보다' },
  { find: '인가보다', replace: '인가 보다' },
];

/**
 * @param {string} text
 * @returns {{ index: number, matchedText: string, suggestedText: string, kind: string }[]}
 */
export function findRieulKkaBodaSpacingHits(text) {
  if (!text) return [];
  /** @type {{ index: number, matchedText: string, suggestedText: string, kind: string }[]} */
  const hits = [];
  const occupied = [];

  const overlaps = (start, end) =>
    occupied.some(([a, b]) => start < b && end > a);

  for (const row of ROWS) {
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
          kind: 'ㄹ까보다',
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
export function findRieulKkaBodaSpacingInPages(pages) {
  /** @type {{ pageNum: number, index: number, matchedText: string, suggestedText: string, kind: string }[]} */
  const out = [];
  for (const page of pages ?? []) {
    const text = String(page?.text ?? '');
    if (!text) continue;
    for (const hit of findRieulKkaBodaSpacingHits(text)) {
      out.push({ pageNum: page.pageNum, ...hit });
    }
  }
  return out;
}
