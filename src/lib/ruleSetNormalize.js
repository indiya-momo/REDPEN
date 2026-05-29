import {
  CAUTION_RULES_FP,
  CAUTION_ENABLED_POLICY_VERSION,
  migrateCautionEnabled,
} from './cautionRules.js';
import {
  SPELLING_RULES_FP,
  migrateBuiltInEnabled,
} from './builtInRules.js';
import { applyCompoundRuleMigrations } from './migrateCompoundRules.js';
import { ensureDefaultAuxiliaryVerbs } from './defaultAuxiliaryVerbs.js';

/**
 * @param {Record<string, unknown>} set
 */
export function normalizeRuleSet(set) {
  const { rules: customRules, version: compoundMigrateVersion } =
    applyCompoundRuleMigrations(
      set.customRules ?? [],
      set.compoundMigrateVersion,
    );
  return {
    ...set,
    builtInEnabled: migrateBuiltInEnabled(
      set.builtInEnabled,
      set.spellingRulesFingerprint,
    ),
    spellingRulesFingerprint: SPELLING_RULES_FP,
    customRules: ensureDefaultAuxiliaryVerbs(customRules),
    compoundMigrateVersion,
    globalExcludePhrases: set.globalExcludePhrases ?? [],
    cautionEnabled: migrateCautionEnabled(
      set.cautionEnabled,
      set.cautionRulesFingerprint,
      set.cautionEnabledPolicyVersion,
    ),
    cautionRulesFingerprint: CAUTION_RULES_FP,
    cautionEnabledPolicyVersion: CAUTION_ENABLED_POLICY_VERSION,
  };
}
