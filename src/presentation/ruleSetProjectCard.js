import { buildCautionCheckRules, defaultCautionEnabled } from '../lib/cautionRules.js';
import {
  BUILT_IN_QUOTA_RULES,
  builtInEnabledFromSheet,
  isBuiltInRuleEnabled,
} from '../lib/builtInRules.js';
import { spellingRuleDisplayLabel } from '../lib/spellingRuleEntry.js';
import {
  isConsistencyEntryEnabled,
  listConsistencyLiteralEntries,
} from '../lib/compoundPairRegister.js';
import { countActiveConsistencyCriteria } from '../lib/consistencyCriteriaEntries.js';
import { listConsistencyUnifyEntries } from '../lib/consistencyRuleLimit.js';
import {
  isPhraseSlotEntryEnabled,
  listPhraseSlotEntries,
} from '../lib/phraseSlotRegister.js';
import {
  isAuxiliaryVerbEntryEnabled,
  listAuxiliaryVerbEntries,
} from '../lib/auxiliaryVerbRegister.js';
import { buildProjectCardSummary } from '../lib/projectCardSummary.js';
import { criteriaNameForInput } from '../lib/criteriaName.js';
import { formatProjectCardDotDateFromIso } from './projectCardViewModel.js';
import { normalizeProjectTags } from '../lib/projectMeta.js';
import { buildWorkHistoryDecisionLedger } from './workHistoryDecisionLedger.js';
import { isRuleSetCriteriaDirty } from '../lib/criteriaCheckpoint.js';

/** @param {import('../lib/ruleSetsStorage.js').RuleSet} set */
function projectTitle(set) {
  const name = criteriaNameForInput(set?.name);
  return name || '이름 없는 프로젝트';
}

/** @param {import('../lib/ruleSetsStorage.js').RuleSet} set */
function buildSpellingChips(set) {
  /** @type {import('./projectCardViewModel.js').ProjectCardChip[]} */
  const chips = [];
  const builtInEnabled = set.builtInEnabled ?? builtInEnabledFromSheet();
  for (const rule of BUILT_IN_QUOTA_RULES) {
    if (!isBuiltInRuleEnabled(builtInEnabled, rule)) continue;
    chips.push({ label: spellingRuleDisplayLabel(rule), active: true });
  }
  const cautionEnabled = set.cautionEnabled ?? defaultCautionEnabled();
  for (const rule of buildCautionCheckRules(cautionEnabled)) {
    chips.push({
      label: rule.displayLabel || rule.label,
      active: true,
    });
  }
  return chips;
}

/** @param {import('../lib/ruleTypes.js').Rule[]} customRules */
function buildConsistencyChips(customRules) {
  /** @type {import('./projectCardViewModel.js').ProjectCardChip[]} */
  const chips = [];
  for (const entry of listConsistencyLiteralEntries(customRules)) {
    chips.push({
      label: entry.tailWord,
      active: isConsistencyEntryEnabled(customRules, entry.tailWord),
    });
  }
  for (const entry of listConsistencyUnifyEntries(customRules)) {
    chips.push({
      label: entry.tailWord,
      active: isConsistencyEntryEnabled(customRules, entry.tailWord),
    });
  }
  for (const entry of listPhraseSlotEntries(customRules)) {
    chips.push({
      label: entry.tailWord,
      active: isPhraseSlotEntryEnabled(customRules, entry.tailWord),
    });
  }
  return chips;
}

/** @param {import('../lib/ruleTypes.js').Rule[]} customRules */
function buildAuxiliaryChips(customRules) {
  return listAuxiliaryVerbEntries(customRules).map((entry) => ({
    label: entry.displayLabel || entry.tailWord,
    active: isAuxiliaryVerbEntryEnabled(customRules, entry),
  }));
}

/**
 * @param {{
 *   editorReview: number,
 *   spelling: number,
 *   loanword?: number,
 *   find: number,
 *   commonString: number,
 *   auxiliary: number,
 * }} counts
 * @param {string[]} excludePhrases
 */
function buildHeadline(counts, excludePhrases) {
  /** @type {string[]} */
  const parts = [];
  const spellTotal =
    counts.editorReview + counts.spelling + (counts.loanword ?? 0);
  if (spellTotal > 0) parts.push(`맞춤법 ${spellTotal}건`);
  const consistencyTotal = counts.find + counts.commonString;
  if (consistencyTotal > 0) parts.push(`일관성 ${consistencyTotal}건`);
  if (counts.auxiliary > 0) parts.push(`본보조 ${counts.auxiliary}쌍`);
  const excludeCount = (excludePhrases ?? []).filter((p) => String(p).trim()).length;
  if (excludeCount > 0) parts.push(`검수 제외 ${excludeCount}개`);
  return parts.length
    ? parts.join(' · ')
    : '맞춤법·표기 통일 기준을 설정하세요';
}

/** @param {import('../lib/ruleSetsStorage.js').RuleSet} set */
function buildLastWork(set) {
  const ctx = set.projectContext;
  if (!ctx?.lastWorkedAt) return undefined;
  const date = formatProjectCardDotDateFromIso(ctx.lastWorkedAt);
  if (!date) return undefined;
  return {
    date,
    manuscriptPages:
      typeof ctx.pdfPageCount === 'number' ? ctx.pdfPageCount : undefined,
  };
}

/** @param {import('../lib/ruleSetsStorage.js').RuleSet} set */
function buildCreatedDate(set) {
  if (!set.savedAt) return undefined;
  return formatProjectCardDotDateFromIso(set.savedAt) || undefined;
}

/**
 * 저장된 RuleSet → Library 카드 ViewModel (로컬·클라oud hydrate 데이터용).
 *
 * @param {import('../lib/ruleSetsStorage.js').RuleSet} set
 * @param {{ isActive?: boolean }} [options]
 * @returns {import('./projectCardViewModel.js').ProjectCardViewModel}
 */
export function buildProjectCardViewModelFromRuleSet(set, options = {}) {
  const customRules = set?.customRules ?? [];
  const summary = buildProjectCardSummary(set);

  const consistencyCounts = countActiveConsistencyCriteria(customRules);
  const auxiliaryWords = listAuxiliaryVerbEntries(customRules)
    .filter((entry) => isAuxiliaryVerbEntryEnabled(customRules, entry))
    .map((entry) => entry.displayLabel || entry.tailWord);

  const counts = {
    editorReview: summary.spelling.editorReview,
    spelling: summary.spelling.spelling,
    loanword: summary.spelling.loanword,
    find: consistencyCounts.find,
    commonString: consistencyCounts.commonString,
    auxiliary: auxiliaryWords.length,
  };

  const chipPreview = {
    spelling: buildSpellingChips(set),
    consistency: buildConsistencyChips(customRules),
    auxiliary: buildAuxiliaryChips(customRules),
  };

  return {
    id: set.id,
    title: projectTitle(set),
    tags: normalizeProjectTags(set.tags),
    memo: set.memo,
    pillarMemos: set.pillarMemos,
    headline: buildHeadline(counts, set.globalExcludePhrases),
    highlights: [],
    counts,
    chipPreview,
    lastWork: buildLastWork(set),
    createdDate: buildCreatedDate(set),
    formatLabel: set.projectContext?.formatLabel,
    savedDate: summary.savedDate,
    isActive: options.isActive === true,
    dirty: isRuleSetCriteriaDirty(set),
    decisionLedger: buildWorkHistoryDecisionLedger(set.consistencyDecisions),
  };
}
