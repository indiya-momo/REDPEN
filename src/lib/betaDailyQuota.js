import {
  doc,
  getDoc,
  getFirestore,
  runTransaction,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { syncFirstCheckBadge } from './badgeGrants.js';
import { assertLoggedInForCheckOrAlert } from './checkAuthGate.js';
import {
  firebaseApp,
  isFirebaseAuthConfigured,
  resolveSessionEmail,
} from './firebaseAuth.js';

const LOCAL_QUOTA_PREFIX = 'indiya-beta-quota-v3--';
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** @typedef {'spelling' | 'consistency'} BetaQuotaTab */

/** @returns {boolean} */
export function isLocalDevQuotaRelaxed() {
  if (!import.meta.env.DEV) return false;
  if (import.meta.env.VITE_BETA_QUOTA_FORCE_LOCAL === 'true') return false;
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
}

/** 베타 기본 — 탭당 하루 1회 */
export const BETA_TAB_LIMIT_DEFAULT = 1;
/** 피드백 보너스 — 탭당 하루 2회 */
export const BETA_TAB_LIMIT_FEEDBACK = 2;
/** 우수 피드백 선정 — 탭당 하루 3회 */
export const BETA_TAB_LIMIT_BOOSTED = 3;

const BETA_QUOTA_POLICY_SUMMARY =
  '오픈베타 기간에는 회원에게 매일 맞춤법·일관성 각 1회 검수를 제공합니다(한국 시간 기준). ' +
  '피드백을 남기면 각 2회, 우수 피드백으로 선정되면 각 3회까지 이용할 수 있습니다. ';

export const BETA_DAILY_QUOTA_ALERT_SPELLING =
  '오늘 맞춤법 검수 한도를 모두 사용했습니다.\n\n' +
  BETA_QUOTA_POLICY_SUMMARY +
  '내일 0시 이후 다시 시도해 주세요.';

export const BETA_DAILY_QUOTA_ALERT_CONSISTENCY =
  '오늘 일관성 검수 한도를 모두 사용했습니다.\n\n' +
  BETA_QUOTA_POLICY_SUMMARY +
  '내일 0시 이후 다시 시도해 주세요.';

/** 피드백 제출 후 작업 탭 새로고침 — 선물 말풍선 (돌아오기만으로는 안 뜸) */
export const FEEDBACK_SUBMIT_THANK_MESSAGE =
  '곧바로 선물을 받을 수 있다냥!';

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
  if (id && getBetaQuotaAdminUidSet().has(id)) return true;
  if (mail && getBetaQuotaAdminEmailSet().has(mail)) return true;
  return false;
}

/**
 * @param {string} uid
 * @param {string} [email]
 */
