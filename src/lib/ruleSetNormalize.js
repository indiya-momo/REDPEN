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
import { normalizeConsistencyDecisions } from './consistencyDecisions.js';
import { buildCriteriaCheckpoint } from './criteriaCheckpoint.js';

/**
 * @param {Record<string, unknown>} set
 */
export function normalizeRuleSet(set) {
  const { rules: customRules, version: compoundMigrateVersion } =
    applyCompoundRuleMigrations(
      set.customRules ?? [],
      set.compoundMigrateVersion,
    );
  const builtInEnabled = migrateBuiltInEnabled(
    set.builtInEnabled,
    set.spellingRulesFingerprint,
  );
  const cautionEnabled = migrateCautionEnabled(
    set.cautionEnabled,
    set.cautionRulesFingerprint,
    set.cautionEnabledPolicyVersion,
  );
  const normalizedCustomRules = ensureDefaultAuxiliaryVerbs(customRules);
  const globalExcludePhrases = set.globalExcludePhrases ?? [];
  const projectContext = normalizeProjectContext(set.projectContext);
  const savedAt =
    typeof set.savedAt === 'string' && set.savedAt ? set.savedAt : undefined;
  const consistencyDecisions = normalizeConsistencyDecisions(
    set.consistencyDecisions,
  );
  const criteriaCheckpoint =
    typeof set.criteriaCheckpoint === 'string' && set.criteriaCheckpoint
      ? set.criteriaCheckpoint
      : savedAt
        ? buildCriteriaCheckpoint({
            builtInEnabled,
            cautionEnabled,
            customRules: normalizedCustomRules,
            globalExcludePhrases,
            consistencyDecisions,
          })
        : undefined;

  return {
    ...set,
    builtInEnabled,
    spellingRulesFingerprint: SPELLING_RULES_FP,
    customRules: normalizedCustomRules,
    compoundMigrateVersion,
    globalExcludePhrases,
    cautionEnabled,
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
    projectContext,
    workHistory: normalizeWorkHistory(set.workHistory),
    consistencyDecisions,
    criteriaCheckpoint,
    savedAt,
    metaUpdatedAt:
      typeof set.metaUpdatedAt === 'string' &&
      !Number.isNaN(Date.parse(set.metaUpdatedAt))
        ? set.metaUpdatedAt
        : undefined,
  };
}
