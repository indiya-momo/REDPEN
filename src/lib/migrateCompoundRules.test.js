import { describe, expect, it } from 'vitest';
import {
  COMPOUND_MIGRATE_VERSION,
  applyCompoundRuleMigrations,
  removeBadCompoundRules,
} from './migrateCompoundRules.js';

describe('migrateCompoundRules', () => {
  it('잘못된 tailWord 규칙 제거', () => {
    const rules = removeBadCompoundRules([
      {
        find: 'x',
        replace: 'y',
        enabled: true,
        patternKind: 'compound-find',
        tailWord: '단어박',
      },
      {
        find: 'a',
        replace: 'b',
        enabled: true,
        patternKind: 'compound-find',
        tailWord: '경제정책',
      },
    ]);
    expect(rules).toHaveLength(1);
    expect(rules[0].tailWord).toBe('경제정책');
  });

  it('구버전은 마이그레이션 후 버전 갱신', () => {
    const { rules, version } = applyCompoundRuleMigrations(
      [
        {
          find: 'x',
          replace: 'y',
          enabled: true,
          patternKind: 'compound-find',
          tailWord: '@시대',
        },
      ],
      0,
    );
    expect(version).toBe(COMPOUND_MIGRATE_VERSION);
    expect(rules.some((r) => r.patternKind === 'phrase-slot-find')).toBe(true);
  });
});
