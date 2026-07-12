/**
 * 목차 · 본문 일치 검수.
 * - `npm run dev`: 항상 켜짐
 * - 프로덕션·Pages 빌드: 기본 꺼짐 (Vercel/GitHub Pages에는 「개발중」만 표시)
 * - 로컬에서 preview로 켜려면 `.env`에 `VITE_FEATURE_TOC_BODY_CHECK=true`
 */
export function isTocBodyCheckEnabled() {
  if (import.meta.env.DEV) return true;
  return import.meta.env.VITE_FEATURE_TOC_BODY_CHECK === 'true';
}

/**
 * 맞춤법·일관성 검수 결과 엑셀 다운로드.
 * - `npm run dev`: 항상 켜짐
 * - 프로덕션: 기본 켜짐 (`VITE_FEATURE_SPELLING_EXPORT=false` 로만 끔)
 * - GitHub Pages 빌드: deploy-pages.yml 에서도 `true` 명시
 */
export function isSpellingExportEnabled() {
  if (import.meta.env.DEV) return true;
  if (import.meta.env.VITE_FEATURE_SPELLING_EXPORT === 'false') return false;
  return true;
}

/**
 * 마이페이지 「나의 프로젝트」 라이브러리(카드·태그·복제 등).
 * - `npm run dev`: 항상 켜짐
 * - 프로덕션·Pages 빌드: 기본 꺼짐 (준비 중 UI만 표시)
 * - 로컬 preview에서 켜려면 `.env`에 `VITE_FEATURE_MYPAGE_PROJECT_HUB=true`
 */
export function isMyPageProjectHubEnabled() {
  if (import.meta.env.DEV) return true;
  return import.meta.env.VITE_FEATURE_MYPAGE_PROJECT_HUB === 'true';
}

/**
 * 맞춤법 탭 「외래어 표기(영어 → 한글 지원)」.
 * - 기본 켜짐 (로그인·게스트 제한 없음)
 * - 끌 때만 `VITE_FEATURE_LOANWORD_CONVERTER=false`
 */
export function isLoanwordConverterEnabled() {
  if (import.meta.env.VITE_FEATURE_LOANWORD_CONVERTER === 'false') return false;
  return true;
}
