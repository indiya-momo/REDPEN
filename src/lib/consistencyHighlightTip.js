import { formatConsistencyListLabel } from './patternDisplayLabels.js';
import {
  getConsistencyUnifyPinnedTailWord,
  isConsistencyUnifyTailWord,
} from './consistencyUnifyRegister.js';
import { AUXILIARY_VERB_BADGE_LABEL } from './bonBojoRules.js';
import { LITERAL_FIND_FEATURE_LABEL } from './consistencyRuleLimit.js';

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
 * PDF 하이라이트·결과 카드 안내 — 일관성·통일형·공통 문자열·본용언+보조용언 구분
 * @param {import('./ruleEngine.js').GroupedResult} group
 * @param {import('./ruleTypes.js').Rule[]} [customRules]
 */
export function getConsistencyHighlightTip(group, customRules = []) {
  const explicit = (group.tip || '').trim();
  if (explicit) return explicit;

  const { badge, label } = getConsistencyResultCardParts(group, customRules);
  if (!label) return badge || '';
  return `${badge} : ${label}`;
}

/**
 * 결과 카드 한 줄 — 배지(일관성·통일형·공통 문자열 찾기·본용언 + 보조용언) + 등록 문자열
 * @param {import('./ruleEngine.js').GroupedResult} group
 * @param {import('./ruleTypes.js').Rule[]} [customRules]
 * @returns {{ badge: string, label: string }}
 */
export function getConsistencyResultCardParts(group, customRules = []) {
  if (group.patternKind === 'phrase-slot-find') {
    return {
      badge: '공통 문자열 찾기',
      label: consistencyFindDisplayLabel(group),
    };
  }

  if (group.patternKind === 'auxiliary-verb') {
    return {
      badge: AUXILIARY_VERB_BADGE_LABEL,
      label: auxiliaryItemTitle(group),
    };
  }

  const label = consistencyFindDisplayLabel(group);
  const tail = group.tailWord?.trim();
  const isUnify = isConsistencyUnifyTailWord(customRules, tail);
  const pinnedTail = getConsistencyUnifyPinnedTailWord(customRules);
  const showPin = isUnify && tail && pinnedTail === tail;

  return {
    badge: isUnify ? '통일형 찾기' : LITERAL_FIND_FEATURE_LABEL,
    label: showPin ? `${label} 📌` : label,
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
