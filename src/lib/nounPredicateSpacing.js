/**
 * 세종 S2-2-5·5a · PR #3「명사+용언」「사전 attach」— 닫힌 표면.
 * - 사전 등재 합성(맛없다…)은 붙임 KEEP
 * - 비등재 붙임은 confirm 띄어 제안(곳없이·기분좋)
 * - 사전 attach FIX/confirm(붉은 빛·불꽃 같은)
 * - 세종 예 일부: 잘못 띈 명사+하다/되다/지다 → 붙임(닫힌 목록)
 * ruleEngine·시트 핫패스에 붙이지 않는다. Kiwi·사전 API 없음.
 */

export const NOUN_PRED_CATEGORY = '명사+용언';
export const NOUN_PRED_LABEL = '명사+용언';
export const NOUN_PRED_TIP =
  '명사와 용언이 한 단어(사전·합성)면 붙이고, 그렇지 않으면 띄어 씁니다.';

/** 사전 등재로 붙임 유지 (골든 KEEP) */
export const NOUN_PRED_KEEP_GLUED = new Set([
  '맛없다',
  '재미있다',
  '쓸데없이',
  '감쪽같다',
]);

/** 붙임 → 띄어 제안 (골든 confirm) */
const SPLIT_CONFIRM = [
  { find: '곳없이', replace: '곳 없이', kind: 'confirm-split' },
  { find: '기분좋', replace: '기분 좋', kind: 'confirm-split' },
];

/** 띄어 → 붙임 (골든 사전 attach) */
const ATTACH_ROWS = [
  { find: '붉은 빛', replace: '붉은빛', kind: 'fix-attach' },
  { find: '불꽃 같은', replace: '불꽃같은', kind: 'confirm-attach' },
];

/** 세종 S2-2-5 예 — 잘못 띈 합성만 (닫힌 목록) */
const SEJONG_ATTACH = [
  { find: '두말 하', replace: '두말하', kind: 'sejong-attach' },
  { find: '해방 되', replace: '해방되', kind: 'sejong-attach' },
  { find: '결정 되', replace: '결정되', kind: 'sejong-attach' },
  { find: '책임 지', replace: '책임지', kind: 'sejong-attach' },
  { find: '도망 가', replace: '도망가', kind: 'sejong-attach' },
  { find: '소문 나', replace: '소문나', kind: 'sejong-attach' },
  { find: '관련 짓', replace: '관련짓', kind: 'sejong-attach' },
  { find: '피해 입', replace: '피해입', kind: 'sejong-attach' },
];

/** 보류 — 제안하지 않음 */
const SKIP = new Set(['사같은']);

/**
 * @param {string} text
 * @returns {{ index: number, matchedText: string, suggestedText: string, kind: string }[]}
 */
export function findNounPredicateSpacingHits(text) {
  if (!text) return [];
  /** @type {{ index: number, matchedText: string, suggestedText: string, kind: string }[]} */
  const hits = [];
  const occupied = [];

  const overlaps = (start, end) =>
    occupied.some(([a, b]) => start < b && end > a);

  const take = (start, end, matchedText, suggestedText, kind) => {
    if (matchedText === suggestedText) return;
    if (overlaps(start, end)) return;
    // KEEP 붙임 단어가 구간에 있으면 스킵
    for (const keep of NOUN_PRED_KEEP_GLUED) {
      if (matchedText.includes(keep) || text.slice(Math.max(0, start - 2), end + 2).includes(keep)) {
        if (kind.startsWith('confirm-split')) return;
      }
    }
    occupied.push([start, end]);
    hits.push({ index: start, matchedText, suggestedText, kind });
  };

  const scanLiteral = (rows) => {
    for (const row of rows) {
      if (SKIP.has(row.find)) continue;
      let from = 0;
      while (from < text.length) {
        const idx = text.indexOf(row.find, from);
        if (idx === -1) break;
        take(
          idx,
          idx + row.find.length,
          row.find,
          row.replace,
          row.kind,
        );
        from = idx + row.find.length;
      }
    }
  };

  scanLiteral(SPLIT_CONFIRM);
  scanLiteral(ATTACH_ROWS);
  scanLiteral(SEJONG_ATTACH);

  hits.sort((a, b) => a.index - b.index);
  return hits;
}

/**
 * @param {{ pageNum: number, text?: string }[]} pages
 */
export function findNounPredicateSpacingInPages(pages) {
  /** @type {{ pageNum: number, index: number, matchedText: string, suggestedText: string, kind: string }[]} */
  const out = [];
  for (const page of pages ?? []) {
    const text = String(page?.text ?? '');
    if (!text) continue;
    for (const hit of findNounPredicateSpacingHits(text)) {
      out.push({ pageNum: page.pageNum, ...hit });
    }
  }
  return out;
}
