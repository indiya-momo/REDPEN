/**
 * 목차 · 본문 일치 검수.
 * - `npm run dev`: 항상 켜짐
 * - 프로덕션 빌드: 기본 끔 (`VITE_FEATURE_TOC_BODY_CHECK=true` 로만 켬)
 */
export function isTocBodyCheckEnabled() {
  return (
    import.meta.env.DEV ||
    import.meta.env.VITE_FEATURE_TOC_BODY_CHECK === 'true'
  );
}
