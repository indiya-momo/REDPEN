/** URL `?workGuideDebug=1` — 123번 말풍선 표시 조건·앵커 위치 콘솔 로그 */
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
