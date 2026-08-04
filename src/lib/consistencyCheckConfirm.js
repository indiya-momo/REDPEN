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
  isConsistencyUnifyResultGroup,
} from './consistencyUnifyRegister.js';
import {
  LITERAL_FIND_FEATURE_LABEL,
  UNIFY_FEATURE_LABEL,
  listConsistencyUnifyEntries,
} from './consistencyRuleLimit.js';
import { formatConsistencyListLabel } from './patternDisplayLabels.js';
import {
  isPhraseSlotEntryEnabled,
  listPhraseSlotEntries,
} from './phraseSlotRegister.js';
import { assertLoggedInForCheckOrAlert } from './checkAuthGate.js';
import { AUXILIARY_VERB_FEATURE_LABEL } from './bonBojoRules.js';
import { createElement } from 'react';
import CheckResultSummaryContent from '../components/CheckResultSummaryContent.jsx';
import ConsistencyCheckConfirmContent from '../components/ConsistencyCheckConfirmContent.jsx';
import UnifyCandidateFindCompleteContent from '../components/UnifyCandidateFindCompleteContent.jsx';
import UnifyCandidateFindConfirmContent from '../components/UnifyCandidateFindConfirmContent.jsx';
import {
  buildConsistencyResultSummaryStats,
  formatCategoryFindingCount,
  formatConsistencyResultsSummaryLine,
} from './checkResultSummaryFormat.js';
import {
  BETA_TAB_LIMIT_DEFAULT,
  betaQuotaAlertForTab,
  buildCheckResultQuotaConsumedLine,
  canRunTabCheck,
  formatConsistencyCheckQuotaAvailabilityLine,
  getBetaDailyQuotaStatus,
  getTabRemainingBreakdown,
  isBetaDailyQuotaEnabled,
  isBetaDailyQuotaEnforcedForUser,
} from './betaDailyQuota.js';
import {
  finishGuestBrowseConsistencyResultThenUnlockExportGuide,
  guestBrowseSkipsCheckConfirm,
} from './guestBrowsePolicy.js';
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
  '표기 통일하기에서 통일형📌을 지정한 뒤 검수해 주세요.';

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

/** 여러 항목 찾기·표기 통일하기 — 등록 항목 수 */
function formatConfirmItemCount(active) {
  return active > 0 ? `(${active}항목)` : '(없음)';
}

/**
 * 통일형 confirm 한 줄 — 예: 표기 통일하기(2항목, 통일형: 조선시대📌)
 * @param {number} unifyActive
 * @param {string | null | undefined} pinnedTailWord
 */
export function formatConsistencyUnifyConfirmLine(
  unifyActive,
  pinnedTailWord,
) {
  if (unifyActive <= 0) {
    return `${UNIFY_FEATURE_LABEL}(없음)`;
  }
  const pinned = typeof pinnedTailWord === 'string' ? pinnedTailWord.trim() : '';
  if (!pinned) {
    return `${UNIFY_FEATURE_LABEL}${formatConfirmItemCount(unifyActive)}`;
  }
  const label = formatConsistencyListLabel(pinned);
  return `${UNIFY_FEATURE_LABEL}(${unifyActive}항목, 통일형: ${label}📌)`;
}

/** @param {number} active @param {number} total */
function formatConfirmAuxiliaryCount(active, total) {
  return total > 0 ? `(${active}/${total})` : '(없음)';
}

/**
 * @param {{
 *   literalActive: number,
 *   commonStringActive: number,
 *   excludeActive: number,
 *   auxiliaryActive: number,
 *   auxiliaryTotal: number,
 * }} input
 */
function formatConsistencyCheckCriteriaBlock({
  literalActive,
  unifyActive = 0,
  pinnedTailWord = null,
  commonStringActive,
  excludeActive,
  auxiliaryActive,
  auxiliaryTotal,
}) {
  const line1 =
    `${formatConsistencyUnifyConfirmLine(unifyActive, pinnedTailWord)}, ` +
    `${LITERAL_FIND_FEATURE_LABEL}${formatConfirmItemCount(literalActive)}`;
  const line2 =
    `공통 항목 찾기${formatConfirmActiveCount(commonStringActive)}, ` +
    `찾기 제외 항목${formatConfirmActiveCount(excludeActive)}`;
  const line3 = `${AUXILIARY_VERB_FEATURE_LABEL}${formatConfirmAuxiliaryCount(auxiliaryActive, auxiliaryTotal)}`;
  return `${line1}\n${line2}\n${line3}`;
}

