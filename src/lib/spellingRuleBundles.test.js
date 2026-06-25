import { describe, expect, it } from 'vitest';
import {
  buildSpellingRuleBundles,
  groupRulesByDivider,
  normalizeDividerLabel,
  spellingBundleDisplayLabel,
} from './spellingRuleBundles.js';

/** @param {Partial<import('./ruleTypes.js').Rule>} patch */
function rule(patch) {
  return {
    find: 'a',
    replace: 'b',
    enabled: true,
    ...patch,
  };
}

describe('normalizeDividerLabel', () => {
  it('빈 값과 "-"는 이름 없음으로 처리한다', () => {
    expect(normalizeDividerLabel('')).toBe('');
    expect(normalizeDividerLabel('-')).toBe('');
    expect(normalizeDividerLabel('  -  ')).toBe('');
  });
});

describe('spellingBundleDisplayLabel', () => {
  it('dividerLabel → dividerGroup → find 순으로 표시한다', () => {
    expect(
      spellingBundleDisplayLabel(
        rule({ find: '갯수', dividerGroup: 'E', dividerLabel: '사이시옷 법칙' }),
      ),
    ).toBe('사이시옷 법칙');
    expect(
      spellingBundleDisplayLabel(rule({ find: '갯수', dividerGroup: 'E' })),
    ).toBe('E');
    expect(spellingBundleDisplayLabel(rule({ find: '갯수' }))).toBe('갯수');
  });
});

describe('buildSpellingRuleBundles', () => {
  it('연속된 dividerGroup을 하나의 묶음으로 만든다', () => {
    const bundles = buildSpellingRuleBundles([
      rule({ find: '갯수', replace: '개수', dividerGroup: 'E', dividerLabel: '사이시옷 법칙' }),
      rule({ find: '싯가', replace: '시가', dividerGroup: 'E', dividerLabel: '사이시옷 법칙' }),
      rule({ find: '댓가', replace: '대가', dividerGroup: 'E2', dividerLabel: '사이시옷 법칙2' }),
    ]);
    expect(bundles).toHaveLength(2);
    expect(bundles[0]).toMatchObject({
      id: 'E',
      label: '사이시옷 법칙',
      ruleCount: 2,
    });
    expect(bundles[1]).toMatchObject({
      id: 'E2',
      label: '사이시옷 법칙2',
      ruleCount: 1,
    });
  });

  it('dividerGroup 없는 규칙은 단독 묶음으로 만든다', () => {
    const groups = groupRulesByDivider([
      rule({ find: 'solo', replace: 'solo2' }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].rules).toHaveLength(1);
    expect(groups[0].key.startsWith('__single_')).toBe(true);
  });
});
