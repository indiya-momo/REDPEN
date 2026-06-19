import { describe, expect, it } from 'vitest';
import {
  CAUTION_RULES,
  buildCautionCheckRules,
  cautionFindPattern,
  cautionHighlightSpan,
  cautionItemTip,
  normalizeMatchMode,
} from './cautionRules.js';
import { runRuleCheck } from './ruleEngine.js';
import { buildPageText } from './pdfService.js';

function matches(pattern, text) {
  return new RegExp(pattern, 'gu').test(text);
}

describe('cautionFindPattern', () => {
  it('attached-before: 붙임만 (오른정도), 띄어 쓴 정도는 제외', () => {
    const find = cautionFindPattern('정도', 'attached-before');
    expect(matches(find, '오른정도')).toBe(true);
    expect(matches(find, '오른 정도')).toBe(false);
  });

  it('attached-before: 가지는 토큰 끝만 (물가지수 제외, 여름가지 포함)', () => {
    const find = cautionFindPattern('가지', 'attached-before');
    expect(matches(find, '여름가지')).toBe(true);
    expect(matches(find, '산가지')).toBe(true);
    expect(matches(find, '두 가지')).toBe(false);
    expect(matches(find, '물가지수')).toBe(false);
    expect(matches(find, '소비자물가지수')).toBe(false);
  });

  it('spaced-before: 쯤 — 앞 공백만 보며 뒤 조사(을)와 무관', () => {
    const find = cautionFindPattern('쯤', 'spaced-before');
    expect(matches(find, '일 년 쯤')).toBe(true);
    expect(matches(find, '일 년 쯤을')).toBe(true);
    expect(
      matches(find, '<세한도>만큼은 일 년 쯤을 더 고민하시다가'),
    ).toBe(true);
    expect(matches(find, '일년쯤')).toBe(false);
    expect(matches(find, '일 년쯤')).toBe(false);
  });

  it('spaced-before: 붙여야 하는데 띄어 씀 (앞말 1음절+)', () => {
    const findMan = cautionFindPattern('만', 'spaced-before');
    expect(matches(findMan, '그때 만')).toBe(true);
    expect(matches(findMan, '그때만')).toBe(false);

    const findGaryang = cautionFindPattern('가량', 'spaced-before');
    expect(matches(findGaryang, '삼 가량')).toBe(true);
    expect(matches(findGaryang, '다섯 배 가량 낮았다고 합니다.')).toBe(true);
    expect(matches(findGaryang, '다섯 배가량')).toBe(false);
  });

  it('spaced-before: 줄·문서 시작의 label+공백도 잡음 (이중 사람)', () => {
    const find = cautionFindPattern('이중', 'spaced-before');
    expect(matches(find, '이중 사람들에게 가장 친숙하고')).toBe(true);
    expect(matches(find, '문장.\n이중 사람들에게')).toBe(true);
    expect(matches(find, '가장 이중적인')).toBe(true);
    expect(matches(find, '이중인격')).toBe(false);
    expect(matches(find, '이중적인')).toBe(false);
  });

  it('any-before: 붙임·띄움 모두 잡음', () => {
    const find = cautionFindPattern('정도', 'any-before');
    expect(matches(find, '오른정도')).toBe(true);
    expect(matches(find, '오른 정도')).toBe(true);
  });

  it('any-before: 만큼은 단어 중간(회상할→상할)에서 중복 매칭하지 않음', () => {
    const find = cautionFindPattern('만큼', 'any-before');
    const text = '회상할 만큼 강한 인상을';
    const re = new RegExp(find, 'gu');
    /** @type {string[]} */
    const hits = [];
    let m;
    while ((m = re.exec(text)) !== null) {
      hits.push(m[0]);
    }
    expect(hits).toEqual(['회상할 만큼']);
  });
});

describe('cautionHighlightSpan', () => {
  it('편집자 검토 하이라이트는 접사·조사 어간만', () => {
    expect(cautionHighlightSpan('회상할 만큼', ['만큼'])).toEqual({
      indexOffset: 4,
      text: '만큼',
    });
    expect(cautionHighlightSpan('회상할만큼', ['만큼'])).toEqual({
      indexOffset: 3,
      text: '만큼',
    });
    expect(cautionHighlightSpan('배 가량', ['가량', '쯤'])).toEqual({
      indexOffset: 2,
      text: '가량',
    });
  });
});

describe('normalizeMatchMode (시트 별칭)', () => {
  it('ap-any / ap-space / ap-attach / spaced-stem', () => {
    expect(normalizeMatchMode('ap-any')).toBe('any-before');
    expect(normalizeMatchMode('ap-space')).toBe('spaced-before');
    expect(normalizeMatchMode('ap-attach')).toBe('attached-before');
    expect(normalizeMatchMode('spaced-stem')).toBe('spaced-stem');
  });

  it('space-stem은 spaced-stem, space 단독은 ap-space', () => {
    expect(normalizeMatchMode('space-stem')).toBe('spaced-stem');
    expect(normalizeMatchMode('space')).toBe('spaced-before');
  });
});

