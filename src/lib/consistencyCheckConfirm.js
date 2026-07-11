import {
  isAuxiliaryVerbEntryEnabled,
  listAuxiliaryVerbEntries,
} from './auxiliaryVerbRegister.js';
import {
  isConsistencyEntryEnabled,
  listConsistencyLiteralEntries,
} from './compoundPairRegister.js';
import { consistencyGroupScope } from './consistencyCheckScopes.js';
import {
  getConsistencyUnifyPinnedTailWord,
  isConsistencyUnifyTailWord,
} from './consistencyUnifyRegister.js';
import {
  listConsistencyUnifyEntries,
} from './consistencyRuleLimit.js';
import {
  isPhraseSlotEntryEnabled,
  listPhraseSlotEntries,
} from './phraseSlotRegister.js';
import { assertLoggedInForCheckOrAlert } from './checkAuthGate.js';
import { AUXILIARY_VERB_FEATURE_LABEL } from './bonBojoRules.js';
import { LITERAL_FIND_FEATURE_LABEL } from './consistencyRuleLimit.js';
import { createElement } from 'react';
import CheckResultSummaryContent from '../components/CheckResultSummaryContent.jsx';
import {
  buildConsistencyResultSummaryStats,
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
import {
  parseBracketTitleMessage,
  showAppAlert,
  showAppConfirm,
} from './appDialog.js';

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

/** 통일형 항목이 켜져 있는데 📌 미지정일 때 검수 차단 문구 */
export const CONSISTENCY_UNIFY_PIN_REQUIRED_MESSAGE =
  '통일형 만들기에서 통일형📌을 지정한 뒤 검수해 주세요.';

/**
 * 켠 통일형 항목이 있으면 📌 지정 필수.
 * @param {import('./ruleTypes.js').Rule[]} [customRules]
 * @returns {Promise<boolean>} 검수 진행 가능하면 true
 */
export async function assertConsistencyUnifyPinnedForCheck(customRules = []) {
  const { unifyActive } = countConsistencyCheckActiveRules(customRules);
  if (unifyActive <= 0) return true;
  if (getConsistencyUnifyPinnedTailWord(customRules)) return true;
  await showAppAlert({
    title: '안내',
    message: CONSISTENCY_UNIFY_PIN_REQUIRED_MESSAGE,
  });
  return false;
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
function formatConsistencyCheckCriteriaBlock({
  literalActive,
  unifyActive,
  commonStringActive,
  excludeActive,
  auxiliaryActive,
  auxiliaryTotal,
}) {
  const line1 =
    `${LITERAL_FIND_FEATURE_LABEL}${formatConfirmActiveCount(literalActive)}, ` +
    `통일형 만들기${formatConfirmActiveCount(unifyActive)}, ` +
    `공통 문자열 찾기${formatConfirmActiveCount(commonStringActive)}`;
  const line2 =
    `검수 제외 항목${formatConfirmActiveCount(excludeActive)}, ` +
    `${AUXILIARY_VERB_FEATURE_LABEL}${formatConfirmAuxiliaryCount(auxiliaryActive, auxiliaryTotal)}`;
  return `${line1}\n${line2}`;
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
    `[표기 통일 검수 진행]\n` +
    `\n` +
    `오늘 표기 통일 검수는 ${remaining}회(한도 ${tabLimit}회) 가능합니다\n` +
    `${formatConsistencyCheckCriteriaBlock({
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
    `[표기 통일 검수 진행]\n` +
    `\n` +
    `${formatConsistencyCheckCriteriaBlock({
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

  if (!(await assertConsistencyUnifyPinnedForCheck(customRules))) {
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

  const { title, message: body } = parseBracketTitleMessage(message);
  return showAppConfirm({ title, message: body });
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
 * 표기 통일 탭 — 지적 건수(instances)를 종류별로 나눈다. 본·보조는 별도 필드.
 * @param {import('./ruleEngine.js').RuleResultGroup[]} groups
 * @param {import('./ruleTypes.js').Rule[]} [customRules]
 */
export function countConsistencyFindingsByType(groups, customRules = []) {
  let find = 0;
  let unify = 0;
  let commonString = 0;
  let bonBojo = 0;
  for (const group of groups) {
    const count = group.instances.length;
    if (count <= 0) continue;
    if (group.patternKind === 'phrase-slot-find') {
      commonString += count;
      continue;
    }
    const scope = consistencyGroupScope(group);
    if (scope === 'literal-slot') {
      if (isConsistencyUnifyTailWord(customRules, group.tailWord)) {
        unify += count;
      } else {
        find += count;
      }
    } else if (scope === 'auxiliary') {
      bonBojo += count;
    }
  }
  return { find, unify, commonString, bonBojo };
}

/**
 * @param {{
 *   literalWithFindings: number,
 *   unifyWithFindings?: number,
 *   commonStringWithFindings: number,
 *   auxiliaryWithFindings: number,
 *   totalFindings: number,
 *   literalSelected?: boolean,
 *   unifySelected?: boolean,
 *   commonStringSelected?: boolean,
 *   auxiliarySelected?: boolean,
 * }} input
 */
export function formatConsistencyCheckCompleteMessage({
  literalWithFindings,
  unifyWithFindings = 0,
  commonStringWithFindings,
  auxiliaryWithFindings,
  totalFindings,
  literalSelected = true,
  unifySelected = true,
  commonStringSelected = true,
  auxiliarySelected = true,
}) {
  return formatConsistencyResultsSummaryLine({
    literalWithFindings,
    unifyWithFindings,
    commonStringWithFindings,
    auxiliaryWithFindings,
    totalFindings,
    literalSelected,
    unifySelected,
    commonStringSelected,
    auxiliarySelected,
  });
}

/**
 * 일관성 탭 검수 직후 — 발견된 기준·총 건수 alert
 * @param {import('./ruleEngine.js').RuleResultGroup[]} groups
 * @param {number} totalFindings
 * @param {import('./ruleTypes.js').Rule[]} [customRules]
 * @param {{
 *   literalSelected?: boolean,
 *   unifySelected?: boolean,
 *   commonStringSelected?: boolean,
 *   auxiliarySelected?: boolean,
 * }} [criteriaSelection]
 */
export async function alertConsistencyCheckAfterRun(
  groups = [],
  totalFindings = 0,
  customRules = [],
  criteriaSelection = {},
) {
  const {
    literalSelected = true,
    unifySelected = true,
    commonStringSelected = true,
    auxiliarySelected = true,
  } = criteriaSelection;
  const counts = countConsistencyGroupsWithFindings(groups, customRules);
  const summaryInput = {
    ...counts,
    totalFindings,
    literalSelected,
    unifySelected,
    commonStringSelected,
    auxiliarySelected,
  };
  const message = formatConsistencyCheckCompleteMessage(summaryInput);
  const stats = buildConsistencyResultSummaryStats(summaryInput);

  await showAppAlert({
    title: '검수를 진행했습니다',
    message,
    messageNode: createElement(CheckResultSummaryContent, {
      stats,
      totalFindings,
    }),
  });
}
