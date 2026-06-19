import { describe, expect, it } from 'vitest';
import { buildAuxiliaryVerbFindRules } from './auxiliaryVerbPattern.js';
import { runRuleCheck } from './ruleEngine.js';
import { matches } from '../test/matchText.js';

const USER_LINE =
  '비 사이의 작동을 돕는 간격 조절기 slack adjuster 같은 역할을 해 왔다"고 말한다. 시스템 전반이 화물차\n';

describe('해 왔 — 왔다 뒤 따옴표 경계', () => {
  it('straight double quote after 왔다 (99쪽 인용문)', () => {
    const rule = buildAuxiliaryVerbFindRules('해 왔')[0];
    expect(matches(rule, USER_LINE)).toBe(true);
  });

  it('runRuleCheck on page 99 user line', () => {
    const rules = buildAuxiliaryVerbFindRules('해 왔').map((r) => ({
      ...r,
      enabled: true,
      bonBojoItemId: 'verb-oda',
    }));
    const { results } = runRuleCheck(
      [{ pageNum: 99, text: USER_LINE, items: [], itemRefs: [] }],
      rules,
    );
    expect(results[0]?.instances.length ?? 0).toBeGreaterThan(0);
    expect(results[0]?.instances[0]?.matchedText).toMatch(/해\s+왔다/);
  });
});
