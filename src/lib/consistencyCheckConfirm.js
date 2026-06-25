import {
  isAuxiliaryVerbEntryEnabled,
  listAuxiliaryVerbEntries,
} from './auxiliaryVerbRegister.js';
import {
  isConsistencyEntryEnabled,
  listConsistencyLiteralEntries,
} from './compoundPairRegister.js';
import { consistencyGroupScope } from './consistencyCheckScopes.js';
import { isConsistencyUnifyTailWord } from './consistencyUnifyRegister.js';
import {
  listConsistencyUnifyEntries,
} from './consistencyRuleLimit.js';
import {
  isPhraseSlotEntryEnabled,
  listPhraseSlotEntries,
} from './phraseSlotRegister.js';
import { assertLoggedInForCheckOrAlert } from './checkAuthGate.js';
import { AUXILIARY_VERB_FEATURE_LABEL } from './bonBojoRules.js';
import {
  formatCategoryFindingCount,
  formatConsistencyResultsSummaryLine,
} from './checkResultSummaryFormat.js';
import {
  betaQuotaAlertForTab,
  canRunTabCheck,
  getBetaDailyQuotaStatus,
  isBetaDailyQuotaEnabled,
  isBetaDailyQuotaEnforcedForUser,
} from './betaDailyQuota.js';

/**
 * @param {import('./ruleTypes.js').Rule[]} [customRules]
 * @param {string[]} [globalExcludePhrases]
 */
export function countConsistencyCheckActiveRules(
  customRules = [],
  globalExcludePhrases = [],
) {
  const literalActive = listConsistencyLiteralEntries(customRules).filter(
    (entry) => isConsistencyEntryEnabled(customRules, entry.tailWord),
  ).length;
  const unifyActive = listConsistencyUnifyEntries(customRules).filter((entry) =>
    isConsistencyEntryEnabled(customRules, entry.tailWord),
  ).length;
  const commonStringActive = listPhraseSlotEntries(customRules).filter((entry) =>
    isPhraseSlotEntryEnabled(customRules, entry.tailWord),
  ).length;

  const auxiliaryActive = listAuxiliaryVerbEntries(customRules).filter(
    (entry) => isAuxiliaryVerbEntryEnabled(customRules, entry),
  ).length;

  const excludeActive = globalExcludePhrases
    .map((p) => String(p ?? '').trim())
    .filter(Boolean).length;

  return {
    literalActive,
    unifyActive,
    commonStringActive,
    auxiliaryActive,
    excludeActive,
  };
}

function formatConfirmActiveCount(active) {
  return active > 0 ? formatCategoryFindingCount(active) : '(없음)';
}

/** @param {number} active @param {number} total */
function formatConfirmAuxiliaryCount(active, total) {
  return total > 0 ? `(${active}/${total}건)` : '(없음)';
}

/**
 * @param {{
 *   literalActive: number,
 *   unifyActive: number,
 *   commonStringActive: number,
 *   excludeActive: number,
 *   auxiliaryActive: number,
 *   auxiliaryTotal: number,
 * }} input
 */
function formatConsistencyCheckCriteriaLine({
  literalActive,
  unifyActive,
  commonStringActive,
  excludeActive,
  auxiliaryActive,
  auxiliaryTotal,
}) {
  return (
    `일관성 찾기${formatConfirmActiveCount(literalActive)}, ` +
    `통일형 만들기${formatConfirmActiveCount(unifyActive)}, ` +
    `공통 문자열 찾기${formatConfirmActiveCount(commonStringActive)}, ` +
    `검수 제외 항목${formatConfirmActiveCount(excludeActive)}, ` +
    `${AUXILIARY_VERB_FEATURE_LABEL}${formatConfirmAuxiliaryCount(auxiliaryActive, auxiliaryTotal)}`
  );
}

/**
 * @param {{
 *   remaining: number,
 *   tabLimit: number,
 *   literalActive: number,
 *   literalTotal: number,
 *   unifyActive: number,
 *   unifyTotal: number,
 *   commonStringActive: number,
 *   commonStringTotal: number,
 *   excludeActive: number,
 *   auxiliaryActive: number,
 *   auxiliaryTotal: number,
 * }} input
 */
export function formatConsistencyCheckConfirmMessage({
  remaining,
  tabLimit,
  literalActive,
  unifyActive,
  commonStringActive,
  excludeActive,
  auxiliaryActive,
  auxiliaryTotal,
}) {
  return (
    `[일관성 검수 안내]\n` +
    `\n` +
    `오늘 일관성 검수는 ${remaining}회(한도 ${tabLimit}회) 가능합니다\n` +
    `${formatConsistencyCheckCriteriaLine({
      literalActive,
      unifyActive,
      commonStringActive,
      excludeActive,
      auxiliaryActive,
      auxiliaryTotal,
    })}\n` +
    `\n` +
    '검수를 진행할까요?'
  );
}

/**
 * @param {{
 *   literalActive: number,
 *   literalTotal: number,
 *   unifyActive: number,
 *   unifyTotal: number,
 *   commonStringActive: number,
 *   commonStringTotal: number,
 *   excludeActive: number,
 *   auxiliaryActive: number,
 *   auxiliaryTotal: number,
 * }} counts
 */
