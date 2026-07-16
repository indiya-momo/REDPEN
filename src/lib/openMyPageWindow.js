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
  const url = buildMyPageWindowUrl(section);
  const existing = window.open('', 'indiya-mypage');
  if (existing && !existing.closed) {
    existing.location.replace(url.toString());
    existing.focus();
    return;
  }
  window.open(url.toString(), 'indiya-mypage');
}
