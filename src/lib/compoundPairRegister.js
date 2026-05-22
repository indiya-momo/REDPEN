import {
  buildCompoundSpacingRules,
  hasCompoundSpacing,
  removeCompoundSpacing,
} from './compoundSpacingPattern.js';
import {
  buildCompoundTailRules,
  hasCompoundTail,
  removeCompoundTail,
} from './compoundTailPattern.js';
import { parseCommaList } from './matchFilters.js';

/** @param {string} s */
export function normalizeConsistencyVariant(s) {
  return s.trim().replace(/\s+/g, ' ');
}

/**
 * @param {string} input
 * @returns {string[]}
 */
export function parseConsistencyInput(input) {
  return parseCommaList(input);
}

/**
 * 쉼표로 구분된 항목마다 그대로 tailWord로 붙임·띄움 규칙을 만든다 (묶음·추론 없음).
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
export function buildRulesForEntry(rules, tailWord) {
  /** @type {import('./ruleTypes.js').Rule[]} */
  const toAdd = [];
  if (!hasCompoundTail(rules, tailWord)) {
    toAdd.push(...buildCompoundTailRules(tailWord));
  }
  if (!hasCompoundSpacing(rules, tailWord)) {
    toAdd.push(...buildCompoundSpacingRules(tailWord));
  }
  return toAdd;
}

/**
 * @typedef {{ tailWord: string, hasTail: boolean, hasSpacing: boolean }} ConsistencyEntryRow
 */

/**
 * @param {import('./ruleTypes.js').Rule[]} customRules
 * @returns {ConsistencyEntryRow[]}
 */
export function listConsistencyEntries(customRules) {
  /** @type {Map<string, ConsistencyEntryRow>} */
  const map = new Map();

  for (const r of customRules) {
    const tw = r.tailWord?.trim();
    if (!tw) continue;
    if (!map.has(tw)) {
      map.set(tw, { tailWord: tw, hasTail: false, hasSpacing: false });
    }
    const row = map.get(tw);
    if (r.patternKind === 'compound-tail') row.hasTail = true;
    if (r.patternKind === 'compound-spacing') row.hasSpacing = true;
  }

  return [...map.values()].sort((a, b) =>
    a.tailWord.localeCompare(b.tailWord, 'ko'),
  );
}

/**
 * @param {import('./ruleTypes.js').Rule[]} rules
 * @param {string} tailWord
 */
export function removeConsistencyEntry(rules, tailWord) {
  const t = tailWord.trim();
  return removeCompoundSpacing(removeCompoundTail(rules, t), t);
}

/**
 * @param {import('./ruleTypes.js').Rule[]} rules
 * @param {string} tailWord
 * @param {boolean} enabled
 */
export function toggleConsistencyEntry(rules, tailWord, enabled) {
  const t = tailWord.trim();
  return rules.map((r) => {
    if (
      (r.patternKind === 'compound-tail' ||
        r.patternKind === 'compound-spacing') &&
      r.tailWord === t
    ) {
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
  const group = rules.filter(
    (r) =>
      (r.patternKind === 'compound-tail' ||
        r.patternKind === 'compound-spacing') &&
      r.tailWord === t,
  );
  return group.length > 0 && group.every((r) => r.enabled);
}
