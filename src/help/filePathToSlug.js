/**
 * Vite glob 키 → help slug (content/help/ 기준, index.md는 상위 slug)
 * @param {string} filePath
 * @returns {string | null}
 */
export function filePathToSlug(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  const match = normalized.match(/content\/help\/(.+)\.md$/);
  if (!match) return null;

  const relative = match[1];
  if (relative.endsWith('/index')) {
    return relative.slice(0, -'/index'.length);
  }
  return relative;
}
