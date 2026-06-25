import { describe, expect, it } from 'vitest';
import {
  canAddConsistencyLiteralRegisteredEntries,
  canAddGlobalExcludeRegisteredEntries,
  canAddPhraseSlotRegisteredEntries,
  countConsistencyLiteralRegisteredEntries,
  countPhraseSlotRegisteredEntries,
  globalExcludeRegistrationBlockedMessage,
  MAX_CONSISTENCY_CRITERIA_SLOTS,
  MAX_CONSISTENCY_UNIFY_SLOTS,
  MAX_PHRASE_SLOT_REGISTERED_ENTRIES,
  canAddConsistencyUnifyRegisteredEntries,
  countConsistencyUnifyRegisteredEntries,
} from './consistencyRuleLimit.js';

describe('consistencyRuleLimit', () => {
  it('counts literal and phrase-slot rows separately', () => {
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
    expect(countConsistencyLiteralRegisteredEntries(rules)).toBe(1);
    expect(countPhraseSlotRegisteredEntries(rules)).toBe(1);
  });

  it('blocks above max for literal consistency', () => {
    const rules = Array.from(
      { length: MAX_CONSISTENCY_CRITERIA_SLOTS },
      (_, i) => ({
        find: 'a',
        replace: 'a',
        enabled: true,
        patternKind: 'compound-find',
        tailWord: `항목${i}`,
      }),
    );
    expect(canAddConsistencyLiteralRegisteredEntries(rules, 1)).toBe(false);
    expect(canAddConsistencyLiteralRegisteredEntries(rules, 0)).toBe(true);
    expect(canAddConsistencyLiteralRegisteredEntries(rules, 2)).toBe(false);
  });

  it('allows comma batch within remaining literal entries', () => {
    const rules = Array.from({ length: 3 }, (_, i) => ({
      find: 'a',
      replace: 'a',
      enabled: true,
      patternKind: 'compound-find',
      tailWord: `항목${i}`,
    }));
    expect(canAddConsistencyLiteralRegisteredEntries(rules, 2)).toBe(true);
    expect(canAddConsistencyLiteralRegisteredEntries(rules, 3)).toBe(false);
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

  it('blocks above max for global exclude entries', () => {
    expect(canAddGlobalExcludeRegisteredEntries(0, 1)).toBe(true);
    expect(canAddGlobalExcludeRegisteredEntries(1, 1)).toBe(false);
    expect(canAddGlobalExcludeRegisteredEntries(0, 2)).toBe(false);
    expect(globalExcludeRegistrationBlockedMessage(1, 1)).toContain('1항목');
  });

  it('counts unify entries separately from literal find', () => {
    const rules = [
      {
        find: 'a',
        replace: 'a',
        enabled: true,
        patternKind: 'compound-find',
        tailWord: '조선시대',
      },
      {
        find: 'b',
        replace: 'b',
        enabled: true,
        patternKind: 'compound-find',
        tailWord: '신라시대',
        consistencyUnifyEntry: true,
      },
    ];
    expect(countConsistencyUnifyRegisteredEntries(rules)).toBe(1);
    expect(canAddConsistencyUnifyRegisteredEntries(rules, 2)).toBe(true);
    expect(canAddConsistencyUnifyRegisteredEntries(rules, 3)).toBe(false);
  });

  it('blocks above max for unify entries', () => {
    const rules = Array.from({ length: MAX_CONSISTENCY_UNIFY_SLOTS }, (_, i) => ({
      find: 'a',
      replace: 'a',
      enabled: true,
      patternKind: 'compound-find',
      tailWord: `통일${i}`,
      consistencyUnifyEntry: true,
    }));
    expect(canAddConsistencyUnifyRegisteredEntries(rules, 1)).toBe(false);
  });
});
