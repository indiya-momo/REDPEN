import {
  clearAllWorkGuideDismissals,
  setDevWorkGuideForceStep,
} from './workGuideKeys.js';

const AUTH_BOUND_KEY = 'pdf-proofread-work-guide-auth-bound';

/**
 * 로그인·계정 전환·새 탭 첫 진입 시 말풍선 dismiss를 초기화한다.
 * 같은 탭에서 새로고침한 경우에는 유지한다(sessionStorage).
 *
 * @param {string | null | undefined} uid
 * @returns {boolean} dismiss를 초기화했으면 true
 */
export function syncWorkGuideOnAuthChange(uid) {
  const id = typeof uid === 'string' ? uid.trim() : '';
  if (!id) {
    clearWorkGuideAuthBound();
    return false;
  }

  let bound = '';
  try {
    bound = sessionStorage.getItem(AUTH_BOUND_KEY) ?? '';
  } catch {
    /* ignore */
  }

  if (bound === id) return false;

  clearAllWorkGuideDismissals(id);
  setDevWorkGuideForceStep(null);
  try {
    sessionStorage.setItem(AUTH_BOUND_KEY, id);
  } catch {
    /* ignore */
  }
  return true;
}

/** 로그아웃 시 호출 — 다음 로그인에서 말풍선을 다시 보이게 함 */
export function clearWorkGuideAuthBound() {
  try {
    sessionStorage.removeItem(AUTH_BOUND_KEY);
  } catch {
    /* ignore */
  }
}
