import {
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { firebaseApp, isFirebaseAuthConfigured } from './firebaseAuth.js';

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

  await setDoc(
    criteriaDocRef(id),
    {
      profile: {
        nickname,
        onboardingComplete: Boolean(profile.onboardingComplete),
        userConfirmed: Boolean(profile.userConfirmed),
        completedAt: profile.completedAt ?? Date.now(),
      },
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  return true;
}
