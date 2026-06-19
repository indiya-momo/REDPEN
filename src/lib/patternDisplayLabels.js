import { encodeSpacesVisible } from './spaceVisibleText.js';

/**
 * 일관성 목록·검사 결과 — 등록 문자열만 (˅ = 공백 위치)
 * @param {string} tailWord
 */
export function formatConsistencyListLabel(tailWord) {
  return encodeSpacesVisible(tailWord.trim());
}

/** @param {string} tail */
export function formatCompoundTailLabel(tail) {
  return formatConsistencyListLabel(tail);
}

/**
 * 일관성 검사 결과 — stem + 시트 display_label
 * @param {string} tailWord
 * @param {string} [groupDisplayLabel]
 */
export function formatAuxiliaryVerbResultLabel(tailWord, groupDisplayLabel) {
  const { stem, groupTag } = auxiliaryVerbResultParts(
    tailWord,
    groupDisplayLabel,
  );
  if (!groupTag) return stem;
  return `${stem} ${groupTag}`;
}

/**
 * @param {string} tailWord
 * @param {string} [groupDisplayLabel]
 * @param {string} [fullLabel]
 */
export function auxiliaryVerbResultParts(tailWord, groupDisplayLabel, fullLabel) {
  const stem = formatConsistencyListLabel(tailWord);
  let groupTag = groupDisplayLabel?.trim() || '';
  if (!groupTag && fullLabel?.trim()) {
    const m = fullLabel.trim().match(/\s+(\(.+\))\s*$/);
    if (m) groupTag = m[1];
  }
  return { stem, groupTag: groupTag || null };
}

/** @param {string} tail */
export function formatCompoundSpacingLabel(tail) {
  return formatConsistencyListLabel(tail);
}