describe('cautionItemTip', () => {
  it('항목 tip이 있으면 그룹 tip보다 우선', () => {
    const group = { id: 'verb-verb', tip: '그룹 설명' };
    const item = { id: 'verb-verb-neal', tip: '늘이다/늘리다 설명' };
    expect(cautionItemTip(item, group)).toBe('늘이다/늘리다 설명');
  });

  it('항목 tip이 없으면 그룹 tip으로 대체', () => {
    const group = { id: 'g', tip: '그룹만' };
    const item = { id: 'i' };
    expect(cautionItemTip(item, group)).toBe('그룹만');
  });

  it('CAUTION_RULES는 항목별 tip을 갖는다', () => {
    const mat = CAUTION_RULES.find((r) => r.id === 'verb-verbi-mat');
    const neal = CAUTION_RULES.find((r) => r.id === 'verb-verb-neal');
    expect(mat?.tip).toContain('맞추다');
    expect(neal?.tip).toContain('늘이다');
    expect(mat?.tip).not.toBe(neal?.tip);
  });
});

describe('jubsa-garyang spaced-before', () => {
  it('배 가량 — 앞말 1음절도 검출', () => {
    const enabled = Object.fromEntries(
      CAUTION_RULES.map((r) => [r.id, r.id === 'jubsa-garyang']),
    );
    const rules = buildCautionCheckRules(enabled);
    const pages = [
      {
        pageNum: 150,
        text: '다섯 배 가량 낮았다고 합니다.',
        items: [],
        itemRefs: [],
      },
    ];
    const { results, errors } = runRuleCheck(pages, rules);
    expect(errors).toEqual([]);
    const texts = results.flatMap((g) => g.instances.map((i) => i.matchedText));
    expect(texts).toContain('배 가량');
  });

  it('일 년 쯤 — PDF에서 년·쯤이 붙어 추출되면 검출 안 됨', () => {
    const items = [
      { str: '일', transform: [12, 0, 0, 12, 48, 200], width: 12 },
      { str: '년', transform: [12, 0, 0, 12, 64, 200], width: 12 },
      { str: '쯤', transform: [12, 0, 0, 12, 76, 200], width: 12, hasEOL: true },
    ];
    const { text, itemRefs } = buildPageText(items);
    expect(text).toContain('년쯤');

    const enabled = Object.fromEntries(
      CAUTION_RULES.map((r) => [r.id, r.id === 'jubsa-garyang']),
    );
    const rules = buildCautionCheckRules(enabled);
    const { results } = runRuleCheck(
      [{ pageNum: 222, text, items, itemRefs }],
      rules,
    );
    const hits = results.flatMap((g) => g.instances.map((i) => i.matchedText));
    expect(hits).toEqual([]);

    const spaced = runRuleCheck(
      [
        {
          pageNum: 222,
          text: '<세한도>만큼은 일 년 쯤을 더 고민하시다가\n',
          items: [],
          itemRefs: [],
        },
      ],
      rules,
    ).results.flatMap((g) => g.instances.map((i) => i.matchedText));
    expect(spaced).toContain('년 쯤');
  });
});

describe('caution except → excludePhrases', () => {
  it('바라보다: 매칭은 앞말+바라, except 바라보는 어간 뒤 이어짐으로 제외', () => {
    const rules = buildCautionCheckRules({ 'verb-verb-bara': true });
    const pages = [
      {
        pageNum: 1,
        text: '하늘을 바라보다. 그가 바라다. 그를 바라보는 눈.',
      },
    ];
    const { results, errors } = runRuleCheck(pages, rules);
    expect(errors).toEqual([]);
    const texts = results.flatMap((g) => g.instances.map((i) => i.matchedText));
    expect(texts).toContain('그가 바라');
    expect(texts).not.toContain('하늘을 바라');
    expect(texts).not.toContain('그를 바라');
  });

  it('except 목록과 통째 같으면 하이라이트 제외', () => {
    const find = cautionFindPattern('정도', 'attached-before');
    const rules = [
      {
        find,
        replace: '(검토)',
        enabled: true,
        pattern: 'regex',
        excludePhrases: ['여름정도'],
      },
    ];
    const pages = [{ pageNum: 1, text: '오른정도 여름정도 입니다.' }];
    const { results, errors } = runRuleCheck(pages, rules);
    expect(errors).toEqual([]);
    const texts = results.flatMap((g) => g.instances.map((i) => i.matchedText));
    expect(texts).toContain('오른정도');
    expect(texts).not.toContain('여름정도');
  });
});
