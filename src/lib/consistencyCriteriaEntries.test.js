import { describe, expect, it } from 'vitest';
import {
  countActiveConsistencyCriteria,
  isConsistencyCriteriaEntryEnabled,
  listConsistencyCriteriaEntries,
  toggleConsistencyCriteriaEntry,
} from './consistencyCriteriaEntries.js';

describe('consistencyCriteriaEntries', () => {
  it('일관성·통일형·공통 문자열 항목을 합쳐 나열한다', () => {
    const rules = [
      {
        find: 'a',
        replace: 'b',
        enabled: true,
        patternKind: 'compound-find',
        tailWord: '한',
        consistencyLiteralEntry: true,
      },
      {
        find: 'b',
        replace: 'c',
        enabled: true,
        patternKind: 'compound-find',
        tailWord: '신라시대',
        consistencyUnifyEntry: true,
      },
      {
        find: '@시대',
        replace: '@시대',
        enabled: false,
        patternKind: 'phrase-slot-find',
        tailWord: '@시대',
      },
    ];
    expect(listConsistencyCriteriaEntries(rules).map((e) => e.tailWord)).toEqual([
      '@시대',
      '신라시대',
      '한',
    ]);
  });

  it('chipPreview 라벨도 목록에 포함한다', () => {
    const rules = [];
    const chips = [{ label: '고려시대', active: false }];
    expect(
      listConsistencyCriteriaEntries(rules, chips).map((e) => e.tailWord),
    ).toEqual(['고려시대']);
  });

  it('비활성 항목도 목록에 포함한다', () => {
    const rules = [
      {
        find: '@시대',
        replace: '@시대',
        enabled: false,
        patternKind: 'phrase-slot-find',
        tailWord: '@시대',
      },
    ];
    const row = { tailWord: '@시대' };
    expect(isConsistencyCriteriaEntryEnabled(rules, row)).toBe(false);
    const next = toggleConsistencyCriteriaEntry(rules, row, true);
    expect(isConsistencyCriteriaEntryEnabled(next, row)).toBe(true);
    expect(countActiveConsistencyCriteria(next).commonString).toBe(1);
  });

  it('활성 건수는 통일형·여러 개 찾기를 find에 합산한다', () => {
    const rules = [
      {
        find: 'a',
        replace: 'b',
        enabled: true,
        patternKind: 'compound-find',
        tailWord: '한',
        consistencyLiteralEntry: true,
      },
      {
        find: 'b',
        replace: 'c',
        enabled: false,
        patternKind: 'compound-find',
        tailWord: '신라시대',
        consistencyUnifyEntry: true,
      },
    ];
    expect(countActiveConsistencyCriteria(rules)).toEqual({
      find: 1,
      commonString: 0,
      total: 1,
    });
  });
});
