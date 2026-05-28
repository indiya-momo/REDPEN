import cautionRulesJson from '../data/caution-rules.json';

/**
 * @typedef {'any-before' | 'spaced-before' | 'attached-before' | 'spaced-stem' | 'fixed-phrase'} CautionMatchMode
 * @typedef {{ id: string, label: string, stems?: string[], enabled?: boolean, matchMode?: CautionMatchMode, displayLabel?: string, inventoryOnly?: boolean, except?: string[] }} CautionItem
 * @typedef {{ id: string, title?: string, tip: string, hideGroupTitle?: boolean, tipInline?: boolean, items: CautionItem[] }} CautionGroup
 * @typedef {{ id: string, label: string, stems: string[], tip: string, groupId: string, enabled: boolean, matchMode: CautionMatchMode, displayLabel: string, inventoryOnly: boolean, except?: string[] }} CautionRule
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

/** @param {string} [mode] */
export function normalizeMatchMode(mode) {
  const v = String(mode ?? '').trim().toLowerCase();
  // 긴 이름 먼저 (space-stem ⊃ space)
  if (
    v === 'spaced-stem' ||
    v === 'space-stem' ||
    v === 'stem' ||
    v === 'spaced-compound'
  ) {
    return 'spaced-stem';
  }
  if (v === 'ap-space' || v === 'spaced-before' || v === 'spaced') {
    return 'spaced-before';
  }
  if (
    v === 'ap-attach' ||
    v === 'before-attached' ||
    v === 'ap-attached' ||
    v === 'attached-before' ||
    v === 'attached' ||
    v === 'glue' ||
    v === 'glued' ||
    v === '붙임'
  ) {
    return 'attached-before';
  }
  if (
    v === 'fixed-phrase' ||
    v === 'fixed' ||
    v === 'phrase' ||
    v === 'fixedphrase'
  ) {
    return 'fixed-phrase';
  }
  if (v === 'ap-any' || v === 'any-before' || v === 'any') {
    return 'any-before';
  }
  // 레거시: space 단독 = ap-space 와 동일
  if (v === 'space') {
    return 'spaced-before';
  }
  return 'any-before';
}

