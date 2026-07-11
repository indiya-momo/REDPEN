/**
 * Firebase가 켜져 있으면 검수는 로그인 필수 (isLoginRequiredForChecks).
 * 둘러보기(게스트)는 guestBrowsePolicy로 검수·결과 팝업까지 허용.
 * App·MainScreen·useRuleCheck·betaDailyQuota에서 공통 정책.
 */
import { firebaseApp, isFirebaseAuthConfigured } from './firebaseAuth.js';
import { guestBrowseAllowsCheckAndResults } from './guestBrowsePolicy.js';

export const CHECK_LOGIN_REQUIRED_ALERT =
  '로그인이 필요합니다.\n\n검수 기능은 Google 로그인 후 이용할 수 있습니다. 대문에서 다시 로그인해 주세요.';

/** @returns {boolean} */
export function isLoginRequiredForChecks() {
  return isFirebaseAuthConfigured && Boolean(firebaseApp);
}

/**
 * UI·게이트 공통 — true면 검수 버튼/실행 차단
 * @param {string} [uid]
 */
export function isCheckAuthBlocked(uid = '') {
  if (!isLoginRequiredForChecks()) return false;
  if (String(uid).trim()) return false;
  if (guestBrowseAllowsCheckAndResults()) return false;
  return true;
}

/**
 * 검수 실행 직전 — Firebase 사용 시 로그인 uid 필수 (둘러보기 예외)
 * @param {string} [uid]
 */
export function assertLoggedInForCheckOrAlert(uid = '') {
  if (!isCheckAuthBlocked(uid)) return true;
  alert(CHECK_LOGIN_REQUIRED_ALERT);
  return false;
}
