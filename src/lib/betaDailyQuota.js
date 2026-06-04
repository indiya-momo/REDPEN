import { getAuth } from 'firebase/auth';
import {
  doc,
  getDoc,
  getFirestore,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { firebaseApp, isFirebaseAuthConfigured } from './firebaseAuth.js';

const LOCAL_QUOTA_PREFIX = 'indiya-beta-quota-v2--';
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** @returns {boolean} */
function isLocalDevQuotaRelaxed() {
  if (!import.meta.env.DEV) return false;
  if (import.meta.env.VITE_BETA_QUOTA_FORCE_LOCAL === 'true') return false;
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
}

export const BETA_DAILY_QUOTA_ALERT =
  '오늘 무료 검수 1회를 모두 사용했습니다.\n\n' +
  '첫 검수는 무료로 제공했습니다. 이후에는 로그인 회원당 하루 1회(한국 시간) ' +
  '전체 기능 검수를 이용할 수 있습니다. 내일 0시 이후 다시 시도해 주세요.';

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
 * 한도 면제·검수 차단에 쓸 로그인 이메일 (session.email 비어 있으면 Firebase user에서 보완)
 * @param {{ email?: string } | null | undefined} session
 */
export function resolveQuotaAuthEmail(session) {
  const fromSession = (session?.email ?? '').trim();
  if (fromSession) return fromSession;
  if (!isFirebaseAuthConfigured || !firebaseApp) return '';
  const user = getAuth(firebaseApp).currentUser;
  if (!user) return '';
  if (user.email?.trim()) return user.email.trim();
  for (const provider of user.providerData ?? []) {
    if (provider.email?.trim()) return provider.email.trim();
  }
  return '';
}

/**
 * 오픈베타 1일 1회 한도 면제 — `VITE_BETA_QUOTA_ADMIN_UIDS` / `VITE_BETA_QUOTA_ADMIN_EMAILS`
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
 * KST 기준 yyyy-mm-dd (검수 일자 키)
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
 * @param {boolean} firstFreeUsed
 * @param {boolean} consumedToday
 */
export function canRunBetaCheck(firstFreeUsed, consumedToday) {
  return !firstFreeUsed || !consumedToday;
}

/**
 * @param {string} uid
 * @returns {string}
 */
function localQuotaKey(uid) {
  return `${LOCAL_QUOTA_PREFIX}${uid.trim()}`;
}

/**
 * @param {string} uid
 * @param {string} dayId
 */
function readLocalQuota(uid, dayId) {
  if (!uid.trim()) {
    return {
      firstFreeUsed: false,
      consumedToday: false,
      dayId,
      enforced: false,
    };
  }
  try {
    const raw = localStorage.getItem(localQuotaKey(uid));
    if (!raw) {
      return {
        firstFreeUsed: false,
        consumedToday: false,
        dayId,
        enforced: true,
      };
    }
    const parsed = JSON.parse(raw);
    const firstFreeUsed = Boolean(parsed?.firstFreeUsed);
    return {
      firstFreeUsed,
      consumedToday: firstFreeUsed && parsed?.dayId === dayId,
      dayId,
      enforced: true,
    };
  } catch {
    return {
      firstFreeUsed: false,
      consumedToday: false,
      dayId,
      enforced: true,
    };
  }
}

/**
 * @param {string} uid
 * @param {{ firstFreeUsed: boolean, dayId?: string }} state
 */
function writeLocalQuota(uid, state) {
  try {
    localStorage.setItem(
      localQuotaKey(uid),
      JSON.stringify({
        firstFreeUsed: state.firstFreeUsed,
        dayId: state.dayId ?? null,
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
 * @param {string} uid
 * @param {string} dayId
 * @returns {Promise<{ firstFreeUsed: boolean, consumedToday: boolean }>}
 */
async function readQuotaFlags(uid, dayId) {
  try {
    const [userSnap, daySnap] = await Promise.all([
      getDoc(userDocRef(uid)),
      getDoc(dayDocRef(uid, dayId)),
    ]);
    const firstFreeUsed =
      userSnap.exists() && userSnap.data()?.firstFreeUsed === true;
    const consumedToday =
      firstFreeUsed &&
      daySnap.exists() &&
      Number(daySnap.data()?.count) >= 1;
    if (firstFreeUsed && consumedToday) {
      writeLocalQuota(uid, { firstFreeUsed: true, dayId });
    } else if (firstFreeUsed) {
      writeLocalQuota(uid, { firstFreeUsed: true, dayId: null });
    }
    return { firstFreeUsed, consumedToday };
  } catch {
    const local = readLocalQuota(uid, dayId);
    return {
      firstFreeUsed: local.firstFreeUsed,
      consumedToday: local.consumedToday,
    };
  }
}

/**
 * @param {string} uid
 * @returns {Promise<{
 *   consumedToday: boolean,
 *   hasWelcomeRemaining: boolean,
 *   dayId: string,
 *   enforced: boolean,
 *   source: 'none' | 'local' | 'firestore',
 * }>}
 */
/**
 * @param {string} uid
 * @param {string} [email]
 */
export async function getBetaDailyQuotaStatus(uid, email = '') {
  const dayId = getKstDayId();
  if (!isBetaDailyQuotaEnforcedForUser(uid, email)) {
    return {
      consumedToday: false,
      hasWelcomeRemaining: false,
      dayId,
      enforced: false,
      source: isBetaQuotaAdminExempt(uid, email) ? 'admin' : 'none',
    };
  }

  const flags = await readQuotaFlags(uid, dayId);
  return {
    consumedToday: flags.consumedToday,
    hasWelcomeRemaining: !flags.firstFreeUsed,
    dayId,
    enforced: true,
    source: 'firestore',
  };
}

/**
 * @param {string} uid
 * @returns {Promise<{ ok: boolean, dayId: string, alreadyUsed?: boolean, kind?: 'welcome' | 'daily' }>}
 */
/**
 * @param {string} uid
 * @param {string} [email]
 */
export async function consumeBetaDailyQuota(uid, email = '') {
  const dayId = getKstDayId();
  if (!isBetaDailyQuotaEnforcedForUser(uid, email)) {
    return { ok: true, dayId, kind: 'daily' };
  }

  const flags = await readQuotaFlags(uid, dayId);
  if (!canRunBetaCheck(flags.firstFreeUsed, flags.consumedToday)) {
    return { ok: false, dayId, alreadyUsed: true, kind: 'daily' };
  }

  const useWelcomeSlot = !flags.firstFreeUsed;

  try {
    await runTransaction(getFirestore(firebaseApp), async (tx) => {
      const userRef = userDocRef(uid);
      const userSnap = await tx.get(userRef);
      const firstFreeUsed =
        userSnap.exists() && userSnap.data()?.firstFreeUsed === true;

      if (!firstFreeUsed) {
        tx.set(
          userRef,
          { firstFreeUsed: true, firstFreeAt: serverTimestamp() },
          { merge: true },
        );
        return;
      }

      const dayRef = dayDocRef(uid, dayId);
      const daySnap = await tx.get(dayRef);
      if (daySnap.exists() && Number(daySnap.data()?.count) >= 1) {
        throw new Error('beta-quota-exceeded');
      }
      tx.set(dayRef, { count: 1, usedAt: serverTimestamp() });
    });

    if (useWelcomeSlot) {
      writeLocalQuota(uid, { firstFreeUsed: true });
      return { ok: true, dayId, kind: 'welcome' };
    }
    writeLocalQuota(uid, { firstFreeUsed: true, dayId });
    return { ok: true, dayId, kind: 'daily' };
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'beta-quota-exceeded'
    ) {
      writeLocalQuota(uid, { firstFreeUsed: true, dayId });
      return { ok: false, dayId, alreadyUsed: true, kind: 'daily' };
    }

    const local = readLocalQuota(uid, dayId);
    if (!canRunBetaCheck(local.firstFreeUsed, local.consumedToday)) {
      return { ok: false, dayId, alreadyUsed: true, kind: 'daily' };
    }
    if (!local.firstFreeUsed) {
      writeLocalQuota(uid, { firstFreeUsed: true });
      return { ok: true, dayId, kind: 'welcome' };
    }
    writeLocalQuota(uid, { firstFreeUsed: true, dayId });
    return { ok: true, dayId, kind: 'daily' };
  }
}

/**
 * 검수 실행 직전 호출 — 실패 시 alert 후 false
 * @param {string} uid
 * @param {{ onConsumed?: () => void, authEmail?: string }} [options]
 */
export async function assertBetaDailyCheckOrAlert(uid, options = {}) {
  const email = options.authEmail ?? '';
  if (!isBetaDailyQuotaEnforcedForUser(uid, email)) {
    return true;
  }
  const result = await consumeBetaDailyQuota(uid, email);
  if (!result.ok) {
    alert(BETA_DAILY_QUOTA_ALERT);
    return false;
  }
  options.onConsumed?.();
  return true;
}
