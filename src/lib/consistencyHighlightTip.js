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
