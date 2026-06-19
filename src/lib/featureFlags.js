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
