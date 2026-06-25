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

  it('마이그레이션 시 일관성·통일형 메타를 보존한다', () => {
    const { rules } = applyCompoundRuleMigrations(
      [
        {
          find: 'a',
          replace: 'a',
          enabled: true,
          patternKind: 'compound-find',
          tailWord: '조선시대',
          consistencyLiteralEntry: true,
        },
        {
          find: 'b',
          replace: 'b',
          enabled: true,
          patternKind: 'compound-find',
          tailWord: '신라시대',
          consistencyUnifyEntry: true,
          consistencyUnifyPinned: true,
        },
        {
          find: 'c',
          replace: 'c',
          enabled: true,
          patternKind: 'compound-find',
          tailWord: '고려시대',
          consistencyUnifyEntry: true,
          overlayReplace: '신라시대',
        },
      ],
      10,
    );

    const literal = rules.find((r) => r.tailWord === '조선시대');
    const pinned = rules.find((r) => r.tailWord === '신라시대');
    const sibling = rules.find((r) => r.tailWord === '고려시대');

    expect(literal?.consistencyLiteralEntry).toBe(true);
    expect(pinned?.consistencyUnifyEntry).toBe(true);
    expect(pinned?.consistencyUnifyPinned).toBe(true);
    expect(sibling?.consistencyUnifyEntry).toBe(true);
    expect(sibling?.overlayReplace).toBe('신라시대');
  });
});
