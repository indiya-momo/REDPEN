import {
  countLoanwordActiveRules,
  countSpacingReviewActiveRules,
  countSpellingRuleActiveRules,
} from './activeRuleCount.js';
import { LOANWORD_FEATURE_LABEL } from './loanwordCheckRules.js';
import {
  LOANWORD_QUOTA_RULES,
  SPELLING_QUOTA_RULES,
} from './builtInRules.js';
import { CAUTION_SEARCH_RULES } from './cautionRules.js';
import { assertLoggedInForCheckOrAlert } from './checkAuthGate.js';
import {
  finishGuestBrowseResultThenUnlockNextGuide,
  guestBrowseSkipsCheckConfirm,
} from './guestBrowsePolicy.js';
import { createElement } from 'react';
import CheckResultSummaryContent from '../components/CheckResultSummaryContent.jsx';
import {
  buildSpellingResultSummaryStats,
  formatSpellingResultsSummaryLine,
} from './checkResultSummaryFormat.js';
import {
  betaQuotaAlertForTab,
  canRunTabCheck,
  getBetaDailyQuotaStatus,
  isBetaDailyQuotaEnabled,
  isBetaDailyQuotaEnforcedForUser,
} from './betaDailyQuota.js';
import {
  parseBracketTitleMessage,
  showAppAlert,
  showAppConfirm,
} from './appDialog.js';

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
  loanwordActive = 0,
  loanwordTotal = 0,
}) {
  const loanwordPart = loanwordTotal
    ? `, ${LOANWORD_FEATURE_LABEL}(${loanwordActive}/${loanwordTotal})`
    : '';
  return (
    `[맞춤법 검수 진행]\n` +
    `오늘 맞춤법 검수는 ${remaining}회(한도 ${tabLimit}회) 가능합니다\n` +
    `편집자 검토 필요(${cautionActive}/${cautionTotal}), 맞춤법 규칙(${builtinTotal}/${builtinActive})${loanwordPart}\n` +
    `\n` +
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
  const loanwordPart = counts.loanwordTotal
    ? `, ${LOANWORD_FEATURE_LABEL}(${counts.loanwordActive ?? 0}/${counts.loanwordTotal})`
    : '';
  return (
    `[맞춤법 검수 진행]\n` +
    `편집자 검토 필요(${counts.cautionActive}/${counts.cautionTotal}), 맞춤법 규칙(${counts.builtinTotal}/${counts.builtinActive})${loanwordPart}\n` +
    `\n` +
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
  if (guestBrowseSkipsCheckConfirm()) {
    return true;
  }

  const builtinActive = countSpellingRuleActiveRules(ruleState);
  const cautionActive = countSpacingReviewActiveRules(ruleState);
  const builtinTotal = SPELLING_QUOTA_RULES.length;
  const cautionTotal = CAUTION_SEARCH_RULES.length;
  const loanwordActive = countLoanwordActiveRules(ruleState);
  const loanwordTotal = LOANWORD_QUOTA_RULES.length;

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
      loanwordActive,
      loanwordTotal,
    });
  } else {
    message = formatSpellingCheckConfirmMessageWithoutQuota({
      builtinActive,
      builtinTotal,
      cautionActive,
      cautionTotal,
      loanwordActive,
      loanwordTotal,
    });
  }

  const { title, message: body } = parseBracketTitleMessage(message);
  return showAppConfirm({ title, message: body });
}

/**
 * 발견이 1건 이상인 기준 그룹 수 (맞춤법 탭)
 * @param {import('./ruleEngine.js').RuleResultGroup[]} groups
 */
export function countSpellingGroupsWithFindings(groups) {
  let builtinWithFindings = 0;
  let cautionWithFindings = 0;
  let loanwordWithFindings = 0;
  for (const group of groups) {
    if (group.instances.length <= 0) continue;
    if (group.category === 'caution') {
      cautionWithFindings += 1;
    } else if (group.category === 'loanword') {
      loanwordWithFindings += 1;
    } else {
      builtinWithFindings += 1;
    }
  }
  return { builtinWithFindings, cautionWithFindings, loanwordWithFindings };
}

/**
 * 맞춤법 탭 — 지적 건수(instances)를 편집자 검토·맞춤법으로 나눈다.
 * @param {import('./ruleEngine.js').RuleResultGroup[]} groups
 */
export function countSpellingFindingsByCategory(groups) {
  let editorReview = 0;
  let spelling = 0;
  let loanword = 0;
  for (const group of groups) {
    const count = group.instances.length;
    if (count <= 0) continue;
    if (group.category === 'caution') {
      editorReview += count;
    } else if (group.category === 'loanword') {
      loanword += count;
    } else {
      spelling += count;
    }
  }
  return { editorReview, spelling, loanword };
}

/**
 * 맞춤법 검수 완료 후 alert 본문 (window.alert 폴백용)
 * @param {{
 *   builtinWithFindings: number,
 *   cautionWithFindings: number,
 *   totalFindings: number,
 *   cautionSelected?: boolean,
 *   builtinSelected?: boolean,
 * }} input
 */
export function formatSpellingCheckCompleteMessage({
  builtinWithFindings,
  cautionWithFindings,
  loanwordWithFindings = 0,
  totalFindings,
  cautionSelected = true,
  builtinSelected = true,
  loanwordSelected = false,
}) {
  return formatSpellingResultsSummaryLine({
    cautionWithFindings,
    builtinWithFindings,
    loanwordWithFindings,
    totalFindings,
    cautionSelected,
    builtinSelected,
    loanwordSelected,
  });
}

/**
 * 맞춤법 탭 검수 직후 — 발견 있는 기준·발견 건수 alert
 * @param {import('./ruleEngine.js').RuleResultGroup[]} groups
 * @param {number} totalFindings
 * @param {{
 *   cautionSelected?: boolean,
 *   builtinSelected?: boolean,
 * }} [criteriaSelection]
 */
export async function alertSpellingCheckAfterRun(
  groups = [],
  totalFindings = 0,
  criteriaSelection = {},
) {
  const {
    cautionSelected = true,
    builtinSelected = true,
    loanwordSelected = false,
  } = criteriaSelection;
  const withFindings = countSpellingGroupsWithFindings(groups);
  const findingsByCategory = countSpellingFindingsByCategory(groups);
  const summaryInput = {
    cautionWithFindings: withFindings.cautionWithFindings,
    builtinWithFindings: withFindings.builtinWithFindings,
    loanwordWithFindings: withFindings.loanwordWithFindings,
    totalFindings,
    cautionSelected,
    builtinSelected,
    loanwordSelected,
  };
  const message = formatSpellingCheckCompleteMessage(summaryInput);
  const stats = buildSpellingResultSummaryStats({
    ...summaryInput,
    editorReviewFindings: findingsByCategory.editorReview,
    spellingFindings: findingsByCategory.spelling,
    loanwordFindings: findingsByCategory.loanword,
  });

  await finishGuestBrowseResultThenUnlockNextGuide(async (extra = {}) => {
    await showAppAlert({
      title: '검수를 진행했습니다',
      message,
      messageNode: createElement(CheckResultSummaryContent, {
        stats,
        totalFindings,
      }),
      ...extra,
    });
  });
}
