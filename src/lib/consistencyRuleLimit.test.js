import { describe, expect, it } from 'vitest';
import {
  canAddPhraseSlotRegisteredEntries,
  countPhraseSlotRegisteredEntries,
  MAX_PHRASE_SLOT_REGISTERED_ENTRIES,
} from './consistencyRuleLimit.js';

describe('consistencyRuleLimit', () => {
  it('counts phrase-slot rows only', () => {
    const rules = [
      {
        find: 'a',
        replace: 'a',
        enabled: true,
        patternKind: 'compound-find',
        tailWord: '조선시대',
      },
      {
        find: '@',
        replace: '@',
        enabled: true,
        patternKind: 'phrase-slot-find',
        tailWord: '@시대',
      },
    ];
    expect(countPhraseSlotRegisteredEntries(rules)).toBe(1);
  });

  it('blocks above max for phrase-slot', () => {
    const rules = Array.from(
      { length: MAX_PHRASE_SLOT_REGISTERED_ENTRIES },
      (_, i) => ({
        find: '@',
        replace: '@',
        enabled: true,
        patternKind: 'phrase-slot-find',
        tailWord: `@slot${i}`,
      }),
    );
    expect(canAddPhraseSlotRegisteredEntries(rules, 1)).toBe(false);
    expect(canAddPhraseSlotRegisteredEntries(rules, 0)).toBe(true);
  });
});
