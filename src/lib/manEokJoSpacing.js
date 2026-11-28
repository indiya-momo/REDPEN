/**
 * 세종 S3-3 · 한글맞춤법 수 표기 — 아라비아+만/억/조 병용.
 * - 만·억·조 단위 묶음 사이는 띄어 씀: 3만4천 → 3만 4천
 * - 숫자와 만/억/조/천/백 병용은 붙여 씀: 3 만 → 3만
 * ruleEngine·시트·맞춤법 핫패스에 붙이지 않는다.
 */

export const MAN_EOK_JO_CATEGORY = '수·만억조';
export const MAN_EOK_JO_LABEL = '만·억·조 띄어쓰기';
export const MAN_EOK_JO_TIP =
  "한글 맞춤법 제44항: 수를 적을 때는 '만(萬)' 단위로 띄어 씁니다. 아라비아 숫자 뒤의 단위는 붙여 쓸 수 있습니다.";

/** 병용으로 숫자에 붙는 단위(긴 것 우선) */
const ATTACH_UNITS = ['천만', '백만', '천억', '조', '억', '만', '천', '백'];

/**
 * @param {string} text
 * @returns {{ index: number, matchedText: string, suggestedText: string, kind: 'split'|'attach' }[]}
 */
export function findManEokJoSpacingHits(text) {
  if (!text) return [];
  /** @type {{ index: number, matchedText: string, suggestedText: string, kind: 'split'|'attach' }[]} */
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

  // 1) 만|억|조 뒤 바로 숫자 → 띄어: 3만4천 → 3만 4천 / 47억5천만 → 47억 5천만
  {
    const re = /(\d{1,3}(?:,\d{3})*|\d+)(만|억|조)(?=\d)/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      const head = `${m[1]}${m[2]}`;
      // 제안 문맥: head + 공백 + 뒤에 이어지는 숫자 덩어리(표시용)
      let j = m.index + head.length;
      const restStart = j;
      while (j < text.length && /[\d,]/.test(text[j])) j += 1;
      // 뒤 단위 말(천만·백 등)까지 문맥에 포함
      for (const u of ATTACH_UNITS) {
        if (text.startsWith(u, j)) {
          j += u.length;
          break;
        }
      }
      const matchedText = text.slice(m.index, j);
      const suggestedText = `${head} ${text.slice(restStart, j)}`;
      take(m.index, j, matchedText, suggestedText, 'split');
    }
  }

  // 2) 숫자와 단위 말 사이 불필요 공백: 3 만 → 3만
  {
    const unitAlt = ATTACH_UNITS.join('|');
    const re = new RegExp(
      `(\\d{1,3}(?:,\\d{3})*|\\d+)\\s+(${unitAlt})(?=\\s|$|[^가-힣0-9,]|만|억|조|천|백|명|원|톤|킬로)`,
      'g',
    );
    let m;
    while ((m = re.exec(text)) !== null) {
      const matchedText = m[0];
      const suggestedText = `${m[1]}${m[2]}`;
      take(m.index, m.index + matchedText.length, matchedText, suggestedText, 'attach');
    }
  }

  hits.sort((a, b) => a.index - b.index);
  return hits;
}

/**
 * @param {{ pageNum: number, text?: string }[]} pages
 */
export function findManEokJoSpacingInPages(pages) {
  /** @type {{ pageNum: number, index: number, matchedText: string, suggestedText: string, kind: string }[]} */
  const out = [];
  for (const page of pages ?? []) {
    const text = String(page?.text ?? '');
    if (!text) continue;
    for (const hit of findManEokJoSpacingHits(text)) {
      out.push({ pageNum: page.pageNum, ...hit });
    }
  }
  return out;
}
