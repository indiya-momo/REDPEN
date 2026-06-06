const STORAGE_PREFIX = 'indiya-user-badges--';

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   description?: string,
 *   imageSrc?: string,
 * }} BadgeDefinition
 */

/** 이미지·지급 로직은 추후 연결 — 슬롯·라벨만 정의 */
export const BADGE_CATALOG = [
  { id: 'slot-1', name: '뱃지 1', description: '이벤트 뱃지' },
  { id: 'slot-2', name: '뱃지 2', description: '이벤트 뱃지' },
  { id: 'slot-3', name: '뱃지 3', description: '이벤트 뱃지' },
  { id: 'slot-4', name: '뱃지 4', description: '이벤트 뱃지' },
  { id: 'slot-5', name: '뱃지 5', description: '이벤트 뱃지' },
  { id: 'slot-6', name: '뱃지 6', description: '이벤트 뱃지' },
  { id: 'slot-7', name: '뱃지 7', description: '이벤트 뱃지' },
  { id: 'slot-8', name: '뱃지 8', description: '이벤트 뱃지' },
];

/**
 * @param {string} uid
 */
function storageKey(uid) {
  return `${STORAGE_PREFIX}${uid.trim()}`;
}

/**
 * @param {string} uid
 * @returns {Set<string>}
 */
export function getEarnedBadgeIds(uid) {
  const id = uid.trim();
  if (!id) return new Set();
  try {
    const raw = localStorage.getItem(storageKey(id));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed?.earned) ? parsed.earned : [];
    return new Set(list.filter((entry) => typeof entry === 'string'));
  } catch {
    return new Set();
  }
}

/**
 * @param {string} uid
 * @param {string} badgeId
 */
export function earnBadge(uid, badgeId) {
  const id = uid.trim();
  const badge = badgeId.trim();
  if (!id || !badge) return false;
  const earned = getEarnedBadgeIds(id);
  if (earned.has(badge)) return true;
  earned.add(badge);
  try {
    localStorage.setItem(
      storageKey(id),
      JSON.stringify({ earned: [...earned], updatedAt: Date.now() }),
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {string} uid
 * @returns {Array<BadgeDefinition & { earned: boolean }>}
 */
export function getUserBadgeCollection(uid) {
  const earned = getEarnedBadgeIds(uid);
  return BADGE_CATALOG.map((badge) => ({
    ...badge,
    earned: earned.has(badge.id),
  }));
}
