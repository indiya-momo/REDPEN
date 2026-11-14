import { describe, expect, it } from 'vitest';
import spellingRulesJson from '../data/spelling-rules.json';
import { BUILT_IN_RULES } from './builtInRules.js';
import { runRuleCheck } from './ruleEngine.js';
import {
  buildSpellingCheckRuleFromBuiltIn,
  isHangulSyllable,
  spellingRuleNeedsLeadingHangulBoundary,
} from './spellingRuleEntry.js';

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
  });

  it('isHangulSyllable', () => {
    expect(isHangulSyllable('가')).toBe(true);
    expect(isHangulSyllable('힣')).toBe(true);
    expect(isHangulSyllable('ㄱ')).toBe(false);
    expect(isHangulSyllable('a')).toBe(false);
    expect(isHangulSyllable(' ')).toBe(false);
    expect(isHangulSyllable(undefined)).toBe(false);
  });
});
