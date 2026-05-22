/** package.json version — 배포·확인용 */
export const APP_VERSION = '0.1.0';

/**
 * UI/layout 변경 시 이 값만 올리면 화면에서 최신 여부 확인 가능
 * (예: 2026-05-22-panel)
 */
export const UI_BUILD_ID = '2026-05-22-tab-filtered-results';

export function versionLabel() {
  const mode = import.meta.env.DEV ? 'dev' : 'build';
  return `v${APP_VERSION} · ${UI_BUILD_ID} · ${mode}`;
}
