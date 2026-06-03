/**
 * 목차 · 본문 일치 검수.
 * - `npm run dev`: 항상 켜짐
 * - 프로덕션 빌드: 기본 켜짐 (로컬·배포 UI 동일). 끄려면 `VITE_FEATURE_TOC_BODY_CHECK=false`
 */
export function isTocBodyCheckEnabled() {
  if (import.meta.env.DEV) return true;
  return import.meta.env.VITE_FEATURE_TOC_BODY_CHECK !== 'false';
}
