/**
 * public/ 아래 정적 파일 URL (GitHub Pages base 경로 포함)
 * @param {string} path
 */
export function publicAssetUrl(path) {
  const base = import.meta.env.BASE_URL || '/';
  const normalized = path.replace(/^\//, '');
  return `${base}${normalized}`;
}
