import { normalizeConsistencyVariant } from './compoundPairRegister.js';
import {
  buildAuxiliaryVerbFindRules,
  hasAuxiliaryVerbFind,
  removeAuxiliaryVerbFind,
} from './auxiliaryVerbPattern.js';
import { parseCommaList } from './matchFilters.js';

/**
 * @param {import('./ruleTypes.js').Rule[]} rules
 * @param {string} tailWord
 */
export function buildRulesForAuxiliaryEntry(rules, tailWord) {
  const t = normalizeConsistencyVariant(tailWord);
  if (hasAuxiliaryVerbFind(rules, t)) return [];
  return buildAuxiliaryVerbFindRules(t);
}

/** @param {import('./ruleTypes.js').Rule[]} customRules */
export function listAuxiliaryVerbEntries(customRules) {
  const seen = new Set();
  /** @type {{ tailWord: string, displayLabel?: string }[]} */
  const entries = [];
  for (const r of customRules) {
    const tw = r.tailWord?.trim();
    if (!tw || r.patternKind !== 'auxiliary-verb' || seen.has(tw)) continue;
    seen.add(tw);
    const group = customRules.filter(
      (row) => row.patternKind === 'auxiliary-verb' && row.tailWord === tw,
    );
    const displayLabel = group[0]?.label?.trim() || undefined;
    entries.push({
      tailWord: tw,
      ...(displayLabel ? { displayLabel } : {}),
    });
  }
  return entries.sort((a, b) => a.tailWord.localeCompare(b.tailWord, 'ko'));
}

export function removeAuxiliaryVerbEntry(rules, tailWord) {
  return removeAuxiliaryVerbFind(rules, tailWord.trim());
}

export function toggleAuxiliaryVerbEntry(rules, tailWord, enabled) {
  const t = tailWord.trim();
  return rules.map((r) =>
    r.patternKind === 'auxiliary-verb' && r.tailWord === t
      ? { ...r, enabled }
      : r,
  );
}

export function isAuxiliaryVerbEntryEnabled(rules, tailWord) {
  const t = tailWord.trim();
  const group = rules.filter(
    (r) => r.patternKind === 'auxiliary-verb' && r.tailWord === t,
  );
  return group.length > 0 && group.every((r) => r.enabled);
}

export function parseAuxiliaryInput(input) {
  return parseCommaList(input);
}