export function formatConsistencyCheckConfirmMessageWithoutQuota(counts) {
  return (
    `[일관성 검수 안내]\n` +
    `\n` +
    `${formatConsistencyCheckCriteriaLine({
      literalActive: counts.literalActive,
      unifyActive: counts.unifyActive,
      commonStringActive: counts.commonStringActive,
      excludeActive: counts.excludeActive,
      auxiliaryActive: counts.auxiliaryActive,
      auxiliaryTotal: counts.auxiliaryTotal,
    })}\n` +
    `\n` +
    '검수를 진행할까요?'
  );
}

/**
 * 일관성 탭 검수 직전 — 한도·기준 개수 confirm (차감 전)
 * @param {string} uid
 * @param {string} [email]
 * @param {import('./ruleTypes.js').Rule[]} [customRules]
 * @param {string[]} [globalExcludePhrases]
 */
export async function confirmConsistencyCheckBeforeRun(
  uid,
  email = '',
  customRules = [],
  globalExcludePhrases = [],
) {
  if (!assertLoggedInForCheckOrAlert(uid)) {
    return false;
  }

  const {
    literalActive,
    unifyActive,
    commonStringActive,
    auxiliaryActive,
    excludeActive,
  } = countConsistencyCheckActiveRules(customRules, globalExcludePhrases);
  const literalTotal = listConsistencyLiteralEntries(customRules).length;
  const unifyTotal = listConsistencyUnifyEntries(customRules).length;
  const commonStringTotal = listPhraseSlotEntries(customRules).length;
  const auxiliaryTotal = listAuxiliaryVerbEntries(customRules).length;

  const quotaDisplayEnabled =
    isBetaDailyQuotaEnabled() && Boolean(uid.trim());

  let message;
  if (quotaDisplayEnabled) {
    const status = await getBetaDailyQuotaStatus(uid, email);
    const tabCount = status.consistencyCount;
    const tabLimit = status.tabLimit;
    if (
      isBetaDailyQuotaEnforcedForUser(uid, email) &&
      !canRunTabCheck(tabCount, tabLimit)
    ) {
      alert(betaQuotaAlertForTab('consistency'));
      return false;
    }
    const remaining = Math.max(0, tabLimit - tabCount);
    message = formatConsistencyCheckConfirmMessage({
      remaining,
      tabLimit,
      literalActive,
      literalTotal,
      unifyActive,
      unifyTotal,
      commonStringActive,
      commonStringTotal,
      excludeActive,
      auxiliaryActive,
      auxiliaryTotal,
    });
  } else {
    message = formatConsistencyCheckConfirmMessageWithoutQuota({
      literalActive,
      literalTotal,
      unifyActive,
      unifyTotal,
      commonStringActive,
      commonStringTotal,
      excludeActive,
      auxiliaryActive,
      auxiliaryTotal,
    });
  }

  return confirm(message);
}

/**
 * 발견이 1건 이상인 기준 그룹 수 (일관성 탭)
 * @param {import('./ruleEngine.js').RuleResultGroup[]} groups
 * @param {import('./ruleTypes.js').Rule[]} [customRules]
 */
export function countConsistencyGroupsWithFindings(groups, customRules = []) {
  let literalWithFindings = 0;
  let unifyWithFindings = 0;
  let commonStringWithFindings = 0;
  let auxiliaryWithFindings = 0;
  for (const group of groups) {
    if (group.instances.length <= 0) continue;
    if (group.patternKind === 'phrase-slot-find') {
      commonStringWithFindings += 1;
      continue;
    }
    const scope = consistencyGroupScope(group);
    if (scope === 'literal-slot') {
      if (isConsistencyUnifyTailWord(customRules, group.tailWord)) {
        unifyWithFindings += 1;
      } else {
        literalWithFindings += 1;
      }
    } else if (scope === 'auxiliary') {
      auxiliaryWithFindings += 1;
    }
  }
  return {
    literalWithFindings,
    unifyWithFindings,
    commonStringWithFindings,
    auxiliaryWithFindings,
  };
}

/**
 * @param {{
 *   literalWithFindings: number,
 *   unifyWithFindings?: number,
 *   commonStringWithFindings: number,
 *   auxiliaryWithFindings: number,
 *   totalFindings: number,
 * }} input
 */
export function formatConsistencyCheckCompleteMessage({
  literalWithFindings,
  unifyWithFindings = 0,
  commonStringWithFindings,
  auxiliaryWithFindings,
  totalFindings,
}) {
  return (
    `검수를 진행했습니다\n` +
    formatConsistencyResultsSummaryLine({
      literalWithFindings,
      unifyWithFindings,
      commonStringWithFindings,
      auxiliaryWithFindings,
      totalFindings,
    })
  );
}

/**
 * 일관성 탭 검수 직후 — 발견된 기준·총 건수 alert
 * @param {import('./ruleEngine.js').RuleResultGroup[]} groups
 * @param {number} totalFindings
 */
export function alertConsistencyCheckAfterRun(
  groups = [],
  totalFindings = 0,
  customRules = [],
) {
  alert(
    formatConsistencyCheckCompleteMessage({
      ...countConsistencyGroupsWithFindings(groups, customRules),
      totalFindings,
    }),
  );
}
