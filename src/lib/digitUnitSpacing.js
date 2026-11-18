/**
 * 세종 S3-5 / S3-5b · 맞춤법 제43항 — 숫자·단위 띄어쓰기.
 * - 아라비아 숫자+단위는 붙여: 4 명 → 4명
 * - 우리말 수(만·억·조 병용)+단위는 띄어: 15만명 → 15만 명
 * - 한글 수사+단위도 띄어(가드·except): 천년 → 천 년, 삼백명 → 삼백 명
 * ruleEngine·시트·맞춤법 핫패스에 붙이지 않는다.
 * @see docs/superpowers/specs/2026-11-19-digit-unit-hangul-guard-design.md
 */

export const DIGIT_UNIT_CATEGORY = '수·단위';
export const DIGIT_UNIT_LABEL = '숫자·단위 띄어쓰기';
export const DIGIT_UNIT_TIP =
  '맞춤법 제43항·세종: 아라비아 숫자와 단위는 붙이고, 한글로 적은 수와 단위는 띄어 씁니다.';

/** @typedef {'A'|'B'|'C'|'D'|'Y'} UnitGroup */
/** @typedef {'N1'|'N2'|'N3_MULTI'|'N3_ALONE'} NumeralClass */

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

/** @type {Record<string, UnitGroup>} */
const UNIT_GROUP = {
  킬로미터: 'A',
  센티미터: 'A',
  밀리미터: 'A',
  킬로그램: 'A',
  밀리그램: 'A',
  퍼센트: 'A',
  달러: 'A',
  유로: 'A',
  엔: 'A',
  원: 'A',
  톤: 'A',
  그램: 'A',
  리터: 'A',
  명: 'A',
  개: 'A',
  곳: 'A',
  권: 'A',
  초: 'A',
  점: 'B',
  편: 'B',
  장: 'B',
  쪽: 'B',
  시: 'B',
  분: 'B',
  세: 'B',
  도: 'B',
  월: 'D',
  일: 'D',
  년: 'Y',
};

const UNIT_ALT = UNITS.join('|');

const NATIVE_NUM =
  '한|두|세|네|다섯|여섯|일곱|여덟|아홉|열|스무|서른|마흔|쉰|예순|일흔|여든|아흔';

const SINO_NUM =
  `(?:몇(?:[일이삼사오육칠팔구]?[십백천]|[일이삼사오육칠팔구])*|(?:수)?(?:[일이삼사오육칠팔구]?[십백천]|[일이삼사오육칠팔구])+)`;

const HANGUL_NUM = `(?:${NATIVE_NUM}|${SINO_NUM})`;

const NATIVE_SET = new Set(NATIVE_NUM.split('|'));

/** N3_ALONE + A/Y 잔여 동형 (천년은 검출 유지 → 목록에 없음) */
const HANGUL_EXCEPT = new Set([
  '천명',
  '만개',
  '만원',
  '만년',
  '만권',
  '천개',
]);

/**
 * 단위 뒤 조사·어미 (목록 직후 한글이 이어지면 불허).
 * @see design §1 오른쪽 경계
 */
const TRAILING_JOSA =
  '이|가|은|는|을|를|의|에|도|만|씩|이나|으로|로부터|부터|까지|께|께서|에게|한테|보다|처럼|만큼|밖에|조차|마저|뿐|마다|쯤|정도|이상|이하';

const RIGHT_BOUND = `(?=$|[^가-힣]|(?:${TRAILING_JOSA})(?![가-힣]))`;
const LEFT_BOUND = '(?<![가-힣0-9])';

/**
 * @param {string} head
 * @returns {NumeralClass | null}
 */
function classifyNumeralHead(head) {
  if (!head) return null;
  if (/^\d[\d,]*$/.test(head)) return null;

  const hasAscii = /^\d/.test(head);
  const bare = head.replace(/^[\d,]+/, '');
  if (!bare) return null;

  if (hasAscii) return 'N3_MULTI';

  if (bare === '몇' || NATIVE_SET.has(bare)) return 'N1';

  if (/^(십|백|천|만)$/.test(bare)) return 'N3_ALONE';

  if (/^[일이삼사오육칠팔구]$/.test(bare)) return 'N2';

  // 수/몇 + 십백천…, 이십·삼백·수천 등
  if (/[십백천만]/.test(bare) || bare.length >= 2) return 'N3_MULTI';

  return 'N2';
}

/**
 * @param {NumeralClass} num
 * @param {UnitGroup} group
 */
function isAllowedByMatrix(num, group) {
  if (group === 'C' || group === 'D') return false;
  if (num === 'N2') return false;
  if (num === 'N1') return group === 'A' || group === 'Y';
  if (num === 'N3_MULTI') return group === 'A' || group === 'B' || group === 'Y';
  if (num === 'N3_ALONE') return group === 'A' || group === 'Y';
  return false;
}

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
  {
    const re = new RegExp(
      `${LEFT_BOUND}((?:\\d{1,3}(?:,\\d{3})*|\\d+)?(?:수|몇)?(?:십|백|천)?(만|억|조))(${UNIT_ALT})${RIGHT_BOUND}`,
      'g',
    );
    let m;
    while ((m = re.exec(text)) !== null) {
      const head = m[1];
      const unit = m[3];
      if (/^(만|억|조)$/.test(head)) continue;
      if (HANGUL_EXCEPT.has(m[0])) continue;
      take(m.index, m.index + m[0].length, m[0], `${head} ${unit}`, 'hangul-space');
    }
  }

  // 3) 한글 수사(+선택적 앞자리 숫자) + 단위 → 띄어 (제43항 · 가드)
  {
    const re = new RegExp(
      `${LEFT_BOUND}((?:\\d{1,3}(?:,\\d{3})*|\\d+)?${HANGUL_NUM})(${UNIT_ALT})${RIGHT_BOUND}`,
      'g',
    );
    let m;
    while ((m = re.exec(text)) !== null) {
      const head = m[1];
      const unit = m[2];
      const matched = m[0];
      if (/^\d[\d,]*$/.test(head)) continue;
      if (HANGUL_EXCEPT.has(matched)) continue;

      const numClass = classifyNumeralHead(head);
      const group = UNIT_GROUP[unit];
      if (!numClass || !group) continue;
      if (!isAllowedByMatrix(numClass, group)) continue;

      take(m.index, m.index + matched.length, matched, `${head} ${unit}`, 'hangul-space');
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
