import {
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { firebaseApp, isFirebaseAuthConfigured } from './firebaseAuth.js';
import { normalizeUserPlan } from './userPlan.js';

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
 * @param {string} uid
 * @returns {Promise<ReturnType<typeof normalizeCloudProfile>>}
 */
export async function loadUserProfileCloud(uid) {
  const id = String(uid ?? '').trim();
  if (!isUserProfileCloudEnabled() || !id) return null;

  const snap = await getDoc(criteriaDocRef(id));
  if (!snap.exists()) return null;
  return normalizeCloudProfile(snap.data()?.profile);
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
