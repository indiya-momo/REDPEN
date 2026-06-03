import bonBojoJson from '../data/bon-bojo-rules.json';
import { partitionBonVerbAllowPhrases } from './bonNounHaeBlocklist.js';
import { assertValidBonBojoRules } from './validateDataJson.js';

/**
 * @typedef {{ id: string, label: string, stems?: string[], enabled?: boolean, displayLabel?: string, except?: string[] }} BonBojoItem
 * @typedef {{ id: string, title?: string, tip: string, bonVerbAllow?: string[], items: BonBojoItem[] }} BonBojoGroup
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

/** @param {typeof bonBojoJson} raw */
export function bonBojoRulesFingerprint(raw) {
  let hash = 0;
  const payload = JSON.stringify(raw);
  for (let i = 0; i < payload.length; i += 1) {
    hash = (Math.imul(31, hash) + payload.charCodeAt(i)) | 0;
  }
  return `${payload.length}:${hash}`;
}

/** @param {typeof bonBojoJson} source */
function buildRuntimeFromSource(source) {
  /** @type {BonBojoGroup[]} */
  const groups = [...(source.groups ?? []), BON_BOJO_LOGIC_ONLY_GROUP];

  /** @type {Map<string, readonly string[]>} */
  const allowByItemId = new Map();
  for (const group of groups) {
    const rawAllow = Array.isArray(group.bonVerbAllow)
      ? group.bonVerbAllow.map((s) => String(s).trim()).filter(Boolean)
      : [];
    const { kept: allow } = partitionBonVerbAllowPhrases(rawAllow);
    if (!allow.length) continue;
    for (const item of group.items) {
      allowByItemId.set(item.id, allow);
    }
  }

  /** @type {BonBojoListItem[]} */
  const listItems = groups.flatMap((group) => {
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

  return {
    groups,
    allowByItemId,
    listItems,
    byItemId: new Map(listItems.map((item) => [item.itemId, item])),
  };
}

/** @type {typeof bonBojoJson} */
let bonBojoSource = bonBojoJson;
let runtime = buildRuntimeFromSource(bonBojoSource);

export const BON_BOJO_RULES_FP = bonBojoRulesFingerprint(bonBojoSource);

/** @returns {BonBojoGroup[]} */
export function getBonBojoGroups() {
  return runtime.groups;
}

/**
 * sync 후 dev에서 반영 시 호출
 * @param {typeof bonBojoJson} data
 */
export function replaceBonBojoRulesData(data) {
  assertValidBonBojoRules(data, 'replaceBonBojoRulesData');
  bonBojoSource = data;
  runtime = buildRuntimeFromSource(data);
}

/** @param {string | undefined} itemId */
export function bonVerbAllowForItemId(itemId) {
  if (itemId == null) return [];
  return runtime.allowByItemId.get(String(itemId).trim()) ?? [];
}

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
 * @param {BonBojoItem} item
 * @param {string} stem
 */
export function isAllowedBonBojoSearchStem(item, stem) {
  const s = stem.trim();
  if (!/^[\uAC00-\uD7A3]$/.test(s)) return true;
  const label = String(item.label ?? '').trim();
  return s === label;
}

/** @param {BonBojoItem} item */
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

/** @param {string} tailWord */
export function bonBojoItemIdForSearchTail(tailWord) {
  const t = tailWord.trim();
  for (const group of runtime.groups) {
    for (const item of group.items) {
      if (auxiliarySearchTailsFromBonBojoItem(item).includes(t)) {
        return item.id;
      }
    }
  }
  return undefined;
}

/** 시트·UI에서 기본 체크·「필수」 표시 대상 */
export const BON_BOJO_REQUIRED_ITEM_IDS_LIST = ['verb-hada', 'verb-jida'];

export const BON_BOJO_REQUIRED_ITEM_IDS = new Set(BON_BOJO_REQUIRED_ITEM_IDS_LIST);

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
  return runtime.byItemId.get(itemId.trim());
}

/** @param {string} tailWord */
export function bonBojoItemIdForTail(tailWord) {
  const t = tailWord.trim();
  for (const item of runtime.listItems) {
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

