import { describe, expect, it } from 'vitest';
import {
  BUILT_IN_GUIDE_RULES,
  BUILT_IN_RULES,
  SPELLING_RULES_FP,
  SPELLING_SERVICE_NO_QUOTA_FINDS,
  countsTowardSpellingQuota,
  isBuiltInRuleVisible,
  migrateBuiltInEnabled,
} from './builtInRules.js';

describe('migrateBuiltInEnabled', () => {
  it('규칙 제외·시트 enabled TRUE는 예전 저장(꺼짐)보다 켜진다', () => {
    const saved = {
      '과반수 이상': false,
      '우리 나라': false,
      구별: false,
      구분: true,
    };
    const merged = migrateBuiltInEnabled(saved, SPELLING_RULES_FP);
    for (const r of BUILT_IN_GUIDE_RULES.filter((x) => x.enabled === true)) {
      expect(merged[r.find], r.find).toBe(true);
    }
  });
});

describe('isBuiltInRuleVisible', () => {
  it('visible이 false가 아니면 UI에 보인다', () => {
    expect(isBuiltInRuleVisible({ visible: true })).toBe(true);
    expect(isBuiltInRuleVisible({})).toBe(true);
    expect(isBuiltInRuleVisible({ visible: false })).toBe(false);
  });
});

describe('SPELLING_SERVICE_NO_QUOTA_FINDS', () => {
  it('서비스 목록 find는 규칙 제외(한도 밖)로 분류된다', () => {
    for (const find of SPELLING_SERVICE_NO_QUOTA_FINDS) {
      const rule = BUILT_IN_RULES.find((r) => r.find === find);
      expect(rule, `missing rule: ${find}`).toBeDefined();
      expect(countsTowardSpellingQuota(rule)).toBe(false);
      expect(BUILT_IN_GUIDE_RULES.some((r) => r.find === find)).toBe(true);
    }
  });
});
