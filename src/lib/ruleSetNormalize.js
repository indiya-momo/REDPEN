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
import { BON_BOJO_RULES_FP } from './bonBojoRules.js';
import {
  normalizeProjectContext,
  normalizeProjectMemo,
  normalizeProjectPillarMemos,
  normalizeProjectTags,
} from './projectMeta.js';
import { normalizeWorkHistory } from './projectWorkHistory.js';

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
    bonBojoRulesFingerprint:
      typeof set.bonBojoRulesFingerprint === 'string'
        ? set.bonBojoRulesFingerprint
        : BON_BOJO_RULES_FP,
    tocBodyText: typeof set.tocBodyText === 'string' ? set.tocBodyText : '',
    tocBodyStartPage:
      typeof set.tocBodyStartPage === 'number' &&
      Number.isFinite(set.tocBodyStartPage) &&
      set.tocBodyStartPage >= 1
        ? Math.floor(set.tocBodyStartPage)
        : null,
    tocBodyExcludePages:
      typeof set.tocBodyExcludePages === 'string' ? set.tocBodyExcludePages : '',
    tags: normalizeProjectTags(set.tags),
    memo: normalizeProjectMemo(set.memo),
    pillarMemos: normalizeProjectPillarMemos(set.pillarMemos),
    projectContext: normalizeProjectContext(set.projectContext),
    workHistory: normalizeWorkHistory(set.workHistory),
    metaUpdatedAt:
      typeof set.metaUpdatedAt === 'string' &&
      !Number.isNaN(Date.parse(set.metaUpdatedAt))
        ? set.metaUpdatedAt
        : undefined,
  };
}
