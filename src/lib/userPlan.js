/**
 * 유료 플랜 판별. 결제 연동 시 이 모듈만 확장한다.
 * @param {{ plan?: string } | null | undefined} profile
 * @returns {boolean}
 */
export function isPaidPlan(profile) {
  return normalizeUserPlan(profile?.plan) === 'paid';
}

/**
 * @param {unknown} raw
 * @returns {'free' | 'paid'}
 */
export function normalizeUserPlan(raw) {
  return raw === 'paid' ? 'paid' : 'free';
}

/** 무료 사용자가 유료 전용 공유를 눌렀을 때 */
export const PAID_SHARE_ONLY_MESSAGE =
  '유료회원 전용입니다.\n프로젝트 공유는 유료 계정에서만 사용할 수 있습니다.';
