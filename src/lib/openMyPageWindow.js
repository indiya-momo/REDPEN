/**
 * 마이페이지 보조 창 열기 (?window=mypage).
 * @param {'overview' | 'projects' | 'profile' | 'badges' | string} [section]
 */
export function buildMyPageWindowUrl(section) {
  const url = new URL(import.meta.env.BASE_URL || '/', window.location.origin);
  url.searchParams.set('window', 'mypage');
  const nav = String(section ?? '').trim();
  if (nav) {
    url.searchParams.set('mypageSection', nav);
  } else {
    url.searchParams.delete('mypageSection');
  }
  return url;
}

/**
 * @param {'overview' | 'projects' | 'profile' | 'badges' | string} [section]
 */
export function openMyPageWindow(section) {
  const url = buildMyPageWindowUrl(section).toString();
  // about:blank 로 먼저 열면 Auth 초기화 레이스가 나기 쉬워 URL 을 바로 연다.
  const win = window.open(url, 'indiya-mypage');
  if (win && !win.closed) {
    try {
      win.focus();
    } catch {
      /* ignore */
    }
  }
}
