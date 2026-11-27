/**
 * 앱 안 한글 맞춤법 규정 페이지 (?window=orthography#art-N).
 * 외부 국립국어원 주소로 보내지 않는다.
 * @param {string} [anchor]
 */
export function buildHangulOrthographyUrl(anchor) {
  const url = new URL(import.meta.env.BASE_URL || '/', window.location.origin);
  url.searchParams.set('window', 'orthography');
  const id = String(anchor ?? '').replace(/^#/, '').trim();
  url.hash = id ? id : '';
  return url;
}

/**
 * @param {string} [anchor]
 */
export function openHangulOrthographyWindow(anchor) {
  const url = buildHangulOrthographyUrl(anchor).toString();
  const win = window.open(url, 'indiya-orthography', 'noopener,noreferrer');
  if (win && !win.closed) {
    try {
      win.focus();
    } catch {
      /* ignore */
    }
  }
}
