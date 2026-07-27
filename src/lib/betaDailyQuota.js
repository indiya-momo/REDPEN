/**
 * 오픈베타 검수 한도: 가입 보너스(맞춤법·표기 통일 각 5, 1회) + KST 일일 1회(피드백 당일 2회).
 * 일일 미사용분은 다음날로 넘어가지 않음. 통일형·우수 피드백 별도 한도 없음.
 * 검수 직전 assertBetaDailyCheckOrAlert, 소비 후 배지·피드백 보너스 연동.
 */
import {
  doc,
  getDoc,
  getFirestore,
  runTransaction,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { createElement, Fragment } from 'react';
import { syncFirstCheckBadge } from './badgeGrants.js';
import { assertLoggedInForCheckOrAlert } from './checkAuthGate.js';
import {
  parseBracketTitleMessage,
  showAppAlert,
  showAppConfirm,
} from './appDialog.js';
import {
  firebaseApp,
  isFirebaseAuthConfigured,
  resolveSessionEmail,
} from './firebaseAuth.js';
import { isPaidPlan } from './userPlan.js';
import { ensureLocalPlanFromCloud } from './userProfileCloud.js';
import { getLocalUserPlan } from './userProfileStorage.js';

const LOCAL_QUOTA_PREFIX = 'indiya-beta-quota-v4--';
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** @typedef {'spelling' | 'consistency' | 'unify'} BetaQuotaTab */

/** @returns {boolean} */
export function isLocalDevQuotaRelaxed() {
  if (!import.meta.env.DEV) return false;
  if (import.meta.env.VITE_BETA_QUOTA_RELAX_LOCAL !== 'true') return false;
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
}

/** 베타 기본 — 맞춤법·표기 통일 탭 검수 하루 1회 */
export const BETA_TAB_LIMIT_DEFAULT = 1;
/** 피드백 보너스 — 맞춤법·표기 통일 탭 검수 하루 2회 */
export const BETA_TAB_LIMIT_FEEDBACK = 2;
/** @deprecated 우수 티어 폐지 — 피드백과 동일(2) */
export const BETA_TAB_LIMIT_BOOSTED = BETA_TAB_LIMIT_FEEDBACK;

/** 가입 시 1회 지급 — 맞춤법·표기 통일 각 5회(소진형, 리필 없음) */
export const SIGNUP_BONUS_TAB_CHECKS = 5;
/**
 * 가입 보너스 정책 버전.
 * 바뀌면 이미 지급된 계정도 잔여를 SIGNUP_BONUS_TAB_CHECKS로 다시 맞춘다.
 */
export const SIGNUP_BONUS_POLICY_VERSION = 2;

/**
 * @deprecated 통일형 별도 한도 폐지 — 표기 통일 탭과 동일 풀
 * 하위 호환용으로 일일 기본값만 노출
 */
export const BETA_UNIFY_LIMIT_DEFAULT = BETA_TAB_LIMIT_DEFAULT;
/** @deprecated */
export const BETA_UNIFY_LIMIT_FEEDBACK = BETA_TAB_LIMIT_FEEDBACK;
/** @deprecated */
export const BETA_UNIFY_LIMIT_BOOSTED = BETA_TAB_LIMIT_FEEDBACK;
/** @deprecated */
export const BETA_CONSISTENCY_LIMIT_DEFAULT = BETA_TAB_LIMIT_DEFAULT;
/** @deprecated */
export const BETA_CONSISTENCY_LIMIT_FEEDBACK = BETA_TAB_LIMIT_FEEDBACK;
/** @deprecated */
export const BETA_CONSISTENCY_LIMIT_BOOSTED = BETA_TAB_LIMIT_FEEDBACK;

const BETA_QUOTA_POLICY_SUMMARY =
  '오픈베타 기간에는 가입 시 맞춤법·표기 통일 검수를 각 5회 드리며, ' +
  '매일(한국 시간) 각 1회가 새로 생깁니다(당일 미사용분은 다음날로 넘어가지 않습니다). ' +
  '피드백을 남기면 그날 일일 지급이 각 2회로 늘어납니다. ';

export const BETA_DAILY_QUOTA_ALERT_SPELLING =
  '맞춤법 검수 한도를 모두 사용했습니다.\n\n' +
  BETA_QUOTA_POLICY_SUMMARY +
  '내일 0시 이후 일일 횟수가 다시 생깁니다.';

export const BETA_DAILY_QUOTA_ALERT_CONSISTENCY =
  '표기 통일 검수 한도를 모두 사용했습니다.\n\n' +
  BETA_QUOTA_POLICY_SUMMARY +
  '내일 0시 이후 일일 횟수가 다시 생깁니다.';

/** @deprecated 통일형은 표기 통일 탭과 동일 안내 */
export const BETA_DAILY_QUOTA_ALERT_UNIFY = BETA_DAILY_QUOTA_ALERT_CONSISTENCY;

export const BETA_DAILY_QUOTA_ALERT_EXPORT =
  '오늘 검수 결과 내보내기 한도를 모두 사용했습니다.\n\n' +
  '오픈베타 기간에는 회원에게 매일 1회 내보내기를 제공합니다(한국 시간 기준). ' +
  '내일 0시 이후 다시 시도해 주세요.';

/**
 * @param {'spelling' | 'consistency'} [exportTab]
 */
export function proofreadExportTabShortLabel(exportTab = 'spelling') {
  return exportTab === 'consistency' ? '표기 통일' : '맞춤법';
}

/**
 * @param {'spelling' | 'consistency'} [exportTab]
 */
export function buildProofreadExportConfirmMessage(exportTab = 'spelling') {
  const tabLabel = proofreadExportTabShortLabel(exportTab);
  return (
    `[${tabLabel} 검수 결과 다운로드]\n` +
    `오늘 ${tabLabel} 검수 결과 다운로드는 1회 가능합니다.\n\n` +
    '다운로드를 진행할까요?\n\n' +
    '※ 엑셀(.xlsx)파일로 진행되며, PDF 다운로드는 준비중입니다'
  );
}

/** @param {'spelling' | 'consistency'} [exportTab] */
async function confirmProofreadExportOrCancel(exportTab = 'spelling') {
  const { title, message } = parseBracketTitleMessage(
    buildProofreadExportConfirmMessage(exportTab),
  );
  return showAppConfirm({ title, message });
}

/** 피드백 제출 후 작업 탭 새로고침 — 8번 말풍선 (돌아오기만으로는 안 뜸) */
export const FEEDBACK_SUBMIT_THANK_BUBBLE_LINES = [
  '피드백을 보내준거냥?',
  '모모집사가 선물을 보냈다는데',
  '마이페이지에서 확인해보라냥',
];

/** @returns {boolean} */
export function isBetaDailyQuotaEnabled() {
  if (import.meta.env.VITE_BETA_DAILY_QUOTA === 'false') return false;
  return isFirebaseAuthConfigured && Boolean(firebaseApp);
}

/**
 * @param {string | undefined} raw
 * @param {{ lowercase?: boolean }} [options]
 */
function parseAdminAllowlist(raw, options = {}) {
  if (!raw || typeof raw !== 'string') return [];
  return raw
    .split(',')
    .map((entry) => {
      const trimmed = entry.trim();
      return options.lowercase ? trimmed.toLowerCase() : trimmed;
    })
    .filter(Boolean);
}

/** @returns {Set<string>} */
function getBetaQuotaAdminUidSet() {
  return new Set(parseAdminAllowlist(import.meta.env.VITE_BETA_QUOTA_ADMIN_UIDS));
}

/** @returns {Set<string>} */
function getBetaQuotaAdminEmailSet() {
  return new Set(
    parseAdminAllowlist(import.meta.env.VITE_BETA_QUOTA_ADMIN_EMAILS, {
      lowercase: true,
    }),
  );
}

/**
 * @param {{ email?: string } | null | undefined} session
 */
export function resolveQuotaAuthEmail(session) {
  if (!isFirebaseAuthConfigured || !firebaseApp) {
    return (session?.email ?? '').trim();
  }
  return resolveSessionEmail(session);
}

/**
 * @param {string} uid
 * @param {string} [email]
 */
export function isBetaQuotaAdminExempt(uid, email = '') {
  const id = uid.trim();
  const mail = email.trim().toLowerCase();
  const uids = getBetaQuotaAdminUidSet();
  const emails = getBetaQuotaAdminEmailSet();
  if (id && uids.has(id)) return true;
  if (mail && emails.has(mail)) return true;
  if (
    import.meta.env.DEV &&
    uids.size === 0 &&
    emails.size === 0
  ) {
    console.warn(
      '[admin] VITE_BETA_QUOTA_ADMIN_EMAILS / UIDS 가 비어 있습니다. .env 를 확인하고 Vite를 재시작하세요.',
    );
  }
  return false;
}

/**
 * @param {string} uid
 * @param {string} [email]
 * @param {unknown} [plan]
 */
export function isBetaDailyQuotaEnforcedForUser(uid, email = '', plan) {
  if (isLocalDevQuotaRelaxed()) return false;
  const resolvedPlan =
    plan === undefined ? getLocalUserPlan(uid) : plan;
  if (isPaidPlan({ plan: resolvedPlan })) return false;
  return (
    isBetaDailyQuotaEnabled() &&
    Boolean(uid.trim()) &&
    !isBetaQuotaAdminExempt(uid, email)
  );
}

/**
 * @param {Date} [date]
 */
export function getKstDayId(date = new Date()) {
  const kst = new Date(date.getTime() + KST_OFFSET_MS);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(kst.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 일일 할당만 (가입 보너스 제외). unify는 consistency와 동일.
 * @param {string | null | undefined} feedbackBonusDayId
 * @param {string | null | undefined} _boostApprovedDayId 폐지(무시)
 * @param {string} dayId
 * @param {BetaQuotaTab} [tab='spelling']
 */
export function getTabCheckLimit(
  feedbackBonusDayId,
  _boostApprovedDayId,
  dayId,
  tab = 'spelling',
) {
  void tab;
  const hasFeedback = feedbackBonusDayId === dayId;
  return hasFeedback ? BETA_TAB_LIMIT_FEEDBACK : BETA_TAB_LIMIT_DEFAULT;
}

/**
 * @param {BetaQuotaTab} tab
 * @returns {'spelling' | 'consistency'}
 */
export function normalizeBetaQuotaTab(tab) {
  return tab === 'spelling' ? 'spelling' : 'consistency';
}

/**
 * @param {number} dailyLimit
 * @param {number} tabCount 오늘 총 사용(일일+보너스)
 * @param {number} bonusRemaining
 */
export function getTabAvailableChecks(dailyLimit, tabCount, bonusRemaining) {
  const dailyUsed = Math.min(Math.max(0, tabCount), dailyLimit);
  const dailyRemaining = Math.max(0, dailyLimit - dailyUsed);
  return dailyRemaining + Math.max(0, bonusRemaining);
}

/**
 * @param {number} tabCount
 * @param {number} tabLimit
 */
export function canRunTabCheck(tabCount, tabLimit) {
  return tabCount < tabLimit;
}

/**
 * @param {BetaQuotaTab} tab
 */
export function betaQuotaAlertForTab(tab) {
  if (tab === 'spelling') return BETA_DAILY_QUOTA_ALERT_SPELLING;
  return BETA_DAILY_QUOTA_ALERT_CONSISTENCY;
}

/**
 * @param {BetaQuotaTab} tab
 */
export function betaQuotaTabLabel(tab) {
  if (tab === 'spelling') return '맞춤법 검수';
  return '표기 통일 검수';
}

export function formatBetaExportConsumedAlert(exportCount, exportLimit) {
  const remaining = Math.max(0, exportLimit - exportCount);
  return (
    `오늘보내기 횟수가 1회 차감되었습니다.\n\n` +
    `사용: ${exportCount}/${exportLimit}회\n` +
    `남음: ${remaining}회`
  );
}

/**
 * 검수 가능 횟수 괄호 안 — 일일+가입 혜택 구성
 * @param {number} dailyRemaining
 * @param {number} bonusRemaining
 */
export function formatQuotaAvailabilityParen(dailyRemaining, bonusRemaining) {
  return `매일 ${Math.max(0, dailyRemaining)}회+가입 혜택 ${Math.max(0, bonusRemaining)}회`;
}

/**
 * 검수 직전 confirm — 1일·선물 검수권 구성
 * @param {number} dailyRemaining
 * @param {number} bonusRemaining
 */
export function formatQuotaTicketAvailabilityParen(dailyRemaining, bonusRemaining) {
  return (
    `1일 검수권 ${Math.max(0, dailyRemaining)}회, ` +
    `선물 검수권 ${Math.max(0, bonusRemaining)}회`
  );
}

/**
 * 표기 통일 검수 직전 confirm — 가능 횟수 한 줄
 * @param {number} remaining
 * @param {number} dailyRemaining
 * @param {number} bonusRemaining
 */
export function formatConsistencyCheckQuotaAvailabilityLine(
  remaining,
  dailyRemaining,
  bonusRemaining,
) {
  return (
    `표기 통일 검수는 ${remaining}회(` +
    `${formatQuotaTicketAvailabilityParen(dailyRemaining, bonusRemaining)}) ` +
    `가능합니다`
  );
}

/**
 * @param {number} tabCount
 * @param {number} dailyLimit
 * @param {number} bonusRemaining
 */
export function getTabRemainingBreakdown(tabCount, dailyLimit, bonusRemaining) {
  const dailyUsed = Math.min(Math.max(0, tabCount), Math.max(0, dailyLimit));
  return {
    dailyRemaining: Math.max(0, dailyLimit - dailyUsed),
    bonusRemaining: Math.max(0, bonusRemaining),
  };
}

/**
 * 검수 완료 팝업 — 차감 직후 남은 검수권
 * @param {number} dailyRemaining
 * @param {number} bonusRemaining
 */
export function formatCheckQuotaConsumedLine(dailyRemaining, bonusRemaining) {
  return (
    `검수권 1회를 사용했습니다(` +
    `1일 검수권 ${Math.max(0, dailyRemaining)}회, ` +
    `선물 검수권 ${Math.max(0, bonusRemaining)}회 남음)`
  );
}

/**
 * @param {ReturnType<typeof statusFromFlags>} status
 * @param {BetaQuotaTab} [tab]
 */
export function getTabQuotaRemainingFromStatus(status, tab = 'spelling') {
  const normalized = normalizeBetaQuotaTab(tab);
  const tabCount =
    normalized === 'spelling'
      ? Math.max(0, Number(status.spellingCount) || 0)
      : Math.max(0, Number(status.consistencyCount) || 0);
  const dailyLimit = Math.max(0, Number(status.dailyLimit) || 1);
  const bonusRemaining =
    normalized === 'spelling'
      ? Math.max(0, Number(status.signupBonusSpellingRemaining) || 0)
      : Math.max(0, Number(status.signupBonusConsistencyRemaining) || 0);
  return getTabRemainingBreakdown(tabCount, dailyLimit, bonusRemaining);
}

/**
 * 검수 완료 팝업 상단 한 줄 (차감 후 최신 잔여)
 * @param {string} uid
 * @param {string} [email]
 * @param {BetaQuotaTab} [tab]
 * @returns {Promise<string | null>}
 */
export async function buildCheckResultQuotaConsumedLine(
  uid,
  email = '',
  tab = 'spelling',
) {
  if (!isBetaDailyQuotaEnabled() || !uid.trim()) {
    return null;
  }
  if (
    !isBetaDailyQuotaEnforcedForUser(uid, email) &&
    !isLocalDevQuotaRelaxed()
  ) {
    return null;
  }
  const status = await getBetaDailyQuotaStatus(uid, email);
  const { dailyRemaining, bonusRemaining } = getTabQuotaRemainingFromStatus(
    status,
    tab,
  );
  return formatCheckQuotaConsumedLine(dailyRemaining, bonusRemaining);
}

/**
 * 검수 차감 직후 안내
 * @param {BetaQuotaTab} tab
 * @param {number} tabCount 차감 후 해당 탭 사용 횟수
 * @param {number} tabLimit 유효 한도(사용+잔여)
 * @param {{ dailyRemaining?: number, bonusRemaining?: number }} [detail]
 */
export function formatBetaQuotaConsumedAlert(tab, tabCount, tabLimit, detail = {}) {
  const label = betaQuotaTabLabel(tab);
  const remaining = Math.max(0, tabLimit - tabCount);
  const dailyRemaining = detail.dailyRemaining;
  const bonusRemaining = detail.bonusRemaining;
  const detailLine =
    typeof dailyRemaining === 'number' && typeof bonusRemaining === 'number'
      ? `\n(오늘 일일 ${dailyRemaining}회 · 가입 보너스 ${bonusRemaining}회)`
      : '';
  return (
    `오늘 ${label} 횟수가 1회 차감되었습니다.\n\n` +
    `사용: ${tabCount}회\n` +
    `남음: ${remaining}회` +
    detailLine
  );
}

/**
 * @param {BetaQuotaTab} tab
 * @param {string} dayId
 * @param {number} tabLimit
 * @param {number} nextSpelling
 * @param {number} nextConsistency
 * @param {{ dailyRemaining?: number, bonusRemaining?: number }} [detail]
 */
function buildConsumeSuccessResult(
  tab,
  dayId,
  tabLimit,
  nextSpelling,
  nextConsistency,
  detail = {},
) {
  const normalized = normalizeBetaQuotaTab(tab);
  const tabCount =
    normalized === 'spelling' ? nextSpelling : nextConsistency;
  return {
    ok: true,
    dayId,
    tab: normalized,
    tabCount,
    tabLimit,
    tabRemaining: Math.max(0, tabLimit - tabCount),
    dailyRemaining: detail.dailyRemaining,
    bonusRemaining: detail.bonusRemaining,
  };
}

/** @returns {{ spellingCount: number, consistencyCount: number }} */
function emptyTabCounts() {
  return { spellingCount: 0, consistencyCount: 0 };
}

/**
 * @param {Record<string, unknown> | undefined} data
 */
function readDayTabCounts(data) {
  return {
    spellingCount: Math.max(0, Number(data?.spellingCount) || 0),
    consistencyCount: Math.max(0, Number(data?.consistencyCount) || 0),
  };
}

/**
 * @param {string} uid
 */
function localQuotaKey(uid) {
  return `${LOCAL_QUOTA_PREFIX}${uid.trim()}`;
}

/**
 * @param {Record<string, unknown> | undefined} data
 */
function readSignupBonusState(data) {
  const granted = data?.signupBonusGranted === true;
  const spelling =
    data?.signupBonusSpellingRemaining != null
      ? Math.max(0, Number(data.signupBonusSpellingRemaining) || 0)
      : granted
        ? 0
        : SIGNUP_BONUS_TAB_CHECKS;
  const consistency =
    data?.signupBonusConsistencyRemaining != null
      ? Math.max(0, Number(data.signupBonusConsistencyRemaining) || 0)
      : granted
        ? 0
        : SIGNUP_BONUS_TAB_CHECKS;
  const policyVersion = Math.max(
    0,
    Number(data?.signupBonusPolicyVersion) || 0,
  );
  return {
    signupBonusGranted: granted,
    signupBonusSpellingRemaining: spelling,
    signupBonusConsistencyRemaining: consistency,
    signupBonusPolicyVersion: policyVersion,
  };
}

/**
 * 가입 보너스 지급·정책 재정렬 필드 (Firestore·local 공통).
 * @returns {{
 *   signupBonusGranted: true,
 *   signupBonusSpellingRemaining: number,
 *   signupBonusConsistencyRemaining: number,
 *   signupBonusPolicyVersion: number,
 * }}
 */
export function buildSignupBonusGrantFields() {
  return {
    signupBonusGranted: true,
    signupBonusSpellingRemaining: SIGNUP_BONUS_TAB_CHECKS,
    signupBonusConsistencyRemaining: SIGNUP_BONUS_TAB_CHECKS,
    signupBonusPolicyVersion: SIGNUP_BONUS_POLICY_VERSION,
  };
}

/**
 * @param {{ signupBonusPolicyVersion?: number } | null | undefined} bonus
 */
export function needsSignupBonusPolicyAlign(bonus) {
  const version = Math.max(0, Number(bonus?.signupBonusPolicyVersion) || 0);
  return version !== SIGNUP_BONUS_POLICY_VERSION;
}

/**
 * 로그인·가입 직후 검수권 안내 팝업 문구.
 * @returns {{ title: string, message: string, messageNode: import('react').ReactNode }}
 */
export function buildSignupBonusGrantAlert() {
  const bonusLabel = `맞춤법·표기 통일 ${SIGNUP_BONUS_TAB_CHECKS}회 검수권`;
  return {
    title: '검수권 선물이 도착했어요!  ฅ•ω•ฅ',
    titleAlign: 'center',
    message:
      `회원님께 감사의 의미로 ${bonusLabel}🎫을 드립니다\n` +
      `일일 검수권은 1회 제공되며, 당일 미사용분은 소멸됩니다(한국 시간 기준)\n` +
      `피드백을 남기면 일일 검수권이 2배로 늘어납니다!\n\n` +
      `인디야와 함께 건강한 여름 되세요🍉`,
    messageNode: createElement(
      Fragment,
      null,
      createElement(
        'p',
        { className: 'app-dialog__confirm-line' },
        '회원님께 감사의 의미로 ',
        createElement('strong', null, bonusLabel),
        '🎫을 드립니다',
      ),
      createElement(
        'p',
        { className: 'app-dialog__confirm-line' },
        '일일 검수권은 1회 제공되며, 당일 미사용분은 소멸됩니다(한국 시간 기준)',
      ),
      createElement(
        'p',
        { className: 'app-dialog__confirm-line' },
        '피드백을 남기면 일일 검수권이 2배로 늘어납니다!',
      ),
      createElement(
        'p',
        { className: 'app-dialog__confirm-line app-dialog__confirm-line--spaced' },
        '인디야와 함께 건강한 여름 되세요🍉',
      ),
    ),
  };
}

/** 로그인 직후 검수권 안내 팝업 */
export async function notifySignupBonusGranted() {
  await showAppAlert(buildSignupBonusGrantAlert());
}

/**
 * @param {string} uid
 * @param {string} dayId
 * @param {string | null} feedbackBonusDayId
 * @param {{ spellingCount: number, consistencyCount: number }} counts
 * @param {{
 *   signupBonusGranted: boolean,
 *   signupBonusSpellingRemaining: number,
 *   signupBonusConsistencyRemaining: number,
 *   signupBonusPolicyVersion?: number,
 * }} bonus
 */
function buildTabQuotaView(uid, dayId, feedbackBonusDayId, counts, bonus) {
  const dailyLimit = getTabCheckLimit(feedbackBonusDayId, null, dayId, 'spelling');
  const spellingAvailable = getTabAvailableChecks(
    dailyLimit,
    counts.spellingCount,
    bonus.signupBonusSpellingRemaining,
  );
  const consistencyAvailable = getTabAvailableChecks(
    dailyLimit,
    counts.consistencyCount,
    bonus.signupBonusConsistencyRemaining,
  );
  const spellingTabLimit = counts.spellingCount + spellingAvailable;
  const consistencyTabLimit = counts.consistencyCount + consistencyAvailable;
  const enforced = Boolean(uid.trim());
  return {
    dayId,
    enforced,
    feedbackBonusDayId,
    boostApprovedDayId: null,
    dailyLimit,
    signupBonusGranted: bonus.signupBonusGranted,
    signupBonusSpellingRemaining: bonus.signupBonusSpellingRemaining,
    signupBonusConsistencyRemaining: bonus.signupBonusConsistencyRemaining,
    signupBonusPolicyVersion: Math.max(
      0,
      Number(bonus.signupBonusPolicyVersion) || 0,
    ),
    spellingAvailable,
    consistencyAvailable,
    /** @deprecated 맞춤법 한도와 동일 — 하위 호환 */
    tabLimit: spellingTabLimit,
    spellingTabLimit,
    consistencyTabLimit,
    /** 통일형은 표기 통일 탭과 동일 */
    unifyTabLimit: consistencyTabLimit,
    spellingCount: counts.spellingCount,
    consistencyCount: counts.consistencyCount,
    unifyCount: counts.consistencyCount,
    spellingConsumed: spellingAvailable <= 0,
    consistencyConsumed: consistencyAvailable <= 0,
    unifyConsumed: consistencyAvailable <= 0,
  };
}

/**
 * @param {string} uid
 * @param {string} dayId
 */
function readLocalQuota(uid, dayId) {
  if (!uid.trim()) {
    return buildTabQuotaView(uid, dayId, null, emptyTabCounts(), {
      signupBonusGranted: false,
      signupBonusSpellingRemaining: SIGNUP_BONUS_TAB_CHECKS,
      signupBonusConsistencyRemaining: SIGNUP_BONUS_TAB_CHECKS,
    });
  }
  try {
    const raw = localStorage.getItem(localQuotaKey(uid));
    if (!raw) {
      return buildTabQuotaView(uid, dayId, null, emptyTabCounts(), {
        signupBonusGranted: false,
        signupBonusSpellingRemaining: SIGNUP_BONUS_TAB_CHECKS,
        signupBonusConsistencyRemaining: SIGNUP_BONUS_TAB_CHECKS,
      });
    }
    const parsed = JSON.parse(raw);
    const feedbackBonusDayId =
      typeof parsed?.feedbackBonusDayId === 'string'
        ? parsed.feedbackBonusDayId
        : null;
    const storedDayId =
      typeof parsed?.dayId === 'string' ? parsed.dayId : null;
    const counts =
      storedDayId === dayId
        ? {
            spellingCount: Math.max(0, Number(parsed?.spellingCount) || 0),
            consistencyCount: Math.max(
              0,
              Number(parsed?.consistencyCount) || 0,
            ),
          }
        : emptyTabCounts();
    const bonus = readSignupBonusState(parsed);
    return buildTabQuotaView(uid, dayId, feedbackBonusDayId, counts, bonus);
  } catch {
    return buildTabQuotaView(uid, dayId, null, emptyTabCounts(), {
      signupBonusGranted: false,
      signupBonusSpellingRemaining: SIGNUP_BONUS_TAB_CHECKS,
      signupBonusConsistencyRemaining: SIGNUP_BONUS_TAB_CHECKS,
    });
  }
}

/**
 * @param {string} uid
 * @param {{
 *   dayId: string,
 *   spellingCount: number,
 *   consistencyCount: number,
 *   feedbackBonusDayId?: string | null,
 *   signupBonusGranted?: boolean,
 *   signupBonusSpellingRemaining?: number,
 *   signupBonusConsistencyRemaining?: number,
 *   signupBonusPolicyVersion?: number,
 * }} state
 */
function writeLocalQuota(uid, state) {
  try {
    const prev = readLocalQuota(uid, state.dayId);
    localStorage.setItem(
      localQuotaKey(uid),
      JSON.stringify({
        dayId: state.dayId,
        spellingCount: state.spellingCount,
        consistencyCount: state.consistencyCount,
        feedbackBonusDayId:
          state.feedbackBonusDayId !== undefined
            ? state.feedbackBonusDayId
            : prev.feedbackBonusDayId,
        signupBonusGranted:
          state.signupBonusGranted !== undefined
            ? state.signupBonusGranted
            : prev.signupBonusGranted,
        signupBonusSpellingRemaining:
          state.signupBonusSpellingRemaining !== undefined
            ? state.signupBonusSpellingRemaining
            : prev.signupBonusSpellingRemaining,
        signupBonusConsistencyRemaining:
          state.signupBonusConsistencyRemaining !== undefined
            ? state.signupBonusConsistencyRemaining
            : prev.signupBonusConsistencyRemaining,
        signupBonusPolicyVersion:
          state.signupBonusPolicyVersion !== undefined
            ? state.signupBonusPolicyVersion
            : prev.signupBonusPolicyVersion,
        updatedAt: Date.now(),
      }),
    );
  } catch {
    /* private mode */
  }
}

/**
 * @param {string} uid
 */
function userDocRef(uid) {
  return doc(getFirestore(firebaseApp), 'betaDailyUsage', uid.trim());
}

/**
 * @param {string} uid
 * @param {string} dayId
 */
function dayDocRef(uid, dayId) {
  return doc(getFirestore(firebaseApp), 'betaDailyUsage', uid.trim(), 'days', dayId);
}

/**
 * @param {Record<string, unknown> | undefined} userData
 */
function readUserBonusDayIds(userData) {
  const feedbackBonusDayId =
    typeof userData?.feedbackBonusDayId === 'string'
      ? userData.feedbackBonusDayId
      : null;
  return { feedbackBonusDayId, boostApprovedDayId: null };
}

/**
 * Firestore·localStorage 탭 사용 횟수 — 큰 값을 신뢰
 * @param {{ spellingCount: number, consistencyCount: number }} firestoreCounts
 * @param {{ spellingCount: number, consistencyCount: number }} localCounts
 */
export function mergeTabQuotaCounts(firestoreCounts, localCounts) {
  return {
    spellingCount: Math.max(
      firestoreCounts.spellingCount,
      localCounts.spellingCount,
    ),
    consistencyCount: Math.max(
      firestoreCounts.consistencyCount,
      localCounts.consistencyCount,
    ),
  };
}

/**
 * @param {{ feedbackBonusDayId: string | null }} firestoreBonus
 * @param {{ feedbackBonusDayId: string | null }} localBonus
 */
export function mergeUserBonusDayIds(firestoreBonus, localBonus) {
  return {
    feedbackBonusDayId:
      firestoreBonus.feedbackBonusDayId ?? localBonus.feedbackBonusDayId,
    boostApprovedDayId: null,
  };
}

/**
 * 가입 보너스 — Firestore 우선, 없으면 로컬.
 * @param {ReturnType<typeof readSignupBonusState>} firestoreBonus
 * @param {ReturnType<typeof readSignupBonusState>} localBonus
 */
export function mergeSignupBonusState(firestoreBonus, localBonus) {
  if (firestoreBonus.signupBonusGranted) {
    return {
      signupBonusGranted: true,
      signupBonusSpellingRemaining: firestoreBonus.signupBonusSpellingRemaining,
      signupBonusConsistencyRemaining:
        firestoreBonus.signupBonusConsistencyRemaining,
      signupBonusPolicyVersion:
        firestoreBonus.signupBonusPolicyVersion ?? 0,
    };
  }
  if (localBonus.signupBonusGranted) {
    return {
      signupBonusGranted: true,
      signupBonusSpellingRemaining: localBonus.signupBonusSpellingRemaining,
      signupBonusConsistencyRemaining:
        localBonus.signupBonusConsistencyRemaining,
      signupBonusPolicyVersion: localBonus.signupBonusPolicyVersion ?? 0,
    };
  }
  return {
    signupBonusGranted: false,
    signupBonusSpellingRemaining: SIGNUP_BONUS_TAB_CHECKS,
    signupBonusConsistencyRemaining: SIGNUP_BONUS_TAB_CHECKS,
    signupBonusPolicyVersion: 0,
  };
}

/**
 * 계정당 가입 보너스 지급·정책 정렬(멱등).
 * 미지급이면 각 SIGNUP_BONUS_TAB_CHECKS회 지급하고,
 * 이미 지급됐어도 정책 버전이 다르면 잔여를 다시 각 N회로 맞춘다.
 * @param {string} uid
 * @param {string} [email]
 */
export async function ensureSignupBonusGranted(uid, email = '') {
  const dayId = getKstDayId();
  if (!uid.trim()) {
    return { ok: false, granted: false, alreadyGranted: false, realigned: false };
  }

  const grantFields = buildSignupBonusGrantFields();

  const applyLocal = () => {
    const local = readLocalQuota(uid, dayId);
    if (
      local.signupBonusGranted &&
      !needsSignupBonusPolicyAlign(local)
    ) {
      return {
        ok: true,
        granted: false,
        alreadyGranted: true,
        realigned: false,
      };
    }
    const wasGranted = local.signupBonusGranted;
    writeLocalQuota(uid, {
      dayId,
      spellingCount: local.spellingCount,
      consistencyCount: local.consistencyCount,
      feedbackBonusDayId: local.feedbackBonusDayId,
      ...grantFields,
    });
    return {
      ok: true,
      granted: !wasGranted,
      alreadyGranted: wasGranted,
      realigned: wasGranted,
    };
  };

  if (!isBetaDailyQuotaEnforcedForUser(uid, email)) {
    if (isLocalDevQuotaRelaxed()) return applyLocal();
    return {
      ok: true,
      granted: false,
      alreadyGranted: false,
      realigned: false,
    };
  }

  try {
    let alreadyGranted = false;
    let grantedNow = false;
    let realigned = false;
    let wrote = false;
    await runTransaction(getFirestore(firebaseApp), async (tx) => {
      const userRef = userDocRef(uid);
      const snap = await tx.get(userRef);
      const data = snap.exists() ? snap.data() : undefined;
      const bonus = readSignupBonusState(data);
      if (
        bonus.signupBonusGranted &&
        !needsSignupBonusPolicyAlign(bonus)
      ) {
        alreadyGranted = true;
        return;
      }
      alreadyGranted = bonus.signupBonusGranted;
      grantedNow = !bonus.signupBonusGranted;
      realigned = bonus.signupBonusGranted;
      wrote = true;
      tx.set(userRef, grantFields, { merge: true });
    });
    const local = readLocalQuota(uid, dayId);
    if (wrote) {
      writeLocalQuota(uid, {
        dayId,
        spellingCount: local.spellingCount,
        consistencyCount: local.consistencyCount,
        feedbackBonusDayId: local.feedbackBonusDayId,
        ...grantFields,
      });
    } else {
      try {
        const snap = await getDoc(userDocRef(uid));
        const remote = readSignupBonusState(
          snap.exists() ? snap.data() : undefined,
        );
        if (remote.signupBonusGranted) {
          writeLocalQuota(uid, {
            dayId,
            spellingCount: local.spellingCount,
            consistencyCount: local.consistencyCount,
            feedbackBonusDayId: local.feedbackBonusDayId,
            signupBonusGranted: true,
            signupBonusSpellingRemaining: remote.signupBonusSpellingRemaining,
            signupBonusConsistencyRemaining:
              remote.signupBonusConsistencyRemaining,
            signupBonusPolicyVersion: remote.signupBonusPolicyVersion,
          });
        }
      } catch {
        /* keep local */
      }
    }
    return {
      ok: true,
      granted: grantedNow,
      alreadyGranted,
      realigned,
    };
  } catch {
    return applyLocal();
  }
}

/**
 * @param {string} uid
 * @param {string} dayId
 */
async function readQuotaFlags(uid, dayId) {
  const local = readLocalQuota(uid, dayId);
  try {
    const [userSnap, daySnap] = await Promise.all([
      getDoc(userDocRef(uid)),
      getDoc(dayDocRef(uid, dayId)),
    ]);
    const userData = userSnap.exists() ? userSnap.data() : undefined;
    const { feedbackBonusDayId } = mergeUserBonusDayIds(
      readUserBonusDayIds(userData),
      { feedbackBonusDayId: local.feedbackBonusDayId },
    );
    const firestoreBonus = readSignupBonusState(userData);
    const localBonus = {
      signupBonusGranted: local.signupBonusGranted,
      signupBonusSpellingRemaining: local.signupBonusSpellingRemaining,
      signupBonusConsistencyRemaining: local.signupBonusConsistencyRemaining,
      signupBonusPolicyVersion: local.signupBonusPolicyVersion,
    };
    let bonus = mergeSignupBonusState(firestoreBonus, localBonus);
    if (!bonus.signupBonusGranted || needsSignupBonusPolicyAlign(bonus)) {
      await ensureSignupBonusGranted(uid);
      const refreshed = readLocalQuota(uid, dayId);
      bonus = {
        signupBonusGranted: refreshed.signupBonusGranted,
        signupBonusSpellingRemaining: refreshed.signupBonusSpellingRemaining,
        signupBonusConsistencyRemaining:
          refreshed.signupBonusConsistencyRemaining,
        signupBonusPolicyVersion: refreshed.signupBonusPolicyVersion,
      };
    }
    const firestoreCounts = daySnap.exists()
      ? readDayTabCounts(daySnap.data())
      : emptyTabCounts();
    const counts = mergeTabQuotaCounts(firestoreCounts, {
      spellingCount: local.spellingCount,
      consistencyCount: local.consistencyCount,
    });
    const view = buildTabQuotaView(
      uid,
      dayId,
      feedbackBonusDayId,
      counts,
      bonus,
    );
    writeLocalQuota(uid, {
      dayId,
      spellingCount: counts.spellingCount,
      consistencyCount: counts.consistencyCount,
      feedbackBonusDayId,
      signupBonusGranted: bonus.signupBonusGranted,
      signupBonusSpellingRemaining: bonus.signupBonusSpellingRemaining,
      signupBonusConsistencyRemaining: bonus.signupBonusConsistencyRemaining,
      signupBonusPolicyVersion: bonus.signupBonusPolicyVersion,
    });
    return view;
  } catch {
    return local;
  }
}

/**
 * @param {string} uid
 * @param {string} [email]
 */
export async function getBetaDailyQuotaStatus(uid, email = '') {
  const dayId = getKstDayId();
  if (!isBetaDailyQuotaEnforcedForUser(uid, email)) {
    if (isLocalDevQuotaRelaxed() && uid.trim()) {
      await ensureSignupBonusGranted(uid, email);
      const flags = readLocalQuota(uid, dayId);
      return statusFromFlags(flags, false);
    }
    return statusFromFlags(
      buildTabQuotaView(uid, dayId, null, emptyTabCounts(), {
        signupBonusGranted: false,
        signupBonusSpellingRemaining: SIGNUP_BONUS_TAB_CHECKS,
        signupBonusConsistencyRemaining: SIGNUP_BONUS_TAB_CHECKS,
      }),
      false,
    );
  }

  const flags = await readQuotaFlags(uid, dayId);
  return statusFromFlags(flags, true);
}

/**
 * @param {ReturnType<typeof buildTabQuotaView>} flags
 * @param {boolean} enforced
 */
function statusFromFlags(flags, enforced) {
  return {
    dayId: flags.dayId,
    enforced,
    dailyLimit: flags.dailyLimit,
    tabLimit: flags.tabLimit,
    spellingTabLimit: flags.spellingTabLimit,
    consistencyTabLimit: flags.consistencyTabLimit,
    unifyTabLimit: flags.unifyTabLimit,
    spellingCount: flags.spellingCount,
    consistencyCount: flags.consistencyCount,
    unifyCount: flags.unifyCount,
    spellingConsumed: flags.spellingConsumed,
    consistencyConsumed: flags.consistencyConsumed,
    unifyConsumed: flags.unifyConsumed,
    spellingAvailable: flags.spellingAvailable,
    consistencyAvailable: flags.consistencyAvailable,
    signupBonusSpellingRemaining: flags.signupBonusSpellingRemaining,
    signupBonusConsistencyRemaining: flags.signupBonusConsistencyRemaining,
    signupBonusGranted: flags.signupBonusGranted,
    hasFeedbackBonusToday: flags.feedbackBonusDayId === flags.dayId,
    hasBoostApprovedToday: false,
  };
}

/**
 * Google Form 피드백 — 당일 일일 지급 2회
 * @param {string} uid
 * @param {string} [email]
 */
export async function grantFeedbackDailyQuotaBonus(uid, email = '') {
  const dayId = getKstDayId();
  if (!uid.trim()) {
    return { ok: false, dayId, granted: false, alreadyHadBonus: false };
  }
  if (!isBetaDailyQuotaEnforcedForUser(uid, email)) {
    if (!isLocalDevQuotaRelaxed()) {
      return { ok: true, dayId, granted: false, alreadyHadBonus: false };
    }
    const local = readLocalQuota(uid, dayId);
    const alreadyHadBonus = local.feedbackBonusDayId === dayId;
    if (alreadyHadBonus) {
      return { ok: true, dayId, granted: true, alreadyHadBonus: true };
    }
    writeLocalQuota(uid, {
      dayId,
      spellingCount: local.spellingCount,
      consistencyCount: local.consistencyCount,
      feedbackBonusDayId: dayId,
      signupBonusGranted: local.signupBonusGranted,
      signupBonusSpellingRemaining: local.signupBonusSpellingRemaining,
      signupBonusConsistencyRemaining: local.signupBonusConsistencyRemaining,
    });
    return { ok: true, dayId, granted: true, alreadyHadBonus: false };
  }

  const flags = await readQuotaFlags(uid, dayId);
  const alreadyHadBonus = flags.feedbackBonusDayId === dayId;
  if (alreadyHadBonus) {
    return { ok: true, dayId, granted: true, alreadyHadBonus: true };
  }

  try {
    await setDoc(
      userDocRef(uid),
      { feedbackBonusDayId: dayId },
      { merge: true },
    );
    writeLocalQuota(uid, {
      dayId,
      spellingCount: flags.spellingCount,
      consistencyCount: flags.consistencyCount,
      feedbackBonusDayId: dayId,
      signupBonusGranted: flags.signupBonusGranted,
      signupBonusSpellingRemaining: flags.signupBonusSpellingRemaining,
      signupBonusConsistencyRemaining: flags.signupBonusConsistencyRemaining,
    });
    return { ok: true, dayId, granted: true, alreadyHadBonus: false };
  } catch {
    writeLocalQuota(uid, {
      dayId,
      spellingCount: flags.spellingCount,
      consistencyCount: flags.consistencyCount,
      feedbackBonusDayId: dayId,
      signupBonusGranted: flags.signupBonusGranted,
      signupBonusSpellingRemaining: flags.signupBonusSpellingRemaining,
      signupBonusConsistencyRemaining: flags.signupBonusConsistencyRemaining,
    });
    return { ok: true, dayId, granted: true, alreadyHadBonus: false };
  }
}

/**
 * @param {ReturnType<typeof buildTabQuotaView>} flags
 * @param {'spelling' | 'consistency'} tab
 */
function planConsume(flags, tab) {
  const dailyLimit = flags.dailyLimit;
  const count =
    tab === 'spelling' ? flags.spellingCount : flags.consistencyCount;
  const bonusRemaining =
    tab === 'spelling'
      ? flags.signupBonusSpellingRemaining
      : flags.signupBonusConsistencyRemaining;
  const available = getTabAvailableChecks(dailyLimit, count, bonusRemaining);
  if (available <= 0) {
    return { ok: false };
  }
  const useDaily = count < dailyLimit;
  const nextCount = count + 1;
  const nextBonus = useDaily ? bonusRemaining : bonusRemaining - 1;
  const nextSpelling =
    tab === 'spelling' ? nextCount : flags.spellingCount;
  const nextConsistency =
    tab === 'consistency' ? nextCount : flags.consistencyCount;
  const nextSpellingBonus =
    tab === 'spelling' ? nextBonus : flags.signupBonusSpellingRemaining;
  const nextConsistencyBonus =
    tab === 'consistency'
      ? nextBonus
      : flags.signupBonusConsistencyRemaining;
  const nextAvailable = getTabAvailableChecks(
    dailyLimit,
    nextCount,
    nextBonus,
  );
  return {
    ok: true,
    useDaily,
    nextSpelling,
    nextConsistency,
    nextSpellingBonus,
    nextConsistencyBonus,
    tabLimit: nextCount + nextAvailable,
    dailyRemaining: Math.max(0, dailyLimit - Math.min(nextCount, dailyLimit)),
    bonusRemaining: nextBonus,
  };
}

/**
 * localhost dev — 한도 차단 없이 localStorage만 갱신·안내 문구용 횟수 반환
 * @param {string} uid
 * @param {BetaQuotaTab} tab
 * @param {string} dayId
 */
export function consumeLocalDevQuotaPreview(uid, tab, dayId = getKstDayId()) {
  const normalized = normalizeBetaQuotaTab(tab);
  const local = readLocalQuota(uid, dayId);
  const planned = planConsume(local, normalized);
  if (!planned.ok) {
    return { ok: false, dayId, alreadyUsed: true, tab: normalized };
  }
  writeLocalQuota(uid, {
    dayId,
    spellingCount: planned.nextSpelling,
    consistencyCount: planned.nextConsistency,
    feedbackBonusDayId: local.feedbackBonusDayId,
    signupBonusGranted: true,
    signupBonusSpellingRemaining: planned.nextSpellingBonus,
    signupBonusConsistencyRemaining: planned.nextConsistencyBonus,
  });
  return buildConsumeSuccessResult(
    normalized,
    dayId,
    planned.tabLimit,
    planned.nextSpelling,
    planned.nextConsistency,
    {
      dailyRemaining: planned.dailyRemaining,
      bonusRemaining: planned.bonusRemaining,
    },
  );
}

/**
 * @param {string} uid
 * @param {string} [email]
 * @param {BetaQuotaTab} tab
 */
export async function consumeBetaDailyQuota(uid, email = '', tab = 'spelling') {
  const dayId = getKstDayId();
  const normalized = normalizeBetaQuotaTab(tab);
  if (!isBetaDailyQuotaEnforcedForUser(uid, email)) {
    if (isLocalDevQuotaRelaxed() && uid.trim()) {
      await ensureSignupBonusGranted(uid, email);
      return consumeLocalDevQuotaPreview(uid, normalized, dayId);
    }
    return { ok: true, dayId, tab: normalized };
  }

  const flags = await readQuotaFlags(uid, dayId);
  const isFirstEverCheck =
    flags.spellingCount === 0 && flags.consistencyCount === 0;
  const planned = planConsume(flags, normalized);
  if (!planned.ok) {
    return { ok: false, dayId, alreadyUsed: true, tab: normalized };
  }

  const countField =
    normalized === 'spelling' ? 'spellingCount' : 'consistencyCount';
  const bonusField =
    normalized === 'spelling'
      ? 'signupBonusSpellingRemaining'
      : 'signupBonusConsistencyRemaining';

  try {
    await runTransaction(getFirestore(firebaseApp), async (tx) => {
      const userRef = userDocRef(uid);
      const userSnap = await tx.get(userRef);
      const userData = userSnap.exists() ? userSnap.data() : undefined;
      const { feedbackBonusDayId } = readUserBonusDayIds(userData);
      let bonus = readSignupBonusState(userData);
      if (!bonus.signupBonusGranted || needsSignupBonusPolicyAlign(bonus)) {
        const grantFields = buildSignupBonusGrantFields();
        bonus = grantFields;
        tx.set(userRef, grantFields, { merge: true });
      }
      const dailyLimit = getTabCheckLimit(
        feedbackBonusDayId,
        null,
        dayId,
        normalized,
      );

      const dayRef = dayDocRef(uid, dayId);
      const daySnap = await tx.get(dayRef);
      const counts = daySnap.exists()
        ? readDayTabCounts(daySnap.data())
        : emptyTabCounts();
      const currentCount =
        normalized === 'spelling'
          ? counts.spellingCount
          : counts.consistencyCount;
      const currentBonus =
        normalized === 'spelling'
          ? bonus.signupBonusSpellingRemaining
          : bonus.signupBonusConsistencyRemaining;
      if (getTabAvailableChecks(dailyLimit, currentCount, currentBonus) <= 0) {
        throw new Error('beta-quota-exceeded');
      }
      const useDaily = currentCount < dailyLimit;
      const nextCount = currentCount + 1;
      const nextBonus = useDaily ? currentBonus : currentBonus - 1;
      const nextData = {
        ...counts,
        [countField]: nextCount,
        usedAt: serverTimestamp(),
      };
      if (!daySnap.exists()) {
        tx.set(dayRef, nextData);
      } else {
        tx.update(dayRef, nextData);
      }
      if (!useDaily) {
        tx.set(
          userRef,
          {
            signupBonusGranted: true,
            [bonusField]: nextBonus,
          },
          { merge: true },
        );
      }
    });

    writeLocalQuota(uid, {
      dayId,
      spellingCount: planned.nextSpelling,
      consistencyCount: planned.nextConsistency,
      feedbackBonusDayId: flags.feedbackBonusDayId,
      signupBonusGranted: true,
      signupBonusSpellingRemaining: planned.nextSpellingBonus,
      signupBonusConsistencyRemaining: planned.nextConsistencyBonus,
      signupBonusPolicyVersion:
        flags.signupBonusPolicyVersion || SIGNUP_BONUS_POLICY_VERSION,
    });
    if (isFirstEverCheck) syncFirstCheckBadge(uid);
    return buildConsumeSuccessResult(
      normalized,
      dayId,
      planned.tabLimit,
      planned.nextSpelling,
      planned.nextConsistency,
      {
        dailyRemaining: planned.dailyRemaining,
        bonusRemaining: planned.bonusRemaining,
      },
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'beta-quota-exceeded'
    ) {
      writeLocalQuota(uid, {
        dayId,
        spellingCount: flags.spellingCount,
        consistencyCount: flags.consistencyCount,
        feedbackBonusDayId: flags.feedbackBonusDayId,
        signupBonusGranted: flags.signupBonusGranted,
        signupBonusSpellingRemaining: flags.signupBonusSpellingRemaining,
        signupBonusConsistencyRemaining:
          flags.signupBonusConsistencyRemaining,
      });
      return { ok: false, dayId, alreadyUsed: true, tab: normalized };
    }

    const local = readLocalQuota(uid, dayId);
    const localPlan = planConsume(local, normalized);
    if (!localPlan.ok) {
      return { ok: false, dayId, alreadyUsed: true, tab: normalized };
    }
    writeLocalQuota(uid, {
      dayId,
      spellingCount: localPlan.nextSpelling,
      consistencyCount: localPlan.nextConsistency,
      feedbackBonusDayId: local.feedbackBonusDayId,
      signupBonusGranted: local.signupBonusGranted || true,
      signupBonusSpellingRemaining: localPlan.nextSpellingBonus,
      signupBonusConsistencyRemaining: localPlan.nextConsistencyBonus,
    });
    if (isFirstEverCheck) syncFirstCheckBadge(uid);
    return buildConsumeSuccessResult(
      normalized,
      dayId,
      localPlan.tabLimit,
      localPlan.nextSpelling,
      localPlan.nextConsistency,
      {
        dailyRemaining: localPlan.dailyRemaining,
        bonusRemaining: localPlan.bonusRemaining,
      },
    );
  }
}

/**
 * @param {string} uid
 * @param {{
 *   onConsumed?: () => void,
 *   authEmail?: string,
 *   checkTab?: BetaQuotaTab,
 *   skipConsumedAlert?: boolean,
 * }} [options]
 */
export async function assertBetaDailyCheckOrAlert(uid, options = {}) {
  if (!assertLoggedInForCheckOrAlert(uid)) {
    return false;
  }
  const email = options.authEmail ?? '';
  const tab = normalizeBetaQuotaTab(options.checkTab ?? 'spelling');
  const userPlan = await ensureLocalPlanFromCloud(uid);
  if (!isBetaDailyQuotaEnforcedForUser(uid, email, userPlan)) {
    return true;
  }
  const result = await consumeBetaDailyQuota(uid, email, tab);
  if (!result.ok) {
    alert(betaQuotaAlertForTab(tab));
    return false;
  }
  if (
    !options.skipConsumedAlert &&
    typeof result.tabCount === 'number' &&
    typeof result.tabLimit === 'number'
  ) {
    alert(
      formatBetaQuotaConsumedAlert(tab, result.tabCount, result.tabLimit, {
        dailyRemaining: result.dailyRemaining,
        bonusRemaining: result.bonusRemaining,
      }),
    );
  }
  options.onConsumed?.();
  return true;
}

/** @typedef {'spelling' | 'consistency'} ExportTab */

/**
 * export 횟수 차감 — 탭별 독립, 하루 1회 고정
 * @param {string} uid
 * @param {string} email
 * @param {ExportTab} exportTab
 */
export async function consumeBetaDailyExport(uid, email = '', exportTab = 'spelling') {
  const dayId = getKstDayId();
  const countField =
    exportTab === 'consistency' ? 'consistencyExportCount' : 'spellingExportCount';
  const exportLimit = 1;

  if (!isBetaDailyQuotaEnforcedForUser(uid, email)) {
    if (isLocalDevQuotaRelaxed() && uid.trim()) {
      return { ok: true, dayId, exportCount: 1, exportLimit };
    }
    return { ok: true, dayId };
  }

  try {
    let exportCount = 0;
    await runTransaction(getFirestore(firebaseApp), async (tx) => {
      const dayRef = dayDocRef(uid, dayId);
      const daySnap = await tx.get(dayRef);
      const data = daySnap.exists() ? daySnap.data() : {};
      const current = Math.max(0, Number(data?.[countField]) || 0);
      if (current >= exportLimit) {
        throw new Error('beta-export-quota-exceeded');
      }
      exportCount = current + 1;
      const update = { [countField]: exportCount, usedAt: serverTimestamp() };
      if (!daySnap.exists()) {
        tx.set(dayRef, { ...data, ...update });
      } else {
        tx.update(dayRef, update);
      }
    });
    return { ok: true, dayId, exportCount, exportLimit };
  } catch (error) {
    if (error instanceof Error && error.message === 'beta-export-quota-exceeded') {
      return { ok: false, dayId, alreadyUsed: true };
    }
    return { ok: true, dayId };
  }
}

/**
 *보내기 전 시도 확인·차감·알림
 * @param {string} uid
 * @param {{ authEmail?: string, exportTab?: ExportTab, onConsumed?: () => void }} [options]
 * @returns {Promise<boolean>} 진행 가능하면 true
 */
export async function assertBetaDailyExportOrAlert(uid, options = {}) {
  const exportTab = options.exportTab ?? 'spelling';
  if (!(await confirmProofreadExportOrCancel(exportTab))) {
    return false;
  }
  if (!assertLoggedInForCheckOrAlert(uid)) {
    return false;
  }
  const email = options.authEmail ?? '';
  const userPlan = await ensureLocalPlanFromCloud(uid);
  if (!isBetaDailyQuotaEnforcedForUser(uid, email, userPlan)) {
    return true;
  }
  const result = await consumeBetaDailyExport(uid, email, exportTab);
  if (!result.ok) {
    await showAppAlert({ title: '안내', message: BETA_DAILY_QUOTA_ALERT_EXPORT });
    return false;
  }
  if (typeof result.exportCount === 'number' && typeof result.exportLimit === 'number') {
    await showAppAlert({
      title: '안내',
      message: formatBetaExportConsumedAlert(result.exportCount, result.exportLimit),
    });
  }
  options.onConsumed?.();
  return true;
}
