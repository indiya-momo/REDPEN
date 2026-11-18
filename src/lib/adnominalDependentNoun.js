/**
 * 세종 S2-2-1 · 맞춤법 제41·42항 — 관형사형+의존명사 띄어쓰기 (닫힌 표면).
 * PR #3 골든「관형사형+의존명사」FIX(F01–F03) 정밀도 우선. Kiwi 없음.
 * ruleEngine·시트 핫패스에 붙이지 않는다.
 *
 * KEEP(고의 미검출): 할수록, 끝난걸, 할걸, 어떤지, 말한바, 이미 띄운 「한 걸」
 */

export const ADNOMINAL_DEP_CATEGORY = '관형사형+의존명사';
export const ADNOMINAL_DEP_LABEL = '관형사형+의존명사';
export const ADNOMINAL_DEP_TIP =
  '한글 맞춤법: 관형사형 어미 뒤 의존명사(수·것·거…)는 띄어 씁니다.';

/** 「…수」가 한 단어인 명사 — 의존명사 수와 구분 */
const SU_AS_NOUN = new Set([
  '선수',
  '횟수',
  '개수',
  '다수',
  '소수',
  '고수',
  '명수',
  '점수',
  '함수',
  '변수',
  '상수',
  '실수',
  '우수',
  '강수',
  '강수량',
  '지수',
  '계수',
  '비수',
  '선수금',
]);

const THING_COMPOUND = /^(그것|이것|저것|아무것)/;

/**
 * @param {string} text
 * @returns {{ index: number, matchedText: string, suggestedText: string, kind: string }[]}
 */
export function findAdnominalDependentNounHits(text) {
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

  // F01: 될수 있 → 될 수 (…수 + 있/없). 선수 등 명사 제외
  {
    // 「없이」는 제외(별수 없이). 있다/없다 계열만.
    const re = /([가-힣]+수)(?=\s*(?:있|없(?!이)))/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      const whole = m[1];
      if (SU_AS_NOUN.has(whole)) continue;
      if (!whole.endsWith('수') || whole.length < 2) continue;
      const stem = whole.slice(0, -1);
      take(m.index, m.index + whole.length, whole, `${stem} 수`, '수');
    }
  }

  // F03: 생각한걸까 → 생각한 걸까 (걸까만 — 끝난걸·할걸 제외)
  {
    const re = /([가-힣]+)걸까/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      take(m.index, m.index + m[0].length, m[0], `${m[1]} 걸까`, '걸까');
    }
  }

  // F02: 봤을거 → 봤을 거 (…을거 / …은거). 할거·갈거(2음절) 스킵
  {
    const re = /([가-힣]+(?:을|은))거(?=$|[^가-힣]|야|요|다|죠|지|고|면|니|을|를|이|가|은|는|도|만)/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      const stem = m[1];
      // 「할거」「갈거」는 「을」이 없어 이 패턴에 안 걸림. 「봤을」(2음절)은 포함.
      take(m.index, m.index + m[0].length, m[0], `${stem} 거`, '거');
    }
  }

  // 보강: 관형 어미 음절(는/은/던/을)+것
  {
    const re = /([가-힣]+(?:는|은|던|을))것(?=[가-힣]|$|[^가-힣])/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      if (THING_COMPOUND.test(m[0])) continue;
      if (m[1].length < 2) continue;
      take(m.index, m.index + m[0].length, m[0], `${m[1]} 것`, '것');
    }
  }

  hits.sort((a, b) => a.index - b.index);
  return hits;
}

/**
 * @param {{ pageNum: number, text?: string }[]} pages
 */
export function findAdnominalDependentNounInPages(pages) {
  /** @type {{ pageNum: number, index: number, matchedText: string, suggestedText: string, kind: string }[]} */
  const out = [];
  for (const page of pages ?? []) {
    const text = String(page?.text ?? '');
    if (!text) continue;
    for (const hit of findAdnominalDependentNounHits(text)) {
      out.push({ pageNum: page.pageNum, ...hit });
    }
  }
  return out;
}
