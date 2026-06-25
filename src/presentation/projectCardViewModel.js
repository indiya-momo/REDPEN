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
 *   label: string,
 *   active?: boolean,
 * }} ProjectCardChip
 */

/**
 * @typedef {'spelling' | 'consistency' | 'auxiliary'} ProjectCardPillarKey
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
 *   chipPreview?: Partial<Record<ProjectCardPillarKey, ProjectCardChip[]>>,
 *   lastWork?: ProjectCardLastWork,
 *   createdDate?: string,
 *   proofRevision?: string,
 *   savedDate: string,
 *   formatLabel?: string,
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

/** @param {ProjectCardViewModel} card @returns {string[]} */
export function formatProjectCardScheduleLines(card) {
  const lines = [];
  if (card.createdDate) {
    lines.push(`${card.createdDate} 생성`);
  }
  if (card.lastWork?.date) {
    lines.push(`${card.lastWork.date} 작업`);
  }
  return lines;
}

/** @param {ProjectCardViewModel} card @returns {string} */
export function formatProjectCardMetaLine(card) {
  const parts = [];
  if (card.lastWork?.manuscriptPages != null) {
    parts.push(`원고 ${card.lastWork.manuscriptPages}p`);
  }
  if (card.proofRevision) {
    parts.push(card.proofRevision);
  }
  if (card.formatLabel) {
    parts.push(card.formatLabel);
  }
  return parts.join(' · ');
}

const PILLAR_META = [
  { key: 'spelling', label: '맞춤법' },
  { key: 'consistency', label: '일관성' },
  { key: 'auxiliary', label: '본용언 + 보조용언' },
];

/** @param {ProjectCardViewModel} card @param {ProjectCardPillarKey} key */
function pillarCount(card, key) {
  if (key === 'spelling') {
    return card.counts.editorReview + card.counts.spelling;
  }
  if (key === 'consistency') {
    return card.counts.find + card.counts.commonString;
  }
  return card.counts.auxiliary;
}

const PILLAR_CHIP_PREVIEW_LIMIT = {
  spelling: 2,
  consistency: 1,
  auxiliary: 2,
};

/**
 * @param {ProjectCardViewModel} card
 * @returns {{ key: ProjectCardPillarKey, label: string, count: number, chips: ProjectCardChip[], hasMore: boolean }[]}
 */
export function buildProjectCardPillarPreviews(card) {
  return PILLAR_META.map(({ key, label }) => {
    const all = card.chipPreview?.[key] ?? [];
    const maxChips = PILLAR_CHIP_PREVIEW_LIMIT[key] ?? 2;
    return {
      key,
      label,
      count: pillarCount(card, key),
      chips: all.slice(0, maxChips),
      hasMore: all.length > maxChips,
    };
  });
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

/** @type {readonly { id: string, label: string }[]} */
export const STANDARD_PROJECT_LIBRARY_TAG_FILTERS = [
  { id: '__series__', label: '시리즈' },
  { id: '문학', label: '문학' },
  { id: '실용서', label: '실용서' },
  { id: '경제경영', label: '경제경영' },
  { id: '출판사 매뉴얼', label: '출판사 매뉴얼' },
];

/**
 * @param {ProjectCardViewModel[]} cards
 * @param {string | null} tagFilter null = 전체, '__series__' = 시리즈 접두
 */
export function filterProjectsForLibrary(cards, tagFilter) {
  if (!tagFilter) return cards;
  if (tagFilter === '__series__') {
    return cards.filter((c) =>
      c.tags.some((tag) => tag.startsWith('시리즈')),
    );
  }
  return filterProjectsByTag(cards, tagFilter);
}

/**
 * @param {ProjectCardViewModel[]} cards
 * @returns {readonly { id: string | null, label: string }[]}
 */
export function buildProjectTagFilterOptions(cards) {
  /** @type {{ id: string | null, label: string }[]} */
  const options = [{ id: null, label: '전체' }];
  const seen = new Set(['__series__', '시리즈']);

  for (const { id, label } of STANDARD_PROJECT_LIBRARY_TAG_FILTERS) {
    options.push({ id, label });
    seen.add(id);
    seen.add(label);
  }

  for (const tag of collectProjectTags(cards)) {
    if (seen.has(tag)) continue;
    options.push({ id: tag, label: tag });
    seen.add(tag);
  }

  return options;
}

/**
 * @param {ProjectCardViewModel[]} cards
 * @param {string | null} tagFilter
 */
export function filterProjectsByTag(cards, tagFilter) {
  if (!tagFilter) return cards;
  return cards.filter((c) => c.tags.includes(tagFilter));
}
