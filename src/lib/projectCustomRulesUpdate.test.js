import { describe, expect, it } from 'vitest';
import { planProjectCustomRulesUpdate } from './projectCustomRulesUpdate.js';
import { MAX_RULES } from './ruleTypes.js';

describe('planProjectCustomRulesUpdate', () => {
  it('활성 규칙 상한을 넘기면 거부한다', () => {
    const overLimitRules = Array.from({ length: MAX_RULES + 1 }, (_, i) => ({
      find: `word-${i}`,
      replace: `word-${i}`,
      enabled: true,
      patternKind: 'compound-find',
      tailWord: `word-${i}`,
    }));
    const result = planProjectCustomRulesUpdate(
      { builtInEnabled: {}, cautionEnabled: {}, customRules: [] },
      overLimitRules,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('max_rules');
    }
  });

  it('상한 이내면 customRules를 허용한다', () => {
    const result = planProjectCustomRulesUpdate(
      { builtInEnabled: {}, cautionEnabled: {}, customRules: [] },
      [{ find: 'a', replace: 'b', enabled: true }],
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.nextCustomRules).toHaveLength(1);
    }
  });
});
