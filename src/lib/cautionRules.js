import cautionRulesJson from '../data/caution-rules.json';

/**
 * @typedef {{ id: string, label: string, enabled?: boolean }} CautionItem
 * @typedef {{ id: string, tip: string, items: CautionItem[] }} CautionGroup
 * @typedef {{ id: string, label: string, tip: string, groupId: string, enabled: boolean }} CautionRule
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
    return raw.groups;
  }
  return [];
}

/** @type {CautionGroup[]} */
export const CAUTION_GROUPS = normalizeGroups(cautionRulesJson);

/** @type {CautionRule[]} */
export const CAUTION_RULES = CAUTION_GROUPS.flatMap((group) =>
  group.items.map((item) => ({
    id: item.id,
    label: item.label,
    tip: group.tip,
    groupId: group.id,
    enabled: item.enabled === true,
  })),
);

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
export function migrateCautionEnabled(saved = {}) {
  const merged = {};
  for (const r of CAUTION_RULES) {
    if (Object.prototype.hasOwnProperty.call(saved, r.id)) {
      merged[r.id] = saved[r.id] === true;
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
export function buildCautionCheckRules(cautionEnabled) {
  return CAUTION_RULES.filter((r) => cautionEnabled[r.id] === true).map(
    (item) => {
      const esc = escapeRegex(item.label);
      return {
        find: String.raw`([^\s]{2,})\s*${esc}`,
        replace: '(검토)',
        enabled: true,
        pattern: 'regex',
        category: 'caution',
        cautionId: item.id,
        label: `주의 · ${item.label}`,
        tip: item.tip,
      };
    },
  );
}
