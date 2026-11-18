/**
 * 세종 S3-5 / S3-5b · 맞춤법 제44항 취지 — 숫자·단위 띄어쓰기.
 * - 아라비아 숫자+단위는 붙여: 4 명 → 4명, 25 킬로미터 → 25킬로미터
 * - 우리말 수(만·억·조 병용 포함)+단위는 띄어: 15만명 → 15만 명
 * ruleEngine·시트·맞춤법 핫패스에 붙이지 않는다.
 */

export const DIGIT_UNIT_CATEGORY = '수·단위';
export const DIGIT_UNIT_LABEL = '숫자·단위 띄어쓰기';
export const DIGIT_UNIT_TIP =
  '세종 표기법 제3장: 숫자와 단위는 붙이고, 우리말로 적은 수와 단위는 띄어 씁니다.';

/** 흔한 단위(긴 것 우선). 한글 전용 — %, ㎞ 등은 1차 제외 */
const UNITS = [
  '킬로미터',
  '센티미터',
  '밀리미터',
  '킬로그램',
  '밀리그램',
  '퍼센트',
  '달러',
  '유로',
  '엔',
  '원',
  '톤',
  '그램',
  '리터',
  '명',
  '개',
  '곳',
  '점',
  '편',
  '장',
  '권',
  '쪽',
  '년',
  '월',
  '일',
  '시',
  '분',
  '초',
  '세',
  '도',
];

const UNIT_ALT = UNITS.join('|');

/**
 * @param {string} text
 * @returns {{ index: number, matchedText: string, suggestedText: string, kind: 'digit-attach'|'hangul-space' }[]}
 */
export function findDigitUnitSpacingHits(text) {
  if (!text) return [];
  /** @type {{ index: number, matchedText: string, suggestedText: string, kind: 'digit-attach'|'hangul-space' }[]} */
  const hits = [];
  const occupied = [];

  const overlaps = (start, end) =>
    occupied.some(([a, b]) => start < b && end > a);

  const take = (start, end, matchedText, suggestedText, kind) => {
    if (matchedText === suggestedText) return;
    if (overlaps(start, end)) return;
    occupied.push([start, end]);
    hits.push({ index: start, matchedText, suggestedText, kind });
  };

  // 1) 숫자 + 공백 + 단위 → 붙임 (S3-5)
  {
    const re = new RegExp(
      `(\\d{1,3}(?:,\\d{3})*|\\d+)\\s+(${UNIT_ALT})(?=\\s|$|[^가-힣0-9])`,
      'g',
    );
    let m;
    while ((m = re.exec(text)) !== null) {
      take(m.index, m.index + m[0].length, m[0], `${m[1]}${m[2]}`, 'digit-attach');
    }
  }

  // 2) (숫자|수|몇…)?만|억|조 + 단위 붙여짐 → 띄어 (S3-5b)
  //    15만명 → 15만 명 / 수천만원 → 수천만 원
  {
    const re = new RegExp(
      `((?:\\d{1,3}(?:,\\d{3})*|\\d+)?(?:수|몇)?(?:십|백|천)?(만|억|조))(${UNIT_ALT})`,
      'g',
    );
    let m;
    while ((m = re.exec(text)) !== null) {
      const head = m[1];
      const unit = m[3];
      // 「만원」「억조」단독 관용 오탐 줄임 — 수·몇·숫자·십백천이 앞에 있을 때만
      if (/^(만|억|조)$/.test(head)) continue;
      take(m.index, m.index + m[0].length, m[0], `${head} ${unit}`, 'hangul-space');
    }
  }

  hits.sort((a, b) => a.index - b.index);
  return hits;
}

/**
 * @param {{ pageNum: number, text?: string }[]} pages
 */
export function findDigitUnitSpacingInPages(pages) {
  /** @type {{ pageNum: number, index: number, matchedText: string, suggestedText: string, kind: string }[]} */
  const out = [];
  for (const page of pages ?? []) {
    const text = String(page?.text ?? '');
    if (!text) continue;
    for (const hit of findDigitUnitSpacingHits(text)) {
      out.push({ pageNum: page.pageNum, ...hit });
    }
  }
  return out;
}