/** @param {CautionItem} item */
function parseExceptField(item) {
  const raw = item.except;
  if (Array.isArray(raw)) {
    const list = raw.map((s) => String(s).trim()).filter(Boolean);
    return list.length ? list : undefined;
  }
  if (typeof raw === 'string' && raw.trim()) {
    const list = raw
      .split(/[,，\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    return list.length ? list : undefined;
  }
  return undefined;
}

function normalizeCautionItem(item) {
  const matchMode = normalizeMatchMode(item.matchMode);
  const stems = cautionStemsFromItem(item);
  const except = parseExceptField(item);
  return {
    ...item,
    label: stems[0] ?? item.label,
    stems,
    matchMode,
    displayLabel: item.displayLabel?.trim() || cautionDisplayLabel(item),
    inventoryOnly: item.inventoryOnly === true,
    ...(except ? { except } : {}),
  };
}

/** @param {{ label: string, matchMode?: CautionMatchMode, displayLabel?: string }} item */
export function cautionDisplayLabel(item) {
  if (item.displayLabel?.trim()) return item.displayLabel.trim();
  if (item.matchMode === 'fixed-phrase') {
    return item.label;
  }
  if (item.matchMode === 'spaced-before' || item.matchMode === 'spaced-stem') {
    return `^${item.label}`;
  }
  if (item.matchMode === 'attached-before') {
    return `∨${item.label}`;
  }
  return item.label;
}

/** @type {CautionGroup[]} */
export const CAUTION_GROUPS = normalizeGroups(cautionRulesJson);

/** @param {typeof cautionRulesJson} raw */
export function cautionRulesFingerprint(raw = cautionRulesJson) {
  let hash = 0;
  const payload = JSON.stringify(raw);
  for (let i = 0; i < payload.length; i += 1) {
    hash = (Math.imul(31, hash) + payload.charCodeAt(i)) | 0;
  }
  return `${payload.length}:${hash}`;
}

export const CAUTION_RULES_FP = cautionRulesFingerprint();
export const CAUTION_ENABLED_POLICY_VERSION = 2;

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
    ...(item.except?.length ? { except: item.except } : {}),
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

/** @param {unknown} value */
function toEnabledBool(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

/**
 * @param {Record<string, boolean>} [saved]
 * @param {string | null | undefined} [savedFingerprint]
 * @param {number | null | undefined} [savedPolicyVersion]
 * @returns {Record<string, boolean>}
 */
const CAUTION_ID_ALIASES = {
  'caution-spaced-itta': 'verb-boda3',
  'caution-spaced-ju': 'verb-boda4',
  'caution-spaced-jun': 'verb-boda4',
  'verb-itta': 'verb-boda3',
  'verb-bo': 'verb-boda1',
  'verb-bonda': 'verb-boda2',
  'verb-ju': 'verb-boda4',
  'verb-jun': 'verb-boda4',
  'verb-juda1': 'verb-boda4',
  'verb-juda2': 'verb-boda4',
  'verb-ha': 'verb-boda5',
  'verb-han': 'verb-boda5',
  'verb-hada1': 'verb-boda5',
  'verb-hada2': 'verb-boda5',
  'verb-hada3': 'verb-boda5',
  'verb-du': 'verb-boda6',
  'verb-duda': 'verb-boda6',
  'verb-duda2': 'verb-boda6',
  'verb-noh': 'verb-boda9',
  'verb-notda': 'verb-boda9',
  'verv-gada': 'verb-boda7',
  'verv-gada2': 'verb-boda7',
  'verv-oda': 'verb-boda8',
  'verv-oda2': 'verb-boda8',
  'verv-oda3': 'verb-boda8',
};

export function migrateCautionEnabled(
  saved = {},
  savedFingerprint,
  savedPolicyVersion,
) {
  if (
    savedPolicyVersion !== CAUTION_ENABLED_POLICY_VERSION ||
    savedFingerprint !== CAUTION_RULES_FP
  ) {
    return defaultCautionEnabled();
  }
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
      merged[r.id] = toEnabledBool(migrated[r.id]);
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
/** @internal 테스트·문서용 */
export function cautionFindPattern(label, matchMode) {
  const esc = escapeRegex(label);
  if (matchMode === 'spaced-before') {
    return String.raw`([^\s]{2,})[ \u00A0]+${esc}(?!\S)`;
  }
  if (matchMode === 'attached-before') {
    // 앞말+label이 한 토큰이고 토큰 끝이 label(예: 여름가지 O, 물가지수 X)
    return String.raw`([^\s]{1,}${esc})(?!\S)`;
  }
  if (matchMode === 'spaced-stem') {
    return String.raw`([^\s]{2,})[ \u00A0]+${esc}[\uAC00-\uD7A3]+(?!\S)`;
  }
  if (matchMode === 'fixed-phrase') {
    const parts = label.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const core = parts.map(escapeRegex).join(String.raw`[ \u00A0]+`);
      return core + String.raw`[\uAC00-\uD7A3]+(?!\S)`;
    }
    return esc + String.raw`[\uAC00-\uD7A3]+(?!\S)`;
  }
  return String.raw`([^\s]{2,})\s*${esc}`;
}

/** 검사 결과 카드에 쓸 체크 항목 이름 (^주다, 만 …) */
export function cautionResultChipLabel(groupOrLabel) {
  const raw =
    typeof groupOrLabel === 'string'
      ? groupOrLabel
      : String(groupOrLabel?.label ?? '').trim();
  return (
    raw
      .replace(/^주의\s*·\s*/, '')
      .replace(/^띄어쓰기\s*·\s*/, '')
      .trim() || raw
  );
}

export function buildCautionCheckRules(cautionEnabled) {
  const rules = [];
  for (const item of CAUTION_SEARCH_RULES) {
    if (cautionEnabled[item.id] !== true) continue;
    const stems = item.stems.filter(Boolean);
    if (!stems.length) continue;
    const findPattern =
      stems.length === 1
        ? cautionFindPattern(stems[0], item.matchMode)
        : stems
            .map((stem) => `(?:${cautionFindPattern(stem, item.matchMode)})`)
            .join('|');
    rules.push({
      find: findPattern,
      replace: '(검토)',
      enabled: true,
      pattern: 'regex',
      category: 'caution',
      cautionId: item.id,
      label: item.displayLabel,
      tip: item.tip,
      ...(item.except?.length ? { excludePhrases: item.except } : {}),
    });
  }
  return rules;
}
