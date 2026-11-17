/**
 * 본조 stem 쌍 — 원고 전체에서 띄움/붙임 표면 출현 횟수 (검사 매치와 별도).
 */

import {
  bonBojoDisplayLabelForItem,
  listBonBojoUnifyReviewStems,
} from './bonBojoRules.js';

export const AUXILIARY_DOC_ONLY_TIP =
  '본용언+보조용언 검사에는 잡히지 않았고, 원고에서 stem 붙임·띄움만 집계했습니다.';

/** @param {string} s */
function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** @param {string} text @param {string} spaced */
export function countSpacedStemInText(text, spaced) {
  const raw = String(spaced ?? '').trim().replace(/\s+/g, ' ');
  if (!raw || !/\s/.test(raw)) return 0;
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return 0;
  const re = new RegExp(parts.map(escapeRegExp).join('\\s+'), 'gu');
  return [...String(text ?? '').matchAll(re)].length;
}

/** @param {string} text @param {string} glued */
export function countGluedStemInText(text, glued) {
  const g = String(glued ?? '').trim().replace(/\s+/g, '');
  if (!g) return 0;
  const re = new RegExp(escapeRegExp(g), 'gu');
  return [...String(text ?? '').matchAll(re)].length;
}

/**
 * @param {readonly { text?: string }[]} pageTexts
 * @param {string} itemId
 */
export function countBonBojoStemsInDocument(pageTexts, itemId) {
  const id = String(itemId ?? '').trim();
  if (!id) return { spaced: 0, glued: 0 };
  const stems = listBonBojoUnifyReviewStems().filter((s) => s.itemId === id);
  if (!stems.length) return { spaced: 0, glued: 0 };

  let spaced = 0;
  let glued = 0;
  for (const page of pageTexts ?? []) {
    const text = String(page?.text ?? '');
    if (!text) continue;
    for (const stem of stems) {
      spaced += countSpacedStemInText(text, stem.spaced);
      glued += countGluedStemInText(text, stem.glued);
    }
  }
  return { spaced, glued };
}

/**
 * @param {readonly { text?: string }[]} pageTexts
 * @param {readonly string[]} enabledItemIds
 * @returns {Map<string, { spaced: number, glued: number }>}
 */
export function buildBonBojoDocStemCountsByItemId(pageTexts, enabledItemIds) {
  /** @type {Map<string, { spaced: number, glued: number }>} */
  const out = new Map();
  const ids = [
    ...new Set(
      (enabledItemIds ?? []).map((id) => String(id ?? '').trim()).filter(Boolean),
    ),
  ];
  for (const itemId of ids) {
    out.set(itemId, countBonBojoStemsInDocument(pageTexts, itemId));
  }
  return out;
}

/** @param {import('./ruleTypes.js').Rule[]} customRules */
export function enabledBonBojoItemIdsFromRules(customRules) {
  /** @type {Set<string>} */
  const ids = new Set();
  for (const rule of customRules ?? []) {
    if (rule.patternKind !== 'auxiliary-verb' || !rule.enabled) continue;
    const itemId = rule.bonBojoItemId?.trim();
    if (itemId) ids.add(itemId);
  }
  return [...ids];
}

/**
 * 검사 매치는 0건인데 원고 stem이 있는 활성 본조 항목 → 결과 카드용 빈 그룹.
 * (엔진 결과에는 넣지 않고 UI에서 붙인다.)
 *
 * @param {{
 *   customRules?: import('./ruleTypes.js').Rule[],
 *   existingGroups?: readonly { patternKind?: string, bonBojoItemId?: string }[],
 *   docCounts?: Map<string, { spaced: number, glued: number }> | null,
 * }} param
 * @returns {import('./ruleEngine.js').GroupedResult[]}
 */
export function buildAuxiliaryDocOnlyResultGroups({
  customRules = [],
  existingGroups = [],
  docCounts = null,
}) {
  if (!docCounts?.size) return [];

  /** @type {Set<string>} */
  const covered = new Set();
  for (const g of existingGroups ?? []) {
    if (g?.patternKind !== 'auxiliary-verb') continue;
    const id = g.bonBojoItemId?.trim();
    if (id) covered.add(id);
  }

  /** @type {import('./ruleEngine.js').GroupedResult[]} */
  const out = [];
  for (const itemId of enabledBonBojoItemIdsFromRules(customRules)) {
    if (covered.has(itemId)) continue;
    const counts = docCounts.get(itemId);
    if (!counts || (counts.spaced <= 0 && counts.glued <= 0)) continue;
    const label = bonBojoDisplayLabelForItem(itemId)?.trim() || itemId;
    out.push({
      find: `auxiliary-item:${label}`,
      replace: '',
      label,
      groupDisplayLabel: label,
      category: 'consistency',
      patternKind: 'auxiliary-verb',
      bonBojoItemId: itemId,
      tip: AUXILIARY_DOC_ONLY_TIP,
      instances: [],
    });
  }
  return out;
}
