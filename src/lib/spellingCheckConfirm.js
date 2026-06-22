import {
  countBuiltInActiveRules,
  countSpacingReviewActiveRules,
} from './activeRuleCount.js';
import { BUILT_IN_QUOTA_RULES } from './builtInRules.js';
import { CAUTION_SEARCH_RULES } from './cautionRules.js';
import { assertLoggedInForCheckOrAlert } from './checkAuthGate.js';
import {
  betaQuotaAlertForTab,
  canRunTabCheck,
  getBetaDailyQuotaStatus,
  isBetaDailyQuotaEnabled,
  isBetaDailyQuotaEnforcedForUser,
} from './betaDailyQuota.js';

/**
 * 맞춤법 검수 시작 전 confirm 본문
 * @param {{
 *   remaining: number,
 *   tabLimit: number,
 *   builtinActive: number,
 *   builtinTotal: number,
 *   cautionActive: number,
 *   cautionTotal: number,
 * }} input
 */
export function formatSpellingCheckConfirmMessage({
  remaining,
  tabLimit,
  builtinActive,
  builtinTotal,
  cautionActive,
  cautionTotal,
}) {
  return (
    `오늘 맞춤법 검수는 ${remaining}회(한도 ${tabLimit}회) 가능합니다\n` +
    `편집자 검토 필요 기준(${cautionActive}/${cautionTotal}), 맞춤법 기준(${builtinTotal}/${builtinActive})\n` +
    '검수를 진행할까요?'
  );
}

/**
 * @param {{
 *   builtinActive: number,
 *   builtinTotal: number,
 *   cautionActive: number,
 *   cautionTotal: number,
 * }} counts
 */
export function formatSpellingCheckConfirmMessageWithoutQuota(counts) {
  return (
    `편집자 검토 필요 기준(${counts.cautionActive}/${counts.cautionTotal}), 맞춤법 기준(${counts.builtinTotal}/${counts.builtinActive})\n` +
    '검수를 진행할까요?'
  );
}

/**
 * 맞춤법 탭 검수 직전 — 한도·기준 개수 confirm (차감 전)
 * @param {string} uid
 * @param {string} [email]
 * @param {{
 *   builtInEnabled?: Record<string, boolean>,
 *   cautionEnabled?: Record<string, boolean>,
 * }} ruleState
 */
export async function confirmSpellingCheckBeforeRun(
  uid,
  email = '',
  ruleState = {},
) {
  if (!assertLoggedInForCheckOrAlert(uid)) {
    return false;
  }

  const builtinActive = countBuiltInActiveRules(ruleState);
  const cautionActive = countSpacingReviewActiveRules(ruleState);
  const builtinTotal = BUILT_IN_QUOTA_RULES.length;
  const cautionTotal = CAUTION_SEARCH_RULES.length;

  const quotaDisplayEnabled =
    isBetaDailyQuotaEnabled() && Boolean(uid.trim());

  let message;
  if (quotaDisplayEnabled) {
    const status = await getBetaDailyQuotaStatus(uid, email);
    const tabCount = status.spellingCount;
    const tabLimit = status.tabLimit;
    if (
      isBetaDailyQuotaEnforcedForUser(uid, email) &&
      !canRunTabCheck(tabCount, tabLimit)
    ) {
      alert(betaQuotaAlertForTab('spelling'));
      return false;
    }
    message = formatSpellingCheckConfirmMessage({
      remaining: Math.max(0, tabLimit - tabCount),
      tabLimit,
      builtinActive,
      builtinTotal,
      cautionActive,
      cautionTotal,
    });
  } else {
    message = formatSpellingCheckConfirmMessageWithoutQuota({
      builtinActive,
      builtinTotal,
      cautionActive,
      cautionTotal,
    });
  }

  return confirm(message);
}

/**
 * 발견이 1건 이상인 기준 그룹 수 (맞춤법 탭)
 * @param {import('./ruleEngine.js').RuleResultGroup[]} groups
 */
export function countSpellingGroupsWithFindings(groups) {
  let builtinWithFindings = 0;
  let cautionWithFindings = 0;
  for (const group of groups) {
    if (group.instances.length <= 0) continue;
    if (group.category === 'caution') {
      cautionWithFindings += 1;
    } else {
      builtinWithFindings += 1;
    }
  }
  return { builtinWithFindings, cautionWithFindings };
}

/**
 * 맞춤법 검수 완료 후 alert 본문
 * @param {{
 *   builtinWithFindings: number,
 *   cautionWithFindings: number,
 *   totalFindings: number,
 * }} input
 */
export function formatSpellingCheckCompleteMessage({
  builtinWithFindings,
  cautionWithFindings,
  totalFindings,
}) {
  return (
    `검수를 진행했습니다\n` +
    `편집자 검토 기준 {${cautionWithFindings}}, 맞춤법 기준 {${builtinWithFindings}}이 해당되어\n` +
    `전체 발견은 [${totalFindings}]입니다`
  );
}

/**
 * 맞춤법 탭 검수 직후 — 발견된 기준·총 건수 alert
 * @param {import('./ruleEngine.js').RuleResultGroup[]} groups
 * @param {number} totalFindings
 */
export function alertSpellingCheckAfterRun(groups = [], totalFindings = 0) {
  alert(
    formatSpellingCheckCompleteMessage({
      ...countSpellingGroupsWithFindings(groups),
      totalFindings,
    }),
  );
}
