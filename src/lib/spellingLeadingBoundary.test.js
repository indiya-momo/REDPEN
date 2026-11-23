import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import spellingRulesJson from '../data/spelling-rules.json';
import { BUILT_IN_RULES } from './builtInRules.js';
import {
  pruneDaboInsideCompoundHits,
  shouldKeepDaboInsideCompound,
} from './daboInsideCompoundKeep.js';
import { runRuleCheck } from './ruleEngine.js';
import {
  buildSpellingCheckRuleFromBuiltIn,
  isHangulSyllable,
  spellingRuleNeedsLeadingHangulBoundary,
} from './spellingRuleEntry.js';
import {
  clearStdictVerbFormsCache,
  setStdictVerbFormsForTests,
} from './stdictVerbForms.js';

/** @param {import('./ruleTypes.js').Rule[]} rules @param {string} text */
function hits(rules, text) {
  const { results, errors } = runRuleCheck([{ pageNum: 1, text }], rules);
  expect(errors).toEqual([]);
  return results.flatMap((g) => g.instances.map((i) => i.matchedText));
}

const KEEP = [
  '건물 속에 들어갔다',
  '선물 속에 편지가',
  '음식물 속 이물질',
  '부산 속 풍경',
  '작품 속 인물',
  '수입 속 비중',
  '머리빗 속 먼지',
];

const DETECT = [
  ['깊은 물 속으로', '물 속'],
  ['깊은 산 속에서', '산 속'],
  ['물 속에서 헤엄쳤다', '물 속'],
  ['물 속', '물 속'],
  ['첫 줄\n물 속으로', '물 속'],
  ['("물 속")', '물 속'],
  ['그 품 속에서', '품 속'],
];

