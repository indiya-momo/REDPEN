/**
 * 세종 S2-2-40 — -ㄴ바: 의존명사 「바」는 띄어, 연결어미성 「…인바」「말한바」는 붙임.
 * PR #3 K05「말한바와 같이」KEEP. 알바(아르바이트) 제외.
 * ruleEngine 비부착.
 */

export const N_BA_CATEGORY = '-ㄴ바';
export const N_BA_LABEL = '-ㄴ바 띄어쓰기';
export const N_BA_TIP =
  '의존명사 「바」는 띄어 쓰고, 연결어미처럼 쓰일 때(…인바·말한바)는 붙입니다.';

/** 연결어미성 — 제안하지 않음 */
const KEEP_GLUED = [
  '말한바',
  '일인바',
  '사실인바',
  '것인바',
  '바인바',
];

/** 의존명사 바+조사 — 붙임 오류 → 띄어 */
const SPLIT_ROWS = [
  { find: '어찌할바', replace: '어찌할 바' },
  { find: '할바를', replace: '할 바를' },
  { find: '할바가', replace: '할 바가' },
  { find: '할바에', replace: '할 바에' },
  { find: '할바도', replace: '할 바도' },
  { find: '할바만', replace: '할 바만' },
  { find: '알바를', replace: '알 바를' }, // 「알 바」— 아래 알바 직업명 가드
  { find: '알바가', replace: '알 바가' },
  { find: '알바에', replace: '알 바에' },
  { find: '모를바', replace: '모를 바' },
  { find: '믿을바', replace: '믿을 바' },
];

/**
 * @param {string} text
 * @returns {{ index: number, matchedText: string, suggestedText: string, kind: string }[]}
 */
export function findNBaDependentNounHits(text) {
  if (!text) return [];
  /** @type {{ index: number, matchedText: string, suggestedText: string, kind: string }[]} */
  const hits = [];
  const occupied = [];

  const overlaps = (start, end) =>
    occupied.some(([a, b]) => start < b && end > a);

  // KEEP: 말한바 등 — 명시적으로 구간 점유만 (제안 없음)
  for (const keep of KEEP_GLUED) {
    let from = 0;
    while (from < text.length) {
      const idx = text.indexOf(keep, from);
      if (idx === -1) break;
      occupied.push([idx, idx + keep.length]);
      from = idx + keep.length;
    }
  }

  for (const row of SPLIT_ROWS) {
    if (row.find === row.replace) continue;
    let from = 0;
    while (from < text.length) {
      const idx = text.indexOf(row.find, from);
      if (idx === -1) break;
      const end = idx + row.find.length;
      // 아르바이트 「알바」: 알바를/알바가 앞에 용언 관형이 없고 명사 쓰임
      if (row.find.startsWith('알바')) {
        const prev = idx > 0 ? text[idx - 1] : '';
        // 한글이 바로 앞이면 「알 바」후보, 아니면 직업명 가능 → 스킵
        if (!prev || prev < '가' || prev > '힣') {
          from = end;
          continue;
        }
      }
      if (!overlaps(idx, end)) {
        occupied.push([idx, end]);
        hits.push({
          index: idx,
          matchedText: row.find,
          suggestedText: row.replace,
          kind: '바-split',
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
export function findNBaDependentNounInPages(pages) {
  /** @type {{ pageNum: number, index: number, matchedText: string, suggestedText: string, kind: string }[]} */
  const out = [];
  for (const page of pages ?? []) {
    const text = String(page?.text ?? '');
    if (!text) continue;
    for (const hit of findNBaDependentNounHits(text)) {
      out.push({ pageNum: page.pageNum, ...hit });
    }
  }
  return out;
}
