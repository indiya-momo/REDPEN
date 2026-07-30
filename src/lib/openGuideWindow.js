/**
 * 도움말 센터 보조 창 열기 (?window=guide).
 * @param {string} [helpSlug]
 */
export function buildGuideWindowUrl(helpSlug) {
  const url = new URL(import.meta.env.BASE_URL || '/', window.location.origin);
  url.searchParams.set('window', 'guide');
  const slug = String(helpSlug ?? '').trim();
  if (slug) {
    url.searchParams.set('help', slug);
  } else {
    url.searchParams.delete('help');
  }
  return url;
}

/**
 * @param {string} [helpSlug]
 */
export function openGuideWindow(helpSlug) {
  const url = buildGuideWindowUrl(helpSlug).toString();
  const win = window.open(url, 'indiya-guide', 'noopener,noreferrer');
  if (win && !win.closed) {
    try {
      win.focus();
    } catch {
      /* ignore */
    }
  }
}
