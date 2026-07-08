import { listConsistencyLiteralEntries } from '../lib/compoundPairRegister.js';
import { getConsistencyUnifyPinnedTailWord } from '../lib/consistencyUnifyRegister.js';
import { listConsistencyUnifyEntries } from '../lib/consistencyRuleLimit.js';
import { listPhraseSlotEntries } from '../lib/phraseSlotRegister.js';
import { formatConsistencyListLabel } from '../lib/patternDisplayLabels.js';

/** @typedef {{ label: string, pinned: boolean }} WorkHistoryUnifyCriterion */

/**
 * @param {import('../lib/ruleTypes.js').Rule[]} customRules
 * @param {string[] | undefined} globalExcludePhrases
 */
export function buildWorkHistoryConsistencyCriteria(
  customRules,
  globalExcludePhrases,
) {
  const find = listConsistencyLiteralEntries(customRules ?? []).map(
    (entry) => formatConsistencyListLabel(entry.tailWord),
  );

  const pinnedTailWord = getConsistencyUnifyPinnedTailWord(customRules ?? []);
  /** @type {WorkHistoryUnifyCriterion[]} */
  const unify = listConsistencyUnifyEntries(customRules ?? []).map((entry) => ({
    label: formatConsistencyListLabel(entry.tailWord),
    pinned: pinnedTailWord === entry.tailWord,
  }));

  const commonString = listPhraseSlotEntries(customRules ?? []).map((entry) =>
    formatConsistencyListLabel(entry.tailWord),
  );

  const exclude = (globalExcludePhrases ?? [])
    .map((phrase) => String(phrase ?? '').trim())
    .filter(Boolean);

  return { find, unify, commonString, exclude };
}

/** @type {{ id: 'find' | 'unify' | 'commonString' | 'exclude', label: string }[]} */
export const WORK_HISTORY_CONSISTENCY_GROUPS = [
  { id: 'find', label: '찾기 항목' },
  { id: 'unify', label: '통일형' },
  { id: 'commonString', label: '공통 문자열' },
  { id: 'exclude', label: '제외 항목' },
];
