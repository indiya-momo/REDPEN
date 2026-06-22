import {
  isAuxiliaryVerbEntryEnabled,
  listAuxiliaryVerbEntries,
} from './auxiliaryVerbRegister.js';
import {
  isConsistencyEntryEnabled,
  listConsistencyEntries,
} from './compoundPairRegister.js';
import { consistencyGroupScope } from './consistencyCheckScopes.js';
import {
  isPhraseSlotEntryEnabled,
  listPhraseSlotEntries,
} from './phraseSlotRegister.js';
import { assertLoggedInForCheckOrAlert } from './checkAuthGate.js';
import {
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
 */
export function countConsistencyCheckActiveRules(customRules = []) {
  const literalActive = listConsistencyEntries(customRules).filter((entry) =>
    isConsistencyEntryEnabled(customRules, entry.tailWord),
  ).length;
  const commonStringActive = listPhraseSlotEntries(customRules).filter((entry) =>
    isPhraseSlotEntryEnabled(customRules, entry.tailWord),
  ).length;

  const auxiliaryActive = listAuxiliaryVerbEntries(customRules).filter(
    (entry) => isAuxiliaryVerbEntryEnabled(customRules, entry),
  ).length;

  return { literalActive, commonStringActive, auxiliaryActive };
}

/**
 * @param {{
 *   remaining: number,
 *   tabLimit: number,
 *   literalActive: number,
 *   literalTotal: number,
 *   commonStringActive: number,
 *   commonStringTotal: number,
 *   auxiliaryActive: number,
 *   auxiliaryTotal: number,
 * }} input
 */
export function formatConsistencyCheckConfirmMessage({
  remaining,
  tabLimit,
  literalActive,
  literalTotal,
  commonStringActive,
  commonStringTotal,
  auxiliaryActive,
  auxiliaryTotal,
}) {
  return (
    `오늘 일관성 검수는 ${remaining}회(한도 ${tabLimit}회) 가능합니다\n` +
    `일관성 찾기(${literalActive}/${literalTotal}), 공통 문자열 찾기(${commonStringActive}/${commonStringTotal}), 본용언 + 보조용언 표기 (${auxiliaryActive}/${auxiliaryTotal})\n` +
    '검수를 진행할까요?'
  );
}

/**
 * @param {{
 *   literalActive: number,
 *   literalTotal: number,
 *   commonStringActive: number,
 *   commonStringTotal: number,
 *   auxiliaryActive: number,
 *   auxiliaryTotal: number,
 * }} counts
 */
export function formatConsistencyCheckConfirmMessageWithoutQuota(counts) {
  return (
    `일관성 찾기(${counts.literalActive}/${counts.literalTotal}), 공통 문자열 찾기(${counts.commonStringActive}/${counts.commonStringTotal}), 본용언 + 보조용언 표기 (${counts.auxiliaryActive}/${counts.auxiliaryTotal})\n` +
    '검수를 진행할까요?'
  );
}

/**
 * 일관성 탭 검수 직전 — 한도·기준 개수 confirm (차감 전)
 * @param {string} uid
 * @param {string} [email]
 * @param {import('./ruleTypes.js').Rule[]} [customRules]
 */
export async function confirmConsistencyCheckBeforeRun(
  uid,
  email = '',
  customRules = [],
) {
  if (!assertLoggedInForCheckOrAlert(uid)) {
    return false;
  }

  const { literalActive, commonStringActive, auxiliaryActive } =
    countConsistencyCheckActiveRules(customRules);
  const literalTotal = listConsistencyEntries(customRules).length;
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
      commonStringActive,
      commonStringTotal,
      auxiliaryActive,
      auxiliaryTotal,
    });
  } else {
    message = formatConsistencyCheckConfirmMessageWithoutQuota({
      literalActive,
      literalTotal,
      commonStringActive,
      commonStringTotal,
      auxiliaryActive,
      auxiliaryTotal,
    });
  }

  return confirm(message);
}

/**
 * 발견이 1건 이상인 기준 그룹 수 (일관성 탭)
 * @param {import('./ruleEngine.js').RuleResultGroup[]} groups
 */
export function countConsistencyGroupsWithFindings(groups) {
  let literalWithFindings = 0;
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
      literalWithFindings += 1;
    } else if (scope === 'auxiliary') {
      auxiliaryWithFindings += 1;
    }
  }
  return { literalWithFindings, commonStringWithFindings, auxiliaryWithFindings };
}

/**
 * @param {{
 *   literalWithFindings: number,
 *   commonStringWithFindings: number,
 *   auxiliaryWithFindings: number,
 *   totalFindings: number,
 * }} input
 */
export function formatConsistencyCheckCompleteMessage({
  literalWithFindings,
  commonStringWithFindings,
  auxiliaryWithFindings,
  totalFindings,
}) {
  return (
    `검수를 진행했습니다\n` +
    formatConsistencyResultsSummaryLine({
      literalWithFindings,
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
export function alertConsistencyCheckAfterRun(groups = [], totalFindings = 0) {
  alert(
    formatConsistencyCheckCompleteMessage({
      ...countConsistencyGroupsWithFindings(groups),
      totalFindings,
    }),
  );
}
