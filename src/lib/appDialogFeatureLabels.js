/**
 * AppDialog 본문 — 기능·기준 항목명 강조용 라벨 목록(긴 것 우선 매칭)
 */

import {
  AUXILIARY_VERB_BADGE_LABEL,
  AUXILIARY_VERB_FEATURE_LABEL,
} from './bonBojoRules.js';
import {
  EDITOR_REVIEW_BADGE_LABEL,
  LOANWORD_BADGE_LABEL,
  SPELLING_RULE_BADGE_LABEL,
} from './checkResultSummaryFormat.js';
import {
  LITERAL_FIND_FEATURE_LABEL,
  UNIFY_FEATURE_LABEL,
} from './consistencyRuleLimit.js';

/** @type {readonly string[]} */
export const APP_DIALOG_FEATURE_LABELS = Object.freeze(
  [
    AUXILIARY_VERB_FEATURE_LABEL,
    AUXILIARY_VERB_BADGE_LABEL,
    EDITOR_REVIEW_BADGE_LABEL,
    SPELLING_RULE_BADGE_LABEL,
    LOANWORD_BADGE_LABEL,
    LITERAL_FIND_FEATURE_LABEL,
    UNIFY_FEATURE_LABEL,
    '공통 항목 찾기',
    '검수 제외 항목',
    '전체 발견',
    '표기 통일 검수',
    '맞춤법 검수',
  ]
    .filter((label, index, all) => label && all.indexOf(label) === index)
    .sort((a, b) => b.length - a.length),
);

/**
 * @param {string} value
 */
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** ≪프로젝트≫ 또는 기능 항목명 */
export function buildAppDialogHighlightPattern() {
  const labels = APP_DIALOG_FEATURE_LABELS.map(escapeRegExp).join('|');
  return new RegExp(`≪([^≫]+)≫|(${labels})`, 'g');
}
