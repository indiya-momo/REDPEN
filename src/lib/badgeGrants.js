import { queueEventReward } from './eventRewardQueue.js';
import { markRewardNotice } from './rewardNotice.js';
import { earnBadge, getEarnedBadgeIds } from './userBadges.js';

export const ATTENDANCE_BADGE_DAYS = 16;

/**
 * @param {number | null | undefined} timestampMs
 */
export function daysSinceJoin(timestampMs) {
  if (!timestampMs || !Number.isFinite(timestampMs)) return null;
  const dayMs = 86_400_000;
  const start = new Date(timestampMs);
  start.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.max(1, Math.floor((today.getTime() - start.getTime()) / dayMs) + 1);
}

/**
 * @param {string} uid
 * @param {string} badgeId
 * @param {{ notify?: boolean, eventId?: string }} [options]
 */
export function grantBadgeIfNew(uid, badgeId, options = {}) {
  const id = uid.trim();
  const badge = badgeId.trim();
  if (!id || !badge) return false;
  if (getEarnedBadgeIds(id).has(badge)) return false;
  if (!earnBadge(id, badge)) return false;

  const { notify = true, eventId } = options;
  if (eventId) queueEventReward(id, eventId);
  if (notify) markRewardNotice(id);
  return true;
}

/**
 * @param {string} uid
 */
export function syncMomoRoomBadge(uid) {
  return grantBadgeIfNew(uid, 'slot-4', { eventId: 'momo-room' });
}

/**
 * @param {string} uid
 */
export function syncFirstCheckBadge(uid) {
  return grantBadgeIfNew(uid, 'slot-1', { notify: true });
}

/**
 * @param {string} uid
 */
export function syncBoostApprovedBadge(uid) {
  return grantBadgeIfNew(uid, 'slot-3', { eventId: 'beta-feedback-excellent' });
}

/**
 * @param {string} uid
 * @param {number | null | undefined} tenureDays
 */
export function syncAttendanceBadge(uid, tenureDays) {
  if (tenureDays == null || tenureDays < ATTENDANCE_BADGE_DAYS) return false;
  return grantBadgeIfNew(uid, 'slot-5', { notify: true });
}

/**
 * @param {string} uid
 * @param {{
 *   tenureDays?: number | null,
 *   hasBoostApprovedToday?: boolean,
 * }} options
 */
export function syncProfileBadges(uid, options = {}) {
  const id = uid.trim();
  if (!id) return false;
  let changed = false;
  if (options.hasBoostApprovedToday) {
    changed = syncBoostApprovedBadge(id) || changed;
  }
  if (options.tenureDays != null) {
    changed = syncAttendanceBadge(id, options.tenureDays) || changed;
  }
  return changed;
}
