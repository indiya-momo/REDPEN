import helpNav from '../../content/help/_nav.json';
import { filePathToSlug } from './filePathToSlug.js';
import { parseFrontmatter } from './parseFrontmatter.js';

const rawModules = import.meta.glob('../../content/help/**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** @type {Map<string, { slug: string, meta: Record<string, unknown>, body: string, searchText: string }>} */
const articlesBySlug = new Map();

for (const [path, raw] of Object.entries(rawModules)) {
  const slug = filePathToSlug(path);
  if (!slug) continue;

  const { meta, body } = parseFrontmatter(raw);
  const title = typeof meta.title === 'string' ? meta.title : slug;
  const keywords = Array.isArray(meta.keywords) ? meta.keywords.join(' ') : '';

  articlesBySlug.set(slug, {
    slug,
    meta,
    body,
    searchText: `${title} ${keywords} ${body}`.toLowerCase(),
  });
}

/**
 * @param {string} slug
 */
export function getHelpArticle(slug) {
  return articlesBySlug.get(slug) ?? null;
}

export function getAllHelpArticles() {
  return [...articlesBySlug.values()];
}

export function getHelpNav() {
  return helpNav;
}

export { articlesBySlug };
