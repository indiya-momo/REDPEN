import { describe, expect, it } from 'vitest';
import {
  consistencyGroupScope,
  filterCustomRulesByConsistencyScope,
} from './consistencyCheckScopes.js';

describe('consistencyCheckScopes', () => {
  it('filters literal-slot rules by pattern kind', () => {
    const rules = [
      { id: 'a', enabled: true, patternKind: 'compound-find' },
      { id: 'b', enabled: true, patternKind: 'auxiliary-verb' },
      { id: 'c', enabled: false, patternKind: 'phrase-slot-find' },
    ];
    const literal = filterCustomRulesByConsistencyScope(rules, 'literal-slot');
    expect(literal.map((r) => r.id)).toEqual(['a']);
    const aux = filterCustomRulesByConsistencyScope(rules, 'auxiliary');
    expect(aux.map((r) => r.id)).toEqual(['b']);
  });

  it('classifies result groups by scope', () => {
    expect(
      consistencyGroupScope({ patternKind: 'compound-spacing', instances: [] }),
    ).toBe('literal-slot');
    expect(
      consistencyGroupScope({ patternKind: 'auxiliary-verb', instances: [] }),
    ).toBe('auxiliary');
    expect(consistencyGroupScope({ patternKind: 'other', instances: [] })).toBe(
      'other',
    );
  });
});
