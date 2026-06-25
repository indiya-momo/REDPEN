import { describe, expect, it, vi } from 'vitest';
import {
  registerConsistencyLiteralBatch,
  registerConsistencyUnifyBatch,
} from './consistencyLiteralRegister.js';
import { listConsistencyLiteralEntries } from './compoundPairRegister.js';
import { listConsistencyUnifyEntries } from './consistencyRuleLimit.js';

describe('registerConsistencyLiteralBatch', () => {
  it('쉼표로 구분된 항목을 그대로 여러 건 등록한다', () => {
    const onApplyRules = vi.fn(() => true);
    const ok = registerConsistencyLiteralBatch(
      '신라시대,신라˅시대,통일신라시대',
      [],
      onApplyRules,
    );
    expect(ok).toBe(true);
    expect(onApplyRules).toHaveBeenCalledTimes(1);
    const next = onApplyRules.mock.calls[0][0];
    const tailWords = next.map((r) => r.tailWord).sort();
    expect(tailWords).toEqual(['신라 시대', '신라시대', '통일신라시대']);
    expect(next.every((rule) => rule.consistencyLiteralEntry)).toBe(true);
  });

  it('쉼표 입력 순서대로 칩에 표시한다', () => {
    const onApplyRules = vi.fn(() => true);
    registerConsistencyLiteralBatch('변한,마한,진한', [], onApplyRules);
    const next = onApplyRules.mock.calls[0][0];
    const ordered = listConsistencyLiteralEntries(next).map((e) => e.tailWord);
    expect(ordered).toEqual(['변한', '마한', '진한']);
  });
});

describe('registerConsistencyUnifyBatch', () => {
  it('통일형 만들기 항목은 consistencyUnifyEntry로 표시한다', () => {
    const onApplyRules = vi.fn(() => true);
    registerConsistencyUnifyBatch('신라시대,고려시대', [], onApplyRules);
    const next = onApplyRules.mock.calls[0][0];
    expect(next.every((rule) => rule.consistencyUnifyEntry)).toBe(true);
  });

  it('통일형도 placeholder 입력 순서를 유지한다', () => {
    const onApplyRules = vi.fn(() => true);
    registerConsistencyUnifyBatch(
      '신라시대,신라˅시대,통일신라시대',
      [],
      onApplyRules,
    );
    const next = onApplyRules.mock.calls[0][0];
    expect(listConsistencyUnifyEntries(next).map((e) => e.tailWord)).toEqual([
      '신라시대',
      '신라 시대',
      '통일신라시대',
    ]);
  });

  it('통일형 만들기는 3개까지만 등록한다', () => {
    const alertMock = vi.fn();
    vi.stubGlobal('alert', alertMock);
    const rules = Array.from({ length: 3 }, (_, i) => ({
      find: 'a',
      replace: 'a',
      enabled: true,
      patternKind: 'compound-find',
      tailWord: `항목${i}`,
      consistencyUnifyEntry: true,
    }));
    const onApplyRules = vi.fn(() => true);
    const ok = registerConsistencyUnifyBatch('추가항목', rules, onApplyRules);
    expect(ok).toBe(false);
    expect(onApplyRules).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('일관성 찾기에 있는 항목을 통일형으로 승격한다', () => {
    const rules = [
      {
        find: '신라',
        replace: '$0',
        enabled: true,
        patternKind: 'compound-find',
        tailWord: '신라시대',
      },
    ];
    const onApplyRules = vi.fn(() => true);
    const ok = registerConsistencyUnifyBatch('신라시대', rules, onApplyRules);
    expect(ok).toBe(true);
    expect(onApplyRules.mock.calls[0][0][0].consistencyUnifyEntry).toBe(true);
  });
});
