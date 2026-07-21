/**
 * 마이페이지 프로젝트 카드 — UI 계약 (Presenter 출력).
 * Library / Share Preview가 공유하는 ViewModel.
 */

import { MAX_PROJECT_TAGS } from '../lib/projectMeta.js';

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
 *   pillarMemos?: import('../lib/projectMeta.js').ProjectPillarMemos,
 *   headline: string,
 *   highlights: ProjectCardHighlight[],
 *   counts: ProjectCardCounts,
 *   chipPreview?: Partial<Record<ProjectCardPillarKey, ProjectCardChip[]>>,
 *   lastWork?: ProjectCardLastWork,
 *   createdDate?: string,
 *   savedDate: string,
 *   formatLabel?: string,
 *   isActive: boolean,
 *   dirty?: boolean,
 *   shareScope?: ProjectShareScope,
 *   decisionLedger?: import('./workHistoryDecisionLedger.js').WorkHistoryDecisionLedgerItem[],
 * }} ProjectCardViewModel
 */

/** @param {ProjectCardViewModel} card @returns {string} */
export function formatProjectCardTitleLine(card) {
  const tagPart =
    card.tags.length > 0 ? `[${card.tags.join(' · ')}] ` : '';
  return `${tagPart}《${card.title}》 기준`;
}

/** ISO·표시 문자열 → `YY.MM.DD` @param {string} [value] @returns {string} */
export function formatProjectCardDotDateFromIso(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const y = String(d.getFullYear() % 100).padStart(2, '0');
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
}

/** `26년 6월 30일`·`26.6.30` 등 → `26.06.30` @param {string} [value] @returns {string} */
export function normalizeProjectCardDotDate(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  const dotted = raw.match(/^(\d{2})\.(\d{1,2})\.(\d{1,2})$/);
  if (dotted) {
    return `${dotted[1]}.${dotted[2].padStart(2, '0')}.${dotted[3].padStart(2, '0')}`;
  }

  const korean = raw.match(/^(\d{2})년\s*(\d{1,2})월\s*(\d{1,2})일$/);
  if (korean) {
    return `${korean[1]}.${korean[2].padStart(2, '0')}.${korean[3].padStart(2, '0')}`;
  }

  return raw;
}

/** @param {ProjectCardViewModel} card @returns {string} */
export function formatProjectCardLastModifiedLabel(card) {
  const raw = card.lastWork?.date || card.savedDate || card.createdDate || '';
  const date = normalizeProjectCardDotDate(raw);
  if (!date) return '프로젝트';
  return `${date} 작업`;
}

/** @param {ProjectCardViewModel} card @returns {string[]} */
export function buildProjectCardTabLabels(card) {
  return buildProjectCardDisplayTags(card);
}

/** 카드 상단 탭 — 태그 최대 {@link MAX_PROJECT_TAGS}개 @param {ProjectCardViewModel} card @returns {string[]} */
export function buildProjectCardDisplayTags(card) {
  return (card.tags ?? [])
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, MAX_PROJECT_TAGS);
}

/** 그 외 정보 (판형·교차 등) @param {ProjectCardViewModel} card @returns {string} */
export function formatProjectCardEditionValues(card) {
  return card.formatLabel?.trim() ?? '';
}

/** 메모 첫 줄 — CSS 말줄임표용 @param {ProjectCardViewModel} card @returns {string} */
export function formatProjectCardMemoPreview(card) {
  const firstLine = (card.memo ?? '').split(/\r?\n/, 1)[0]?.trim() ?? '';
  return firstLine;
}

/** @param {ProjectCardViewModel} card @returns {string[]} */
export function formatProjectCardScheduleLines(card) {
  const lines = [];
  const workDate = normalizeProjectCardDotDate(card.lastWork?.date);
  if (workDate) {
    lines.push(`${workDate} 작업`);
  }
  return lines;
}

/** @param {ProjectCardViewModel} card @returns {string} */
export function formatProjectCardCompactDateLine(card) {
  return normalizeProjectCardDotDate(
    card.lastWork?.date || card.savedDate || card.createdDate || '',
  );
}

/** @param {ProjectCardViewModel} card @returns {string} */
export function formatProjectCardMetaLine(card) {
  const parts = [];
  if (card.lastWork?.manuscriptPages != null) {
    parts.push(`원고 ${card.lastWork.manuscriptPages}p`);
  }
  if (card.formatLabel) {
    parts.push(card.formatLabel);
  }
  return parts.join(' · ');
}

const PILLAR_META = [
  { key: 'spelling', label: '맞춤법' },
  { key: 'consistency', label: '표기 통일' },
  { key: 'auxiliary', label: '본용언(-아/어) + 보조용언' },
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

/** 라이브러리 필터에 항상 보이는 예시 태그 (시리즈는 접두 매칭) */
export const PROJECT_TAG_FILTER_PRESETS = Object.freeze([
  { id: '__series__', label: '시리즈' },
  { id: '국내서', label: '국내서' },
  { id: '영미서', label: '영미서' },
  { id: '문학', label: '문학' },
  { id: '비문학', label: '비문학' },
]);

/**
 * @param {ProjectCardViewModel[]} cards
 * @returns {readonly { id: string | null, label: string }[]}
 */
export function buildProjectTagFilterOptions(cards) {
  /** @type {{ id: string | null, label: string }[]} */
  const options = [{ id: null, label: '전체' }];
  const seenLabels = new Set(['전체']);

  for (const preset of PROJECT_TAG_FILTER_PRESETS) {
    options.push({ id: preset.id, label: preset.label });
    seenLabels.add(preset.label);
  }

  const tags = collectProjectTags(cards);
  for (const tag of tags) {
    if (tag.startsWith('시리즈')) continue;
    if (seenLabels.has(tag)) continue;
    options.push({ id: tag, label: tag });
    seenLabels.add(tag);
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
