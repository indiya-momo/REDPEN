/**
 * 도움말 센터 URL의 help 쿼리 동기화 (?window=guide&help=slug)
 * @returns {string}
 */
export function getHelpSlugFromUrl() {
  return new URLSearchParams(window.location.search).get('help') ?? '';
}

/**
 * @param {string} slug
 */
export function setHelpSlugInUrl(slug) {
  const url = new URL(window.location.href);
  if (slug) {
    url.searchParams.set('help', slug);
  } else {
    url.searchParams.delete('help');
  }
  window.history.replaceState(null, '', url);
}
