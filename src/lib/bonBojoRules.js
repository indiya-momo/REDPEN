import bonBojoJson from '../data/bon-bojo-rules.json';

/**
 * @typedef {{ id: string, label: string, stems?: string[], enabled?: boolean, displayLabel?: string, except?: string[] }} BonBojoItem
 * @typedef {{ id: string, title?: string, tip: string, items: BonBojoItem[] }} BonBojoGroup
 * @typedef {{ itemId: string, primaryTail: string, variantTails: string[], displayLabel?: string, enabled: boolean, tip?: string }} BonBojoListItem
 */

/** 시트에 없음 — 아는체하다 등, UI 없이 검사만 */
const BON_BOJO_LOGIC_ONLY_GROUP = {
  id: 'adj-bon',
  tip: '아는체하다·읽은체했다 등 — 관형어(은·는·ㄴ) 뒤 체+하다 붙임.',
  items: [
    {
      id: 'adj-che-hada',
      label: '체하',
      enabled: false,
      stems: ['체하'],
      displayLabel: '아는체하다',
    },
  ],
};

/** @type {BonBojoGroup[]} */
export const BON_BOJO_GROUPS = [
  ...(bonBojoJson.groups ?? []),
  BON_BOJO_LOGIC_ONLY_GROUP,
];

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

/**
 * bon-bojo 1음절 stem — 항목 label(가·보·주…)와 같을 때만 허용.
 * 시트에 잘못 들어간 연결 어미(어·아·해 등) 단독은 검색 규칙에서 제외.
 * @param {BonBojoItem} item
 * @param {string} stem
 */
export function isAllowedBonBojoSearchStem(item, stem) {
  const s = stem.trim();
  if (!/^[\uAC00-\uD7A3]$/.test(s)) return true;
  const label = String(item.label ?? '').trim();
  return s === label;
}

/**
 * 일관성 검사용 tail — stems가 있으면 stems만(시트와 동일), 없으면 label
 * @param {BonBojoItem} item
 */
export function auxiliarySearchTailsFromBonBojoItem(item) {
  const stems = Array.isArray(item.stems)
    ? item.stems
        .map((s) => String(s).trim())
        .filter(Boolean)
        .filter((s) => isAllowedBonBojoSearchStem(item, s))
    : [];
  if (stems.length > 0) return stems;
  const label = String(item.label ?? '').trim();
  return label ? [label] : [];
}

/** @returns {Set<string>} 시트 bon-bojo 검색 stem 전체(11항목) */
export function allBonBojoSearchStems() {
  const s = new Set();
  for (const group of BON_BOJO_GROUPS) {
    for (const item of group.items) {
      for (const tail of auxiliarySearchTailsFromBonBojoItem(item)) {
        s.add(tail);
      }
    }
  }
  return s;
}

/** @param {string} tailWord 시트 stems·label( stems 없을 때)와 정확히 일치 */
export function bonBojoItemIdForSearchTail(tailWord) {
  const t = tailWord.trim();
  for (const group of BON_BOJO_GROUPS) {
    for (const item of group.items) {
      if (auxiliarySearchTailsFromBonBojoItem(item).includes(t)) {
        return item.id;
      }
    }
  }
  return undefined;
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
/** 필수 본조 — UI 하단·필수 뱃지 (하다 → 지다 순) */
export const BON_BOJO_REQUIRED_ITEM_IDS_LIST = ['verb-hada', 'verb-jida'];

export const BON_BOJO_REQUIRED_ITEM_IDS = new Set(BON_BOJO_REQUIRED_ITEM_IDS_LIST);

/** UI 체크박스 없이 검사만 수행 */
export const BON_BOJO_LOGIC_ONLY_ITEM_IDS_LIST = ['adj-che-hada'];

export const BON_BOJO_LOGIC_ONLY_ITEM_IDS = new Set(
  BON_BOJO_LOGIC_ONLY_ITEM_IDS_LIST,
);

/** @param {string | undefined} itemId */
export function isBonBojoLogicOnlyItem(itemId) {
  return (
    itemId != null && BON_BOJO_LOGIC_ONLY_ITEM_IDS.has(String(itemId).trim())
  );
}

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
