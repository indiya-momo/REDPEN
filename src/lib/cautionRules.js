import cautionRulesJson from '../data/caution-rules.json';

/**
 * @typedef {'any-before' | 'spaced-before' | 'spaced-stem'} CautionMatchMode
 * @typedef {{ id: string, label: string, stems?: string[], enabled?: boolean, matchMode?: CautionMatchMode, displayLabel?: string, inventoryOnly?: boolean }} CautionItem
 * @typedef {{ id: string, tip: string, items: CautionItem[] }} CautionGroup
 * @typedef {{ id: string, label: string, stems: string[], tip: string, groupId: string, enabled: boolean, matchMode: CautionMatchMode, displayLabel: string, inventoryOnly: boolean }} CautionRule
 */

/** @param {unknown} raw */
function normalizeGroups(raw) {
  if (Array.isArray(raw)) {
    return raw.map((row) => ({
      id: row.id,
      tip: row.tip,
      items: [
        {
          id: row.id,
          label: row.label,
          enabled: row.enabled === true,
        },
      ],
    }));
  }
  if (raw && typeof raw === 'object' && Array.isArray(raw.groups)) {
    return raw.groups.map((group) => ({
      ...group,
      items: markInventoryItems(
        (group.items ?? []).map((item) => normalizeCautionItem(item)),
      ),
    }));
  }
  return [];
}

/** @param {CautionItem} item */
function cautionStemsFromItem(item) {
  if (Array.isArray(item.stems) && item.stems.length > 0) {
    return item.stems.map((s) => String(s).trim()).filter(Boolean);
  }
  const label = String(item.label ?? '').trim();
  return label ? [label] : [];
}

/** @param {CautionItem[]} items */
export function markInventoryItems(items) {
  const covered = new Set();
  for (const it of items) {
    if (it.inventoryOnly) continue;
    const bundled =
      Boolean(it.displayLabel?.trim()) ||
      (Array.isArray(it.stems) && it.stems.length > 1);
    if (!bundled) continue;
    for (const s of it.stems?.length ? it.stems : [it.label]) {
      covered.add(s);
    }
  }

  return items.map((it) => {
    if (it.inventoryOnly === true) return { ...it, inventoryOnly: true };
    const bundled =
      Boolean(it.displayLabel?.trim()) ||
      (Array.isArray(it.stems) && it.stems.length > 1);
    if (bundled) return { ...it, inventoryOnly: false };

    const label = String(it.label || '').trim();
    let inventoryOnly = false;
    if (covered.has(label)) inventoryOnly = true;
    else {
      for (const s of covered) {
        if (label.startsWith(s)) {
          inventoryOnly = true;
          break;
        }
      }
    }
    return { ...it, inventoryOnly };
  });
}

/** @param {CautionRule | CautionItem} item */
export function isCautionSearchItem(item) {
  return item.inventoryOnly !== true;
}

function normalizeCautionItem(item) {
  const matchMode =
    item.matchMode === 'spaced-before'
      ? 'spaced-before'
      : item.matchMode === 'spaced-stem'
        ? 'spaced-stem'
        : 'any-before';
  const stems = cautionStemsFromItem(item);
  return {
    ...item,
    label: stems[0] ?? item.label,
    stems,
    matchMode,
    displayLabel: item.displayLabel?.trim() || cautionDisplayLabel(item),
    inventoryOnly: item.inventoryOnly === true,
  };
}

/** @param {{ label: string, matchMode?: CautionMatchMode, displayLabel?: string }} item */
export function cautionDisplayLabel(item) {
  if (item.displayLabel?.trim()) return item.displayLabel.trim();
  if (item.matchMode === 'spaced-before' || item.matchMode === 'spaced-stem') {
    return `^${item.label}`;
  }
  return item.label;
}

/** @type {CautionGroup[]} */
export const CAUTION_GROUPS = normalizeGroups(cautionRulesJson);

