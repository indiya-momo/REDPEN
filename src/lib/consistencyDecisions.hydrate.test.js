import { describe, expect, it } from 'vitest';
import {
  appendFindDecisions,
  hydrateConsistencyDecisionsFromRules,
} from './consistencyDecisions.js';

describe('hydrateConsistencyDecisionsFromRules', () => {
  it('등록 규칙만으로 가짜 확정 이력을 만들지 않는다', () => {
    /** @type {import('./ruleTypes.js').Rule[]} */
    const rules = [
      {
        find: '고구려',
        replace: '고구려',
        enabled: true,
        patternKind: 'compound-find',
        consistencyLiteralEntry: true,
        tailWord: '고구려',
        category: 'consistency',
      },
    ];
    const out = hydrateConsistencyDecisionsFromRules(
      [],
      rules,
      '2026-07-12T10:15:00.000Z',
    );
    expect(out).toEqual([]);
  });

  it('실제 대장만 정규화해 남긴다', () => {
    /** @type {import('./ruleTypes.js').Rule[]} */
    const rules = [
      {
        find: '고구려',
        replace: '고구려',
        enabled: true,
        patternKind: 'compound-find',
        consistencyLiteralEntry: true,
        tailWord: '고구려',
        category: 'consistency',
      },
    ];
    const existing = appendFindDecisions([], ['고구려'], {
      at: '2026-07-01T00:00:00.000Z',
    });
    const out = hydrateConsistencyDecisionsFromRules(
      existing,
      rules,
      '2026-07-12T10:15:00.000Z',
    );
    expect(out).toHaveLength(1);
    expect(out[0].at).toBe('2026-07-01T00:00:00.000Z');
  });
});
