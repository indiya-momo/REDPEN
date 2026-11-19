/**
 * 한글 맞춤법 — 문장부호와 붙임·띄어.
 * - 종결·쉼표 뒤 한글은 한 칸
 * - 닫는 부호와 조사는 붙임
 * - 가운뎃점 뒤 불필요 공백 제거
 * - 소수+단위 사이 중복 점 제거
 * ruleEngine·시트 핫패스에 붙이지 않는다.
 */

export const PUNCT_SPACING_CATEGORY = '문장부호';
export const PUNCT_SPACING_LABEL = '문장부호 띄어쓰기';
export const PUNCT_SPACING_TIP =
  '한글 맞춤법: 문장 부호 뒤는 띄고, 닫는 부호와 조사는 붙입니다.';

const UNIT_ALT = '킬로미터|센티미터|밀리미터|킬로그램|밀리그램|퍼센트|그램|리터|미터|센티|밀리|cm|mm|kg|km|m|g';

const JOSA_ALT =
  '으로|부터|까지|은|는|이|가|을|를|의|에|도|만|와|과|께|로';

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

  // 3) 닫는 부호 + 공백 + 조사 (조사 뒤 한글 이어짐 제외)
  {
    const re = new RegExp(
      `([」』》\\)】])[ \\t]+(${JOSA_ALT})(?![가-힣])`,
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
