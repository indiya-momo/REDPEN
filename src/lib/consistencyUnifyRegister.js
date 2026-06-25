import { removeCompoundFind } from './compoundFindPattern.js';
import { normalizeConsistencyVariant } from './compoundPairRegister.js';

const COMPOUND_KINDS = new Set([
  'compound-find',
  'compound-tail',
  'compound-spacing',
]);

/**
 * @param {import('./ruleTypes.js').Rule[]} customRules
 * @param {string} [tailWord]
 */
export function isConsistencyUnifyTailWord(customRules, tailWord) {
  const tail = String(tailWord ?? '').trim();
  if (!tail) return false;
  return customRules.some(
    (rule) =>
      COMPOUND_KINDS.has(rule.patternKind ?? '') &&
      rule.tailWord?.trim() === tail &&
      rule.consistencyUnifyEntry === true,
  );
}

/**
 * @typedef {{ correction: string, unified: string }} ConsistencyUnifyMapping
 */

/**
 * @param {import('./ruleTypes.js').Rule[]} rules
 * @returns {ConsistencyUnifyMapping[]}
 */
export function listConsistencyUnifyMappings(rules) {
  /** @type {Map<string, string>} */
  const byCorrection = new Map();

  for (const rule of rules) {
    if (!COMPOUND_KINDS.has(rule.patternKind ?? '')) continue;
    const correction = rule.tailWord?.trim();
    const unified = String(rule.overlayReplace ?? '').trim();
    if (!correction || !unified) continue;
    byCorrection.set(correction, unified);
  }

  return [...byCorrection.entries()]
    .map(([correction, unified]) => ({ correction, unified }))
    .sort((a, b) => a.correction.localeCompare(b.correction, 'ko'));
}

/**
 * @param {import('./ruleTypes.js').Rule[]} rules
 * @param {string} correctionRaw
 * @param {string} unifiedRaw
 */
export function setConsistencyUnifyOverlay(rules, correctionRaw, unifiedRaw) {
  const correction = normalizeConsistencyVariant(correctionRaw);
  const unified = unifiedRaw.trim();
  if (!correction || !unified) return rules;

  return rules.map((rule) => {
    if (!COMPOUND_KINDS.has(rule.patternKind ?? '')) return rule;
    if (rule.tailWord?.trim() !== correction) return rule;
    return { ...rule, overlayReplace: unified };
  });
}

/**
 * @param {import('./ruleTypes.js').Rule[]} rules
 * @param {string} correctionRaw
 */
export function clearConsistencyUnifyOverlay(rules, correctionRaw) {
  const correction = normalizeConsistencyVariant(correctionRaw);
  if (!correction) return rules;

  return rules.map((rule) => {
    if (!COMPOUND_KINDS.has(rule.patternKind ?? '')) return rule;
    if (rule.tailWord?.trim() !== correction) return rule;
    const next = { ...rule };
    delete next.overlayReplace;
    return next;
  });
}

/**
 * @param {import('./ruleTypes.js').Rule[]} customRules
 * @param {import('./ruleEngine.js').GroupedResult} group
 * @returns {string | null}
 */
export function getConsistencyUnifyOverlayForGroup(customRules, group) {
  const tail = String(group.tailWord ?? '').trim();
  if (!tail) return null;
  if (getConsistencyUnifyPinnedTailWord(customRules) === tail) return null;

  for (const rule of customRules) {
    if (!COMPOUND_KINDS.has(rule.patternKind ?? '')) continue;
    if (rule.tailWord?.trim() !== tail) continue;
    const text = String(rule.overlayReplace ?? '').trim();
    if (text) return text;
  }
  return null;
}

/**
 * @param {import('./ruleTypes.js').Rule[]} rules
 * @returns {string | null}
 */
export function getConsistencyUnifyPinnedTailWord(rules) {
  for (const rule of rules) {
    if (!rule.consistencyUnifyPinned) continue;
    const tailWord = rule.tailWord?.trim();
    if (tailWord) return tailWord;
  }
  return null;
}

/**
 * @param {import('./ruleTypes.js').Rule[]} rules
 */
export function clearConsistencyUnifyPinState(rules) {
  return rules.map((rule) => {
    if (!rule.consistencyUnifyEntry) return rule;
    const next = { ...rule };
    delete next.consistencyUnifyPinned;
    delete next.overlayReplace;
    return next;
  });
}

/**
 * 통일형 📌 1개만 — 같은 항목 재클릭 시 해제
 *
 * @param {import('./ruleTypes.js').Rule[]} rules
 * @param {string} targetTailWordRaw
 */
export function applyConsistencyUnifyPin(rules, targetTailWordRaw) {
  const target = normalizeConsistencyVariant(targetTailWordRaw);
  if (!target) return rules;

  const current = getConsistencyUnifyPinnedTailWord(rules);
  if (current === target) {
    return clearConsistencyUnifyPinState(rules);
  }

  return rules.map((rule) => {
    if (!rule.consistencyUnifyEntry) return rule;
    const tailWord = rule.tailWord?.trim();
    if (!tailWord) return rule;

    if (tailWord === target) {
      const next = { ...rule, consistencyUnifyPinned: true };
      delete next.overlayReplace;
      return next;
    }

    return {
      ...rule,
      consistencyUnifyPinned: false,
      overlayReplace: target,
    };
  });
}

/**
 * @param {import('./ruleTypes.js').Rule[]} rules
 * @param {string} tailWordRaw
 */
export function removeConsistencyUnifyEntry(rules, tailWordRaw) {
  const tailWord = normalizeConsistencyVariant(tailWordRaw);
  if (!tailWord) return rules;

  const pinnedBefore = getConsistencyUnifyPinnedTailWord(rules);
  let next = removeCompoundFind(rules, tailWord);

  if (pinnedBefore === tailWord) {
    next = clearConsistencyUnifyPinState(next);
  }

  return next;
}
