import { getEventRewardDefinition } from './eventRewardCatalog.js';

const STORAGE_PREFIX = 'indiya-event-reward-pending--';

/**
 * @param {string} uid
 */
function storageKey(uid) {
  return `${STORAGE_PREFIX}${uid.trim()}`;
}

/**
 * 이벤트 보상 팝업을 대기열에 넣습니다. (피드백 복귀 등에서 추후 호출)
 * @param {string} uid
 * @param {string} eventId
 */
export function queueEventReward(uid, eventId) {
  const id = uid.trim();
  const event = eventId.trim();
  if (!id || !event || !getEventRewardDefinition(event)) return false;
  try {
    localStorage.setItem(
      storageKey(id),
      JSON.stringify({ eventId: event, queuedAt: Date.now() }),
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * 대기 중인 이벤트 보상을 꺼냅니다. 없으면 null.
 * @param {string} uid
 * @returns {import('./eventRewardCatalog.js').EventRewardDefinition | null}
 */
export function consumePendingEventReward(uid) {
  const id = uid.trim();
  if (!id) return null;
  try {
    const raw = localStorage.getItem(storageKey(id));
    if (!raw) return null;
    localStorage.removeItem(storageKey(id));
    const parsed = JSON.parse(raw);
    const eventId = typeof parsed?.eventId === 'string' ? parsed.eventId : '';
    return getEventRewardDefinition(eventId);
  } catch {
    return null;
  }
}
