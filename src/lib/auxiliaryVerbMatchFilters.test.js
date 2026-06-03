import { describe, expect, it } from 'vitest';
import { buildAuxiliaryVerbFindRules } from './auxiliaryVerbPattern.js';
import {
  isBonVerbHeadTooLongForAuxiliary,
  shouldSkipAuxiliaryVerbMatch,
} from './auxiliaryVerbMatchFilters.js';
import { matches } from '../test/matchText.js';

/** @param {import('./ruleTypes.js').Rule} rule @param {string} text */
function ruleMatches(rule, text) {
  if (!matches(rule, text)) return false;
  const re = new RegExp(
    rule.find.replace(/\\0/g, '\0'),
    'gu',
  );
  let m = re.exec(text);
  while (m) {
    if (!shouldSkipAuxiliaryVerbMatch(rule, m)) return true;
    m = re.exec(text);
  }
  return false;
}

describe('auxiliaryVerbMatchFilters', () => {
  it('본조 stems — 띄움만(좋아 했지만 / 좋아했지만 제외)', () => {
    const rules = buildAuxiliaryVerbFindRules('아 했');
    expect(rules.length).toBe(1);
    expect(matches(rules[0], '좋아 했지만')).toBe(true);
    expect(matches(rules[0], '좋아했지만')).toBe(false);
  });

  it('1 — 구 결합 어하 붙임(먹고 싶어하다) — 붙임 규칙 없음', () => {
    const rules = buildAuxiliaryVerbFindRules('어 하');
    expect(rules.length).toBe(1);
    expect(ruleMatches(rules[0], '먹고 싶어하다')).toBe(false);
    expect(ruleMatches(rules[0], '먹어 하다')).toBe(true);
  });

  it('2 — 조사 직후 보조(먹어도 보) — 띄움만', () => {
    const rule = buildAuxiliaryVerbFindRules('어 보')[0];
    expect(ruleMatches(rule, '먹어도보았다')).toBe(false);
    expect(ruleMatches(rule, '먹어 보았다')).toBe(true);
  });

  it('본용언 3음절 이상 — 표기 제외(기다려·매달려 동일)', () => {
    expect(isBonVerbHeadTooLongForAuxiliary('매달려', '어')).toBe(true);
    expect(isBonVerbHeadTooLongForAuxiliary('기다려', '어')).toBe(true);
    expect(isBonVerbHeadTooLongForAuxiliary('상상해', '해')).toBe(false);

    const eoBo = buildAuxiliaryVerbFindRules('어 보')[0];
    const haeBo = buildAuxiliaryVerbFindRules('해 보')[0];
    const eoBon = buildAuxiliaryVerbFindRules('어 본')[0];
    expect(ruleMatches(eoBo, '먹어 보았다')).toBe(true);
    expect(ruleMatches(haeBo, '상상해 보았다')).toBe(true);
    expect(ruleMatches(eoBon, '매달려 본다')).toBe(false);
    expect(ruleMatches(eoBon, '기다려 본다')).toBe(false);
  });

  it('2 — 의존명사+조사 뒤 붙임(읽은체를하) 제외', () => {
    const rule = { patternKind: 'auxiliary-verb', tailWord: '어 하' };
    /** @type {RegExpExecArray} */
    const match = Object.assign(['읽은체를한다', '읽은체를'], {
      index: 0,
      input: '읽은체를한다',
      groups: undefined,
    });
    expect(shouldSkipAuxiliaryVerbMatch(rule, match)).toBe(true);
  });
});
