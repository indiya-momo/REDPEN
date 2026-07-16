import {
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { firebaseApp, isFirebaseAuthConfigured } from './firebaseAuth.js';
import { normalizeUserPlan } from './userPlan.js';
import {
  getLocalUserPlan,
  syncUserPlanFromCloud,
} from './userProfileStorage.js';

const COLLECTION = 'userCriteria';

/** @returns {boolean} */
export function isUserProfileCloudEnabled() {
  return isFirebaseAuthConfigured && Boolean(firebaseApp);
}

/**
 * @param {string} uid
 */
function criteriaDocRef(uid) {
  return doc(getFirestore(firebaseApp), COLLECTION, uid.trim());
}

/**
 * @param {unknown} raw
 * @returns {{
 *   nickname: string,
 *   onboardingComplete: boolean,
 *   userConfirmed: boolean,
 *   completedAt: number,
 *   plan: 'free' | 'paid',
 * } | null}
 */
function normalizeCloudProfile(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const nickname = String(raw.nickname ?? '').trim();
  if (!nickname) return null;
  return {
    nickname,
    onboardingComplete: Boolean(raw.onboardingComplete),
    userConfirmed: Boolean(raw.userConfirmed),
    completedAt:
      typeof raw.completedAt === 'number' && Number.isFinite(raw.completedAt)
        ? raw.completedAt
        : 0,
    plan: normalizeUserPlan(/** @type {{ plan?: unknown }} */ (raw).plan),
  };
}

/**
 * 프로필 문서 한 번 읽고 plan + (가능하면) 닉네임 프로필을 반환.
 * @param {string} uid
 * @returns {Promise<{
 *   plan: 'free' | 'paid',
 *   profile: ReturnType<typeof normalizeCloudProfile>,
 * }>}
 */
export async function loadUserCriteriaCloud(uid) {
  const id = String(uid ?? '').trim();
  if (!isUserProfileCloudEnabled() || !id) {
    return { plan: 'free', profile: null };
  }

  const snap = await getDoc(criteriaDocRef(id));
  if (!snap.exists()) {
    return { plan: 'free', profile: null };
  }
  const raw = snap.data()?.profile;
  return {
    plan: normalizeUserPlan(raw?.plan),
    profile: normalizeCloudProfile(raw),
  };
}

/**
 * @param {string} uid
 * @returns {Promise<'free' | 'paid'>}
 */
export async function loadUserPlanCloud(uid) {
  const { plan } = await loadUserCriteriaCloud(uid);
  return plan;
}

/**
 * Firestore plan 을 읽어 localStorage 에 맞춘 뒤 반환.
 * 공유·한도·검수저장 등 유료 게이트의 공통 진입점.
 * 클라우드 불가·실패 시에는 기존 local plan 을 유지한다.
 * @param {string} uid
 * @returns {Promise<'free' | 'paid'>}
 */
export async function ensureLocalPlanFromCloud(uid) {
  const id = String(uid ?? '').trim();
  if (!id) return 'free';
  if (!isUserProfileCloudEnabled()) {
    return getLocalUserPlan(id);
  }
  try {
    const plan = await loadUserPlanCloud(id);
    syncUserPlanFromCloud(id, plan);
    return plan;
  } catch (err) {
    console.warn('ensureLocalPlanFromCloud 실패, local plan 유지', err);
    return getLocalUserPlan(id);
  }
}

/**
 * @param {string} uid
 * @returns {Promise<ReturnType<typeof normalizeCloudProfile>>}
 */
export async function loadUserProfileCloud(uid) {
  const { profile } = await loadUserCriteriaCloud(uid);
  return profile;
}

/**
 * @param {string} uid
 * @param {{
 *   nickname: string,
 *   onboardingComplete: boolean,
 *   userConfirmed: boolean,
 *   completedAt: number,
 * }} profile
 */
export async function saveUserProfileCloud(uid, profile) {
  const id = String(uid ?? '').trim();
  if (!isUserProfileCloudEnabled() || !id) return false;
  const nickname = String(profile.nickname ?? '').trim();
  if (!nickname) return false;

  const existing = await getDoc(criteriaDocRef(id));
  const prevProfile = existing.exists()
    ? (existing.data()?.profile ?? {})
    : {};
  const existingPlan = existing.exists()
    ? normalizeUserPlan(prevProfile.plan)
    : 'free';

  /** @type {Record<string, unknown>} */
  const nextProfile = {
    nickname,
    onboardingComplete: Boolean(profile.onboardingComplete),
    userConfirmed: Boolean(profile.userConfirmed),
    completedAt: profile.completedAt ?? Date.now(),
    // plan은 Callable만 변경 — 클라에서는 기존 값 유지(또는 생성 시 free)
    plan: existingPlan,
  };
  if (typeof prevProfile.paidUpdatedAt === 'number') {
    nextProfile.paidUpdatedAt = prevProfile.paidUpdatedAt;
  }
  if (
    typeof prevProfile.paidUpdatedBy === 'string' &&
    prevProfile.paidUpdatedBy.trim()
  ) {
    nextProfile.paidUpdatedBy = prevProfile.paidUpdatedBy.trim();
  }
  if (
    typeof prevProfile.paidEmail === 'string' &&
    prevProfile.paidEmail.trim()
  ) {
    nextProfile.paidEmail = prevProfile.paidEmail.trim().toLowerCase();
  }

  await setDoc(
    criteriaDocRef(id),
    {
      profile: nextProfile,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  return true;
}
