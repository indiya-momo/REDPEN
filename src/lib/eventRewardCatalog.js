/**
 * @typedef {{
 *   id: string,
 *   badgeId?: string,
 *   title: string,
 *   message: string,
 *   imageSrc?: string,
 *   imageAlt?: string,
 * }} EventRewardDefinition
 */

/** 이벤트별 팝업·뱃지 매핑 — 이미지·지급 트리거는 추후 연결 */
export const EVENT_REWARD_CATALOG = {
  'beta-feedback': {
    id: 'beta-feedback',
    badgeId: 'slot-1',
    title: '피드백 선물',
    message: '오픈베타 피드백을 남겨 주셔서 감사합니다. 배지가 컬렉션에 추가됩니다.',
  },
};

/**
 * @param {string} eventId
 * @returns {EventRewardDefinition | null}
 */
export function getEventRewardDefinition(eventId) {
  const key = eventId.trim();
  if (!key) return null;
  return EVENT_REWARD_CATALOG[key] ?? null;
}
