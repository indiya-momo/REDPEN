import { describe, expect, it } from 'vitest';
import {
  buildCautionRuleBundles,
  cautionItemBundleKey,
} from './cautionRuleBundles.js';

/** @param {Partial<import('./cautionRules.js').CautionGroup> & { id: string }} group */
function group(group) {
  return {
    tip: '',
    items: [],
    ...group,
  };
}

/** @param {string} id @param {Partial<import('./cautionRules.js').CautionItem>} [overrides */
function item(id, overrides = {}) {
  return {
    id,
    label: id,
    enabled: true,
    matchMode: 'any-before',
    inventoryOnly: false,
    ...overrides,
  };
}

describe('cautionItemBundleKey', () => {
  it('항목 groupLabel을 우선한다', () => {
    expect(
      cautionItemBundleKey(
        item('a', { groupLabel: '띄어쓰기로 뜻이 달라지는 경우' }),
        group({ id: 'g1', title: '틀리기 쉬운 경우' }),
      ),
    ).toBe('띄어쓰기로 뜻이 달라지는 경우');
  });
});

describe('buildCautionRuleBundles', () => {
  it('같은 groupLabel 항목을 한 묶음으로 합친다', () => {
    const bundles = buildCautionRuleBundles([
      group({
        id: 'eogan-eomi',
        title: '틀리기 쉬운 경우',
        items: [
          item('mot', { groupLabel: '띄어쓰기로 뜻이 달라지는 경우' }),
          item('doei', { groupLabel: '틀리기 쉬운 경우' }),
          item('aniyo', { groupLabel: '틀리기 쉬운 경우' }),
        ],
      }),
    ]);

    expect(bundles).toHaveLength(2);
    expect(bundles[0].label).toBe('띄어쓰기로 뜻이 달라지는 경우');
    expect(bundles[0].entries.map((e) => e.item.id)).toEqual(['mot']);
    expect(bundles[1].label).toBe('틀리기 쉬운 경우');
    expect(bundles[1].ruleCount).toBe(2);
  });
});
