/**
 * uid별 닉네임·온보딩 완료 플래그 localStorage.
 * 대문 온보딩·MainScreen 인사말·isOnboardingComplete 판단.
 * userProfileCloud와 병행; 오프라인·즉시 반영용.
 */
const STORAGE_KEY = 'indiya-user-profile-v1';

const NICKNAME_PREFIXES = ['편집자', '교정인', '인디독자', '모모친구'];

function readMap() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/** @returns {boolean} */
function writeMap(map) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    return true;
  } catch {
    return false;
  }
}

export function createRandomNickname() {
  const prefix =
    NICKNAME_PREFIXES[Math.floor(Math.random() * NICKNAME_PREFIXES.length)];
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}${suffix}`;
}

/**
 * @param {string} uid
 * @returns {{
 *   nickname: string,
 *   termsAccepted: boolean,
 *   privacyAccepted: boolean,
 *   marketingOptIn: boolean,
 *   onboardingComplete: boolean,
 *   userConfirmed: boolean,
 *   completedAt: number,
 * } | null}
 */
export function getUserProfile(uid) {
  if (!uid) return null;
  const profile = readMap()[uid];
  return profile && typeof profile === 'object' ? profile : null;
}

/** 모달에서 직접 완료한 경우만 true (예전 자동 저장은 false) */
export function isOnboardingComplete(uid) {
  const profile = getUserProfile(uid);
  if (!profile) return false;
  if (profile.onboardingComplete && profile.userConfirmed) return true;
  // 예전 자동 저장: nickname만 있고 userConfirmed가 없으면 완료로 간주
  if (profile.onboardingComplete && profile.nickname?.trim()) {
    return true;
  }
  return false;
}

/**
 * Firestore에서 불러온 프로필을 localStorage에 병합한다.
 * @param {string} uid
 * @param {{
 *   nickname: string,
 *   onboardingComplete?: boolean,
 *   userConfirmed?: boolean,
 *   completedAt?: number,
 * }} cloudProfile
 * @returns {boolean} localStorage를 갱신했으면 true
 */
export function mergeUserProfileFromCloud(uid, cloudProfile) {
  if (!uid || !cloudProfile?.nickname?.trim()) return false;
  if (!cloudProfile.onboardingComplete || !cloudProfile.userConfirmed) return false;

  const local = getUserProfile(uid);
  const cloudAt = cloudProfile.completedAt ?? 0;
  const localAt = local?.completedAt ?? 0;
  if (local?.userConfirmed && localAt >= cloudAt) return false;

  return Boolean(
    saveUserProfile(uid, {
      nickname: cloudProfile.nickname,
      termsAccepted: local?.termsAccepted ?? false,
      privacyAccepted: local?.privacyAccepted ?? false,
      marketingOptIn: local?.marketingOptIn ?? false,
    }),
  );
}

/**
 * @param {string} uid
 * @param {{
 *   nickname: string,
 *   termsAccepted?: boolean,
 *   privacyAccepted?: boolean,
 *   marketingOptIn?: boolean,
 * }} payload
 * @returns {ReturnType<typeof getUserProfile>}
 */
export function saveUserProfile(uid, payload) {
  if (!uid) return null;
  const map = readMap();
  const profile = {
    nickname: String(payload.nickname ?? '').trim(),
    termsAccepted: Boolean(payload.termsAccepted),
    privacyAccepted: Boolean(payload.privacyAccepted),
    marketingOptIn: Boolean(payload.marketingOptIn),
    onboardingComplete: true,
    userConfirmed: true,
    completedAt: Date.now(),
  };
  map[uid] = profile;
  if (!writeMap(map)) return null;
  return profile;
}
