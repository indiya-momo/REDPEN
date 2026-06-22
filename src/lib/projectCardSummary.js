import {
  countBuiltInActiveRules,
  countSpacingReviewActiveRules,
} from './activeRuleCount.js';
import {
  isConsistencyEntryEnabled,
  listConsistencyEntries,
} from './compoundPairRegister.js';
import {
  isPhraseSlotEntryEnabled,
  listPhraseSlotEntries,
} from './phraseSlotRegister.js';
import {
  isAuxiliaryVerbEntryEnabled,
  listAuxiliaryVerbEntries,
} from './auxiliaryVerbRegister.js';
import { formatRuleSetSavedDate } from './ruleSetsStorage.js';

/** 값이 없을 때 표시할 라벨 */
export const PROJECT_CARD_NONE_LABEL = '없음';

/**
 * 등록된 문자열 목록을 카드 표시용 한 줄로 합친다.
 * 비어 있으면 '없음'.
 * @param {string[]} values
 * @returns {string}
 */
function joinOrNone(values) {
  const cleaned = (values ?? [])
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean);
  return cleaned.length ? cleaned.join(', ') : PROJECT_CARD_NONE_LABEL;
}

/**
 * 사용자가 실제로 선택(활성)한 단어 목록을 '"대표단어" 포함 N건' 형태로 만든다.
 * 1건이면 '"단어" N건', 선택한 항목이 없으면 '없음'.
 * 따옴표 안의 대표단어는 선택된 항목 중 첫 단어다.
 * @param {string[]} words 선택(활성)된 항목의 표시 단어
 * @returns {string}
 */
function formatEntrySummary(words) {
  const cleaned = (words ?? [])
    .map((w) => (typeof w === 'string' ? w.trim() : ''))
    .filter(Boolean);
  const count = cleaned.length;
  if (count === 0) return PROJECT_CARD_NONE_LABEL;
  const first = cleaned[0];
  return count > 1 ? `"${first}" 포함 ${count}건` : `"${first}" ${count}건`;
}

/**
 * @typedef {{
 *   savedDate: string,
 *   spelling: { editorReview: number, spelling: number },
 *   consistency: { find: string, commonString: string, excludeWords: string },
 *   auxiliary: string,
 * }} ProjectCardSummary
 */

/**
 * 저장된 프로젝트(RuleSet) 한 건을 마이페이지 카드 표시용 구조로 변환한다.
 *
 * 맞춤법 개수는 검수 시작 팝업과 동일한 함수를 재사용한다. 일관성 찾기·공통
 * 문자열 찾기·본용언+보조용언은 사용자가 선택(활성)한 항목만 세고, 대표단어도
 * 선택된 항목에서 뽑는다. 선택·입력이 없으면 '없음'으로 표시한다.
 *
 * @param {import('./ruleSetsStorage.js').RuleSet} set
 * @returns {ProjectCardSummary}
 */
export function buildProjectCardSummary(set) {
  const customRules = set?.customRules ?? [];

  const consistencyWords = listConsistencyEntries(customRules)
    .filter((entry) => isConsistencyEntryEnabled(customRules, entry.tailWord))
    .map((entry) => entry.tailWord);
  const commonStringWords = listPhraseSlotEntries(customRules)
    .filter((entry) => isPhraseSlotEntryEnabled(customRules, entry.tailWord))
    .map((entry) => entry.tailWord);
  const auxiliaryWords = listAuxiliaryVerbEntries(customRules)
    .filter((entry) => isAuxiliaryVerbEntryEnabled(customRules, entry))
    .map((entry) => entry.displayLabel || entry.tailWord);

  return {
    savedDate: formatRuleSetSavedDate(set?.savedAt),
    spelling: {
      editorReview: countSpacingReviewActiveRules({
        cautionEnabled: set?.cautionEnabled,
      }),
      spelling: countBuiltInActiveRules({
        builtInEnabled: set?.builtInEnabled,
      }),
    },
    consistency: {
      find: formatEntrySummary(consistencyWords),
      commonString: formatEntrySummary(commonStringWords),
      excludeWords: joinOrNone(set?.globalExcludePhrases ?? []),
    },
    auxiliary: formatEntrySummary(auxiliaryWords),
  };
}
