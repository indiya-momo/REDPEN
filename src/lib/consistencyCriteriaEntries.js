import {
  isConsistencyEntryEnabled,
  listConsistencyLiteralEntries,
  toggleConsistencyEntry,
} from './compoundPairRegister.js';
import { listConsistencyUnifyEntries } from './consistencyRuleLimit.js';
import {
  isPhraseSlotEntryEnabled,
  listPhraseSlotEntries,
  togglePhraseSlotEntry,
} from './phraseSlotRegister.js';

const COMPOUND_KINDS = new Set([
  'compound-find',
  'compound-tail',
  'compound-spacing',
]);

/**
 * @param {import('./ruleTypes.js').Rule[]} customRules
 */
function listConsistencyTailWordsFromRules(customRules) {
  /** @type {{ tailWord: string }[]} */
  const entries = [];
  const seen = new Set();

  for (const rule of customRules ?? []) {
    const tailWord = rule.tailWord?.trim();
    if (!tailWord || seen.has(tailWord)) continue;
    const kind = rule.patternKind ?? '';
    if (kind === 'phrase-slot-find' || COMPOUND_KINDS.has(kind)) {
      seen.add(tailWord);
      entries.push({ tailWord });
    }
  }

  return entries;
}

/**
 * @param {import('./projectCardViewModel.js').ProjectCardChip[]} [chips]
 * @returns {{ tailWord: string, displayLabel?: string }[]}
 */
export function listConsistencyEntriesFromChipPreview(chips) {
  /** @type {{ tailWord: string, displayLabel?: string }[]} */
  const entries = [];
  const seen = new Set();
  for (const chip of chips ?? []) {
    const label = String(chip.label ?? '').trim();
    if (!label || seen.has(label)) continue;
    seen.add(label);
    entries.push({ tailWord: label, displayLabel: label });
  }
  return entries;
}

/**
 * 표기 통일(마이페이지·카드·검수) — 등록된 토글 항목 전체.
 *
 * @param {import('./ruleTypes.js').Rule[]} customRules
 * @param {import('./projectCardViewModel.js').ProjectCardChip[]} [chipPreview]
 */
export function listConsistencyCriteriaEntries(customRules, chipPreview) {
  /** @type {{ tailWord: string, displayLabel?: string }[]} */
  const entries = [];
  const seen = new Set();

  function add(entry) {
    const tailWord = entry.tailWord?.trim();
    if (!tailWord || seen.has(tailWord)) return;
    seen.add(tailWord);
    entries.push({
      tailWord,
      ...(entry.displayLabel ? { displayLabel: entry.displayLabel } : {}),
    });
  }

  for (const entry of listConsistencyLiteralEntries(customRules)) add(entry);
  for (const entry of listConsistencyUnifyEntries(customRules)) add(entry);
  for (const entry of listPhraseSlotEntries(customRules)) add(entry);
  for (const entry of listConsistencyTailWordsFromRules(customRules)) add(entry);
  for (const entry of listConsistencyEntriesFromChipPreview(chipPreview)) add(entry);

  return entries.sort((a, b) =>
    (a.displayLabel || a.tailWord).localeCompare(
      b.displayLabel || b.tailWord,
      'ko',
    ),
  );
}

/** @param {import('./ruleTypes.js').Rule[]} rules @param {{ tailWord: string }} row */
function isPhraseSlotRow(rules, row) {
  return listPhraseSlotEntries(rules).some(
    (entry) => entry.tailWord === row.tailWord,
  );
}

/**
 * @param {import('./ruleTypes.js').Rule[]} rules
 * @param {{ tailWord: string }} row
 */
export function isConsistencyCriteriaEntryEnabled(rules, row) {
  if (isPhraseSlotRow(rules, row)) {
    return isPhraseSlotEntryEnabled(rules, row.tailWord);
  }
  return isConsistencyEntryEnabled(rules, row.tailWord);
}

/**
 * @param {import('./ruleTypes.js').Rule[]} rules
 * @param {{ tailWord: string }} row
 * @param {boolean} enabled
 */
export function toggleConsistencyCriteriaEntry(rules, row, enabled) {
  if (isPhraseSlotRow(rules, row)) {
    return togglePhraseSlotEntry(rules, row.tailWord, enabled);
  }
  return toggleConsistencyEntry(rules, row.tailWord, enabled);
}

/**
 * 카드·네비 건수 — 활성 항목만 (본보조와 동일 기준).
 *
 * @param {import('./ruleTypes.js').Rule[]} customRules
 * @returns {{ find: number, commonString: number, total: number }}
 */
export function countActiveConsistencyCriteria(customRules) {
  const find =
    listConsistencyLiteralEntries(customRules).filter((entry) =>
      isConsistencyEntryEnabled(customRules, entry.tailWord),
    ).length +
    listConsistencyUnifyEntries(customRules).filter((entry) =>
      isConsistencyEntryEnabled(customRules, entry.tailWord),
    ).length;
  const commonString = listPhraseSlotEntries(customRules).filter((entry) =>
    isPhraseSlotEntryEnabled(customRules, entry.tailWord),
  ).length;
  return { find, commonString, total: find + commonString };
}

/** @deprecated listConsistencyCriteriaEntries 사용 */
export const listProjectHubConsistencyEntries = listConsistencyCriteriaEntries;

/** @deprecated isConsistencyCriteriaEntryEnabled 사용 */
export const isProjectHubConsistencyEntryEnabled =
  isConsistencyCriteriaEntryEnabled;

/** @deprecated toggleConsistencyCriteriaEntry 사용 */
export const toggleProjectHubConsistencyEntry = toggleConsistencyCriteriaEntry;
