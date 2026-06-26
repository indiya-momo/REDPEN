import { listConsistencyLiteralEntries } from './compoundPairRegister.js';
import { listPhraseSlotEntries } from './phraseSlotRegister.js';

/** UI 표기 — 쉼표로 여러 표기를 등록해 찾기 */
export const LITERAL_FIND_FEATURE_LABEL = '여러 개 찾기';

/** 여러 개 찾기 — 등록 상한 (쉼표 항목마다 1건) */
export const MAX_CONSISTENCY_CRITERIA_SLOTS = 5;

/** 통일형 만들기 — 등록 상한 (쉼표 항목마다 1건) */
export const MAX_CONSISTENCY_UNIFY_SLOTS = 3;

/** 공통 문자열 찾기(@ 패턴) 등록 상한 */
export const MAX_PHRASE_SLOT_REGISTERED_ENTRIES = 1;

/** 검수 제외 항목 등록 상한 */
export const MAX_GLOBAL_EXCLUDE_REGISTERED_ENTRIES = 1;

const COMPOUND_LITERAL_KINDS = new Set([
  'compound-find',
  'compound-tail',
  'compound-spacing',
]);

/**
 * @param {import('./ruleTypes.js').Rule[]} customRules
 */
export function countConsistencyUnifyRegisteredEntries(customRules) {
  const seen = new Set();
  let count = 0;

  for (const rule of customRules) {
    if (!rule.consistencyUnifyEntry && !rule.consistencyUnifyPinned) continue;
    const tailWord = rule.tailWord?.trim();
    if (
      !tailWord ||
      !COMPOUND_LITERAL_KINDS.has(rule.patternKind ?? '') ||
      seen.has(tailWord)
    ) {
      continue;
    }
    seen.add(tailWord);
    count += 1;
  }

  return count;
}

/**
 * @param {import('./ruleTypes.js').Rule[]} customRules
 */
export function listConsistencyUnifyEntries(customRules) {
  const seen = new Set();
  /** @type {{ tailWord: string }[]} */
  const entries = [];

  for (const rule of customRules) {
    if (!rule.consistencyUnifyEntry && !rule.consistencyUnifyPinned) continue;
    const tailWord = rule.tailWord?.trim();
    if (
      !tailWord ||
      !COMPOUND_LITERAL_KINDS.has(rule.patternKind ?? '') ||
      seen.has(tailWord)
    ) {
      continue;
    }
    seen.add(tailWord);
    entries.push({ tailWord });
  }

  return entries;
}

/**
 * @param {import('./ruleTypes.js').Rule[]} customRules
 */
export function countConsistencyLiteralRegisteredEntries(customRules) {
  return listConsistencyLiteralEntries(customRules).length;
}

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
export function consistencyLiteralRegistrationBlockedMessage(current, adding = 0) {
  const max = MAX_CONSISTENCY_CRITERIA_SLOTS;
  const total = current + adding;
  const over = Math.max(0, total - max);
  return `${LITERAL_FIND_FEATURE_LABEL}는 ${max}개까지 등록할 수 있습니다(현재 ${total}개, ${over}개 초과)`;
}

/**
 * @param {number} current
 * @param {number} adding
 */
export function consistencyUnifyRegistrationBlockedMessage(current, adding = 0) {
  const max = MAX_CONSISTENCY_UNIFY_SLOTS;
  const total = current + adding;
  const over = Math.max(0, total - max);
  return `통일형 만들기는 ${max}개까지 등록할 수 있습니다(현재 ${total}개, ${over}개 초과)`;
}

/**
 * @param {number} current
 * @param {number} adding
 */
export function phraseSlotRegistrationBlockedMessage(current, adding = 1) {
  const max = MAX_PHRASE_SLOT_REGISTERED_ENTRIES;
  if (adding > 1) {
    return `공통 문자열 찾기는 최대 ${max}항목까지 등록할 수 있습니다. (현재 ${current}항목, ${adding}항목 추가 시도)`;
  }
  return `공통 문자열 찾기는 최대 ${max}항목까지 등록할 수 있습니다. (현재 ${current}항목)`;
}

/**
 * @param {number} current
 * @param {number} adding
 */
export function globalExcludeRegistrationBlockedMessage(current, adding = 1) {
  const max = MAX_GLOBAL_EXCLUDE_REGISTERED_ENTRIES;
  if (adding > 1) {
    return `검수 제외 항목은 최대 ${max}항목까지 등록할 수 있습니다. (현재 ${current}항목, ${adding}항목 추가 시도)`;
  }
  return `검수 제외 항목은 최대 ${max}항목까지 등록할 수 있습니다. (현재 ${current}항목)`;
}

/**
 * @param {import('./ruleTypes.js').Rule[]} customRules
 * @param {number} newEntryCount
 */
export function canAddConsistencyLiteralRegisteredEntries(
  customRules,
  newEntryCount,
) {
  if (newEntryCount <= 0) return true;
  const current = countConsistencyLiteralRegisteredEntries(customRules);
  return current + newEntryCount <= MAX_CONSISTENCY_CRITERIA_SLOTS;
}

/**
 * @param {import('./ruleTypes.js').Rule[]} customRules
 * @param {number} newEntryCount
 */
export function canAddConsistencyUnifyRegisteredEntries(
  customRules,
  newEntryCount,
) {
  if (newEntryCount <= 0) return true;
  const current = countConsistencyUnifyRegisteredEntries(customRules);
  return current + newEntryCount <= MAX_CONSISTENCY_UNIFY_SLOTS;
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

/**
 * @param {number} currentCount
 * @param {number} newEntryCount
 */
export function canAddGlobalExcludeRegisteredEntries(
  currentCount,
  newEntryCount,
) {
  if (newEntryCount <= 0) return true;
  return (
    currentCount + newEntryCount <= MAX_GLOBAL_EXCLUDE_REGISTERED_ENTRIES
  );
}
