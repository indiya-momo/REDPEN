import bonBojoJson from '../data/bon-bojo-rules.json';

/**
 * @typedef {{ id: string, label: string, stems?: string[], enabled?: boolean, displayLabel?: string, except?: string[] }} BonBojoItem
 * @typedef {{ id: string, title?: string, tip: string, items: BonBojoItem[] }} BonBojoGroup
 * @typedef {{ itemId: string, primaryTail: string, variantTails: string[], displayLabel?: string, enabled: boolean, tip?: string }} BonBojoListItem
 */

/** @type {BonBojoGroup[]} */
export const BON_BOJO_GROUPS = bonBojoJson.groups ?? [];

/** @param {BonBojoItem} item */
export function tailWordsFromBonBojoItem(item) {
  const label = String(item.label ?? '').trim();
  const stems = Array.isArray(item.stems)
    ? item.stems.map((s) => String(s).trim()).filter(Boolean)
    : [];
  const tails = [];
  if (label) tails.push(label);
  for (const s of stems) {
    if (!tails.includes(s)) tails.push(s);
  }
  return tails;
}

/** 일관성 목록·체크 단위 (시트 item 1행 = 1칸) */
/** @type {BonBojoListItem[]} */
export const BON_BOJO_LIST_ITEMS = BON_BOJO_GROUPS.flatMap((group) => {
  const tip = String(group.tip ?? '').trim();
  return group.items.map((item) => {
    const tails = tailWordsFromBonBojoItem(item);
    const primaryTail = String(item.label ?? '').trim();
    return {
      itemId: item.id,
      primaryTail,
      variantTails: tails.filter((t) => t !== primaryTail),
      displayLabel: item.displayLabel?.trim() || undefined,
      enabled: item.enabled === true,
      ...(tip ? { tip } : {}),
    };
  });
});

/** @type {Map<string, BonBojoListItem>} */
const BON_BOJO_BY_ITEM_ID = new Map(
  BON_BOJO_LIST_ITEMS.map((item) => [item.itemId, item]),
);

/** 시트·UI에서 기본 체크·「필수」 표시 대상 */
export const BON_BOJO_REQUIRED_ITEM_IDS = new Set(['verb-hada']);

/** @param {string | undefined} itemId */
export function isBonBojoRequiredItem(itemId) {
  return itemId != null && BON_BOJO_REQUIRED_ITEM_IDS.has(String(itemId).trim());
}

/** @param {string} itemId */
export function bonBojoListItem(itemId) {
  return BON_BOJO_BY_ITEM_ID.get(itemId.trim());
}

/** @param {string} tailWord */
export function bonBojoItemIdForTail(tailWord) {
  const t = tailWord.trim();
  for (const item of BON_BOJO_LIST_ITEMS) {
    if (item.primaryTail === t || item.variantTails.includes(t)) {
      return item.itemId;
    }
  }
  return undefined;
}

/** @param {string} itemId */
export function bonBojoDisplayLabelForItem(itemId) {
  return bonBojoListItem(itemId)?.displayLabel;
}

/** @returns {Set<string>} */
export function allBonBojoTailWords() {
  const s = new Set();
  for (const item of BON_BOJO_LIST_ITEMS) {
    s.add(item.primaryTail);
    for (const v of item.variantTails) s.add(v);
  }
  return s;
}

/** @param {string} tailWord @deprecated 목록은 itemId 기준 — 수동 등록 tail용 */
export function bonBojoDisplayLabelForTail(tailWord) {
  const itemId = bonBojoItemIdForTail(tailWord);
  if (itemId) return bonBojoDisplayLabelForItem(itemId);
  return undefined;
}
