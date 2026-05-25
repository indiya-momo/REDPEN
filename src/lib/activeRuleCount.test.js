import { describe, expect, it } from 'vitest';
import { buildCautionCheckRules } from './cautionRules.js';
import { BUILT_IN_RULES, builtInEnabledFromSheet } from './builtInRules.js';
import {
  countActiveRules,
  countConsistencyActiveRules,
  countSpellingActiveRules,
  isOverMaxRules,
} from './activeRuleCount.js';
import { MAX_RULES } from './ruleTypes.js';

describe('activeRuleCount', () => {
  it('내장 기본값은 모두 꺼짐', () => {
    const defaults = builtInEnabledFromSheet();
    expect(Object.values(defaults).every((v) => v === false)).toBe(true);
  });

  it('내장 전부 ON + 일관성 없음 = 내장 개수', () => {
    const builtInOn = Object.fromEntries(
      BUILT_IN_RULES.map((r) => [r.find, true]),
    );
    expect(countSpellingActiveRules({ builtInEnabled: builtInOn })).toBe(
      BUILT_IN_RULES.length,
    );
  });

  it('띄어쓰기만 켜면 활성 규칙 수에 caution regex 수가 더해짐', () => {
    const builtInOff = Object.fromEntries(
      BUILT_IN_RULES.map((r) => [r.find, false]),
    );
    const cautionEnabled = { 'josa-uinoun-mankum': true };
    const cautionRules = buildCautionCheckRules(cautionEnabled);
    expect(cautionRules.length).toBeGreaterThanOrEqual(1);
    expect(
      countActiveRules({
        builtInEnabled: builtInOff,
        cautionEnabled,
        customRules: [],
      }),
    ).toBe(cautionRules.length);
  });

  it('일관성 활성 규칙만 customRules에서 센다', () => {
    const customRules = [
      { find: 'a', replace: 'b', enabled: true },
      { find: 'c', replace: 'd', enabled: false },
    ];
    expect(countConsistencyActiveRules(customRules)).toBe(1);
  });

  it('본용언+보조용언(auxiliary-verb)은 일관성 규칙 수에서 제외한다', () => {
    const customRules = [
      { find: 'a', replace: 'b', enabled: true },
      {
        find: 'x',
        replace: '$0',
        enabled: true,
        patternKind: 'auxiliary-verb',
        tailWord: '보',
      },
    ];
    expect(countConsistencyActiveRules(customRules)).toBe(1);
  });

  it('isOverMaxRules는 MAX_RULES 초과만 true', () => {
    expect(isOverMaxRules(MAX_RULES)).toBe(false);
    expect(isOverMaxRules(MAX_RULES + 1)).toBe(true);
  });
});
