/** package.json version */
export const APP_VERSION = '0.1.0';

/**
 * 화면에서 바로 확인하는 기능 표식 — UI를 바꿀 때마다 올리면 됩니다.
 * (Pages·dev 공통. 최신이면 대문·메인 하단에 이 문자열이 보입니다.)
 */
export const UI_FEATURE_MARK = '2026-05-25-no-aux-upload';

/** CI 빌드 시 VITE_UI_BUILD_ID(커밋 SHA), 로컬 dev는 dev-local */
const RAW_BUILD_ID = import.meta.env.VITE_UI_BUILD_ID || 'dev-local';

export const UI_BUILD_ID =
  RAW_BUILD_ID.length > 7 ? RAW_BUILD_ID.slice(0, 7) : RAW_BUILD_ID;

export function versionLabel() {
  const mode = import.meta.env.DEV ? 'dev' : 'pages';
  return `v${APP_VERSION} · ${UI_BUILD_ID} · ${UI_FEATURE_MARK} · ${mode}`;
}

/** @deprecated versionLabel() 사용 */
export function buildFingerprint() {
  return versionLabel();
}
