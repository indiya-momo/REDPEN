import { normalizeConsistencyVariant } from './compoundPairRegister.js';
import {
  buildAuxiliaryVerbFindRules,
  hasAuxiliaryVerbFind,
  removeAuxiliaryVerbFind,
} from './auxiliaryVerbPattern.js';
import { parseCommaList } from './matchFilters.js';
import { bonBojoListItem, isBonBojoLogicOnlyItem } from './bonBojoRules.js';

/**
 * @param {import('./ruleTypes.js').Rule[]} rules
 * @param {string} tailWord
 */
export function buildRulesForAuxiliaryEntry(rules, tailWord) {
  const t = normalizeConsistencyVariant(tailWord);
  if (hasAuxiliaryVerbFind(rules, t)) return [];
  return buildAuxiliaryVerbFindRules(t);
}

/**
 * @param {import('./ruleTypes.js').Rule[]} rules
 * @param {string} itemId
 */
function rulesForBonBojoItem(rules, itemId) {
  return rules.filter(
    (r) =>
      r.patternKind === 'auxiliary-verb' && r.bonBojoItemId?.trim() === itemId,
  );
}

/** @param {import('./ruleTypes.js').Rule[]} customRules */
export function listAuxiliaryVerbEntries(customRules) {
  const seenTails = new Set();
  const seenItems = new Set();
  /** @type {{ tailWord: string, displayLabel?: string, bonBojoItemId?: string }[]} */
  const entries = [];

  for (const r of customRules) {
    if (r.patternKind !== 'auxiliary-verb') continue;
    const itemId = r.bonBojoItemId?.trim();
    if (itemId) {
      if (isBonBojoLogicOnlyItem(itemId)) continue;
      if (seenItems.has(itemId)) continue;
      seenItems.add(itemId);
      const group = rulesForBonBojoItem(customRules, itemId);
      const primary =
        bonBojoListItem(itemId)?.primaryTail ||
        group[0]?.tailWord?.trim() ||
        '';
      const displayLabel = group[0]?.label?.trim() || undefined;
      entries.push({
        bonBojoItemId: itemId,
        tailWord: primary,
        ...(displayLabel ? { displayLabel } : {}),
      });
      continue;
    }

    const tw = r.tailWord?.trim();
    if (!tw || seenTails.has(tw)) continue;
    seenTails.add(tw);
    const group = customRules.filter(
      (row) => row.patternKind === 'auxiliary-verb' && row.tailWord === tw,
    );
    const displayLabel = group[0]?.label?.trim() || undefined;
    entries.push({
      tailWord: tw,
      ...(displayLabel ? { displayLabel } : {}),
    });
  }

  return entries.sort((a, b) => {
    const la = a.displayLabel || a.tailWord;
    const lb = b.displayLabel || b.tailWord;
    return la.localeCompare(lb, 'ko');
  });
}

export function removeAuxiliaryVerbEntry(rules, tailWord) {
  return removeAuxiliaryVerbFind(rules, tailWord.trim());
}

/**
 * @param {import('./ruleTypes.js').Rule[]} rules
 * @param {{ tailWord: string, bonBojoItemId?: string }} entry
 * @param {boolean} enabled
 */
export function toggleAuxiliaryVerbEntry(rules, entry, enabled) {
  const itemId = entry.bonBojoItemId?.trim();
  if (itemId && isBonBojoLogicOnlyItem(itemId)) return rules;
  if (itemId) {
    return rules.map((r) =>
      r.patternKind === 'auxiliary-verb' && r.bonBojoItemId?.trim() === itemId
        ? { ...r, enabled }
        : r,
    );
  }
  const t = entry.tailWord.trim();
  return rules.map((r) =>
    r.patternKind === 'auxiliary-verb' && r.tailWord === t
      ? { ...r, enabled }
      : r,
  );
}

/**
 * @param {import('./ruleTypes.js').Rule[]} rules
 * @param {{ tailWord: string, bonBojoItemId?: string }} entry
 */
export function isAuxiliaryVerbEntryEnabled(rules, entry) {
  const itemId = entry.bonBojoItemId?.trim();
  const group = itemId
    ? rulesForBonBojoItem(rules, itemId)
    : rules.filter(
        (r) =>
          r.patternKind === 'auxiliary-verb' &&
          r.tailWord === entry.tailWord.trim(),
      );
  return group.length > 0 && group.every((r) => r.enabled);
}

/**
 * @param {import('./ruleTypes.js').Rule[]} rules
 * @param {{ tailWord: string, bonBojoItemId?: string }[]} entries
 * @param {boolean} enabled
 */
export function setAllAuxiliaryVerbEntries(rules, entries, enabled) {
  /** @type {Set<string>} */
  const itemIds = new Set();
  /** @type {Set<string>} */
  const tailWords = new Set();
  for (const entry of entries) {
    const itemId = entry.bonBojoItemId?.trim();
    if (itemId) {
      if (!isBonBojoLogicOnlyItem(itemId)) itemIds.add(itemId);
      continue;
    }
    const tail = entry.tailWord?.trim();
    if (tail) tailWords.add(tail);
  }
  return rules.map((r) => {
    if (r.patternKind !== 'auxiliary-verb') return r;
    const itemId = r.bonBojoItemId?.trim();
    if (itemId && itemIds.has(itemId)) return { ...r, enabled };
    const tail = r.tailWord?.trim();
    if (!itemId && tail && tailWords.has(tail)) return { ...r, enabled };
    return r;
  });
}

export function parseAuxiliaryInput(input) {
  return parseCommaList(input);
}
