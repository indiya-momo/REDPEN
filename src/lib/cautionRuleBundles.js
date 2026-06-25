import { isCautionSearchItem } from './cautionRules.js';

/**
 * @param {import('./cautionRules.js').CautionItem} item
 * @param {import('./cautionRules.js').CautionGroup} group
 */
export function cautionItemBundleKey(item, group) {
  const fromItem = String(item.groupLabel ?? '').trim();
  if (fromItem) return fromItem;
  const fromGroup = String(group.title ?? '').trim();
  if (fromGroup) return fromGroup;
  return `__group:${group.id}`;
}

/**
 * @param {string} key
 * @param {import('./cautionRules.js').CautionGroup} group
 */
export function cautionBundleLabelFromKey(key, group) {
  if (key.startsWith('__group:')) {
    return String(group.id ?? '').trim();
  }
  return key;
}

/**
 * group_label(item) → 같은 표시 이름끼리 한 폴더. 시트 등장 순서 유지.
 * @param {import('./cautionRules.js').CautionGroup[]} groups
 */
export function buildCautionRuleBundles(groups) {
  /** @type {{ id: string, key: string, label: string, entries: { item: import('./cautionRules.js').CautionItem, group: import('./cautionRules.js').CautionGroup }[], ruleCount: number }[]} */
  const bundles = [];
  /** @type {Map<string, number>} */
  const keyToIndex = new Map();

  for (const group of groups) {
    for (const item of group.items) {
      if (!isCautionSearchItem(item)) continue;

      const key = cautionItemBundleKey(item, group);
      const label = cautionBundleLabelFromKey(key, group);
      const entry = { item, group };

      if (keyToIndex.has(key)) {
        bundles[keyToIndex.get(key)].entries.push(entry);
      } else {
        keyToIndex.set(key, bundles.length);
        bundles.push({
          id: key,
          key,
          label,
          entries: [entry],
          ruleCount: 0,
        });
      }
    }
  }

  return bundles.map((bundle) => ({
    ...bundle,
    ruleCount: bundle.entries.length,
  }));
}
