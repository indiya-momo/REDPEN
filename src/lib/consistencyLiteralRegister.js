import { hasCompoundFind } from './compoundFindPattern.js';
import {
  buildRulesForEntry,
  isLiteralConsistencyEntry,
  normalizeConsistencyVariant,
  planConsistencyEntries,
  parseConsistencyInput,
} from './compoundPairRegister.js';
import { isPhraseSlotPattern } from './phraseSlotPattern.js';
import {
  canAddConsistencyLiteralRegisteredEntries,
  canAddConsistencyUnifyRegisteredEntries,
  consistencyLiteralRegistrationBlockedMessage,
  consistencyUnifyRegistrationBlockedMessage,
  countConsistencyLiteralRegisteredEntries,
  countConsistencyUnifyRegisteredEntries,
  MAX_CONSISTENCY_CRITERIA_SLOTS,
  MAX_CONSISTENCY_UNIFY_SLOTS,
} from './consistencyRuleLimit.js';

const COMPOUND_LITERAL_KINDS = new Set([
  'compound-find',
  'compound-tail',
  'compound-spacing',
]);

/**
 * @typedef {{
 *   maxSlots: number,
 *   countEntries: (rules: import('./ruleTypes.js').Rule[]) => number,
 *   canAddEntries: (rules: import('./ruleTypes.js').Rule[], adding: number) => boolean,
 *   blockedMessage: (current: number, adding?: number) => string,
 *   emptyInputMessage: string,
 *   markUnifyEntry?: boolean,
 * }} ConsistencyLiteralRegisterOptions
 */

/** @type {ConsistencyLiteralRegisterOptions} */
const LITERAL_REGISTER_OPTIONS = {
  maxSlots: MAX_CONSISTENCY_CRITERIA_SLOTS,
  countEntries: countConsistencyLiteralRegisteredEntries,
  canAddEntries: canAddConsistencyLiteralRegisteredEntries,
  blockedMessage: consistencyLiteralRegistrationBlockedMessage,
  emptyInputMessage: '문자열을 입력하세요.',
};

/** @type {ConsistencyLiteralRegisterOptions} */
const UNIFY_REGISTER_OPTIONS = {
  maxSlots: MAX_CONSISTENCY_UNIFY_SLOTS,
  countEntries: countConsistencyUnifyRegisteredEntries,
  canAddEntries: canAddConsistencyUnifyRegisteredEntries,
  blockedMessage: consistencyUnifyRegistrationBlockedMessage,
  emptyInputMessage: '문자열을 입력하세요.',
  markUnifyEntry: true,
};

/**
 * @param {import('./ruleTypes.js').Rule[]} rules
 * @param {string} tailWord
 */
function promoteConsistencyUnifyEntry(rules, tailWord) {
  const tail = normalizeConsistencyVariant(tailWord);
  return rules.map((rule) => {
    if (
      COMPOUND_LITERAL_KINDS.has(rule.patternKind ?? '') &&
      rule.tailWord?.trim() === tail
    ) {
      return { ...rule, consistencyUnifyEntry: true };
    }
    return rule;
  });
}

/**
 * @param {import('./ruleTypes.js').Rule[]} rules
 * @param {string} tailWord
 */
function isConsistencyUnifyEntryRegistered(rules, tailWord) {
  const tail = normalizeConsistencyVariant(tailWord);
  return rules.some(
    (rule) =>
      rule.consistencyUnifyEntry &&
      COMPOUND_LITERAL_KINDS.has(rule.patternKind ?? '') &&
      rule.tailWord?.trim() === tail,
  );
}

/**
 * @param {string} input
 * @param {import('./ruleTypes.js').Rule[]} customRules
 * @param {(next: import('./ruleTypes.js').Rule[]) => boolean} onApplyRules
 * @param {ConsistencyLiteralRegisterOptions} options
 * @returns {boolean}
 */
function registerConsistencyLiteralBatchWithOptions(
  input,
  customRules,
  onApplyRules,
  options,
) {
  const currentCount = options.countEntries(customRules);
  const variants = parseConsistencyInput(input);
  if (!variants.length) {
    if (currentCount >= options.maxSlots) {
      alert(options.blockedMessage(currentCount, 0));
      return false;
    }
    alert(options.emptyInputMessage);
    return false;
  }

  let nextRules = customRules;
  let newEntryCount = 0;
  let changed = false;

  for (const raw of planConsistencyEntries(variants)) {
    if (!isLiteralConsistencyEntry(raw)) {
      if (isPhraseSlotPattern(raw)) {
        alert(`「${raw}」은 공통 문자열 찾기(1항목)에 등록하세요. (@)`);
      } else {
        alert(`등록할 수 없는 형식입니다: ${raw}`);
      }
      continue;
    }

    const tail = normalizeConsistencyVariant(raw);

    if (options.markUnifyEntry && hasCompoundFind(nextRules, tail)) {
      if (isConsistencyUnifyEntryRegistered(nextRules, tail)) continue;
      nextRules = promoteConsistencyUnifyEntry(nextRules, tail);
      newEntryCount += 1;
      changed = true;
      continue;
    }

    const batch = buildRulesForEntry(nextRules, tail).map((rule) => {
      if (options.markUnifyEntry) {
        return { ...rule, consistencyUnifyEntry: true };
      }
      return { ...rule, consistencyLiteralEntry: true };
    });
    if (!batch.length) continue;
    newEntryCount += 1;
    nextRules = [...nextRules, ...batch];
    changed = true;
  }

  if (!changed) {
    alert('입력한 항목은 모두 이미 등록되어 있거나 다른 칸에 넣어야 합니다.');
    return false;
  }

  if (!options.canAddEntries(customRules, newEntryCount)) {
    alert(options.blockedMessage(currentCount, newEntryCount));
    return false;
  }

  return onApplyRules(nextRules);
}

/**
 * 쉼표로 구분된 일관성 찾기 항목을 그대로 등록한다.
 *
 * @param {string} input
 * @param {import('./ruleTypes.js').Rule[]} customRules
 * @param {(next: import('./ruleTypes.js').Rule[]) => boolean} onApplyRules
 * @returns {boolean} 등록 성공 시 true(입력창 비우기용)
 */
export function registerConsistencyLiteralBatch(input, customRules, onApplyRules) {
  return registerConsistencyLiteralBatchWithOptions(
    input,
    customRules,
    onApplyRules,
    LITERAL_REGISTER_OPTIONS,
  );
}

/**
 * 쉼표로 구분된 통일형 만들기 항목을 그대로 등록한다(최대 3건).
 *
 * @param {string} input
 * @param {import('./ruleTypes.js').Rule[]} customRules
 * @param {(next: import('./ruleTypes.js').Rule[]) => boolean} onApplyRules
 * @returns {boolean}
 */
export function registerConsistencyUnifyBatch(input, customRules, onApplyRules) {
  return registerConsistencyLiteralBatchWithOptions(
    input,
    customRules,
    onApplyRules,
    UNIFY_REGISTER_OPTIONS,
  );
}
