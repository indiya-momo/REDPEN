import {
  buildCompoundFindRules,
  hasCompoundFind,
  removeCompoundFind,
} from './compoundFindPattern.js';
import { isPhraseSlotPattern } from './phraseSlotPattern.js';
import { parseCommaList } from './matchFilters.js';
import { decodeSpacesVisible } from './spaceVisibleText.js';

/** @param {string} s */
export function normalizeConsistencyVariant(s) {
  return decodeSpacesVisible(s).trim().replace(/\s+/g, ' ');
}

/**
 * @param {string} input
 * @returns {string[]}
 */
export function parseConsistencyInput(input) {
  return parseCommaList(input);
}

/**
 * 쉼표 항목마다 등록 문자열 그대로 검색 (묶음·반대 형태 추론 없음)
 * @param {string[]} variants
 * @returns {string[]}
 */
export function planConsistencyEntries(variants) {
  const seen = new Set();
  /** @type {string[]} */
  const entries = [];
  for (const raw of variants) {
    const t = normalizeConsistencyVariant(raw);
    if (!t || seen.has(t)) continue;
    seen.add(t);
    entries.push(t);
  }
  return entries;
}

/**
 * @param {import('./ruleTypes.js').Rule[]} rules
 * @param {string} tailWord
 * @returns {import('./ruleTypes.js').Rule[]}
 */
/** @param {string} tailWord */
export function isLiteralConsistencyEntry(tailWord) {
  const t = normalizeConsistencyVariant(tailWord);
  if (!t || isPhraseSlotPattern(t)) return false;
  return true;
}

export function buildRulesForEntry(rules, tailWord) {
  const t = normalizeConsistencyVariant(tailWord);
  if (!isLiteralConsistencyEntry(t) || hasCompoundFind(rules, t)) return [];
  return buildCompoundFindRules(t);
}

/**
 * @typedef {{ tailWord: string }} ConsistencyEntryRow
 */

/**
 * @param {import('./ruleTypes.js').Rule[]} customRules
 * @returns {ConsistencyEntryRow[]}
 */
export function listConsistencyEntries(customRules) {
  const kinds = new Set([
    'compound-find',
    'compound-tail',
    'compound-spacing',
  ]);
  const seen = new Set();
  /** @type {ConsistencyEntryRow[]} */
  const entries = [];

  for (const r of customRules) {
    const tw = r.tailWord?.trim();
    if (!tw || !kinds.has(r.patternKind ?? '') || seen.has(tw)) continue;
    seen.add(tw);
    entries.push({ tailWord: tw });
  }

  return entries.sort((a, b) => a.tailWord.localeCompare(b.tailWord, 'ko'));
}

/**
 * @param {import('./ruleTypes.js').Rule[]} rules
 * @param {string} tailWord
 */
export function removeConsistencyEntry(rules, tailWord) {
  return removeCompoundFind(rules, tailWord.trim());
}

/**
 * @param {import('./ruleTypes.js').Rule[]} rules
 * @param {string} tailWord
 * @param {boolean} enabled
 */
export function toggleConsistencyEntry(rules, tailWord, enabled) {
  const t = tailWord.trim();
  const kinds = new Set([
    'compound-find',
    'compound-tail',
    'compound-spacing',
  ]);
  return rules.map((r) => {
    if (kinds.has(r.patternKind ?? '') && r.tailWord === t) {
      return { ...r, enabled };
    }
    return r;
  });
}

/**
 * @param {import('./ruleTypes.js').Rule[]} rules
 * @param {string} tailWord
 */
export function isConsistencyEntryEnabled(rules, tailWord) {
  const t = tailWord.trim();
  const kinds = new Set([
    'compound-find',
    'compound-tail',
    'compound-spacing',
  ]);
  const group = rules.filter(
    (r) => kinds.has(r.patternKind ?? '') && r.tailWord === t,
  );
  return group.length > 0 && group.every((r) => r.enabled);
}
