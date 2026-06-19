import { describe, expect, it } from 'vitest';
import {
  validateBonBojoRules,
  validateCautionRules,
  validateSpellingRules,
} from './validateDataJson.js';
import spellingRules from '../data/spelling-rules.json';
import cautionRules from '../data/caution-rules.json';
import bonBojoRules from '../data/bon-bojo-rules.json';

describe('validateSpellingRules', () => {
  it('accepts committed spelling-rules.json', () => {
    expect(validateSpellingRules(spellingRules)).toEqual([]);
  });

  it('rejects missing enabled', () => {
    const issues = validateSpellingRules([
      { find: 'a', replace: 'b', enabled: 'yes' },
    ]);
    expect(issues.some((i) => i.path.includes('enabled'))).toBe(true);
  });

  it('rejects duplicate find+replace', () => {
    const issues = validateSpellingRules([
      { find: 'x', replace: 'y', enabled: true },
      { find: 'x', replace: 'y', enabled: false },
    ]);
    expect(issues.some((i) => i.message.includes('duplicate'))).toBe(true);
  });
});

describe('validateCautionRules', () => {
  it('accepts committed caution-rules.json', () => {
    expect(validateCautionRules(cautionRules)).toEqual([]);
  });

  it('requires matchMode', () => {
    const issues = validateCautionRules({
      groups: [
        {
          id: 'g1',
          tip: '',
          items: [{ id: 'i1', label: '가', enabled: true }],
        },
      ],
    });
    expect(issues.some((i) => i.path.includes('matchMode'))).toBe(true);
  });
});

describe('validateBonBojoRules', () => {
  it('accepts committed bon-bojo-rules.json', () => {
    expect(validateBonBojoRules(bonBojoRules)).toEqual([]);
  });
});