export function isBetaDailyQuotaEnforcedForUser(uid, email = '') {
  if (isLocalDevQuotaRelaxed()) return false;
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
 * @param {string | null | undefined} feedbackBonusDayId
 * @param {string | null | undefined} boostApprovedDayId
 * @param {string} dayId
 */
export function getTabCheckLimit(feedbackBonusDayId, boostApprovedDayId, dayId) {
  if (boostApprovedDayId === dayId) {
    return BETA_TAB_LIMIT_BOOSTED;
  }
  if (feedbackBonusDayId === dayId) {
    return BETA_TAB_LIMIT_FEEDBACK;
  }
  return BETA_TAB_LIMIT_DEFAULT;
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
  return tab === 'spelling'
    ? BETA_DAILY_QUOTA_ALERT_SPELLING
    : BETA_DAILY_QUOTA_ALERT_CONSISTENCY;
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
 * @param {string} uid
 * @param {string} dayId
 * @param {string | null} feedbackBonusDayId
 * @param {string | null} boostApprovedDayId
 * @param {{ spellingCount: number, consistencyCount: number }} counts
 */
function buildTabQuotaView(
  uid,
  dayId,
  feedbackBonusDayId,
  boostApprovedDayId,
  counts,
) {
  const tabLimit = getTabCheckLimit(
    feedbackBonusDayId,
    boostApprovedDayId,
    dayId,
  );
  const enforced = Boolean(uid.trim());
  return {
    dayId,
    enforced,
    feedbackBonusDayId,
    boostApprovedDayId,
    tabLimit,
    spellingCount: counts.spellingCount,
    consistencyCount: counts.consistencyCount,
    spellingConsumed: counts.spellingCount >= tabLimit,
    consistencyConsumed: counts.consistencyCount >= tabLimit,
  };
}

/**
 * @param {string} uid
 * @param {string} dayId
 */
function readLocalQuota(uid, dayId) {
  if (!uid.trim()) {
    return buildTabQuotaView(uid, dayId, null, null, {
      spellingCount: 0,
      consistencyCount: 0,
    });
  }
  try {
    const raw = localStorage.getItem(localQuotaKey(uid));
    if (!raw) {
      return buildTabQuotaView(uid, dayId, null, null, {
        spellingCount: 0,
        consistencyCount: 0,
      });
    }
    const parsed = JSON.parse(raw);
    const feedbackBonusDayId =
      typeof parsed?.feedbackBonusDayId === 'string'
        ? parsed.feedbackBonusDayId
        : null;
    const boostApprovedDayId =
      typeof parsed?.boostApprovedDayId === 'string'
        ? parsed.boostApprovedDayId
        : null;
    const storedDayId =
      typeof parsed?.dayId === 'string' ? parsed.dayId : null;
    const counts =
      storedDayId === dayId
        ? {
            spellingCount: Math.max(0, Number(parsed?.spellingCount) || 0),
            consistencyCount: Math.max(0, Number(parsed?.consistencyCount) || 0),
          }
        : { spellingCount: 0, consistencyCount: 0 };
    return buildTabQuotaView(
      uid,
      dayId,
      feedbackBonusDayId,
      boostApprovedDayId,
      counts,
    );
  } catch {
    return buildTabQuotaView(uid, dayId, null, null, {
      spellingCount: 0,
      consistencyCount: 0,
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
 *   boostApprovedDayId?: string | null,
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
        boostApprovedDayId:
          state.boostApprovedDayId !== undefined
            ? state.boostApprovedDayId
            : prev.boostApprovedDayId,
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
  const boostApprovedDayId =
    typeof userData?.boostApprovedDayId === 'string'
      ? userData.boostApprovedDayId
      : null;
  return { feedbackBonusDayId, boostApprovedDayId };
}

/**
 * @param {string} uid
 * @param {string} dayId
 */
async function readQuotaFlags(uid, dayId) {
  try {
    const [userSnap, daySnap] = await Promise.all([
      getDoc(userDocRef(uid)),
      getDoc(dayDocRef(uid, dayId)),
    ]);
    const { feedbackBonusDayId, boostApprovedDayId } = readUserBonusDayIds(
      userSnap.exists() ? userSnap.data() : undefined,
    );
    const counts = daySnap.exists()
      ? readDayTabCounts(daySnap.data())
      : { spellingCount: 0, consistencyCount: 0 };
    const view = buildTabQuotaView(
      uid,
      dayId,
      feedbackBonusDayId,
      boostApprovedDayId,
      counts,
    );
    writeLocalQuota(uid, {
      dayId,
      spellingCount: counts.spellingCount,
      consistencyCount: counts.consistencyCount,
      feedbackBonusDayId,
      boostApprovedDayId,
    });
    return view;
  } catch {
    return readLocalQuota(uid, dayId);
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
      const flags = readLocalQuota(uid, dayId);
      return {
        dayId,
        enforced: false,
        tabLimit: flags.tabLimit,
        spellingCount: flags.spellingCount,
        consistencyCount: flags.consistencyCount,
        spellingConsumed: flags.spellingConsumed,
        consistencyConsumed: flags.consistencyConsumed,
        hasFeedbackBonusToday: flags.feedbackBonusDayId === dayId,
        hasBoostApprovedToday: flags.boostApprovedDayId === dayId,
      };
    }
    return {
      dayId,
      enforced: false,
      tabLimit: BETA_TAB_LIMIT_DEFAULT,
      spellingCount: 0,
      consistencyCount: 0,
      spellingConsumed: false,
      consistencyConsumed: false,
      hasFeedbackBonusToday: false,
      hasBoostApprovedToday: false,
    };
  }

  const flags = await readQuotaFlags(uid, dayId);
  return {
    dayId,
    enforced: true,
    tabLimit: flags.tabLimit,
    spellingCount: flags.spellingCount,
    consistencyCount: flags.consistencyCount,
    spellingConsumed: flags.spellingConsumed,
    consistencyConsumed: flags.consistencyConsumed,
    hasFeedbackBonusToday: flags.feedbackBonusDayId === dayId,
    hasBoostApprovedToday: flags.boostApprovedDayId === dayId,
  };
}

/**
 * Google Form 피드백 — 당일 탭당 2회 (KST)
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
      boostApprovedDayId: local.boostApprovedDayId,
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
      boostApprovedDayId: flags.boostApprovedDayId,
    });
    return { ok: true, dayId, granted: true, alreadyHadBonus: false };
  } catch {
    writeLocalQuota(uid, {
      dayId,
      spellingCount: flags.spellingCount,
      consistencyCount: flags.consistencyCount,
      feedbackBonusDayId: dayId,
      boostApprovedDayId: flags.boostApprovedDayId,
    });
    return { ok: true, dayId, granted: true, alreadyHadBonus: false };
  }
}

/**
 * @param {string} uid
 * @param {string} [email]
 * @param {BetaQuotaTab} tab
 */
export async function consumeBetaDailyQuota(uid, email = '', tab = 'spelling') {
  const dayId = getKstDayId();
  if (!isBetaDailyQuotaEnforcedForUser(uid, email)) {
    return { ok: true, dayId, tab };
  }

  const flags = await readQuotaFlags(uid, dayId);
  const isFirstEverCheck =
    flags.spellingCount === 0 && flags.consistencyCount === 0;
  const tabCount =
    tab === 'spelling' ? flags.spellingCount : flags.consistencyCount;
  if (!canRunTabCheck(tabCount, flags.tabLimit)) {
    return { ok: false, dayId, alreadyUsed: true, tab };
  }

  const countField = tab === 'spelling' ? 'spellingCount' : 'consistencyCount';

  try {
    await runTransaction(getFirestore(firebaseApp), async (tx) => {
      const userRef = userDocRef(uid);
      const userSnap = await tx.get(userRef);
      const { feedbackBonusDayId, boostApprovedDayId } = readUserBonusDayIds(
        userSnap.exists() ? userSnap.data() : undefined,
      );
      const tabLimit = getTabCheckLimit(
        feedbackBonusDayId,
        boostApprovedDayId,
        dayId,
      );

      const dayRef = dayDocRef(uid, dayId);
      const daySnap = await tx.get(dayRef);
      const counts = daySnap.exists()
        ? readDayTabCounts(daySnap.data())
        : { spellingCount: 0, consistencyCount: 0 };
      const currentCount =
        tab === 'spelling' ? counts.spellingCount : counts.consistencyCount;
      if (currentCount >= tabLimit) {
        throw new Error('beta-quota-exceeded');
      }
      const nextCount = currentCount + 1;
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
    });

    const nextSpelling =
      tab === 'spelling' ? flags.spellingCount + 1 : flags.spellingCount;
    const nextConsistency =
      tab === 'consistency'
        ? flags.consistencyCount + 1
        : flags.consistencyCount;
    writeLocalQuota(uid, {
      dayId,
      spellingCount: nextSpelling,
      consistencyCount: nextConsistency,
      feedbackBonusDayId: flags.feedbackBonusDayId,
      boostApprovedDayId: flags.boostApprovedDayId,
    });
    if (isFirstEverCheck) syncFirstCheckBadge(uid);
    return { ok: true, dayId, tab };
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
        boostApprovedDayId: flags.boostApprovedDayId,
      });
      return { ok: false, dayId, alreadyUsed: true, tab };
    }

    const local = readLocalQuota(uid, dayId);
    const localTabCount =
      tab === 'spelling' ? local.spellingCount : local.consistencyCount;
    if (!canRunTabCheck(localTabCount, local.tabLimit)) {
      return { ok: false, dayId, alreadyUsed: true, tab };
    }
    const nextSpelling =
      tab === 'spelling' ? local.spellingCount + 1 : local.spellingCount;
    const nextConsistency =
      tab === 'consistency'
        ? local.consistencyCount + 1
        : local.consistencyCount;
    writeLocalQuota(uid, {
      dayId,
      spellingCount: nextSpelling,
      consistencyCount: nextConsistency,
      feedbackBonusDayId: local.feedbackBonusDayId,
      boostApprovedDayId: local.boostApprovedDayId,
    });
    if (isFirstEverCheck) syncFirstCheckBadge(uid);
    return { ok: true, dayId, tab };
  }
}

/**
 * @param {string} uid
 * @param {{ onConsumed?: () => void, authEmail?: string, checkTab?: BetaQuotaTab }} [options]
 */
export async function assertBetaDailyCheckOrAlert(uid, options = {}) {
  if (!assertLoggedInForCheckOrAlert(uid)) {
    return false;
  }
  const email = options.authEmail ?? '';
  const tab = options.checkTab ?? 'spelling';
  if (!isBetaDailyQuotaEnforcedForUser(uid, email)) {
    return true;
  }
  const result = await consumeBetaDailyQuota(uid, email, tab);
  if (!result.ok) {
    alert(betaQuotaAlertForTab(tab));
    return false;
  }
  options.onConsumed?.();
  return true;
}