describe('맞춤법 띄어쓰기 규칙 — 앞 한글 경계', () => {
  const findsRule = buildSpellingCheckRuleFromBuiltIn({
    find: '물 속',
    replace: '물속',
    finds: ['물 속', '산 속', '품 속', '입 속', '빗 속'],
    enabled: true,
    builtIn: true,
    category: 'spelling',
  });
  const literalRule = buildSpellingCheckRuleFromBuiltIn({
    find: '물 속',
    replace: '물속',
    enabled: true,
    builtIn: true,
    category: 'spelling',
  });

  it('finds 묶음·단일 행 모두 경계 플래그가 켜진다', () => {
    expect(findsRule.spellingLeadingHangulBoundary).toBe(true);
    expect(literalRule.spellingLeadingHangulBoundary).toBe(true);
  });

  it.each(KEEP)('finds 묶음: 「%s」는 잡지 않는다', (text) => {
    expect(hits([findsRule], text)).toEqual([]);
  });

  it.each(KEEP.slice(0, 3))('단일 find 행: 「%s」는 잡지 않는다', (text) => {
    expect(hits([literalRule], text)).toEqual([]);
  });

  it.each(DETECT)('finds 묶음: 「%s」는 잡는다', (text, expected) => {
    expect(hits([findsRule], text)).toEqual([expected]);
  });

  it.each(DETECT.filter(([, e]) => e === '물 속'))(
    '단일 find 행: 「%s」는 잡는다',
    (text) => {
      expect(hits([literalRule], text)).toEqual(['물 속']);
    },
  );

  it('뒤 경계는 보지 않는다(조사·뒷글자 붙어도 잡음)', () => {
    expect(hits([findsRule], '물 속도 맑다')).toEqual(['물 속']);
  });

  it('한 문장에 오탐과 정탐이 섞이면 정탐만 남는다', () => {
    expect(hits([findsRule], '건물 속이 아니라 깊은 물 속이다')).toEqual([
      '물 속',
    ]);
  });

  it('붙여 쓴 오기 행(되요 등)은 경계를 켜지 않는다 — 안되요도 잡음', () => {
    const rule = buildSpellingCheckRuleFromBuiltIn({
      find: '되요',
      replace: '돼요',
      enabled: true,
      builtIn: true,
      category: 'spelling',
    });
    expect(rule.spellingLeadingHangulBoundary).toBeUndefined();
    expect(hits([rule], '그러면 안되요')).toEqual(['되요']);
  });

  it('allowAttachedPrefix면 경계를 끈다', () => {
    const rule = buildSpellingCheckRuleFromBuiltIn({
      find: '물 속',
      replace: '물속',
      enabled: true,
      allowAttachedPrefix: true,
    });
    expect(rule.spellingLeadingHangulBoundary).toBeUndefined();
    expect(hits([rule], '건물 속')).toEqual(['물 속']);
  });

  it('기본 opt-out 목록: 「것 뿐」은 「이것 뿐」도 잡는다', () => {
    const row = BUILT_IN_RULES.find((r) => r.find === '것 뿐');
    expect(row).toBeTruthy();
    const rule = buildSpellingCheckRuleFromBuiltIn({ ...row, enabled: true });
    expect(spellingRuleNeedsLeadingHangulBoundary(rule)).toBe(false);
    expect(hits([rule], '남은 건 이것 뿐이다')).toEqual(['것 뿐']);
  });

  describe('기본 opt-out 목록: 「듯 하」', () => {
    const rowOf = (find) => {
      const row = BUILT_IN_RULES.find((r) => r.find === find);
      expect(row).toBeTruthy();
      return buildSpellingCheckRuleFromBuiltIn({ ...row, enabled: true });
    };
    const deutHa = rowOf('듯 하');
    const geureolDeut = rowOf('그럴 듯');

    it('경계 검사를 끈다', () => {
      expect(spellingRuleNeedsLeadingHangulBoundary(deutHa)).toBe(false);
    });

    it.each([
      ['그럴듯 하다', ['듯 하']],
      ['비가 올듯 하다', ['듯 하']],
      ['비가 올 듯 하다', ['듯 하']],
    ])('「%s」를 잡는다', (text, expected) => {
      expect(hits([deutHa, geureolDeut], text)).toEqual(expected);
    });

    it('「그럴 듯 하다」는 「그럴 듯」 한 번만 잡는다(겹침 중복 없음)', () => {
      expect(hits([deutHa, geureolDeut], '그럴 듯 하다')).toEqual(['그럴 듯']);
    });
  });

  it('맞춤법이 아닌 일반 literal 규칙은 그대로(앞 한글 붙어도 잡음)', () => {
    expect(
      hits([{ find: '물 속', replace: '물속', enabled: true }], '건물 속'),
    ).toEqual(['물 속']);
  });

  it('번들 시트: 띄어 쓴 이형태만 있는 행만 경계가 켜진다', () => {
    const flagged = spellingRulesJson.filter((row) =>
      spellingRuleNeedsLeadingHangulBoundary(
        BUILT_IN_RULES.find((r) => r.find === row.find && r.replace === row.replace),
      ),
    );
    for (const row of flagged) {
      const variants = row.finds?.length >= 2 ? row.finds : [row.find];
      expect(variants.every((v) => /\s/.test(v.trim()))).toBe(true);
    }
    expect(flagged.some((r) => r.find === '봄 밤')).toBe(true);
    expect(flagged.some((r) => r.find === '것 뿐')).toBe(false);
    expect(flagged.some((r) => r.find === '듯 하')).toBe(false);
  });

  it('isHangulSyllable', () => {
    expect(isHangulSyllable('가')).toBe(true);
    expect(isHangulSyllable('힣')).toBe(true);
    expect(isHangulSyllable('ㄱ')).toBe(false);
    expect(isHangulSyllable('a')).toBe(false);
    expect(isHangulSyllable(' ')).toBe(false);
    expect(isHangulSyllable(undefined)).toBe(false);
  });
  describe('다보면·다보니 — 들여다보다 2차 KEEP', () => {
    const dabomyeon = buildSpellingCheckRuleFromBuiltIn({
      ...BUILT_IN_RULES.find((r) => r.find === '다보면'),
      enabled: true,
    });
    const daboni = buildSpellingCheckRuleFromBuiltIn({
      ...BUILT_IN_RULES.find((r) => r.find === '다보니'),
      enabled: true,
    });

    beforeAll(() => {
      setStdictVerbFormsForTests({
        lemmas: {
          들여다보다: ['들여다보니', '들여다보아', '들여다봐'],
        },
      });
    });

    afterAll(() => {
      clearStdictVerbFormsCache();
    });

    it('1차는 시트 표면 그대로 두고 lookbehind를 쓰지 않는다', () => {
      expect(dabomyeon.find).toBe('다보면');
      expect(dabomyeon.pattern).not.toBe('regex');
      expect(daboni.find).toBe('다보니');
    });

    it('들여다보면·들여다보니는 2차에서 KEEP', () => {
      expect(shouldKeepDaboInsideCompound('들여다보면')).toBe(true);
      expect(shouldKeepDaboInsideCompound('들여다보니')).toBe(true);
      const pages = [
        { pageNum: 1, text: '유심히 들여다보면' },
        { pageNum: 2, text: '사정을 들여다보니' },
      ];
      const groups = [
        {
          label: '다보면',
          instances: [
            {
              pageNum: 1,
              index: pages[0].text.indexOf('다보면'),
              matchedText: '다보면',
            },
          ],
        },
        {
          label: '다보니',
          instances: [
            {
              pageNum: 2,
              index: pages[1].text.indexOf('다보니'),
              matchedText: '다보니',
            },
          ],
        },
      ];
      expect(pruneDaboInsideCompoundHits(groups, pages, { analyze: () => null })).toEqual([]);
    });

    it('읽다보면·그러다보니·단독 다보면은 잡는다', () => {
      expect(hits([dabomyeon], '책을 읽다보면')).toEqual(['다보면']);
      expect(hits([daboni], '그러다보니 우리는')).toEqual(['다보니']);
      expect(hits([dabomyeon], '다보면 알 수 있다')).toEqual(['다보면']);
      expect(shouldKeepDaboInsideCompound('읽다보면')).toBe(false);
      expect(shouldKeepDaboInsideCompound('그러다보니')).toBe(false);
      expect(shouldKeepDaboInsideCompound('다보면')).toBe(false);
    });
  });

  describe('해질녘·해질 무렵 — 어절 시작 경계', () => {
    const nyeok = buildSpellingCheckRuleFromBuiltIn({
      ...BUILT_IN_RULES.find((r) => r.find === '해질녘'),
      enabled: true,
    });
    const muryeop = buildSpellingCheckRuleFromBuiltIn({
      ...BUILT_IN_RULES.find((r) => r.find === '해질 무렵'),
      enabled: true,
    });
    const glued = buildSpellingCheckRuleFromBuiltIn({
      ...BUILT_IN_RULES.find((r) => r.find === '해질무렵'),
      enabled: true,
    });

    it('붙여 쓴 해질녘·해질무렵은 requireLeadingBoundary', () => {
      expect(nyeok.requireLeadingBoundary).toBe(true);
      expect(glued.requireLeadingBoundary).toBe(true);
      expect(nyeok.spellingLeadingHangulBoundary).toBeUndefined();
    });

    it('띄어 쓴 해질 무렵은 정확 정규식 + requireLeadingBoundary (바른 「해 질 무렵」 제외)', () => {
      expect(muryeop.pattern).toBe('regex');
      expect(muryeop.requireLeadingBoundary).toBe(true);
      expect(muryeop.spellingLeadingHangulBoundary).toBeUndefined();
    });

    it('양성: 해질녘·해질 무렵', () => {
      expect(hits([nyeok], '해질녘 바람이')).toEqual(['해질녘']);
      expect(hits([muryeop], '해질 무렵 가장')).toEqual(['해질 무렵']);
    });

    it('음성: 해 질 무렵·따뜻해질 무렵·깨끗해질 때', () => {
      expect(hits([muryeop, nyeok, glued], '해 질 무렵')).toEqual([]);
      expect(hits([muryeop, nyeok, glued], '따뜻해질 무렵')).toEqual([]);
      expect(hits([muryeop, nyeok, glued], '선선해질 무렵')).toEqual([]);
      expect(hits([muryeop, nyeok, glued], '깨끗해질 때')).toEqual([]);
    });
  });

});
