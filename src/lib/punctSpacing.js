/**
 * 한글 맞춤법 — 문장부호와 붙임·띄어.
 * - 종결·쉼표 뒤 한글은 한 칸
 * - 닫는 부호·따옴표와 조사·이다(라고 포함)는 붙임
 * - 닫는 따옴표와 하고·하며·하는는 띄움
 * - 여는 따옴표 앞은 한 칸
 * - 가운뎃점 뒤 불필요 공백 제거
 * - 소수+단위 사이 중복 점 제거
 * ruleEngine·시트 핫패스에 붙이지 않는다.
 */

export const PUNCT_SPACING_CATEGORY = '문장부호';
export const PUNCT_SPACING_LABEL = '문장부호 띄어쓰기';
export const PUNCT_SPACING_TIP =
  '「한글 맞춤법」 부록(문장 부호): 문장 부호 뒤는 띄고, 닫는 부호·따옴표와 조사(라고)는 붙여 씀';

const UNIT_ALT = '킬로미터|센티미터|밀리미터|킬로그램|밀리그램|퍼센트|그램|리터|미터|센티|밀리|cm|mm|kg|km|m|g';

/** 닫는 부호 뒤 붙임 — 긴 것 먼저(이/가보다 입니다·인가요). */
const AFTER_CLOSE_ALT =
  '으로부터|으로|부터|까지|입니다|인가요|인가|인지|이며|이고|이면|이에요|예요|이었다|였다|이다|은|는|이|가|을|를|의|에|도|만|와|과|께|로';

/** 닫는 따옴표·겹낫표 (직선·둥근·」』) — 문자 클래스 안쪽만 */
const CLOSE_QUOTE_CHARS = `"'”’」』`;
const CLOSE_QUOTE_CLASS = `[${CLOSE_QUOTE_CHARS}]`;
/** 일반 조사·이다 붙임용 — 따옴표 + 》 ) 】 */
const CLOSE_MARK_CLASS = `[${CLOSE_QUOTE_CHARS}》\\)】]`;
/** 여는 따옴표·낧표 (직선 " ' 는 개·폐 구분이 애매해 제외) */
const OPEN_QUOTE_CLASS = `[‘“「『]`;

/**
 * @param {string} text
 * @returns {{ index: number, matchedText: string, suggestedText: string, kind: string }[]}
 */
export function findPunctSpacingHits(text) {
  if (!text) return [];
  /** @type {{ index: number, matchedText: string, suggestedText: string, kind: string }[]} */
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

  // 1) 한글 + 종결 + 한글 (같은 줄) → 한 칸
  {
    const re = /(?<=[가-힣])([.?!…])([가-힣])/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      take(
        m.index,
        m.index + m[0].length,
        m[0],
        `${m[1]} ${m[2]}`,
        'stop-space',
      );
    }
  }

  // 2) 한글 + 쉼표 + 한글 → 한 칸
  {
    const re = /(?<=[가-힣]),([가-힣])/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      take(m.index, m.index + m[0].length, m[0], `, ${m[1]}`, 'comma-space');
    }
  }

  // 3a) 닫는 따옴표 + 공백 + (이)라고 → 붙임
  {
    const re = new RegExp(
      `(${CLOSE_QUOTE_CLASS})[ \\t]+(이라고|라고)`,
      'g',
    );
    let m;
    while ((m = re.exec(text)) !== null) {
      take(
        m.index,
        m.index + m[0].length,
        m[0],
        `${m[1]}${m[2]}`,
        'quote-rago',
      );
    }
  }

  // 3b) 닫는 따옴표 + 붙여 쓴 하고|하며|하는 → 한 칸
  {
    const re = new RegExp(`(${CLOSE_QUOTE_CLASS})(하고|하며|하는)`, 'g');
    let m;
    while ((m = re.exec(text)) !== null) {
      take(
        m.index,
        m.index + m[0].length,
        m[0],
        `${m[1]} ${m[2]}`,
        'quote-hago',
      );
    }
  }

  // 3c) 닫는 부호·따옴표 + 공백 + 조사·이다 (뒤 한글 이어짐 제외)
  {
    const re = new RegExp(
      `(${CLOSE_MARK_CLASS})[ \\t]+(${AFTER_CLOSE_ALT})(?![가-힣])`,
      'g',
    );
    let m;
    while ((m = re.exec(text)) !== null) {
      take(m.index, m.index + m[0].length, m[0], `${m[1]}${m[2]}`, 'close-josa');
    }
  }

  // 4) 붙인 가운뎃점 뒤 공백 → 제거
  {
    const re = /(?<![ \t\n])·[ \t]+(?=[가-힣])/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      take(m.index, m.index + m[0].length, m[0], '·', 'middot-space');
    }
  }

  // 5) 소수 + 중복 점 + 단위
  {
    const re = new RegExp(`(\\d+\\.\\d+)\\.(${UNIT_ALT})\\b`, 'gi');
    let m;
    while ((m = re.exec(text)) !== null) {
      take(m.index, m.index + m[0].length, m[0], `${m[1]}${m[2]}`, 'unit-dot');
    }
  }

  // 6) 한글 + 붙여 쓴 여는 따옴표·낧표 → 한 칸
  {
    const re = new RegExp(`(?<=[가-힣])(${OPEN_QUOTE_CLASS})`, 'g');
    let m;
    while ((m = re.exec(text)) !== null) {
      take(
        m.index,
        m.index + m[0].length,
        m[0],
        ` ${m[1]}`,
        'open-quote-space',
      );
    }
  }

  hits.sort((a, b) => a.index - b.index);
  return hits;
}

/**
 * @param {{ pageNum: number, text?: string }[]} pages
 */
export function findPunctSpacingInPages(pages) {
  /** @type {{ pageNum: number, index: number, matchedText: string, suggestedText: string, kind: string }[]} */
  const out = [];
  for (const page of pages ?? []) {
    const text = String(page?.text ?? '');
    if (!text) continue;
    for (const hit of findPunctSpacingHits(text)) {
      out.push({ pageNum: page.pageNum, ...hit });
    }
  }
  return out;
}
