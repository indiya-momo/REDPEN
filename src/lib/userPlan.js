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
