import {
  buildPhraseSlotFindRules,
  hasPhraseSlotFind,
  isPhraseSlotPattern,
  removePhraseSlotFind,
} from './phraseSlotPattern.js';
import { canAddPhraseSlotRegisteredEntries } from './consistencyRuleLimit.js';
import { normalizeConsistencyVariant } from './compoundPairRegister.js';
import { decodeSpacesVisible } from './spaceVisibleText.js';
import { parseCommaList } from './matchFilters.js';

export { isPhraseSlotPattern };

/**
 * @param {import('./ruleTypes.js').Rule[]} rules
 * @param {string} pattern
 */
export function buildRulesForPhraseSlot(rules, pattern) {
  const t = normalizeConsistencyVariant(pattern);
  if (!isPhraseSlotPattern(t) || hasPhraseSlotFind(rules, t)) return [];
  if (!canAddPhraseSlotRegisteredEntries(rules, 1)) return [];
  return buildPhraseSlotFindRules(t);
}

/** @param {import('./ruleTypes.js').Rule[]} customRules */
export function listPhraseSlotEntries(customRules) {
  const seen = new Set();
  /** @type {{ tailWord: string }[]} */
  const entries = [];
  for (const r of customRules) {
    const tw = r.tailWord?.trim();
    if (!tw || r.patternKind !== 'phrase-slot-find' || seen.has(tw)) continue;
    seen.add(tw);
    entries.push({ tailWord: tw });
  }
  return entries.sort((a, b) => a.tailWord.localeCompare(b.tailWord, 'ko'));
}

export function removePhraseSlotEntry(rules, pattern) {
  return removePhraseSlotFind(rules, pattern.trim());
}

export function togglePhraseSlotEntry(rules, pattern, enabled) {
  const t = pattern.trim();
  return rules.map((r) =>
    r.patternKind === 'phrase-slot-find' && r.tailWord === t
      ? { ...r, enabled }
      : r,
  );
}

export function isPhraseSlotEntryEnabled(rules, pattern) {
  const t = pattern.trim();
  const group = rules.filter(
    (r) => r.patternKind === 'phrase-slot-find' && r.tailWord === t,
  );
  return group.length > 0 && group.every((r) => r.enabled);
}

export function parsePhraseSlotInput(input) {
  return parseCommaList(input).map((s) =>
    normalizeConsistencyVariant(decodeSpacesVisible(s)),
  );
}
