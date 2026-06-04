import { describe, expect, it } from 'vitest';
import { buildAuxiliaryVerbFindRules } from './auxiliaryVerbPattern.js';
import {
  isBonVerbHeadOnAllowList,
  isBonVerbHeadTooLongForAuxiliary,
  shouldSkipAuxiliaryVerbMatch,
} from './auxiliaryVerbMatchFilters.js';
import { bonVerbAllowForItemId } from './bonBojoRules.js';
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

  it('bon_allow — 동사 표면형만(기다려·깨트려), 명사+해는 제외', () => {
    const allow = bonVerbAllowForItemId('verb-boda1');
    expect(allow).toContain('기다려');
    expect(allow).toContain('깨트려');
    expect(allow).not.toContain('생각해');
    expect(allow).not.toContain('사랑해');
    expect(isBonVerbHeadOnAllowList('기다려', '어', allow)).toBe(true);
    expect(isBonVerbHeadOnAllowList('생각해', '해', allow)).toBe(false);
    expect(isBonVerbHeadOnAllowList('매달려', '어', allow)).toBe(false);
  });

  it('역할을 해 왔다 — 명사+조사+해(역할을해)는 3음절 제한 제외', () => {
    const rule = buildAuxiliaryVerbFindRules('해 왔')[0];
    expect(isBonVerbHeadTooLongForAuxiliary('역할을해', '해')).toBe(false);
    expect(ruleMatches(rule, '역할을 해 왔다.')).toBe(true);
    expect(ruleMatches(rule, '역할을해 왔다.')).toBe(true);
    expect(ruleMatches(rule, '역할을 해 왔다고')).toBe(true);
    expect(
      ruleMatches(
        rule,
        'slack adjuster 같은 역할을 해 왔다"고 말한다.',
      ),
    ).toBe(true);
    expect(isBonVerbHeadTooLongForAuxiliary('주장해', '해')).toBe(true);
    expect(ruleMatches(rule, '주장해 왔다.')).toBe(false);
  });

  it('명사 어근+해(생각해 보다) — 본조 검사 제외', () => {
    const haeBo = buildAuxiliaryVerbFindRules('해 보')[0];
    expect(ruleMatches(haeBo, '생각해 보았다')).toBe(false);
    expect(ruleMatches(haeBo, '사랑해 보았다')).toBe(false);
    expect(ruleMatches(haeBo, '상상해 보았다')).toBe(false);
    expect(ruleMatches(haeBo, '주장해 보았다')).toBe(false);
  });

  it('본용언 3음절 이상 — bon_allow만 포함(기다려), 나머지 제외(매달려·주장해)', () => {
    expect(isBonVerbHeadTooLongForAuxiliary('매달려', '어')).toBe(true);
    expect(isBonVerbHeadTooLongForAuxiliary('기다려', '어')).toBe(true);
    expect(isBonVerbHeadTooLongForAuxiliary('주장해', '해')).toBe(true);
    expect(isBonVerbHeadTooLongForAuxiliary('상상해', '해')).toBe(true);
    expect(isBonVerbHeadTooLongForAuxiliary('만들어', '어')).toBe(false);
    expect(isBonVerbHeadTooLongForAuxiliary('먹어', '어')).toBe(false);

    const eoBo = buildAuxiliaryVerbFindRules('어 보')[0];
    const haeBo = buildAuxiliaryVerbFindRules('해 보')[0];
    expect(ruleMatches(eoBo, '먹어 보았다')).toBe(true);
    expect(ruleMatches(haeBo, '상상해 보았다')).toBe(false);
    expect(ruleMatches(haeBo, '주장해 왔다')).toBe(false);

    const allowRule = {
      patternKind: 'auxiliary-verb',
      tailWord: '어 보',
      bonBojoItemId: 'verb-boda1',
    };
    /** @type {RegExpExecArray} */
    const allowMatch = Object.assign(['기다려 보았다', '기다려'], {
      index: 0,
      input: '기다려 보았다',
      groups: undefined,
    });
    expect(shouldSkipAuxiliaryVerbMatch(allowRule, allowMatch)).toBe(false);
    /** @type {RegExpExecArray} */
    const blockMatch = Object.assign(['매달려 보았다', '매달려'], {
      index: 0,
      input: '매달려 보았다',
      groups: undefined,
    });
    expect(shouldSkipAuxiliaryVerbMatch(allowRule, blockMatch)).toBe(true);
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

