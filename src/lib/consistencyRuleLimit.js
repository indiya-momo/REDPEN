import { listPhraseSlotEntries } from './phraseSlotRegister.js';

/** 공통 문자열 찾기(@ 패턴) 등록 상한 */
export const MAX_PHRASE_SLOT_REGISTERED_ENTRIES = 8;

/**
 * @param {import('./ruleTypes.js').Rule[]} customRules
 */
export function countPhraseSlotRegisteredEntries(customRules) {
  return listPhraseSlotEntries(customRules).length;
}

/**
 * @param {number} current
 * @param {number} adding
 */
export function phraseSlotRegistrationBlockedMessage(current, adding = 1) {
  const max = MAX_PHRASE_SLOT_REGISTERED_ENTRIES;
  if (adding > 1) {
    return `공통 문자열 찾기는 최대 ${max}개까지 등록할 수 있습니다(1회 검수 8개 이내 추천). (현재 ${current}개, ${adding}개 추가 시도)`;
  }
  return `공통 문자열 찾기는 최대 ${max}개까지 등록할 수 있습니다(1회 검수 8개 이내 추천). (현재 ${current}개)`;
}

/**
 * @param {import('./ruleTypes.js').Rule[]} customRules
 * @param {number} newEntryCount
 */
export function canAddPhraseSlotRegisteredEntries(customRules, newEntryCount) {
  if (newEntryCount <= 0) return true;
  const current = countPhraseSlotRegisteredEntries(customRules);
  return current + newEntryCount <= MAX_PHRASE_SLOT_REGISTERED_ENTRIES;
}
