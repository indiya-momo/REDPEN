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
  // 고정 창 이름을 쓰면 기존 맞춤법 창이 이동만 한다. 링크를 누를 때마다 새 창을 연다.
  const win = window.open(url, '_blank', 'noopener,noreferrer');
  if (win && !win.closed) {
    try {
      win.focus();
    } catch {
      /* ignore */
    }
  }
}
