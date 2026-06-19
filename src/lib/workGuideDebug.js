/** URL `?workGuideDebug=1` — 말풍선 앵커 위치 콘솔 로그 (TooltipGuide) */
export function isWorkGuideDebug() {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('workGuideDebug') === '1';
}

/**
 * @param {string} label
 * @param {Record<string, unknown>} payload
 */
export function logWorkGuideDebug(label, payload) {
  if (!isWorkGuideDebug()) return;
  // eslint-disable-next-line no-console
  console.log(`[work-guide] ${label}`, payload);
}
