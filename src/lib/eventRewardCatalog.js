import { getBadgeDefinition } from './userBadges.js';

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
    badgeId: 'slot-2',
    title: '피드백 선물',
    message:
      '오늘 맞춤법·표기 통일 각 2회까지 검수할 수 있어요. 마이페이지 배지 모음집에서 비밀 연구원 배지를 확인해 보세요.',
  },
  'momo-room': {
    id: 'momo-room',
    badgeId: 'slot-4',
    title: '매의 눈',
    message:
      '모모의 방에 온 걸 환영해요. 배지 모음집에서 매의 눈 배지를 확인해 보세요.',
  },
  'beta-feedback-excellent': {
    id: 'beta-feedback-excellent',
    badgeId: 'slot-3',
    title: '우수 피드백 선정',
    message:
      '오늘 맞춤법·표기 통일 각 3회까지 이용할 수 있어요. 수석 검증관 배지가 추가됐어요.',
  },
};

/**
 * @param {string} eventId
 * @returns {EventRewardDefinition | null}
 */
export function getEventRewardDefinition(eventId) {
  const key = eventId.trim();
  if (!key) return null;
  const base = EVENT_REWARD_CATALOG[key];
  if (!base) return null;
  const badge = base.badgeId ? getBadgeDefinition(base.badgeId) : null;
  return {
    ...base,
    ...(badge?.imageSrc ? { imageSrc: badge.imageSrc } : {}),
    ...(badge?.name ? { imageAlt: badge.name } : {}),
  };
}
