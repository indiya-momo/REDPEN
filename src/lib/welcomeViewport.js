/** welcome-pc / welcome-mo 분기와 동일 (WelcomeScreen.jsx) */
export const WELCOME_MOBILE_MQ = '(max-width: 960px)';

/** @returns {boolean} */
export function isWelcomeMobileViewport() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(WELCOME_MOBILE_MQ).matches;
}

/** 모바일 welcome-mo는 안내 전용 — PC에서만 로그인 후 main 자동 진입 */
export function shouldAutoEnterMainFromWelcome() {
  return !isWelcomeMobileViewport();
}
