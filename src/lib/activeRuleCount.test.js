import { describe, expect, it } from 'vitest';
import { buildCautionCheckRules, defaultCautionEnabled } from './cautionRules.js';
import {
  BUILT_IN_QUOTA_RULES,
  BUILT_IN_RULES,
  builtInEnabledFromSheet,
} from './builtInRules.js';
import { builtInEnabledKey } from './spellingRuleEntry.js';
import {
  countActiveRules,
  countBuiltInGuideActiveRules,
  countConsistencyActiveRules,
  countSpellingActiveRules,
  isOverMaxRules,
} from './activeRuleCount.js';
import { MAX_RULES } from './ruleTypes.js';

/** 맞춤법 한도 테스트 — 기본 켜진 편집자 검토 규칙이 섞이지 않도록 */
function allCautionDisabled() {
  return Object.fromEntries(
    Object.keys(defaultCautionEnabled()).map((id) => [id, false]),
  );
}

describe('activeRuleCount', () => {
  it('내장 기본 체크는 시트 enabled 열과 같다', () => {
    const defaults = builtInEnabledFromSheet();
    for (const r of BUILT_IN_RULES) {
      expect(defaults[builtInEnabledKey(r)]).toBe(r.enabled === true);
    }
  });

  it('규칙 제외(참고)는 한도 집계에서 빠지고 제외 수에만 잡힌다', () => {
    const guideOnlyOn = Object.fromEntries(
      BUILT_IN_RULES.filter((r) => r.countsInQuota === false).map((r) => [
        builtInEnabledKey(r),
        true,
      ]),
    );
    expect(
      countSpellingActiveRules({
        builtInEnabled: guideOnlyOn,
        cautionEnabled: allCautionDisabled(),
      }),
    ).toBe(0);
    expect(countBuiltInGuideActiveRules({ builtInEnabled: guideOnlyOn })).toBe(
      BUILT_IN_RULES.filter((r) => r.countsInQuota === false).length,
    );
  });

  it('내장 전부 ON + 일관성 없음 = 한도 포함 내장 개수', () => {
    const builtInOn = Object.fromEntries(
      BUILT_IN_RULES.map((r) => [builtInEnabledKey(r), true]),
    );
    expect(
      countSpellingActiveRules({
        builtInEnabled: builtInOn,
        cautionEnabled: allCautionDisabled(),
      }),
    ).toBe(BUILT_IN_QUOTA_RULES.length);
  });

  it('띄어쓰기만 켜면 활성 규칙 수에 caution regex 수가 더해짐', () => {
    const builtInOff = Object.fromEntries(
      BUILT_IN_RULES.map((r) => [builtInEnabledKey(r), false]),
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
