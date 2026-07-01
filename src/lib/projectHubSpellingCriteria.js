import {
  countActiveRules,
  isOverMaxRules,
  maxRulesExceededMessage,
} from './activeRuleCount.js';
import {
  BUILT_IN_QUOTA_RULES,
  builtInEnabledFromSheet,
  builtInEnabledKey,
  isBuiltInRuleEnabled,
} from './builtInRules.js';
import {
  buildCautionCheckRules,
  defaultCautionEnabled,
} from './cautionRules.js';
import { spellingRuleDisplayLabel } from './spellingRuleEntry.js';

/**
 * @typedef {{
 *   id: string,
 *   tailWord: string,
 *   displayLabel?: string,
 *   kind: 'built-in' | 'caution',
 *   ruleKey?: string,
 *   cautionId?: string,
 * }} SpellingCriteriaEntry
 */

/**
 * @param {import('./ruleSetsStorage.js').RuleSet} ruleSet
 * @returns {SpellingCriteriaEntry[]}
 */
export function listSpellingCriteriaEntries(ruleSet) {
  const builtInEnabled = ruleSet.builtInEnabled ?? builtInEnabledFromSheet();
  const cautionEnabled = ruleSet.cautionEnabled ?? defaultCautionEnabled();
  /** @type {SpellingCriteriaEntry[]} */
  const entries = [];

  for (const rule of BUILT_IN_QUOTA_RULES) {
    const ruleKey = builtInEnabledKey(rule);
    entries.push({
      id: `built-in:${ruleKey}`,
      tailWord: ruleKey,
      displayLabel: spellingRuleDisplayLabel(rule),
      kind: 'built-in',
      ruleKey,
    });
  }

  for (const rule of buildCautionCheckRules(cautionEnabled)) {
    const cautionId = String(rule.cautionId ?? '').trim();
    if (!cautionId) continue;
    entries.push({
      id: `caution:${cautionId}`,
      tailWord: cautionId,
      displayLabel: rule.displayLabel || rule.label,
      kind: 'caution',
      cautionId,
    });
  }

  return entries;
}

/**
 * @param {import('./ruleSetsStorage.js').RuleSet} ruleSet
 * @param {SpellingCriteriaEntry} row
 */
export function isSpellingCriteriaEntryEnabled(ruleSet, row) {
  const builtInEnabled = ruleSet.builtInEnabled ?? builtInEnabledFromSheet();
  const cautionEnabled = ruleSet.cautionEnabled ?? defaultCautionEnabled();
  if (row.kind === 'caution' && row.cautionId) {
    return cautionEnabled[row.cautionId] === true;
  }
  if (row.kind === 'built-in' && row.ruleKey) {
    const builtInRule = BUILT_IN_QUOTA_RULES.find(
      (rule) => builtInEnabledKey(rule) === row.ruleKey,
    );
    return builtInRule
      ? isBuiltInRuleEnabled(builtInEnabled, builtInRule)
      : false;
  }
  return false;
}

/**
 * @param {import('./ruleSetsStorage.js').RuleSet} ruleSet
 * @param {SpellingCriteriaEntry} row
 * @param {boolean} enabled
 */
export function planSpellingCriteriaToggle(ruleSet, row, enabled) {
  const builtInEnabled = {
    ...(ruleSet.builtInEnabled ?? builtInEnabledFromSheet()),
  };
  const cautionEnabled = {
    ...(ruleSet.cautionEnabled ?? defaultCautionEnabled()),
  };

  if (row.kind === 'caution' && row.cautionId) {
    cautionEnabled[row.cautionId] = enabled;
  } else if (row.kind === 'built-in' && row.ruleKey) {
    builtInEnabled[row.ruleKey] = enabled;
  }

  const count = countActiveRules({
    builtInEnabled,
    cautionEnabled,
    customRules: ruleSet.customRules ?? [],
  });
  if (isOverMaxRules(count)) {
    return {
      ok: false,
      reason: 'max_rules',
      message: maxRulesExceededMessage(count),
    };
  }

  return {
    ok: true,
    patch: { builtInEnabled, cautionEnabled },
  };
}
