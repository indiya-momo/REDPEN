import {
  auxiliaryVerbResultParts,
  formatConsistencyListLabel,
} from './patternDisplayLabels.js';

const LITERAL_PREFIX = '일관성 찾기 : ';
const AUXILIARY_PREFIX = '본용언 + 보조용언 : ';
/** @param {import('./ruleEngine.js').GroupedResult} group */
function auxiliaryItemTitle(group) {
  return group.groupDisplayLabel?.trim() || (group.label || '').trim();
}

/**
 * @param {import('./ruleEngine.js').GroupedResult} group
 */
function consistencyFindDisplayLabel(group) {
  if (group.tailWord?.trim()) {
    return formatConsistencyListLabel(group.tailWord);
  }
  const label = (group.label || '').trim();
  if (label) {
    const arrow = label.indexOf(' → ');
    if (arrow >= 0) return label.slice(0, arrow).trim();
    if (!label.startsWith('(?') && !label.includes('$0')) return label;
  }
  return formatConsistencyListLabel(group.find);
}

/**
 * PDF 하이라이트·결과 카드 안내 — 일관성 찾기 / 본용언 + 보조용언 형식 통일
 * @param {import('./ruleEngine.js').GroupedResult} group
 */
export function getConsistencyHighlightTip(group) {
  const explicit = (group.tip || '').trim();
  if (explicit) return explicit;

  if (group.patternKind === 'auxiliary-verb') {
    const itemLabel = auxiliaryItemTitle(group);
    if (itemLabel) return `${AUXILIARY_PREFIX}${itemLabel}`;
    const value = (group.label || '').trim();
    if (!value) return '';
    if (group.tailWord?.trim()) {
      const { stem, groupTag } = auxiliaryVerbResultParts(
        group.tailWord,
        group.groupDisplayLabel,
        group.label,
      );
      const tag = groupTag?.trim() || value;
      return stem
        ? `${AUXILIARY_PREFIX}${stem} ${tag}`
        : `${AUXILIARY_PREFIX}${tag}`;
    }
    return `${AUXILIARY_PREFIX}${value}`;
  }

  const registered = consistencyFindDisplayLabel(group);
  if (!registered) return '';
  return `${LITERAL_PREFIX}${registered}`;
}

/**
 * 결과 카드 한 줄 — 배지(일관성·공통 문자열·본용언 + 보조용언) + 등록 문자열
 * @param {import('./ruleEngine.js').GroupedResult} group
 * @returns {{ badge: string, label: string }}
 */
export function getConsistencyResultCardParts(group) {
  if (group.patternKind === 'phrase-slot-find') {
    return {
      badge: '공통 문자열',
      label: consistencyFindDisplayLabel(group),
    };
  }

  if (group.patternKind === 'auxiliary-verb') {
    return {
      badge: '본용언 + 보조용언',
      label: auxiliaryItemTitle(group),
    };
  }

  return {
    badge: '일관성',
    label: consistencyFindDisplayLabel(group),
  };
}

/**
 * @deprecated 카드 UI는 getConsistencyResultCardParts + 배지 컴포넌트 사용
 * @param {import('./ruleEngine.js').GroupedResult} group
 * @param {number} [_itemIndex]
 */
export function getConsistencyResultCardTitle(group, _itemIndex = 1) {
  const { badge, label } = getConsistencyResultCardParts(group);
  if (group.patternKind === 'auxiliary-verb') {
    return label ? `${badge} ${label}` : badge;
  }
  return label ? `${badge} ${label}` : badge;
}

/** @param {import('./ruleEngine.js').GroupedResult} group @param {string} source */
export function consistencyResultCardKey(group, source) {
  return `${source}-${group.label}-${group.find}`;
}

/**
 * @param {Array<{ group: import('./ruleEngine.js').GroupedResult, source: string }>} entries
 */
export function buildConsistencyItemIndexMap(entries) {
  const next = { literal: 0, commonString: 0, auxiliary: 0 };
  /** @type {Map<string, number>} */
  const map = new Map();
  for (const { group, source } of entries) {
    if (source !== 'consistency') continue;
    const bucket =
      group.patternKind === 'phrase-slot-find'
        ? 'commonString'
        : group.patternKind === 'auxiliary-verb'
          ? 'auxiliary'
          : 'literal';
    next[bucket] += 1;
    map.set(consistencyResultCardKey(group, source), next[bucket]);
  }
  return map;
}
