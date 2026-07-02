import { describe, expect, it } from 'vitest';
import { buildRulesForPhraseSlot } from './phraseSlotRegister.js';

describe('phraseSlotRegister', () => {
  it('buildRulesForPhraseSlot는 등록 상한(1건)을 넘기지 않는다', () => {
    const existing = buildRulesForPhraseSlot([], '@시대');
    expect(existing).toHaveLength(1);

    const rules = [...existing];
    expect(buildRulesForPhraseSlot(rules, '@문자')).toEqual([]);
    expect(buildRulesForPhraseSlot(rules, '@시대')).toEqual([]);
  });
});
