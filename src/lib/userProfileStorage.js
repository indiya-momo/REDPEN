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



function writeMap(map) {

  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));

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

  return Boolean(profile?.onboardingComplete && profile?.userConfirmed);

}



/**

 * @param {string} uid

 * @param {{

 *   nickname: string,

 *   termsAccepted?: boolean,

 *   privacyAccepted?: boolean,

 *   marketingOptIn?: boolean,

 * }} payload

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

  writeMap(map);

  return profile;

}


