import { describe, expect, it } from 'vitest';
import {
  SPELLING_RULES_FP,
  isBuiltInRuleVisible,
  migrateBuiltInEnabled,
} from './builtInRules.js';

describe('migrateBuiltInEnabled', () => {
  it('동일 fingerprint에서는 저장된 체크 상태를 우선한다', () => {
    const saved = {
      '과반수 이상': false,
      '우리 나라': false,
    };
    const merged = migrateBuiltInEnabled(saved, SPELLING_RULES_FP);
    expect(merged['과반수 이상']).toBe(false);
    expect(merged['우리 나라']).toBe(false);
  });

  it('finds 규칙은 예전 find 키가 켜져 있으면 ruleId로 이전한다', () => {
    const merged = migrateBuiltInEnabled(
      { 애덤: true, 애썸: false },
      SPELLING_RULES_FP,
    );
    if (merged['foreign-adam'] !== undefined) {
      expect(merged['foreign-adam']).toBe(true);
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

