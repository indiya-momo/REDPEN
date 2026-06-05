import { firebaseApp, isFirebaseAuthConfigured } from './firebaseAuth.js';

export const CHECK_LOGIN_REQUIRED_ALERT =
  '로그인이 필요합니다.\n\n검수 기능은 Google 로그인 후 이용할 수 있습니다. 대문에서 다시 로그인해 주세요.';

/** @returns {boolean} */
export function isLoginRequiredForChecks() {
  return isFirebaseAuthConfigured && Boolean(firebaseApp);
}

/**
 * 검수 실행 직전 — Firebase 사용 시 로그인 uid 필수
 * @param {string} [uid]
 */
export function assertLoggedInForCheckOrAlert(uid = '') {
  if (!isLoginRequiredForChecks()) return true;
  if (String(uid).trim()) return true;
  alert(CHECK_LOGIN_REQUIRED_ALERT);
  return false;
}
