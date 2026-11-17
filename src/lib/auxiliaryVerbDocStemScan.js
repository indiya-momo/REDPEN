/**
 * 본조 stem 쌍 — 원고 전체에서 띄움/붙임 표면 출현 횟수 (검사 매치와 별도).
 */

import { listBonBojoUnifyReviewStems } from './bonBojoRules.js';

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