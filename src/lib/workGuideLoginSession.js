import { setDevWorkGuideForceStep } from './workGuideKeys.js';

/**
 * 로그인·계정 전환 시 dev 고정 단계만 초기화한다.
 * 말풍선 dismiss·온보딩 노출 횟수는 uid별 localStorage에 유지한다.
 *
 * @param {string | null | undefined} uid
 * @returns {boolean} 상태를 갱신했으면 true
 */
export function syncWorkGuideOnAuthChange(uid) {
  const id = typeof uid === 'string' ? uid.trim() : '';
  if (!id) {
    clearWorkGuideAuthBound();
    return false;
  }
  setDevWorkGuideForceStep(null);
  return false;
}

/** @deprecated no-op — dismiss는 로그아웃 후에도 유지 */
export function clearWorkGuideAuthBound() {
  /* intentionally empty */
}