/**
 * @param {{
 *   remaining: number,
 *   dailyRemaining: number,
 *   bonusRemaining: number,
 *   literalActive: number,
 *   unifyActive?: number,
 *   pinnedTailWord?: string | null,
 *   commonStringActive: number,
 *   excludeActive: number,
 *   auxiliaryActive: number,
 *   auxiliaryTotal: number,
 * }} input
 */
export function formatConsistencyCheckConfirmMessage({
  remaining,
  dailyRemaining,
  bonusRemaining,
  literalActive,
  unifyActive = 0,
  pinnedTailWord = null,
  commonStringActive,
  excludeActive,
  auxiliaryActive,
  auxiliaryTotal,
}) {
  return (
    `[표기 통일 검수]\n` +
    `\n` +
    `${formatConsistencyCheckQuotaAvailabilityLine(remaining, dailyRemaining, bonusRemaining)}\n` +
    `${formatConsistencyCheckCriteriaBlock({
      literalActive,
      unifyActive,
      pinnedTailWord,
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
 *   remaining: number,
 *   dailyRemaining: number,
 *   bonusRemaining: number,
 *   unifyActive: number,
 *   pinnedTailWord?: string | null,
 * }} input
 */
export function formatConsistencyUnifyCheckConfirmMessage({
  remaining,
  dailyRemaining,
  bonusRemaining,
  unifyActive,
  pinnedTailWord = null,
}) {
  return (
    `[표기 통일하기 검수 진행]\n` +
    `\n` +
    `${formatConsistencyCheckQuotaAvailabilityLine(remaining, dailyRemaining, bonusRemaining)}\n` +
    `(표기 통일하기는 표기 통일 검수 횟수를 사용합니다)\n` +
    `${formatConsistencyUnifyConfirmLine(unifyActive, pinnedTailWord)}\n` +
    `\n` +
    '검수를 진행할까요?'
  );
}

/**
 * @param {{ unifyActive: number, pinnedTailWord?: string | null }} input
 */
export function formatConsistencyUnifyCheckConfirmMessageWithoutQuota({
  unifyActive,
  pinnedTailWord = null,
}) {
  return (
    `[통일형 검수 진행]\n` +
    `\n` +
    `${formatConsistencyUnifyConfirmLine(unifyActive, pinnedTailWord)}\n` +
    `\n` +
    '검수를 진행할까요?'
  );
}

/**
 * 표기 통일 추천 — 찾기 직전 confirm
 * @returns {string}
 */
export function formatUnifyCandidateFindConfirmMessage() {
  return (
    `[표기 통일 추천(띄어쓰기-붙여쓰기)]\n` +
    `\n` +
    `표기 통일 검수권 1장을 사용합니다\n` +
    `사용자의 PC 성능에 따라 10초 ~ 1분 정도 시간이 소요됩니다\n` +
    `\n` +
    '찾기를 진행할까요?'
  );
}

/** @returns {string} */
export function formatUnifyCandidateFindConfirmMessageWithoutQuota() {
  return (
    `[표기 통일 추천(띄어쓰기-붙여쓰기)]\n` +
    `\n` +
    '띄어쓰기가 다른 표기 후보를 문서에서 찾습니다.\n' +
    `사용자의 PC 성능에 따라 10초 ~ 1분 정도 시간이 소요됩니다\n` +
    `\n` +
    '찾기를 진행할까요?'
  );
}

/**
 * 표기 통일 추천 찾기 직전 — 검수권 confirm (차감 전)
 * @param {string} uid
 * @param {string} [email]
 */
export async function confirmUnifyCandidateFindBeforeRun(uid, email = '') {
  if (!assertLoggedInForCheckOrAlert(uid)) {
    return false;
  }

  if (guestBrowseSkipsCheckConfirm()) {
    return true;
  }

  const quotaDisplayEnabled =
    isBetaDailyQuotaEnabled() && Boolean(uid.trim());

  let message;
  /** @type {import('react').ReactNode | undefined} */
  let messageNode;
  if (quotaDisplayEnabled) {
    const status = await getBetaDailyQuotaStatus(uid, email);
    const tabCount = status.consistencyCount ?? 0;
    const tabLimit = status.consistencyTabLimit ?? BETA_TAB_LIMIT_DEFAULT;
    if (
      isBetaDailyQuotaEnforcedForUser(uid, email) &&
      !canRunTabCheck(tabCount, tabLimit)
    ) {
      alert(betaQuotaAlertForTab('consistency'));
      return false;
    }
    message = formatUnifyCandidateFindConfirmMessage();
    messageNode = createElement(UnifyCandidateFindConfirmContent);
  } else {
    message = formatUnifyCandidateFindConfirmMessageWithoutQuota();
  }

  const { title, message: body } = parseBracketTitleMessage(message);
  return showAppConfirm({ title, message: body, messageNode });
}

/**
 * 표기 통일 추천 찾기 완료 alert 본문
 * @param {number} clusterCount
 * @param {number} totalOccurrences
 */
export function formatUnifyCandidateFindCompleteMessage(
  clusterCount,
  totalOccurrences,
) {
  if (clusterCount <= 0) {
    return '띄어쓰기만 다른 표기 후보를 찾지 못했습니다.';
  }
  return `1차 표기 통일 : 추천 항목 ${clusterCount} 전체 발견 ${totalOccurrences}`;
}

/**
 * 2차 표기 통일 완료 alert 본문
 * @param {number} clusterCount
 * @param {number} totalOccurrences
 */
export function formatUnifyCandidatePhase2CompleteMessage(
  clusterCount,
  totalOccurrences,
) {
  if (clusterCount <= 0) {
    return '확장할 표기 후보가 없었습니다.';
  }
  return `2차 표기 통일 : 추천 항목 ${clusterCount} 전체 발견 ${totalOccurrences}`;
}

/**
 * 표기 통일 추천 찾기 직후 — 발견 항목·검수권 사용 alert
 * 항목 수 = 목록 아코디언 행(계열은 1), 횟수 = 목록과 동일(item 재집계·보조용언 추정 제외).
 * @param {import('./unifyCandidateDiscover.js').UnifySpacingCluster[]} clusters
 * @param {{
 *   uid?: string,
 *   email?: string,
 *   itemCount?: number,
 * }} [quotaContext]
 */
export async function alertUnifyCandidateFindAfterRun(
  clusters = [],
  quotaContext = {},
) {
  const {
    uid = '',
    email = '',
    itemCount,
  } = quotaContext;
  const clusterCount =
    typeof itemCount === 'number' ? itemCount : clusters.length;
  const totalOccurrences = clusters.reduce(
    (sum, cluster) => sum + (cluster.totalCount ?? 0),
    0,
  );
  let message = formatUnifyCandidateFindCompleteMessage(
    clusterCount,
    totalOccurrences,
  );

  const quotaConsumedLine = await buildCheckResultQuotaConsumedLine(
    uid,
    email,
    'consistency',
  );
  if (quotaConsumedLine) {
    message = `${message}\n\n${quotaConsumedLine}`;
  }

  await finishGuestBrowseConsistencyResultThenUnlockExportGuide(
    async (extra = {}) => {
      await showAppAlert({
        title: '찾기를 진행했습니다',
        message,
        messageNode:
          clusterCount > 0
            ? createElement(UnifyCandidateFindCompleteContent, {
                clusterCount,
                totalOccurrences,
                quotaConsumedLine,
                phaseLabel: '1차 표기 통일 :',
              })
            : undefined,
        ...extra,
      });
    },
  );
}

/**
 * 2차 표기 통일 완료 후 — 추천 항목·전체 발견 alert
 * @param {{
 *   itemCount?: number,
 *   clusters?: import('./unifyCandidateDiscover.js').UnifySpacingCluster[],
 * }} [opts]
 */
export async function alertUnifyCandidatePhase2AfterComplete(opts = {}) {
  const clusters = opts.clusters ?? [];
  const clusterCount =
    typeof opts.itemCount === 'number' ? opts.itemCount : clusters.length;
  const totalOccurrences = clusters.reduce(
    (sum, cluster) => sum + (cluster.totalCount ?? 0),
    0,
  );
  const message = formatUnifyCandidatePhase2CompleteMessage(
    clusterCount,
    totalOccurrences,
  );

  await showAppAlert({
    title: '2차 표기 통일을 완료했습니다',
    message,
    messageNode:
      clusterCount > 0
        ? createElement(UnifyCandidateFindCompleteContent, {
            clusterCount,
            totalOccurrences,
            phaseLabel: '2차 표기 통일 :',
          })
        : undefined,
  });
}

/**
 * @param {{
 *   literalActive: number,
 *   literalTotal: number,
 *   commonStringActive: number,
 *   commonStringTotal: number,
 *   excludeActive: number,
 *   auxiliaryActive: number,
 *   auxiliaryTotal: number,
 * }} counts
 */
export function formatConsistencyCheckConfirmMessageWithoutQuota(counts) {
  return (
    `[표기 통일 검수]\n` +
    `\n` +
    `${formatConsistencyCheckCriteriaBlock({
      literalActive: counts.literalActive,
      unifyActive: counts.unifyActive ?? 0,
      pinnedTailWord: counts.pinnedTailWord ?? null,
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

  if (guestBrowseSkipsCheckConfirm()) {
    return true;
  }

  const {
    literalActive,
    unifyActive,
    commonStringActive,
    auxiliaryActive,
    excludeActive,
  } = countConsistencyCheckActiveRules(customRules, globalExcludePhrases);
  const literalTotal = listConsistencyLiteralEntries(customRules).length;
  const commonStringTotal = listPhraseSlotEntries(customRules).length;
  const auxiliaryTotal = listAuxiliaryVerbEntries(customRules).length;
  const pinnedTailWord = getConsistencyUnifyPinnedTailWord(customRules);

  const quotaDisplayEnabled =
    isBetaDailyQuotaEnabled() && Boolean(uid.trim());

  let message;
  /** @type {import('react').ReactElement | null} */
  let messageNode = null;
  const criteriaProps = {
    literalActive,
    unifyActive,
    pinnedTailWord,
    commonStringActive,
    excludeActive,
    auxiliaryActive,
    auxiliaryTotal,
  };
  if (quotaDisplayEnabled) {
    const status = await getBetaDailyQuotaStatus(uid, email);
    const tabCount = status.consistencyCount;
    const tabLimit =
      status.consistencyTabLimit ?? status.tabLimit;
    if (
      isBetaDailyQuotaEnforcedForUser(uid, email) &&
      !canRunTabCheck(tabCount, tabLimit)
    ) {
      alert(betaQuotaAlertForTab('consistency'));
      return false;
    }
    const remaining = Math.max(0, tabLimit - tabCount);
    const dailyLimit = status.dailyLimit ?? 1;
    const bonusRemaining = status.signupBonusConsistencyRemaining ?? 0;
    const { dailyRemaining } = getTabRemainingBreakdown(
      tabCount,
      dailyLimit,
      bonusRemaining,
    );
    message = formatConsistencyCheckConfirmMessage({
      remaining,
      dailyRemaining,
      bonusRemaining,
      ...criteriaProps,
      literalTotal,
      commonStringTotal,
    });
    messageNode = createElement(ConsistencyCheckConfirmContent, {
      remaining,
      dailyRemaining,
      bonusRemaining,
      showQuota: true,
      ...criteriaProps,
    });
  } else {
    message = formatConsistencyCheckConfirmMessageWithoutQuota({
      ...criteriaProps,
      literalTotal,
      commonStringTotal,
    });
    messageNode = createElement(ConsistencyCheckConfirmContent, {
      showQuota: false,
      ...criteriaProps,
    });
  }

  const { title, message: body } = parseBracketTitleMessage(message);
  return showAppConfirm({ title, message: body, messageNode });
}

/**
 * 표기 통일하기 전용 검수 confirm
 * @param {string} uid
 * @param {string} [email]
 * @param {import('./ruleTypes.js').Rule[]} [customRules]
 */
export async function confirmConsistencyUnifyCheckBeforeRun(
  uid,
  email = '',
  customRules = [],
) {
  if (!assertLoggedInForCheckOrAlert(uid)) {
    return false;
  }

  if (!(await assertConsistencyUnifyPinnedForCheck(customRules))) {
    return false;
  }

  if (guestBrowseSkipsCheckConfirm()) {
    return true;
  }

  const { unifyActive } = countConsistencyCheckActiveRules(customRules, []);
  if (unifyActive <= 0) {
    await showAppAlert({
      title: '안내',
      message: `${UNIFY_FEATURE_LABEL}에서 검사할 항목을 등록·선택하세요.`,
    });
    return false;
  }

  const pinnedTailWord = getConsistencyUnifyPinnedTailWord(customRules);

  const quotaDisplayEnabled =
    isBetaDailyQuotaEnabled() && Boolean(uid.trim());

  let message;
  if (quotaDisplayEnabled) {
    const status = await getBetaDailyQuotaStatus(uid, email);
    const tabCount = status.consistencyCount ?? 0;
    const tabLimit = status.consistencyTabLimit ?? BETA_TAB_LIMIT_DEFAULT;
    if (
      isBetaDailyQuotaEnforcedForUser(uid, email) &&
      !canRunTabCheck(tabCount, tabLimit)
    ) {
      alert(betaQuotaAlertForTab('consistency'));
      return false;
    }
    const remaining = Math.max(0, tabLimit - tabCount);
    const dailyLimit = status.dailyLimit ?? 1;
    const bonusRemaining = status.signupBonusConsistencyRemaining ?? 0;
    const { dailyRemaining } = getTabRemainingBreakdown(
      tabCount,
      dailyLimit,
      bonusRemaining,
    );
    message = formatConsistencyUnifyCheckConfirmMessage({
      remaining,
      dailyRemaining,
      bonusRemaining,
      unifyActive,
      pinnedTailWord,
    });
  } else {
    message = formatConsistencyUnifyCheckConfirmMessageWithoutQuota({
      unifyActive,
      pinnedTailWord,
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
      if (isConsistencyUnifyResultGroup(customRules, group)) {
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
      if (isConsistencyUnifyResultGroup(customRules, group)) {
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
 * @param {{ uid?: string, email?: string, tab?: import('./betaDailyQuota.js').BetaQuotaTab }} [quotaContext]
 */
export async function alertConsistencyCheckAfterRun(
  groups = [],
  totalFindings = 0,
  customRules = [],
  criteriaSelection = {},
  quotaContext = {},
) {
  const {
    literalSelected = true,
    unifySelected = true,
    commonStringSelected = true,
    auxiliarySelected = true,
  } = criteriaSelection;
  const { uid = '', email = '', tab = 'consistency' } = quotaContext;
  const withFindings = countConsistencyGroupsWithFindings(
    groups,
    customRules,
  );
  const findingsByType = countConsistencyFindingsByType(groups, customRules);
  const summaryInput = {
    literalWithFindings: withFindings.literalWithFindings,
    unifyWithFindings: withFindings.unifyWithFindings,
    commonStringWithFindings: withFindings.commonStringWithFindings,
    auxiliaryWithFindings: withFindings.auxiliaryWithFindings,
    totalFindings,
    literalSelected,
    unifySelected,
    commonStringSelected,
    auxiliarySelected,
  };
  const message = formatConsistencyCheckCompleteMessage(summaryInput);
  const stats = buildConsistencyResultSummaryStats({
    ...summaryInput,
    literalFindings: findingsByType.find,
    unifyFindings: findingsByType.unify,
    commonStringFindings: findingsByType.commonString,
    auxiliaryFindings: findingsByType.bonBojo,
  });

  const quotaConsumedLine = await buildCheckResultQuotaConsumedLine(
    uid,
    email,
    tab,
  );

  await finishGuestBrowseConsistencyResultThenUnlockExportGuide(
    async (extra = {}) => {
      await showAppAlert({
        title: '검수를 진행했습니다',
        message,
        messageNode: createElement(CheckResultSummaryContent, {
          stats,
          totalFindings,
          quotaConsumedLine,
        }),
        ...extra,
      });
    },
  );
}
