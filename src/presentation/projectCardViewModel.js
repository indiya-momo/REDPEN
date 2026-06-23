/**
 * 마이페이지 프로젝트 카드 — UI 계약 (Presenter 출력).
 * Library / Share Preview가 공유하는 ViewModel.
 */

/** @typedef {'project' | 'folder'} ProjectShareScope */

/**
 * @typedef {{
 *   category: string,
 *   label: string,
 *   count: number,
 * }} ProjectCardHighlight
 */

/**
 * @typedef {{
 *   editorReview: number,
 *   spelling: number,
 *   find: number,
 *   commonString: number,
 *   auxiliary: number,
 * }} ProjectCardCounts
 */

/**
 * @typedef {{
 *   date: string,
 *   manuscriptPages?: number,
 * }} ProjectCardLastWork
 */

/**
 * @typedef {{
 *   id: string,
 *   title: string,
 *   tags: string[],
 *   memo?: string,
 *   headline: string,
 *   highlights: ProjectCardHighlight[],
 *   counts: ProjectCardCounts,
 *   lastWork?: ProjectCardLastWork,
 *   savedDate: string,
 *   isActive: boolean,
 *   dirty?: boolean,
 *   shareScope?: ProjectShareScope,
 * }} ProjectCardViewModel
 */

/** @param {ProjectCardViewModel} card @returns {string} */
export function formatProjectCardTitleLine(card) {
  const tagPart =
    card.tags.length > 0 ? `[${card.tags.join(' · ')}] ` : '';
  return `${tagPart}《${card.title}》 기준`;
}

/** @param {ProjectCardViewModel} card @returns {string} */
export function formatProjectCardMetaLine(card) {
  const parts = [];
  if (card.lastWork?.date) {
    parts.push(`마지막 작업 ${card.lastWork.date}`);
  }
  if (card.lastWork?.manuscriptPages != null) {
    parts.push(`원고 ${card.lastWork.manuscriptPages}p`);
  }
  if (card.savedDate) {
    parts.push(`저장 ${card.savedDate}`);
  }
  return parts.join(' · ');
}

/**
 * @param {ProjectCardViewModel[]} cards
 * @returns {string[]}
 */
export function collectProjectTags(cards) {
  const set = new Set();
  for (const card of cards) {
    for (const tag of card.tags) {
      const trimmed = tag.trim();
      if (trimmed) set.add(trimmed);
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'ko'));
}

/**
 * @param {ProjectCardViewModel[]} cards
 * @param {string | null} tagFilter null = 전체
 */
export function filterProjectsByTag(cards, tagFilter) {
  if (!tagFilter) return cards;
  return cards.filter((c) => c.tags.includes(tagFilter));
}
