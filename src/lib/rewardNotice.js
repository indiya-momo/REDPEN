const STORAGE_PREFIX = 'indiya-reward-notice--';

/**
 * @param {string} uid
 */
function storageKey(uid) {
  return `${STORAGE_PREFIX}${uid.trim()}`;
}

/**
 * 새 배지 획득 알림 — 작업 화면 마이페이지 버튼 빨간 점 (grantBadgeIfNew notify 시만)
 * @param {string} uid
 */
export function markRewardNotice(uid) {
  const id = uid.trim();
  if (!id || typeof window === 'undefined') return;
  try {
    localStorage.setItem(storageKey(id), JSON.stringify({ at: Date.now() }));
  } catch {
    /* private mode */
  }
}

/**
 * @param {string} uid
 */
export function hasRewardNotice(uid) {
  const id = uid.trim();
  if (!id || typeof window === 'undefined') return false;
  try {
    return Boolean(localStorage.getItem(storageKey(id)));
  } catch {
    return false;
  }
}

/**
 * @param {string} uid
 */
export function clearRewardNotice(uid) {
  const id = uid.trim();
  if (!id || typeof window === 'undefined') return;
  try {
    localStorage.removeItem(storageKey(id));
  } catch {
    /* ignore */
  }
}
