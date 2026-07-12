import { describe, expect, it } from 'vitest';
import {
  appendUnifyDecisionFromPin,
  applyUnifyPinWithLedger,
  formatUnifyPinLedgerWarning,
  normalizeConsistencyDecisions,
  resolvePinnedForVariant,
} from './consistencyDecisions.js';
import { applyConsistencyUnifyPin } from './consistencyUnifyRegister.js';
import { registerConsistencyUnifyBatch } from './consistencyLiteralRegister.js';

function seedUnifyRules(...words) {
  /** @type {import('./ruleTypes.js').Rule[]} */
  let rules = [];
  registerConsistencyUnifyBatch(words.join(','), rules, (next) => {
    rules = next;
    return true;
  });
  return rules;
}

describe('consistencyDecisions', () => {
  it('normalize — find/unify/commonString 통과', () => {
    const normalized = normalizeConsistencyDecisions([
      {
        id: 'dec_1',
        kind: 'unify',
        at: '2026-07-10T00:00:00.000Z',
        pinned: '신라시대',
        variants: ['통일신라시대', '신라시대'],
      },
      {
        id: 'dec_2',
        kind: 'find',
        at: '2026-07-10T00:00:00.000Z',
        query: '찾기',
      },
      {
        id: 'dec_3',
        kind: 'commonString',
        at: '2026-07-11T00:00:00.000Z',
        pattern: '@시대',
      },
      { id: 'bad' },
    ]);
    expect(normalized).toHaveLength(3);
    expect(normalized[0]).toMatchObject({
      kind: 'unify',
      pinned: '신라시대',
      variants: ['통일신라시대'],
    });
    expect(normalized[1]).toMatchObject({ kind: 'find', query: '찾기' });
    expect(normalized[2]).toMatchObject({
      kind: 'commonString',
      pattern: '@시대',
    });
  });

  it('append — 📌 후 대장에 쌓인다', () => {
    const rules = applyConsistencyUnifyPin(
      seedUnifyRules('신라시대', '통일신라시대'),
      '신라시대',
    );
    const next = appendUnifyDecisionFromPin([], rules, '신라시대');
    expect(next).toHaveLength(1);
    expect(next[0].pinned).toBe('신라시대');
    expect(next[0].variants).toContain('통일신라시대');
  });

  it('resolvePinnedForVariant — 최신 1홉', () => {
    const decisions = [
      {
        id: 'a',
        kind: 'unify',
        at: '2026-07-01T00:00:00.000Z',
        pinned: '제미나이',
        variants: ['제미니'],
      },
      {
        id: 'b',
        kind: 'unify',
        at: '2026-07-10T00:00:00.000Z',
        pinned: 'Gemini',
        variants: ['제미나이'],
      },
    ];
    expect(resolvePinnedForVariant(decisions, '제미니')).toBe('제미나이');
    expect(resolvePinnedForVariant(decisions, '제미나이')).toBe('Gemini');
  });

  it('applyUnifyPinWithLedger — 핀 시 append, 해제 시 유지', () => {
    const base = seedUnifyRules('빨간표시', '파란표시');
    const first = applyUnifyPinWithLedger(base, [], '빨간표시');
    expect(first.pinnedApplied).toBe('빨간표시');
    expect(first.nextDecisions).toHaveLength(1);

    const cleared = applyUnifyPinWithLedger(
      first.nextRules,
      first.nextDecisions,
      '빨간표시',
    );
    expect(cleared.pinnedApplied).toBeNull();
    expect(cleared.nextDecisions).toHaveLength(1);
  });

  it('formatUnifyPinLedgerWarning — 과거 확정 경고', () => {
    const decisions = [
      {
        id: 'a',
        kind: 'unify',
        at: '2026-07-01T00:00:00.000Z',
        pinned: '제미나이',
        variants: ['제미니'],
      },
    ];
    const rules = seedUnifyRules('제미니', '제미나이', '제미 니');
    const warning = formatUnifyPinLedgerWarning(decisions, rules, '제미니');
    expect(warning).toContain('제미나이');
    expect(warning).toContain('자동 반영되지는');
  });
});
