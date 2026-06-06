const STORAGE_PREFIX = 'indiya-reward-notice--';

/**
 * @param {string} uid
 */
function storageKey(uid) {
  return `${STORAGE_PREFIX}${uid.trim()}`;
}

/**
 * 마이페이지 배지·선물 확인 유도 — 검수 화면 버튼 점 표시
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
