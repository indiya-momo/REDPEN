import { describe, expect, it } from 'vitest';
import {
  buildRulesForEntry,
  isLiteralConsistencyEntry,
} from './compoundPairRegister.js';
import { runRuleCheck } from './ruleEngine.js';
import { SPACE_VISIBLE_CHAR } from './spaceVisibleText.js';

describe('compoundPairRegister', () => {
  it('아 두·보 — 일관성 문자열로 등록 가능', () => {
    expect(isLiteralConsistencyEntry('아 두')).toBe(true);
    expect(isLiteralConsistencyEntry('보')).toBe(true);
    expect(buildRulesForEntry([], '아 두').length).toBeGreaterThan(0);
  });

  it('˅(표시용 공백)이 tailWord에 있어도 실제 공백으로 등록·검색', () => {
    const visible = `담아${SPACE_VISIBLE_CHAR}두어요`;
    const rules = buildRulesForEntry([], visible).map((r) => ({
      ...r,
      enabled: true,
    }));
    expect(rules[0]?.tailWord).toBe('담아 두어요');

    const page = {
      pageNum: 1,
      text: '원고에 이야기를 담아 두어요.\n',
      items: [],
      itemRefs: [],
    };
    const hits = runRuleCheck([page], rules).results.flatMap((g) =>
      g.instances.map((i) => i.matchedText),
    );
    expect(hits).toContain('담아 두어요');
  });
});