/** @type {CautionRule[]} */
export const CAUTION_RULES = CAUTION_GROUPS.flatMap((group) =>
  group.items.map((item) => ({
    id: item.id,
    label: item.label,
    stems: item.stems ?? cautionStemsFromItem(item),
    tip: group.tip,
    groupId: group.id,
    enabled: item.enabled === true,
    matchMode: item.matchMode ?? 'any-before',
    displayLabel: item.displayLabel ?? cautionDisplayLabel(item),
    inventoryOnly: item.inventoryOnly === true,
  })),
);

/** 검사 체크박스 대상만 */
export const CAUTION_SEARCH_RULES = CAUTION_RULES.filter(isCautionSearchItem);

/** @param {string} s */
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** @returns {Record<string, boolean>} */
export function defaultCautionEnabled() {
  return Object.fromEntries(
    CAUTION_RULES.map((r) => [r.id, r.enabled === true]),
  );
}

/**
 * @param {Record<string, boolean>} [saved]
 * @returns {Record<string, boolean>}
 */
const CAUTION_ID_ALIASES = {
  'caution-spaced-itta': 'verb-boda3',
  'caution-spaced-ju': 'verb-boda4',
  'caution-spaced-jun': 'verb-boda4',
  juda1: 'verb-boda4',
  juda2: 'verb-boda4',
  'verb-itta': 'verb-boda3',
  'verb-bo': 'verb-boda1',
  'verb-bonda': 'verb-boda2',
  'verb-ju': 'verb-boda4',
  'verb-jun': 'verb-boda4',
  'verb-ha': 'verb-boda5',
  'verb-han': 'verb-boda5',
  'verb-du': 'verb-boda6',
  'verb-noh': 'verb-boda7',
};

export function migrateCautionEnabled(saved = {}) {
  const migrated = { ...saved };
  for (const [oldId, newId] of Object.entries(CAUTION_ID_ALIASES)) {
    if (
      Object.prototype.hasOwnProperty.call(migrated, oldId) &&
      !Object.prototype.hasOwnProperty.call(migrated, newId)
    ) {
      migrated[newId] = migrated[oldId];
    }
  }

  if (migrated['verb-jun'] === true) migrated['verb-boda4'] = true;
  if (migrated['verb-han'] === true) migrated['verb-boda5'] = true;

  const merged = {};
  for (const r of CAUTION_RULES) {
    if (Object.prototype.hasOwnProperty.call(migrated, r.id)) {
      merged[r.id] = migrated[r.id] === true;
    } else {
      merged[r.id] = r.enabled === true;
    }
  }
  return merged;
}

/**
 * @param {Record<string, boolean>} cautionEnabled
 * @returns {import('./ruleTypes.js').Rule[]}
 */
function cautionFindPattern(label, matchMode) {
  const esc = escapeRegex(label);
  if (matchMode === 'spaced-before') {
    return String.raw`([^\s]{2,})[ \u00A0]+${esc}(?!\S)`;
  }
  if (matchMode === 'spaced-stem') {
    return String.raw`([^\s]{2,})[ \u00A0]+${esc}[\uAC00-\uD7A3]+(?!\S)`;
  }
  return String.raw`([^\s]{2,})\s*${esc}`;
}

/** 검사 결과 카드에 쓸 체크 항목 이름 (^주다, 만 …) */
export function cautionResultChipLabel(groupOrLabel) {
  const raw =
    typeof groupOrLabel === 'string'
      ? groupOrLabel
      : String(groupOrLabel?.label ?? '').trim();
  return raw.replace(/^주의\s*·\s*/, '').trim() || raw;
}

export function buildCautionCheckRules(cautionEnabled) {
  const rules = [];
  for (const item of CAUTION_SEARCH_RULES) {
    if (cautionEnabled[item.id] !== true) continue;
    for (const stem of item.stems) {
      rules.push({
        find: cautionFindPattern(stem, item.matchMode),
        replace: '(검토)',
        enabled: true,
        pattern: 'regex',
        category: 'caution',
        cautionId: item.id,
        label: item.displayLabel,
        tip: item.tip,
      });
    }
  }
  return rules;
}
