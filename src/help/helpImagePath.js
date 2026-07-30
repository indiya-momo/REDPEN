/** @typedef {string | null | undefined} ArticleSlug */

const HELP_IMAGE_PREFIX = 'help-image:';
const HELP_IMAGES_ROOT = '/help/images';

/**
 * 도움말 MD 이미지 경로 → public URL
 *
 * - help-image:01-upload.png        → /help/images/{현재글 slug}/01-upload.png
 * - help-image:other/slug/file.png  → /help/images/other/slug/file.png
 * - /help/images/...                → 그대로
 *
 * @param {string} href
 * @param {ArticleSlug} articleSlug
 * @returns {string | null}
 */
export function resolveHelpImageSrc(href, articleSlug) {
  const trimmed = href.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith(`${HELP_IMAGES_ROOT}/`)) {
    return trimmed;
  }

  if (!trimmed.startsWith(HELP_IMAGE_PREFIX)) {
    return trimmed;
  }

  const relative = trimmed.slice(HELP_IMAGE_PREFIX.length).replace(/^\/+/, '');
  if (!relative) return null;

  const hasFolder = relative.includes('/');
  if (!hasFolder && articleSlug) {
    return `${HELP_IMAGES_ROOT}/${articleSlug}/${relative}`;
  }

  return `${HELP_IMAGES_ROOT}/${relative}`;
}

/**
 * @param {string} line
 * @returns {{ alt: string, href: string } | null}
 */
export function parseMarkdownImageLine(line) {
  const match = line.trim().match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
  if (!match) return null;
  return { alt: match[1], href: match[2] };
}

/**
 * @param {string} line
 */
export function isMarkdownImageLine(line) {
  return parseMarkdownImageLine(line) !== null;
}

/**
 * @param {string} line
 * @returns {string | null}
 */
export function parseImageCaptionLine(line) {
  const trimmed = line.trim();
  const match = trimmed.match(/^\*(.+)\*$/);
  if (!match) return null;
  return match[1].trim();
}

/**
 * @param {string} line
 */
export function isImageCaptionLine(line) {
  return parseImageCaptionLine(line) !== null;
}
